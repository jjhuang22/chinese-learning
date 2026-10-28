import { Card, cardKey, StudyState, localDate } from "./model";
import { createReviewSession } from "./review-session";
import { DAY } from "./cards";
import { DAILY_REVIEW_LIMIT } from "./review-config";

export function selectDailyCards(cards: Card[], random = Math.random): Card[] {
  const seen = new Set<string>();
  const active = cards.filter((card) => {
    const key = cardKey(card.text);
    if (card.status !== "active" || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
  const ids = createReviewSession(active, random, DAILY_REVIEW_LIMIT);
  return ids.map((id) => active.find((card) => card.id === id)!);
}

export function recordDailyReview(card: Card, now = Date.now()): Card {
  return {
    ...card,
    reviews: card.reviews + 1,
    dueAt: Math.max(card.dueAt, now + DAY),
  };
}

export function startDailySet(
  state: StudyState,
  date = localDate(),
): StudyState {
  if (state.dailyReview?.date === date) return state;
  return {
    ...state,
    dailyReview: {
      date,
      cardIds: selectDailyCards(state.cards).map((card) => card.id),
      seenIds: [],
    },
  };
}

export function viewDailyCard(
  state: StudyState,
  id: string,
  now = Date.now(),
): StudyState {
  const session = state.dailyReview;
  if (!session || !session.cardIds.includes(id) || session.seenIds.includes(id))
    return state;
  return {
    ...state,
    dailyReview: { ...session, seenIds: [...session.seenIds, id] },
    cards: state.cards.map((card) =>
      card.id === id ? recordDailyReview(card, now) : card,
    ),
  };
}

export function finishDailySet(state: StudyState): StudyState {
  const session = state.dailyReview;
  if (!session?.cardIds.length) return state;
  return { ...state, reviewedOn: session.date };
}
