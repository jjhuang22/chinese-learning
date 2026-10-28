import { Card, cardKey } from "./model";

export type ReviewQuestion = {
  card: Card;
  prompt: string;
  contextual: boolean;
};
export function dailyQuestions(
  cards: Card[],
  now = Date.now(),
): ReviewQuestion[] {
  // Prioritize overdue words, then shuffle presentation rather than the priority.
  const seen = new Set<string>();
  const selected = cards
    .filter((c) => c.status === "active" && c.dueAt <= now)
    .sort((a, b) => a.dueAt - b.dueAt || a.reviews - b.reviews)
    .filter((c) => {
      const key = cardKey(c.text);
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .slice(0, 8);
  const context = selected
    .filter((c) => c.kind === "vocabulary" && c.sentence.includes(c.text))
    .slice(0, 2);
  const mixed = selected.filter((c) => !context.includes(c));
  for (let i = mixed.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [mixed[i], mixed[j]] = [mixed[j], mixed[i]];
  }
  return [...context, ...mixed].map((card) => ({
    card,
    contextual: context.includes(card),
    prompt: context.includes(card)
      ? card.sentence.split(card.text).join("＿＿＿")
      : card.meaning,
  }));
}

export function scheduleRecall(
  card: Card,
  recalled: boolean,
  now = Date.now(),
): Card {
  const days = recalled
    ? Math.min(30, Math.max(3, (card.intervalDays ?? 1) * 2))
    : 1;
  return {
    ...card,
    intervalDays: days,
    reviews: card.reviews + 1,
    dueAt: now + days * 86400000,
  };
}
