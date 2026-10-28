import { cardKey, type Card, type Suggestion, type StudyState } from "./model";
export const DAY = 86_400_000;
export function addCards(
  state: StudyState,
  suggestions: Suggestion[],
  lessonId: string,
  now = Date.now(),
): StudyState {
  const keys = new Set(state.cards.map((c) => cardKey(c.text)));
  const additions: Card[] = [];
  for (const suggestion of suggestions) {
    const key = cardKey(suggestion.text);
    if (!key || keys.has(key)) continue;
    keys.add(key);
    additions.push({
      ...suggestion,
      lessonId,
      status: "active",
      dueAt: now,
      createdAt: now,
      reviews: 0,
    });
  }
  return {
    ...state,
    cards: [...state.cards, ...additions],
    dismissed: state.dismissed.filter(
      (id) => !additions.some((c) => c.id === id),
    ),
  };
}
export function cardCollision(cards: Card[], suggestion: Suggestion) {
  return (
    !cardKey(suggestion.text) ||
    cards.some(
      (c) =>
        c.id !== suggestion.id && cardKey(c.text) === cardKey(suggestion.text),
    )
  );
}
export function rateCard(card: Card, archive: boolean, now = Date.now()): Card {
  return {
    ...card,
    status: archive ? "archived" : "active",
    reviews: card.reviews + 1,
    dueAt: now + (archive ? 30 : Math.min(7, card.reviews + 1)) * DAY,
  };
}
