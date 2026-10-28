import { test, expect, type APIRequestContext } from "@playwright/test";
import { readFile } from "node:fs/promises";
const origin = "http://127.0.0.1:3002";
async function unlock(request: APIRequestContext) {
  const response = await request.post("/api/unlock", {
    headers: { Origin: origin },
    data: { passcode: "local-test-passcode-only" },
  });
  expect(response.status()).toBe(200);
  const header = response.headers()["set-cookie"];
  expect(header).toContain("HttpOnly");
  expect(header).toContain("Secure");
  expect(header.toLowerCase()).toContain("samesite=strict");
  return /everyday_session=([^;]+)/.exec(header)![1];
}
test.beforeEach(async ({ request }) => {
  expect((await request.post("http://127.0.0.1:4010/__reset")).ok()).toBe(true);
});
test("lessons are public while progress and writes reject forged cookies", async ({
  request,
}) => {
  const home = await request.get("/", { maxRedirects: 0 });
  expect(home.status()).toBe(200);
  expect(home.headers().location).toBeUndefined();
  expect(await home.text()).toContain("PRIVATE_LESSON_SENTINEL");
  expect(
    (
      await request.put("/api/progress", {
        headers: { Origin: origin, Cookie: "everyday_session=forged" },
        data: {
          state: { cards: [], dismissed: [], read: [], feedback: {} },
          revision: 0,
        },
      })
    ).status(),
  ).toBe(401);
  for (const route of ["/api/session", "/api/progress"])
    expect(
      (
        await request.get(route, {
          headers: { Cookie: "everyday_session=forged" },
        })
      ).status(),
    ).toBe(401);
  expect(
    (
      await request.post("/api/import", {
        headers: { Origin: origin },
        data: {},
      })
    ).status(),
  ).toBe(401);
  expect(
    (
      await request.post("/api/unlock", {
        headers: { Origin: "https://other.example" },
        data: { passcode: "local-test-passcode-only" },
      })
    ).status(),
  ).toBe(403);
});
test("wrong passcodes are limited persistently without exposing a session", async ({
  request,
}) => {
  for (let i = 0; i < 5; i++) {
    const response = await request.post("/api/unlock", {
      headers: { Origin: origin },
      data: { passcode: "wrong-passcode" },
    });
    expect(response.status()).toBe(401);
    expect(response.headers()["set-cookie"]).toBeUndefined();
  }
  const limited = await request.post("/api/unlock", {
    headers: { Origin: origin },
    data: { passcode: "local-test-passcode-only" },
  });
  expect(limited.status()).toBe(429);
  expect(limited.headers()["retry-after"]).toBe("900");
});
test("unlocked API scopes the library and progress to the configured learner, then locks", async ({
  request,
}) => {
  const token = await unlock(request);
  const headers = { Cookie: `everyday_session=${token}`, Origin: origin };
  const home = await request.get("/", { headers });
  expect(home.status()).toBe(200);
  const html = await home.text();
  expect(html).toContain("PRIVATE_LESSON_SENTINEL");
  expect(html).not.toContain("OTHER_LEARNER_SENTINEL");
  const state = {
    reviewedOn: "2026-10-27",
    cards: [],
    dismissed: [],
    read: ["private-read-marker"],
    feedback: {},
  };
  expect(
    (
      await request.put("/api/progress", {
        headers,
        data: { state, revision: 0 },
      })
    ).status(),
  ).toBe(200);
  const result = await request.get(
    "/api/progress?user_id=22222222-2222-4222-8222-222222222222",
    { headers },
  );
  expect((await result.json()).state).toEqual(state);
  const example = await readFile("public/example-lesson.json", "utf8");
  expect(
    (
      await request.post("/api/import", {
        headers: { ...headers, "Content-Type": "application/json" },
        data: example,
      })
    ).status(),
  ).toBe(201);
  expect(
    (
      await request.post("/api/import", {
        headers: { ...headers, "Content-Type": "application/json" },
        data: example,
      })
    ).status(),
  ).toBe(409);
  const lock = await request.post("/api/lock", { headers });
  expect(lock.status()).toBe(200);
  expect(lock.headers()["set-cookie"]).toContain("Max-Age=0");
  expect(
    (
      await request.get("/api/progress", {
        headers: { Cookie: "everyday_session=" },
      })
    ).status(),
  ).toBe(401);
});
test("reader creates cards, saves through the protected server API, and restores them on reload", async ({
  request,
  page,
}) => {
  const token = await unlock(request);
  // The production cookie is Secure (asserted above); localhost HTTP needs a
  // test-only equivalent so Chromium can exercise the protected reader.
  await page.context().addCookies([
    {
      name: "everyday_session",
      value: token,
      url: origin,
      httpOnly: true,
      secure: false,
      sameSite: "Strict",
    },
  ]);
  await page.goto("/");
  await openDailyLesson(page);
  await expect(page.locator(".lesson-heading h1")).toContainText(
    "PRIVATE_LESSON_SENTINEL",
  );
  const suggestion = page.locator(".suggestion-card").first();
  await suggestion
    .getByRole("button", { name: "Save flashcard", exact: true })
    .click();
  await expect
    .poll(async () => {
      const response = await request.get("/api/progress", {
        headers: { Cookie: `everyday_session=${token}` },
      });
      return (await response.json()).state.cards.length;
    })
    .toBe(1);
  await page.reload();
  await openDailyLesson(page);
  await expect(page.locator(".saved-card")).toHaveCount(1);
  await page
    .locator(".sidebar nav")
    .getByRole("button", { name: /^Review/ })
    .click();
  await page.getByRole("button", { name: "Start review" }).click();
  await page
    .getByRole("button", { name: "Reveal meaning", exact: true })
    .click();
  await expect(page.locator(".card-answer")).toBeVisible();
  expect(
    (
      await page.request.post("/api/lock", {
        headers: { Origin: origin },
      })
    ).status(),
  ).toBe(200);
  await page.reload();
  await openDailyLesson(page);
  await expect(page.locator(".lesson-heading h1")).toContainText(
    "PRIVATE_LESSON_SENTINEL",
  );
  await expect(
    page.getByRole("button", { name: "Enable editing", exact: true }),
  ).toBeVisible();
});

