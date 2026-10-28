import { readFile } from "node:fs/promises";
import { test, expect, type Page } from "@playwright/test";
async function nav(page: Page, label: string) {
  const mobile = await page.locator(".mobile-nav").isVisible();
  await page
    .locator(mobile ? ".mobile-nav" : ".sidebar nav")
    .getByRole("button", { name: new RegExp(`^${label}`) })
    .click();
}

test("pinyin can be revealed individually and all at once without duplicating passages", async ({
  page,
}) => {
  await page.goto("/");
  await openDailyLesson(page);
  await expect(page.locator(".lesson-heading h1")).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Show all pinyin" }),
  ).toHaveAttribute("aria-pressed", "true");
  await expect(page.locator(".pinyin-line")).toHaveCount(
    await page.locator(".sentence").count(),
  );
  await page.getByRole("button", { name: "Show all pinyin" }).click();
  await expect(page.locator(".pinyin-line")).toHaveCount(0);
  await page
    .locator(".sentence")
    .first()
    .click({ position: { x: 20, y: 15 } });
  await expect(page.locator(".pinyin-line")).toHaveCount(1);
  await page.getByRole("button", { name: "Show all pinyin" }).click();
  await expect(page.locator(".pinyin-line")).toHaveCount(
    await page.locator(".sentence").count(),
  );
  await page.getByRole("button", { name: "Show all pinyin" }).click();
  await expect(page.locator(".pinyin-line")).toHaveCount(1);
  await expect(page.locator(".passage")).toHaveCount(2);
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
});
test("saving a highlight updates the suggestions once, persists, and supports archive and restore", async ({
  page,
}) => {
  await page.goto("/");
  await openDailyLesson(page);
  await page
    .getByRole("button", { name: "Look up 觀望", exact: true })
    .first()
    .click();
  await expect(page.getByRole("dialog")).toBeVisible();
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Save flashcard", exact: true })
    .click();
  const suggestion = page
    .locator(".suggestion-card")
    .filter({ has: page.getByRole("heading", { name: "觀望", exact: true }) });
  await expect(
    suggestion.getByRole("button", { name: "Saved", exact: true }),
  ).toBeEnabled();
  await page.reload();
  await openDailyLesson(page);
  await expect(
    suggestion.getByRole("button", { name: "Saved", exact: true }),
  ).toBeEnabled();
  await nav(page, "Review");
  await expect(
    page.getByRole("heading", { name: "1 card to review" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Start review" }).click();
  await expect(page.locator(".card-answer")).toHaveCount(0);
  await page
    .getByRole("button", { name: "Reveal meaning", exact: true })
    .click();
  await expect(page.locator(".card-answer")).toContainText("Wait and see");
  await page
    .getByRole("button", { name: "Understand already", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "A little more familiar." }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Back to your cards" }).click();
  await page
    .locator(".deck-toolbar")
    .getByRole("button", { name: "Archive", exact: true })
    .click();
  await expect(page.locator(".deck-word")).toContainText("觀望");
  await page.getByRole("button", { name: "Restore", exact: true }).click();
  await page.getByRole("button", { name: "Due", exact: true }).click();
  await expect(page.locator(".deck-word")).toContainText("觀望");
});
test("saved phrases can be unsaved from suggestions and the dialog, then saved again", async ({
  page,
}) => {
  await page.goto("/");
  await openDailyLesson(page);
  const suggestion = page.locator(".suggestion-card").filter({
    has: page.getByRole("heading", { name: "觀望", exact: true }),
  });
  await suggestion
    .getByRole("button", { name: "Save flashcard", exact: true })
    .click();
  await suggestion.getByRole("button", { name: "Saved", exact: true }).click();
  await expect(
    suggestion.getByRole("button", { name: "Save flashcard", exact: true }),
  ).toHaveAttribute("aria-pressed", "false");
  await page.reload();
  await openDailyLesson(page);
  await expect(
    suggestion.getByRole("button", { name: "Save flashcard", exact: true }),
  ).toBeEnabled();
  await nav(page, "Review");
  await expect(page.locator(".deck-word")).toHaveCount(0);
  await nav(page, "Today");
  await suggestion
    .getByRole("button", { name: "Save flashcard", exact: true })
    .click();
  const phrase = page
    .getByRole("button", { name: "Look up 觀望", exact: true })
    .first();
  await expect(phrase).toHaveClass(/word-saved/);
  await phrase.click();
  const dialog = page.getByRole("dialog");
  await dialog
    .getByRole("button", { name: "Saved to review", exact: true })
    .click();
  await expect(
    dialog.getByRole("button", { name: "Save flashcard", exact: true }),
  ).toHaveAttribute("aria-pressed", "false");
  await expect(
    suggestion.getByRole("button", { name: "Save flashcard", exact: true }),
  ).toBeEnabled();
  await expect(phrase).not.toHaveClass(/word-saved/);
  await page.reload();
  await openDailyLesson(page);
  await nav(page, "Review");
  await expect(page.locator(".deck-word")).toHaveCount(0);
  await nav(page, "Today");
  await phrase.click();
  await dialog
    .getByRole("button", { name: "Save flashcard", exact: true })
    .click();
  await nav(page, "Review");
  await expect(page.locator(".deck-word")).toHaveCount(1);
  await expect(page.locator(".deck-word")).toContainText("觀望");
});
test("arbitrary selected phrases become editable contextual cards", async ({
  page,
}) => {
  await page.goto("/");
  await openDailyLesson(page);
  await page.evaluate(() => {
    const el = document.querySelector(".sentence")!;
    const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
    let node;
    while ((node = walker.nextNode())) {
      const index = node.textContent?.indexOf("群組");
      if (index !== undefined && index >= 0) {
        const range = document.createRange();
        range.setStart(node, index);
        range.setEnd(node, index + 2);
        const selection = window.getSelection()!;
        selection.removeAllRanges();
        selection.addRange(range);
        document.dispatchEvent(new Event("selectionchange"));
        break;
      }
    }
  });
  await page
    .getByRole("button", { name: "Create flashcard", exact: true })
    .click();
  await expect(
    page.getByRole("dialog").getByLabel("Characters / pattern"),
  ).toHaveValue("群組");
  await expect(page.getByLabel("Original sentence")).toHaveValue(/你昨天不是/);
  await page.getByLabel("Meaning in context").fill("A group chat");
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Save flashcard", exact: true })
    .click();
  const manualHighlight = page.getByRole("button", {
    name: "Look up 群組",
    exact: true,
  });
  await expect(manualHighlight).toHaveClass(/word-saved/);
  await manualHighlight.click();
  await expect(
    page.getByRole("dialog").locator(".context-sentence"),
  ).toContainText("群組");
  await expect(page.getByRole("dialog").locator(".dialog-meaning")).toHaveText(
    "A group chat",
  );
  await page.getByRole("button", { name: "Close dialog", exact: true }).click();
  await page.reload();
  await openDailyLesson(page);
  await expect(manualHighlight).toHaveClass(/word-saved/);
  await nav(page, "Review");
  await expect(page.locator(".deck-word")).toContainText("群組");
});
test("review repeats kept cards once and ends; archive and reading progress persist", async ({
  page,
}) => {
  await page.goto("/");
  await openDailyLesson(page);
  await page.getByRole("button", { name: "Mark as read", exact: true }).click();
  const card = page.locator(".suggestion-card").first();
  await card
    .getByRole("button", { name: "Save flashcard", exact: true })
    .click();
  await nav(page, "Archive");
  await expect(page.locator(".library-lesson")).toHaveCount(2);
  await expect(page.locator(".library-lesson").first()).toContainText("Read");
  await page.locator(".library-lesson").first().click();
  await expect(
    page.getByRole("button", { name: "Lesson read", exact: true }),
  ).toBeVisible();
  await nav(page, "Review");
  await page.getByRole("button", { name: "Start review" }).click();
  for (let i = 0; i < 2; i++) {
    await page
      .getByRole("button", { name: "Reveal meaning", exact: true })
      .click();
    await page
      .getByRole("button", { name: "Keep reviewing", exact: true })
      .click();
  }
  await expect(
    page.getByRole("heading", { name: "A little more familiar." }),
  ).toBeVisible();
});
test("cloud endpoints reject unauthenticated requests and manifest is available", async ({
  request,
}) => {
  const response = await request.post("/api/import", {
    data: { schemaVersion: 1 },
  });
  expect(response.status()).toBe(401);
  expect((await response.json()).error).toBeTruthy();
  for (const route of ["/api/generate", "/api/lookup", "/api/cron"])
    expect((await request.get(route)).status()).toBe(404);
  expect((await request.get("/manifest.webmanifest")).ok()).toBe(true);
});

test("suggestions share one approval state and bulk saving respects dismissals", async ({
  page,
}) => {
  await page.goto("/");
  await openDailyLesson(page);
  const count = await page.locator(".suggestion-card").count();
  const first = page.locator(".suggestion-card").first();
  await first
    .getByRole("button", { name: "Dismiss 湊不到人", exact: true })
    .click();
  await expect(
    first.getByRole("button", { name: "Dismissed", exact: true }),
  ).toBeDisabled();
  await page.getByRole("button", { name: /Save remaining/ }).click();
  await expect(page.locator(".saved-card")).toHaveCount(count - 1);
  await first
    .getByRole("button", { name: "Undo dismissal of 湊不到人", exact: true })
    .click();
  await first
    .getByRole("button", { name: "Save flashcard", exact: true })
    .click();
  await expect(page.locator(".saved-card")).toHaveCount(count);
  await page
    .getByRole("button", { name: "Look up 湊不到人", exact: true })
    .first()
    .click();
  await expect(
    page
      .getByRole("dialog")
      .getByRole("button", { name: "Saved to review", exact: true }),
  ).toBeEnabled();
});

test("reader uses paragraphs with multiple inline sentences and removes ornamental copy", async ({
  page,
}) => {
  await page.goto("/");
  await openDailyLesson(page);
  const paragraph = page
    .locator(".reading-paragraph")
    .filter({ has: page.locator(".sentence") })
    .first();
  expect(await paragraph.locator(".sentence").count()).toBeGreaterThan(1);
  const sentence = paragraph.locator(".sentence").first();
  await expect(sentence).toHaveCSS("display", "inline");
  await expect(page.getByText("TAKE SOMETHING WITH YOU")).toHaveCount(0);
  await expect(page.getByText("A little, every day.")).toHaveCount(0);
  await expect(
    page.getByText("From your original lessons.", { exact: false }),
  ).toHaveCount(0);
});

test("paste, preview, save, reload, library, pinyin, and card review pipeline", async ({
  page,
}) => {
  const example = await readFile("public/example-lesson.json", "utf8");
  await page.goto("/");
  await openDailyLesson(page);
  await page
    .getByRole("button", { name: "Import lesson", exact: true })
    .click();
  await page.getByLabel("Lesson JSON").fill("```json\n" + example + "\n```");
  await page
    .getByRole("button", { name: "Preview lesson", exact: true })
    .click();
  await expect(page.getByRole("dialog")).toContainText(
    "買得划算，真的用得上嗎？",
  );
  await page
    .getByRole("button", { name: "Save on this device", exact: true })
    .click();
  await expect(page.locator(".lesson-heading h1")).toContainText("買得划算");
  await expect(
    page.getByRole("region", { name: "Text", exact: true }),
  ).toBeVisible();
  const grammar = page.getByRole("region", { name: "Grammar", exact: true });
  await expect(grammar).toBeVisible();
  const note = grammar.locator("details").first();
  await expect(note).not.toHaveAttribute("open", "");
  await expect(note).toHaveCSS("background-color", "rgb(255, 255, 255)");
  await note.locator("summary").click();
  await expect(note.locator(".usage-note-text")).toBeVisible();
  await note.locator("summary").click();
  await expect(note.locator(".usage-note-text")).toBeHidden();
  await expect(
    page.getByRole("region", { name: "Suggested cards", exact: true }),
  ).toBeVisible();
  await page.reload();
  await openDailyLesson(page);
  await expect(page.locator(".lesson-heading h1")).toContainText("買得划算");
  await page
    .getByRole("button", { name: "Look up 湊單", exact: true })
    .first()
    .click();
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Save flashcard", exact: true })
    .click();
  await nav(page, "Archive");
  await expect(page.locator(".library-lesson")).toHaveCount(3);
  await page.locator(".library-lesson").first().click();
  await expect(
    page.getByRole("button", { name: "Show all pinyin", exact: true }),
  ).toHaveAttribute("aria-pressed", "true");
  await expect(page.locator(".pinyin-line")).toHaveCount(12);
  await nav(page, "Review");
  await page.getByRole("button", { name: "Start review", exact: true }).click();
  await page
    .getByRole("button", { name: "Reveal meaning", exact: true })
    .click();
  await expect(page.locator(".card-answer")).toContainText("Combine purchases");
});
test("invalid and duplicate imports are rejected without changing the lesson library", async ({
  page,
}) => {
  await page.goto("/");
  await openDailyLesson(page);
  await page
    .getByRole("button", { name: "Import lesson", exact: true })
    .click();
  await page.getByLabel("Lesson JSON").fill("{bad json");
  await page
    .getByRole("button", { name: "Preview lesson", exact: true })
    .click();
  await expect(page.getByRole("dialog").getByRole("alert")).toContainText(
    "not valid JSON",
  );
  const example = JSON.parse(
    await readFile("public/example-lesson.json", "utf8"),
  );
  example.date = "2026-02-30";
  await page.getByLabel("Lesson JSON").fill(JSON.stringify(example));
  await page
    .getByRole("button", { name: "Preview lesson", exact: true })
    .click();
  await expect(page.getByRole("dialog").getByRole("alert")).toContainText(
    "real calendar date",
  );
  example.date = "2026-10-21";
  await page.getByLabel("Lesson JSON").fill(JSON.stringify(example));
  await page
    .getByRole("button", { name: "Preview lesson", exact: true })
    .click();
  await expect(page.getByRole("dialog").getByRole("alert")).toContainText(
    "already exists",
  );
  await page.getByRole("button", { name: "Close dialog", exact: true }).click();
  await nav(page, "Archive");
  await expect(page.locator(".library-lesson")).toHaveCount(2);
});

test("card bodies open context while save and dismiss keep their own actions", async ({
  page,
}) => {
  await page.goto("/");
  await openDailyLesson(page);
  await expect(
    page.getByText("How did this feel?", { exact: true }),
  ).toHaveCount(0);
  await expect(
    page.getByRole("button", { name: "Too hard", exact: true }),
  ).toHaveCount(0);
  const card = page.locator(".suggestion-card").first();
  const word = await card.locator("h3").innerText();
  await card.locator(":scope > p").click();
  await expect(page.getByRole("dialog").locator(".dialog-word")).toHaveText(
    word,
  );
  await expect(
    page.getByRole("dialog").locator(".context-sentence"),
  ).not.toBeEmpty();
  await page.getByRole("button", { name: "Close dialog", exact: true }).click();
  await card.click({ position: { x: 5, y: 5 } });
  await expect(page.getByRole("dialog")).toBeVisible();
  await page.getByRole("button", { name: "Close dialog", exact: true }).click();
  await card
    .getByRole("button", { name: "Save flashcard", exact: true })
    .click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect(
    card.getByRole("button", { name: "Saved", exact: true }),
  ).toBeEnabled();
  const other = page.locator(".suggestion-card").nth(1);
  await other.getByRole("button", { name: /^Dismiss / }).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect(
    other.getByRole("button", { name: "Dismissed", exact: true }),
  ).toBeDisabled();
  await nav(page, "Review");
  await page.locator(".deck-meaning").first().click();
  await expect(page.getByRole("dialog").locator(".dialog-word")).toHaveText(
    word,
  );
  await expect(
    page.getByRole("dialog").locator(".context-sentence"),
  ).not.toBeEmpty();
});

test("import paste field has a moderate default height and page content has bottom space", async ({
  page,
}) => {
  await page.goto("/");
  await openDailyLesson(page);
  await page
    .getByRole("button", { name: "Import lesson", exact: true })
    .click();
  const field = page.getByLabel("Lesson JSON");
  const box = await field.boundingBox();
  expect(box!.height).toBeGreaterThanOrEqual(180);
  expect(box!.height).toBeLessThanOrEqual(260);
  await expect(field).toHaveCSS("resize", "vertical");
  await page.getByRole("button", { name: "Close dialog", exact: true }).click();
  for (const label of ["Today", "Archive", "Review"]) {
    await nav(page, label);
    expect(
      await page
        .locator(".content")
        .evaluate((el) => parseFloat(getComputedStyle(el).paddingBottom)),
    ).toBeGreaterThanOrEqual(88);
  }
});

test("review search accepts plain, accented, spaced, and numbered pinyin", async ({
  page,
}) => {
  await page.addInitScript(() => {
    localStorage.setItem(
      "everyday-chinese-v1",
      JSON.stringify({
        cards: [
          {
            id: "search-jiangjiu",
            lessonId: "demo-2",
            text: "講究",
            pinyin: "jiǎng jiù",
            meaning: "Be particular about quality.",
            sentence: "他很講究品質。",
            kind: "vocabulary",
            status: "active",
            dueAt: 0,
            reviews: 0,
            createdAt: 0,
          },
          {
            id: "search-other",
            lessonId: "demo-2",
            text: "觀望",
            pinyin: "guān wàng",
            meaning: "Wait and see.",
            sentence: "我想先觀望一下。",
            kind: "vocabulary",
            status: "active",
            dueAt: 0,
            reviews: 0,
            createdAt: 0,
          },
        ],
        dismissed: [],
        read: [],
        feedback: {},
      }),
    );
  });
  await page.goto("/");
  await openDailyLesson(page);
  await nav(page, "Review");
  await expect(
    page.getByRole("button", { name: "Practice", exact: true }),
  ).toHaveCount(0);
  const search = page.getByRole("textbox", { name: "Find a card" });
  for (const query of [
    "jiangjiu",
    "jiang jiu",
    "JIANGJIU",
    "jiǎng jiù",
    "jiang3jiu4",
    "講究",
    "particular",
  ]) {
    await search.fill(query);
    await expect(page.locator(".deck-list article")).toHaveCount(1);
    await expect(page.locator(".deck-word")).toContainText("講究");
  }
  await page.locator(".deck-list article").click({ position: { x: 5, y: 5 } });
  await expect(
    page.getByRole("dialog").locator(".context-sentence"),
  ).toHaveText("他很講究品質。");
  await page.getByRole("button", { name: "Close dialog", exact: true }).click();
  await search.fill("not-a-match");
  await expect(page.locator(".deck-list article")).toHaveCount(0);
  await search.clear();
  await expect(page.locator(".deck-list article")).toHaveCount(2);
});

test("Archive unread count follows read status and persists after reload", async ({
  page,
}) => {
  await page.goto("/");
  await openDailyLesson(page);
  const navigation = page.locator(
    (await page.locator(".mobile-nav").isVisible())
      ? ".mobile-nav"
      : ".sidebar nav",
  );
  const archive = navigation.getByRole("button", { name: /^Archive/ });
  await expect(archive).toContainText("2");
  await page.getByRole("button", { name: "Mark as read", exact: true }).click();
  await expect(archive).toContainText("1");
  await page.reload();
  await openDailyLesson(page);
  await expect(archive).toContainText("1");
  await page.getByRole("button", { name: "Lesson read", exact: true }).click();
  await expect(archive).toContainText("2");
  await page.getByRole("button", { name: "Mark as read", exact: true }).click();
  await archive.click();
  await page.locator(".library-lesson").filter({ hasText: "Unread" }).click();
  await page.getByRole("button", { name: "Mark as read", exact: true }).click();
  await expect(archive).toHaveText("Archive");
  await page.reload();
  await openDailyLesson(page);
  await expect(archive).toHaveText("Archive");
});
async function openDailyLesson(page: import("@playwright/test").Page) {
  const lesson = page.getByRole("button", {
    name: /Read (daily lesson|lesson again)/,
  });
  if (await lesson.count()) await lesson.click();
}
