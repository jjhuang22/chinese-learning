import { Card, cardKey } from "./model";
import { createReviewSession } from "./review-session";
import { DAY } from "./cards";

export function selectDailyCards(cards: Card[], random = Math.random): Card[] {
  const seen = new Set<string>();
  const active = cards.filter((card) => {
    const key = cardKey(card.text);
    if (card.status !== "active" || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
  const ids = createReviewSession(active, random).slice(0, 10);
  return ids.map((id) => active.find((card) => card.id === id)!);
}

export function recordDailyReview(card: Card, now = Date.now()): Card {
  return {
    ...card,
    reviews: card.reviews + 1,
    dueAt: Math.max(card.dueAt, now + DAY),
  };
}
