import { test, expect, type Page } from "@playwright/test";
import {
  selectDailyCards,
  recordDailyReview,
  startDailySet,
  viewDailyCard,
  finishDailySet,
} from "../lib/daily-review";
import { Card, emptyState, progressSchema } from "../lib/model";

const card: Card = {
  id: "word-1",
  text: "學習",
  meaning: "to study",
  pinyin: "xué xí",
  sentence: "我每天學習中文。",
  kind: "vocabulary",
  lessonId: "lesson",
  status: "active",
  dueAt: 0,
  createdAt: 0,
  reviews: 0,
};
async function nav(page: Page, name: string) {
  await page
    .locator(
      (await page.locator(".mobile-nav").isVisible())
        ? ".mobile-nav"
        : ".sidebar nav",
    )
    .getByRole("button", { name: new RegExp(`^${name}`) })
    .click();
}

test("daily selection samples all active cards and caps at ten without duplicates", () => {
  const cards = Array.from({ length: 20 }, (_, i) => ({
    ...card,
    id: `${i}`,
    text: `字${i}`,
    dueAt: 9e12,
  }));
  const selected = selectDailyCards(
    [
      ...cards,
      { ...cards[0], id: "duplicate" },
      { ...card, status: "archived" },
    ],
    () => 0,
  );
  expect(selected.map((c) => c.id)).toEqual(
    cards.slice(1, 11).map((c) => c.id),
  );
  expect(new Set(selected.map((c) => c.text)).size).toBe(10);
  expect(selectDailyCards([])).toEqual([]);
  expect(recordDailyReview(cards[0], 100).dueAt).toBe(cards[0].dueAt);
});

test("daily sets persist until the next day, count each card once, and require viewing all cards to finish", () => {
  const original = {
    ...emptyState,
    cards: [card, { ...card, id: "2", text: "每天" }],
  };
  const started = startDailySet(original, "2026-10-27");
  expect(startDailySet(started, "2026-10-27")).toBe(started);
  expect(finishDailySet(started).reviewedOn).toBeUndefined();
  const first = viewDailyCard(started, "word-1", 100);
  expect(viewDailyCard(first, "word-1", 200)).toBe(first);
  expect(finishDailySet(first).reviewedOn).toBeUndefined();
  const finished = finishDailySet(viewDailyCard(first, "2", 100));
  expect(finished.reviewedOn).toBe("2026-10-27");
  expect(finished.cards.every((c) => c.reviews === 1)).toBe(true);
  const nextDay = startDailySet(finished, "2026-10-28");
  expect(nextDay.dailyReview?.date).toBe("2026-10-28");
  expect(nextDay.dailyReview?.seenIds).toEqual([]);
  expect(progressSchema.parse(emptyState)).toEqual(emptyState);
  expect(
    progressSchema.safeParse({
      ...started,
      dailyReview: { ...started.dailyReview, seenIds: ["missing"] },
    }).success,
  ).toBe(false);
  const deleted = { ...first, cards: [first.cards[0]] };
  expect(finishDailySet(deleted).reviewedOn).toBe("2026-10-27");
});

test("Home completion stays actionable; daily cards support backtracking, repeats, and reloads", async ({
  page,
}) => {
  await page.addInitScript(
    (saved) => {
      if (!localStorage.getItem("everyday-chinese-v1"))
        localStorage.setItem("everyday-chinese-v1", JSON.stringify(saved));
    },
    {
      ...emptyState,
      cards: [
        card,
        {
          ...card,
          id: "word-2",
          text: "每天",
          meaning: "every day",
          dueAt: 9e12,
        },
      ],
    },
  );
  await page.goto("/");
  const home = page.locator(".daily-activities");
  const boxes = home.locator(".daily-activity");
  await expect(home.locator("p, .eyebrow")).toHaveCount(0);
  await expect(home.locator(".primary")).toHaveCount(2);
  await expect(home.locator(".daily-activity-heading > svg")).toHaveCount(2);
  const top = (await boxes.first().boundingBox())!.y;
  const headerBottom = await page
    .locator(".topbar")
    .evaluate((el) => el.getBoundingClientRect().bottom);
  expect(top - headerBottom).toBeGreaterThanOrEqual(
    (await page.locator(".mobile-nav").isVisible()) ? 36 : 64,
  );
  const buttons = home.locator(".primary");
  expect(
    await buttons.nth(0).evaluate((el) => getComputedStyle(el).backgroundColor),
  ).toBe(
    await buttons.nth(1).evaluate((el) => getComputedStyle(el).backgroundColor),
  );
  await page.getByRole("button", { name: "Start review", exact: true }).click();
  const first = await page.locator(".flashcard h2").innerText();
  await page.getByRole("button", { name: "Next", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "Finish review" }),
  ).toBeDisabled();
  const second = await page.locator(".flashcard h2").innerText();
  await page.getByRole("button", { name: "Previous" }).click();
  await page
    .getByRole("button", { name: "Reveal meaning", exact: true })
    .click();
  await page.getByRole("button", { name: "Next", exact: true }).click();
  await page.getByRole("button", { name: "Previous" }).click();
  await expect(page.locator(".card-answer")).toBeVisible();
  await page.getByRole("button", { name: "Next", exact: true }).click();
  await page
    .getByRole("button", { name: "Reveal meaning", exact: true })
    .click();
  await page.getByRole("button", { name: "Finish review" }).click();
  await page.getByRole("button", { name: "Review these again" }).click();
  await expect(page.locator(".flashcard h2")).toHaveText(first);
  await expect(page.locator(".card-answer")).toHaveCount(0);
  await page
    .getByRole("button", { name: "Reveal meaning", exact: true })
    .click();
  await page.getByRole("button", { name: "Back to Home" }).click();
  await expect(
    page.getByRole("img", { name: "Daily review completed" }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Review again", exact: true }),
  ).toBeEnabled();
  await page.reload();
  await page.getByRole("button", { name: "Review again", exact: true }).click();
  await expect(page.locator(".flashcard h2")).toHaveText(first);
  await page.getByRole("button", { name: "Next", exact: true }).click();
  await expect(page.locator(".flashcard h2")).toHaveText(second);
  const saved = await page.evaluate(() =>
    JSON.parse(localStorage.getItem("everyday-chinese-v1")!),
  );
  expect(
    saved.cards.every((c: Card) => c.status === "active" && c.reviews === 1),
  ).toBe(true);
  await page.getByRole("button", { name: "Back to Home" }).click();
  await page.getByRole("button", { name: "Read lesson", exact: true }).click();
  await page.getByRole("button", { name: "Mark as read", exact: true }).click();
  await nav(page, "Home");
  await expect(
    page.getByRole("img", { name: "Daily lesson completed" }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Read again", exact: true }),
  ).toBeEnabled();
  const navigation = page.locator(
    (await page.locator(".mobile-nav").isVisible())
      ? ".mobile-nav"
      : ".sidebar nav",
  );
  await expect(
    navigation.getByRole("button", { name: /^Review/ }),
  ).toContainText("2");
  await nav(page, "Review");
  await expect(
    page.getByRole("heading", { name: "2 active cards", exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Archive 學習", exact: true }).click();
  await expect(
    navigation.getByRole("button", { name: /^Review/ }),
  ).toContainText("1");
  await expect(
    page.getByRole("heading", { name: "1 active card", exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Archived", exact: true }).click();
  await expect(page.locator(".deck-word")).toHaveCount(1);
  await page.getByRole("button", { name: "All", exact: true }).click();
  await expect(page.locator(".deck-word")).toHaveCount(2);
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
});