test("stale progress writes return a conflict and preserve the newer snapshot", async ({
  request,
}) => {
  const token = await unlock(request);
  const headers = { Cookie: `everyday_session=${token}`, Origin: origin };
  const state = { cards: [], dismissed: [], read: ["newer"], feedback: {} };
  const first = await request.put("/api/progress", {
    headers,
    data: { state, revision: 0 },
  });
  expect(first.status()).toBe(200);
  expect((await first.json()).revision).toBe(1);
  const stale = await request.put("/api/progress", {
    headers,
    data: { state: { ...state, read: [] }, revision: 0 },
  });
  expect(stale.status()).toBe(409);
  const result = await request.get("/api/progress", { headers });
  expect(await result.json()).toEqual({ state, revision: 1 });
  expect(
    (await request.put("/api/progress", { headers, data: state })).status(),
  ).toBe(400);
});

test("opening a reader does not save; overlapping edits are saved in order", async ({
  request,
  page,
}) => {
  const token = await unlock(request);
  await page.context().addCookies([
    {
      name: "everyday_session",
      value: token,
      url: origin,
      secure: false,
      httpOnly: true,
      sameSite: "Strict",
    },
  ]);
  let release!: () => void;
  const held = new Promise<void>((resolve) => {
    release = resolve;
  });
  let firstSeen!: () => void;
  const firstRequest = new Promise<void>((resolve) => {
    firstSeen = resolve;
  });
  const revisions: number[] = [];
  await page.route("**/api/progress", async (route) => {
    if (route.request().method() === "PUT") {
      revisions.push(route.request().postDataJSON().revision);
      if (revisions.length === 1) {
        firstSeen();
        await held;
      }
    }
    await route.continue();
  });
  await page.goto("/");
  await openDailyLesson(page);
  await expect(page.locator(".lesson-heading h1")).toBeVisible();
  await page.waitForTimeout(750); // Exceed the 500 ms debounce to detect mount-only writes.
  expect(revisions).toEqual([]);
  try {
    await page
      .locator(".suggestion-card")
      .first()
      .getByRole("button", { name: "Save flashcard", exact: true })
      .click();
    await firstRequest;
    await page
      .getByRole("button", { name: "Mark as read", exact: true })
      .click();
    await page.waitForTimeout(750);
    expect(revisions).toEqual([0]);
  } finally {
    release();
  }
  await expect
    .poll(async () => {
      const result = await request.get("/api/progress", {
        headers: { Cookie: `everyday_session=${token}` },
      });
      const { state, revision } = await result.json();
      return { cards: state.cards.length, read: state.read.length, revision };
    })
    .toEqual({ cards: 1, read: 1, revision: 2 });
  expect(revisions).toEqual([0, 1]);
});

