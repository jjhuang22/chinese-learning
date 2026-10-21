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
test("locked data stays private, forged cookies fail, and cross-origin unlock is denied", async ({
  request,
}) => {
  const home = await request.get("/", { maxRedirects: 0 });
  expect(home.status()).toBe(307);
  expect(home.headers().location).toContain("/sign-in");
  expect(await home.text()).not.toContain("PRIVATE_LESSON_SENTINEL");
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
  await page.locator(".settings-button").click();
  await page
    .getByRole("button", { name: "Lock this device", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "Unlock your lessons" }),
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
  await page.getByRole("button", { name: "Too hard", exact: true }).click();
  await expect(page.locator(".warning")).toContainText(
    "Progress changed on another device",
  );
  await expect(page.getByRole("button", { name: "Retry sync" })).toHaveCount(0);
  await expect(
    page.getByRole("button", { name: "Too hard", exact: true }),
  ).toHaveClass("selected");
  const result = await request.get("/api/progress", {
    headers: { Cookie: `everyday_session=${token}` },
  });
  expect((await result.json()).state).toEqual(state);
});
