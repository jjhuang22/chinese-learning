import { test, expect } from "@playwright/test";
import { selectDailyCards, recordDailyReview } from "../lib/daily-review";
import { Card, emptyState } from "../lib/model";

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

test("daily selection samples the whole active deck, caps at ten, and excludes duplicates and archived words", () => {
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
  expect(selected).toHaveLength(10);
  expect(new Set(selected.map((c) => c.text)).size).toBe(10);
  expect(selected.map((c) => c.id)).toEqual(
    cards.slice(1, 11).map((c) => c.id),
  );
  expect(selectDailyCards([])).toEqual([]);
  const reviewed = recordDailyReview(card, 100);
  expect(reviewed.status).toBe("active");
  expect(reviewed.reviews).toBe(1);
  expect(recordDailyReview(cards[0], 100).dueAt).toBe(cards[0].dueAt);
});

test("simple Home and flashcard-only daily review persist completion", async ({
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
  await expect(
    page.locator(
      ".daily-activities svg, .daily-activities p, .daily-activities .eyebrow",
    ),
  ).toHaveCount(0);
  await expect(page.locator(".daily-activities .primary")).toHaveCount(2);
  await page
    .getByRole("button", { name: "Start daily review", exact: true })
    .click();
  await expect(page.getByRole("textbox")).toHaveCount(0);
  for (let i = 0; i < 2; i++) {
    await expect(page.locator(".session-header")).toContainText(`${i + 1} / 2`);
    await expect(page.locator(".card-answer")).toHaveCount(0);
    await page
      .getByRole("button", { name: "Reveal meaning", exact: true })
      .click();
    await expect(page.locator(".card-answer")).toBeVisible();
    await page
      .getByRole("button", {
        name: i === 1 ? "Finish review" : "Next",
        exact: true,
      })
      .click();
  }
  await expect(
    page.getByRole("heading", { name: "Daily review complete", exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Back to Home" }).click();
  await page.reload();
  await expect(
    page.getByRole("button", { name: "Review complete", exact: true }),
  ).toBeDisabled();
  const saved = await page.evaluate(() =>
    JSON.parse(localStorage.getItem("everyday-chinese-v1")!),
  );
  expect(
    saved.cards.every((c: Card) => c.status === "active" && c.reviews === 1),
  ).toBe(true);
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  const navigation = page.locator(
    (await page.locator(".mobile-nav").isVisible())
      ? ".mobile-nav"
      : ".sidebar nav",
  );
  await navigation.getByRole("button", { name: /^Review/ }).click();
  await page
    .getByRole("button", { name: "Extra practice", exact: true })
    .click();
  await expect(
    page.getByRole("button", { name: "Reveal meaning", exact: true }),
  ).toBeVisible();
});
