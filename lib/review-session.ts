import type { Card } from "./model";

export function createReviewSession(
  cards: readonly Pick<Card, "id">[],
  random: () => number = Math.random,
) {
  const ids = cards.map((card) => card.id);
  // Shuffle the whole due pool before choosing the session's 12 cards.
  for (let i = ids.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [ids[i], ids[j]] = [ids[j], ids[i]];
  }
  return ids.slice(0, 12);
}
