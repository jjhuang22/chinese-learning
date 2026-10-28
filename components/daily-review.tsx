"use client";
import { useState } from "react";
import { Card } from "@/lib/model";
import { selectDailyCards } from "@/lib/daily-review";

export default function DailyReview({
  cards,
  onReviewed,
  onComplete,
  onHome,
}: {
  cards: Card[];
  onReviewed: (id: string) => void;
  onComplete: () => void;
  onHome: () => void;
}) {
  const [session] = useState(() => selectDailyCards(cards));
  const [index, setIndex] = useState(0);
  const [revealed, setRevealed] = useState(false);
  const card = session[index];
  if (!card)
    return (
      <section className="daily-review">
        <h1>{session.length ? "Daily review complete" : "No saved cards"}</h1>
        <button className="primary" onClick={onHome}>
          Back to Home
        </button>
      </section>
    );
  return (
    <section className="review-session daily-review">
      <div className="session-header">
        <button className="text-button" onClick={onHome}>
          Back to Home
        </button>
        <span>
          {index + 1} / {session.length}
        </span>
      </div>
      <h1>Daily review</h1>
      <button
        className="flashcard"
        onClick={() => setRevealed((v) => !v)}
        aria-label={revealed ? "Hide meaning" : "Reveal meaning"}
        aria-expanded={revealed}
      >
        <h2 lang="zh-Hant">{card.text}</h2>
        <div className="card-pinyin">{card.pinyin}</div>
        {revealed ? (
          <div className="card-answer">
            <p>{card.meaning}</p>
            <blockquote lang="zh-Hant">{card.sentence}</blockquote>
          </div>
        ) : (
          <span className="flip-hint">Reveal meaning</span>
        )}
      </button>
      {revealed && (
        <button
          className="primary next-card"
          onClick={() => {
            onReviewed(card.id);
            if (index === session.length - 1) onComplete();
            setIndex((i) => i + 1);
            setRevealed(false);
          }}
        >
          {index === session.length - 1 ? "Finish review" : "Next"}
        </button>
      )}
    </section>
  );
}