test("another device's save blocks stale UI edits and keeps them available to export", async ({
  request,
  page,
}) => {
  const token = await unlock(request);
  await page.context().addCookies([
    {
      name: "everyday_session",
      value: token,
      url: origin,
      secure: false,
      httpOnly: true,
      sameSite: "Strict",
    },
  ]);
  await page.goto("/");
  await openDailyLesson(page);
  await expect(page.locator(".lesson-heading h1")).toBeVisible();
  const state = {
    cards: [],
    dismissed: [],
    read: ["other-device"],
    feedback: {},
  };
  expect(
    (
      await request.put("/api/progress", {
        headers: { Cookie: `everyday_session=${token}`, Origin: origin },
        data: { state, revision: 0 },
      })
    ).status(),
  ).toBe(200);
  await page.getByRole("button", { name: "Mark as read", exact: true }).click();
  await expect(page.locator(".warning")).toContainText(
    "Progress changed on another device",
  );
  await expect(page.getByRole("button", { name: "Retry sync" })).toHaveCount(0);
  await expect(
    page.getByRole("button", { name: "Lesson read", exact: true }),
  ).toBeVisible();
  const result = await request.get("/api/progress", {
    headers: { Cookie: `everyday_session=${token}` },
  });
  expect((await result.json()).state).toEqual(state);
  await page.context().clearCookies();
  await page.evaluate(() => window.dispatchEvent(new Event("focus")));
  await expect(
    page.getByRole("button", { name: "Export unsaved progress" }),
  ).toHaveCount(0);
  await expect(
    page.locator(".warning").getByRole("button", { name: "Enable editing" }),
  ).toBeVisible();
});
for (const viewport of [
  { width: 1280, height: 800 },
  { width: 390, height: 844 },
]) {
  test(`empty lessons offer import without phantom progress at ${viewport.width}px`, async ({
    request,
    page,
  }) => {
    await page.setViewportSize(viewport);
    expect(
      (await request.post("http://127.0.0.1:4010/__reset?empty=1")).ok(),
    ).toBe(true);
    const token = await unlock(request);
    await page.context().addCookies([
      {
        name: "everyday_session",
        value: token,
        url: origin,
        httpOnly: true,
        secure: false,
        sameSite: "Strict",
      },
    ]);
    await page.goto("/");
    await openDailyLesson(page);
    await openDailyLesson(page);
    await expect(
      page.getByRole("heading", { name: "No lessons yet" }),
    ).toBeVisible();
    await expect(
      page.locator(".reader-toolbar, .reading-complete, .suggestions"),
    ).toHaveCount(0);
    await expect(page.getByRole("button", { name: /settings/i })).toHaveCount(
      0,
    );
    await expect(page.getByText("Private cloud sync")).toHaveCount(0);
    await expect(page.locator(".brand-mark")).toHaveText("中");
    const nav = page.locator(
      viewport.width < 760 ? ".mobile-nav" : ".sidebar nav",
    );
    await nav.getByRole("button", { name: "Archive", exact: true }).click();
    await expect(page.locator(".breadcrumb")).toHaveText("Archive");
    await expect(
      page.getByRole("heading", { name: "No lessons yet" }),
    ).toBeVisible();
    await nav.getByRole("button", { name: "Today", exact: true }).click();
    await page
      .getByRole("button", { name: "Import your first lesson" })
      .click();
    await page
      .getByLabel("Lesson JSON")
      .fill(await readFile("public/example-lesson.json", "utf8"));
    await page
      .getByRole("button", { name: "Preview lesson", exact: true })
      .click();
    await page
      .getByRole("button", { name: "Save to archive", exact: true })
      .click();
    await expect(page.locator(".breadcrumb")).toHaveText("Today");
    await expect(page.locator(".lesson-heading h1")).toContainText("買得划算");
    await expect(
      page.getByRole("button", { name: "Show all pinyin" }),
    ).toBeVisible();
    await expect(
      page.getByRole("button", { name: "Mark as read", exact: true }),
    ).toBeVisible();
    await page.reload();
    await openDailyLesson(page);
    await openDailyLesson(page);
    await expect(page.locator(".lesson-heading h1")).toContainText("買得划算");
    const archive = nav.getByRole("button", { name: /^Archive\b/ });
    await expect(archive).toHaveText(/Archive\s*(?:·\s*)?1$/);
    await archive.click();
    await expect(page.locator(".library-summary")).toContainText("1 lesson");
    await expect(page.locator(".library-summary")).toContainText("0 read");
    const progress = await request.get("/api/progress", {
      headers: { Cookie: `everyday_session=${token}` },
    });
    expect((await progress.json()).state).toEqual({
      cards: [],
      dismissed: [],
      read: [],
      feedback: {},
    });
  });
}

