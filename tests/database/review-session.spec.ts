import { test, expect } from "@playwright/test";
import { createReviewSession } from "../../lib/review-session";

test("review samples the entire due pool without duplicates or changing the source order", () => {
  const cards = Array.from({ length: 15 }, (_, index) => ({
    id: String(index),
  }));
  const original = cards.map((card) => ({ ...card }));
  const session = createReviewSession(cards, () => 0);
  expect(session).toHaveLength(12);
  expect(new Set(session).size).toBe(12);
  expect(session).toContain("12");
  expect(session).not.toEqual(cards.slice(0, 12).map((card) => card.id));
  expect(cards).toEqual(original);
});

test("review handles empty and small decks without losing cards", () => {
  expect(createReviewSession([])).toEqual([]);
  expect(createReviewSession([{ id: "only" }])).toEqual(["only"]);
  const cards = [{ id: "a" }, { id: "b" }, { id: "c" }];
  expect(createReviewSession(cards, () => 0).sort()).toEqual(["a", "b", "c"]);
  expect(createReviewSession(cards, () => 0)).not.toEqual(
    createReviewSession(cards, () => 0.99),
  );
});
