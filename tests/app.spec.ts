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
  await expect(page.locator(".lesson-heading h1")).toBeVisible();
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
  ).toBeDisabled();
  await page.reload();
  await expect(
    suggestion.getByRole("button", { name: "Saved", exact: true }),
  ).toBeDisabled();
  await nav(page, "Review");
  await expect(
    page.getByRole("heading", { name: "1 cards to revisit" }),
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
  await page.getByRole("button", { name: "Archive", exact: true }).click();
  await expect(page.locator(".deck-word")).toContainText("觀望");
  await page.getByRole("button", { name: "Restore", exact: true }).click();
  await page.getByRole("button", { name: "Due", exact: true }).click();
  await expect(page.locator(".deck-word")).toContainText("觀望");
});
test("arbitrary selected phrases become editable contextual cards", async ({
  page,
}) => {
  await page.goto("/");
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
  await nav(page, "Review");
  await expect(page.locator(".deck-word")).toContainText("群組");
});
test("review repeats kept cards once and ends; library and difficulty changes persist", async ({
  page,
}) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Too hard", exact: true }).click();
  await page.getByRole("button", { name: "Mark as read", exact: true }).click();
  const card = page.locator(".suggestion-card").first();
  await card
    .getByRole("button", { name: "Save flashcard", exact: true })
    .click();
  await nav(page, "Library");
  await expect(page.locator(".library-lesson")).toHaveCount(2);
  await expect(page.locator(".library-lesson").first()).toContainText("Read");
  await page.locator(".library-lesson").first().click();
  await expect(
    page.getByRole("button", { name: "Too hard", exact: true }),
  ).toHaveClass("selected");
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
  ).toBeDisabled();
});

test("reader uses paragraphs with multiple inline sentences and removes ornamental copy", async ({
  page,
}) => {
  await page.goto("/");
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
  await page.reload();
  await expect(page.locator(".lesson-heading h1")).toContainText("買得划算");
  await page
    .getByRole("button", { name: "Look up 湊單", exact: true })
    .first()
    .click();
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Save flashcard", exact: true })
    .click();
  await nav(page, "Library");
  await expect(page.locator(".library-lesson")).toHaveCount(3);
  await page.locator(".library-lesson").first().click();
  await page
    .getByRole("button", { name: "Show all pinyin", exact: true })
    .click();
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
  await nav(page, "Library");
  await expect(page.locator(".library-lesson")).toHaveCount(2);
});

test("unreadable local progress is preserved until an explicit reset", async ({
  page,
}) => {
  const broken = '{"cards":[{}],"dismissed":[],"read":[],"feedback":{}}';
  await page.addInitScript(
    (value) => localStorage.setItem("everyday-chinese-v1", value),
    broken,
  );
  await page.goto("/");
  await expect(
    page.getByText(/Saved progress could not be loaded/),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Export original data" }),
  ).toBeVisible();
  await expect(page.locator(".lesson-heading h1")).toBeVisible();
  expect(
    await page.evaluate(() => localStorage.getItem("everyday-chinese-v1")),
  ).toBe(broken);
  await page.getByRole("button", { name: "Reset local progress" }).click();
  await expect(
    page.getByText(/Saved progress could not be loaded/),
  ).toHaveCount(0);
  expect(
    JSON.parse(
      (await page.evaluate(() => localStorage.getItem("everyday-chinese-v1")))!,
    ).cards,
  ).toEqual([]);
});

test("editing a card cannot collide with another saved expression", async ({
  page,
}) => {
  await page.goto("/");
  await page.getByRole("button", { name: /Save remaining/ }).click();
  await nav(page, "Review");
  const words = page.locator(".deck-word");
  const target = (await words.nth(1).locator("span").textContent())!;
  await words.first().click();
  await page.getByRole("button", { name: "Edit card", exact: true }).click();
  await page.getByLabel("Characters / pattern").fill(target);
  await page.getByRole("button", { name: "Save changes", exact: true }).click();
  await expect(page.getByRole("dialog").getByRole("alert")).toContainText(
    "not already saved",
  );
  await expect(page.getByRole("dialog")).toBeVisible();
});