test("keep reviewing retains a failed save, retries it, and persists both session reviews", async ({
  request,
  page,
}) => {
  const token = await unlock(request);
  await page.context().addCookies([
    {
      name: "everyday_session",
      value: token,
      url: origin,
      secure: false,
      httpOnly: true,
      sameSite: "Strict",
    },
  ]);
  const headers = { Cookie: `everyday_session=${token}` };
  await page.goto("/");
  await openDailyLesson(page);
  await page
    .locator(".suggestion-card")
    .first()
    .getByRole("button", { name: "Save flashcard", exact: true })
    .click();
  await expect
    .poll(
      async () =>
        (await (await request.get("/api/progress", { headers })).json()).state
          .cards.length,
    )
    .toBe(1);
  let failNext = true;
  const saveError =
    "Could not save your progress. Check your connection and retry.";
  await page.route("**/api/progress", async (route) => {
    if (route.request().method() === "PUT" && failNext) {
      failNext = false;
      await route.fulfill({
        status: 503,
        contentType: "application/json",
        body: JSON.stringify({ error: saveError }),
      });
    } else await route.continue();
  });
  await page
    .locator(".sidebar nav")
    .getByRole("button", { name: /^Review/ })
    .click();
  await page.getByRole("button", { name: "Start review", exact: true }).click();
  await page
    .getByRole("button", { name: "Reveal meaning", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Keep reviewing", exact: true })
    .click();
  await expect(page.locator(".warning")).toContainText(saveError);
  const failedSnapshot = await (
    await request.get("/api/progress", { headers })
  ).json();
  expect(failedSnapshot.state.cards[0].reviews).toBe(0);
  await page.getByRole("button", { name: "Retry sync", exact: true }).click();
  await expect(page.locator(".warning")).toHaveCount(0);
  await expect
    .poll(
      async () =>
        (await (await request.get("/api/progress", { headers })).json()).state
          .cards[0].reviews,
    )
    .toBe(1);
  await page
    .getByRole("button", { name: "Reveal meaning", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Keep reviewing", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "A little more familiar." }),
  ).toBeVisible();
  await expect
    .poll(
      async () =>
        (await (await request.get("/api/progress", { headers })).json()).state
          .cards[0].reviews,
    )
    .toBe(2);
  await page.reload();
  await openDailyLesson(page);
  await page
    .locator(".sidebar nav")
    .getByRole("button", { name: /^Review/ })
    .click();
  await page.getByRole("button", { name: "All", exact: true }).click();
  await expect(page.locator(".deck-list article")).toHaveCount(1);
  await expect(page.locator(".warning")).toHaveCount(0);
});

test("missing revision metadata keeps the authenticated library readable without unsafe saves", async ({
  request,
  page,
}) => {
  expect(
    (
      await request.post("http://127.0.0.1:4010/__reset?missing-revision=1")
    ).ok(),
  ).toBe(true);
  const token = await unlock(request);
  await page.context().addCookies([
    {
      name: "everyday_session",
      value: token,
      url: origin,
      secure: false,
      httpOnly: true,
      sameSite: "Strict",
    },
  ]);
  const response = await page.goto("/");
  await openDailyLesson(page);
  expect(response?.status()).toBe(200);
  await openDailyLesson(page);
  await expect(page.locator(".lesson-heading h1")).toContainText(
    "PRIVATE_LESSON_SENTINEL",
  );
  await expect(page.locator(".warning")).toContainText("Saving is unavailable");
  await expect(
    page.getByRole("button", { name: "Export unsaved progress" }),
  ).toBeVisible();
  let writes = 0;
  page.on("request", (req) => {
    if (req.url().endsWith("/api/progress") && req.method() === "PUT") writes++;
  });
  await page
    .locator(".suggestion-card")
    .first()
    .getByRole("button", { name: "Save flashcard", exact: true })
    .click();
  await page.waitForTimeout(750);
  expect(writes).toBe(0);
  const saved = await request.get("/api/progress", {
    headers: { Cookie: `everyday_session=${token}` },
  });
  expect(saved.status()).toBe(200);
  expect((await saved.json()).state.cards).toEqual([]);
  await request.post("http://127.0.0.1:4010/__reset");
  await page.reload();
  await openDailyLesson(page);
  await expect(page.locator(".warning")).toHaveCount(0);
});

test("public readers see lesson suggestions but never saved cards or personal progress", async ({
  request,
  page,
}) => {
  const token = await unlock(request);
  const example = JSON.parse(
    await readFile("lib/sample-lessons.json", "utf8"),
  )[1];
  const state = {
    cards: [
      {
        ...example.suggestions[0],
        id: "PRIVATE_CARD_ID",
        text: "PRIVATE_SAVED_CARD_SENTINEL",
        meaning: "PRIVATE_CARD_MEANING",
        lessonId: example.id,
        status: "active",
        dueAt: 0,
        reviews: 7,
        createdAt: 0,
      },
    ],
    dismissed: ["PRIVATE_DISMISS_SENTINEL"],
    read: ["PRIVATE_READ_SENTINEL"],
    feedback: {},
  };
  expect(
    (
      await request.put("/api/progress", {
        headers: { Cookie: `everyday_session=${token}`, Origin: origin },
        data: { state, revision: 0 },
      })
    ).status(),
  ).toBe(200);
  for (const headers of [{ Cookie: "" }, { Cookie: "", RSC: "1" }] as Record<
    string,
    string
  >[]) {
    const response = await page.request.get("/", { headers });
    expect(response.status()).toBe(200);
    const source = await response.text();
    expect(source).toContain("PRIVATE_LESSON_SENTINEL");
    for (const secret of [
      "PRIVATE_SAVED_CARD_SENTINEL",
      "PRIVATE_CARD_MEANING",
      "PRIVATE_READ_SENTINEL",
      "PRIVATE_DISMISS_SENTINEL",
      "local-integration-service-key-only",
    ])
      expect(source).not.toContain(secret);
  }
  let writes = 0;
  page.on("request", (req) => {
    if (
      req.method() === "PUT" ||
      (req.method() === "POST" && req.url().endsWith("/api/import"))
    )
      writes++;
  });
  await page.goto("/");
  await openDailyLesson(page);
  await expect(page.locator(".suggestion-card")).not.toHaveCount(0);
  await page
    .locator(".sidebar nav")
    .getByRole("button", { name: "Archive", exact: true })
    .click();
  await expect(page.locator(".read-status")).toHaveCount(0);
  await expect(page.locator(".library-summary")).not.toContainText("read");
  await expect(page.locator(".library-lesson")).not.toContainText(
    "saved cards",
  );
  await page
    .locator(".sidebar nav")
    .getByRole("button", { name: /^Review/ })
    .click();
  await expect(
    page.getByRole("heading", { name: "Your review deck is private" }),
  ).toBeVisible();
  await expect(page.locator(".deck-word")).toHaveCount(0);
  await page
    .locator(".sidebar nav")
    .getByRole("button", { name: "Today", exact: true })
    .click();
  const actions = [
    page.getByRole("button", { name: "Import lesson", exact: true }),
    page
      .locator(".suggestion-card")
      .first()
      .getByRole("button", { name: "Save flashcard", exact: true }),
    page
      .locator(".suggestion-card")
      .first()
      .getByRole("button", { name: /^Dismiss / }),
    page.getByRole("button", { name: "Mark as read", exact: true }),
    page.getByRole("button", { name: /^Save remaining/ }),
  ];
  for (const action of actions) {
    await action.click();
    const dialog = page
      .getByRole("dialog")
      .filter({ has: page.locator(".editing-access-form") });
    await expect(dialog.getByLabel("Password")).toBeVisible();
    await dialog
      .getByRole("button", { name: "Close dialog", exact: true })
      .click();
  }
  await page.locator(".suggestion-card").first().locator(":scope > p").click();
  await page.getByRole("button", { name: "Edit card", exact: true }).click();
  await expect(page.locator(".editing-access-form")).toBeVisible();
  await expect(page.getByLabel("Meaning in context")).toHaveCount(0);
  expect(writes).toBe(0);
});

test("password enables editing and locking returns to public reading", async ({
  page,
}) => {
  await page.goto("/");
  await openDailyLesson(page);
  await page
    .getByRole("button", { name: "Enable editing", exact: true })
    .click();
  const form = page.locator(".editing-access-form");
  await form.getByLabel("Password").fill("incorrect-password");
  await form
    .getByRole("button", { name: "Enable editing", exact: true })
    .click();
  await expect(form.getByRole("alert")).toContainText("Incorrect password");
  await form.getByLabel("Password").fill("local-test-passcode-only");
  await form
    .getByRole("button", { name: "Enable editing", exact: true })
    .click();
  await expect(
    page.getByRole("button", { name: "Lock editing", exact: true }),
  ).toBeVisible();
  await openDailyLesson(page);
  await page
    .getByRole("button", { name: "Import lesson", exact: true })
    .click();
  await expect(page.getByLabel("Lesson JSON")).toBeVisible();
  await page.getByRole("button", { name: "Close dialog", exact: true }).click();
  await page
    .locator(".suggestion-card")
    .first()
    .getByRole("button", { name: "Save flashcard", exact: true })
    .click();
  await expect(page.locator(".saved-card")).toHaveCount(1);
  await page.getByRole("button", { name: "Lock editing", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "Enable editing", exact: true }),
  ).toBeVisible();
  await openDailyLesson(page);
  await expect(page.locator(".lesson-heading h1")).toContainText(
    "PRIVATE_LESSON_SENTINEL",
  );
  await expect(page.locator(".saved-card")).toHaveCount(0);
  expect((await page.request.get("/api/progress")).status()).toBe(401);
});

test("expired editing access keeps reading available and pending changes survive reauthentication", async ({
  request,
  page,
}) => {
  const token = await unlock(request);
  await page.context().addCookies([
    {
      name: "everyday_session",
      value: token,
      url: origin,
      secure: false,
      httpOnly: true,
      sameSite: "Strict",
    },
  ]);
  await page.goto("/");
  await openDailyLesson(page);
  let expireNext = true;
  await page.route("**/api/progress", async (route) => {
    if (route.request().method() === "PUT" && expireNext) {
      expireNext = false;
      await page.context().clearCookies();
      await route.fulfill({
        status: 401,
        contentType: "application/json",
        body: JSON.stringify({
          error: "Enable editing with your password to continue.",
        }),
      });
    } else await route.continue();
  });
  await page.getByRole("button", { name: "Mark as read", exact: true }).click();
  await expect(page.locator(".warning")).toContainText(
    "Editing access expired",
  );
  await expect(page.locator(".lesson-heading h1")).toContainText(
    "PRIVATE_LESSON_SENTINEL",
  );
  expect((await page.request.get("/api/progress")).status()).toBe(401);
  await page.locator(".editing-trigger").click();
  const form = page.locator(".editing-access-form");
  await form.getByLabel("Password").fill("local-test-passcode-only");
  await form
    .getByRole("button", { name: "Enable editing", exact: true })
    .click();
  await expect(
    page.getByRole("button", { name: "Lock editing", exact: true }),
  ).toBeVisible();
  await expect(page.locator(".warning")).toHaveCount(0);
  await expect(
    page.getByRole("button", { name: "Lesson read", exact: true }),
  ).toBeVisible();
  await expect
    .poll(async () => {
      const response = await request.get("/api/progress", {
        headers: { Cookie: `everyday_session=${token}` },
      });
      return (await response.json()).state.read.length;
    })
    .toBe(1);
});
async function openDailyLesson(page: import("@playwright/test").Page) {
  const lesson = page.getByRole("button", {
    name: /Read (daily lesson|lesson again)/,
  });
  if (await lesson.count()) await lesson.click();
}

test("opening a library does not save it, and locking waits for the latest progress", async ({
  request,
  page,
}) => {
  const token = await unlock(request);
  await page.context().addCookies([
    {
      name: "everyday_session",
      value: token,
      url: origin,
      httpOnly: true,
      secure: false,
      sameSite: "Strict",
    },
  ]);
  let saves = 0;
  let release!: () => void;
  const gate = new Promise<void>((done) => {
    release = done;
  });
  await page.route("**/api/progress", async (route) => {
    if (route.request().method() === "PUT") {
      saves++;
      await gate;
    }
    await route.continue();
  });
  await page.goto("/");
  await openDailyLesson(page);
  await page.waitForTimeout(700);
  expect(saves).toBe(0);
  await page.getByRole("button", { name: "Mark as read", exact: true }).click();
  await expect.poll(() => saves).toBe(1);
  await page
    .locator(".suggestion-card")
    .first()
    .getByRole("button", { name: "Save flashcard", exact: true })
    .click();
  await page.getByRole("button", { name: "Lock editing", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "Saving and locking…" }),
  ).toBeDisabled();
  release();
  await expect(
    page.getByRole("button", { name: "Enable editing", exact: true }),
  ).toBeVisible();
  const state = (
    await (
      await request.get("/api/progress", {
        headers: { Cookie: `everyday_session=${token}` },
      })
    ).json()
  ).state;
  expect(state.read).toHaveLength(1);
  expect(state.cards).toHaveLength(1);
  expect(saves).toBe(2);
});

test("Escape leaves the import dialog open while a save is pending", async ({
  request,
  page,
}) => {
  const token = await unlock(request);
  await page.context().addCookies([
    {
      name: "everyday_session",
      value: token,
      url: origin,
      httpOnly: true,
      secure: false,
      sameSite: "Strict",
    },
  ]);
  let release!: () => void;
  const gate = new Promise<void>((done) => {
    release = done;
  });
  await page.route("**/api/import", async (route) => {
    await gate;
    await route.continue();
  });
  await page.goto("/");
  await openDailyLesson(page);
  await page
    .getByRole("button", { name: "Import lesson", exact: true })
    .click();
  await page
    .getByLabel("Lesson JSON")
    .fill(await readFile("public/example-lesson.json", "utf8"));
  await page
    .getByRole("button", { name: "Preview lesson", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Save to archive", exact: true })
    .click();
  await expect(
    page.getByRole("button", { name: "Saving…", exact: true }),
  ).toBeDisabled();
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog")).toBeVisible();
  release();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect(page.locator(".lesson-heading h1")).toContainText("買得划算");
});

test("a failed save keeps the app unlocked and locking can be retried", async ({
  request,
  page,
}) => {
  const token = await unlock(request);
  await page.context().addCookies([
    {
      name: "everyday_session",
      value: token,
      url: origin,
      httpOnly: true,
      secure: false,
      sameSite: "Strict",
    },
  ]);
  await page.route("**/api/progress", async (route) => {
    if (route.request().method() === "PUT")
      await route.fulfill({
        status: 503,
        json: { error: "Test save failure" },
      });
    else await route.continue();
  });
  let locks = 0;
  page.on("request", (request) => {
    if (request.url().endsWith("/api/lock")) locks++;
  });
  await page.goto("/");
  await openDailyLesson(page);
  await page.getByRole("button", { name: "Mark as read", exact: true }).click();
  const lockButton = page.getByRole("button", {
    name: "Lock editing",
    exact: true,
  });
  await lockButton.click();
  await expect(page.locator(".warning")).toContainText("Test save failure");
  await expect(lockButton).toBeEnabled();
  expect(locks).toBe(0);
  await page.unroute("**/api/progress");
  await lockButton.click();
  await expect(
    page.getByRole("button", { name: "Enable editing", exact: true }),
  ).toBeVisible();
  expect(locks).toBe(1);
});
