import { test, expect } from "@playwright/test";
import { dailyQuestions, scheduleRecall } from "../lib/daily-review";
import { Card, emptyState } from "../lib/model";
import { progressSchema } from "../lib/progress-schema";

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

test("selection caps overdue practice, excludes future and archived words, and masks all occurrences", () => {
  const cards = Array.from({ length: 15 }, (_, i) => ({
    ...card,
    id: `${i}`,
    text: `字${i}`,
    sentence: `字${i}和字${i}`,
    dueAt: i,
  }));
  const questions = dailyQuestions(
    [
      ...cards,
      { ...card, id: "future", dueAt: 200 },
      { ...card, id: "archive", status: "archived" },
    ],
    100,
  );
  expect(questions).toHaveLength(8);
  expect(new Set(questions.map((q) => q.card.id))).toEqual(
    new Set(cards.slice(0, 8).map((c) => c.id)),
  );
  expect(questions[0].prompt).toBe("＿＿＿和＿＿＿");
});

test("successful recall expands spacing and a miss resets it; old progress remains valid", () => {
  const first = scheduleRecall(card, true, 100);
  const second = scheduleRecall(first, true, 100);
  expect(first.intervalDays).toBe(3);
  expect(second.intervalDays).toBe(6);
  expect(scheduleRecall(second, false, 100).dueAt).toBe(100 + 86400000);
  expect(progressSchema.parse(emptyState)).toEqual(emptyState);
  expect(
    progressSchema.parse({
      ...emptyState,
      cards: [second],
      reviewedOn: "2026-10-27",
    }).reviewedOn,
  ).toBe("2026-10-27");
});

test("home separates activities and daily completion survives reload without archiving words", async ({
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
        { ...card, id: "word-2", text: "每天", meaning: "every day" },
      ],
    },
  );
  await page.goto("/");
  await expect(
    page.getByRole("heading", { name: "Daily lesson", exact: true }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Start daily review", exact: true })
    .click();
  await page.getByLabel("Your answer (Chinese characters)").fill("學習");
  await page.getByRole("button", { name: "Check answer" }).click();
  await expect(page.getByRole("status")).toContainText("Recalled!");
  await page.getByRole("button", { name: "Next question" }).click();
  await page.getByRole("button", { name: "Show answer", exact: true }).click();
  await page.getByRole("button", { name: "Finish review" }).click();
  await expect(
    page.getByRole("heading", { name: "Daily review complete." }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Back to Home" }).click();
  await page.reload();
  await expect(
    page.getByRole("button", { name: "Review complete", exact: true }),
  ).toBeDisabled();
  const saved = await page.evaluate(() =>
    JSON.parse(localStorage.getItem("everyday-chinese-v1")!),
  );
  expect(saved.cards.every((c: Card) => c.status === "active")).toBe(true);
  expect(saved.cards[0].intervalDays).toBe(3);
  expect(saved.cards[1].intervalDays).toBe(1);
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
});
