"use client";
import { useState } from "react";
import { Card, StudyState } from "@/lib/model";

export default function DailyReview({
  cards,
  session,
  onReviewed,
  onComplete,
  onHome,
}: {
  cards: Card[];
  session: NonNullable<StudyState["dailyReview"]>;
  onReviewed: (id: string) => void;
  onComplete: () => void;
  onHome: () => void;
}) {
  const [index, setIndex] = useState(0);
  const [revealed, setRevealed] = useState<string[]>([]);
  const selected = session.cardIds.flatMap((id) => {
    const card = cards.find((c) => c.id === id);
    return card ? [card] : [];
  });
  const card = selected[index];
  if (!card)
    return (
      <section className="review-session daily-review">
        <h1>No saved cards</h1>
        <button className="primary" onClick={onHome}>
          Back to Home
        </button>
      </section>
    );
  const visible = revealed.includes(card.id);
  return (
    <section className="review-session daily-review">
      <div className="session-header">
        <button className="text-button" onClick={onHome}>
          Back to Home
        </button>
      </div>
      <h1>Daily review</h1>
      <div className="daily-card-navigation" aria-label="Card navigation">
        <button
          className="secondary"
          disabled={index === 0}
          onClick={() => setIndex((i) => i - 1)}
        >
          Previous
        </button>
        <span aria-live="polite">
          {index + 1} / {selected.length}
        </span>
        <button
          className="secondary"
          disabled={index === selected.length - 1}
          onClick={() => setIndex((i) => i + 1)}
        >
          Next
        </button>
      </div>
      <button
        key={card.id}
        className="flashcard"
        onClick={() => {
          if (!visible) onReviewed(card.id);
          setRevealed((prev) =>
            visible ? prev.filter((id) => id !== card.id) : [...prev, card.id],
          );
        }}
        aria-label={visible ? "Hide meaning" : "Reveal meaning"}
        aria-expanded={visible}
      >
        <h2 lang="zh-Hant">{card.text}</h2>
        <div className="card-pinyin">{card.pinyin}</div>
        {visible ? (
          <div className="card-answer">
            <p>{card.meaning}</p>
            <blockquote lang="zh-Hant">{card.sentence}</blockquote>
          </div>
        ) : (
          <span className="flip-hint">Reveal meaning</span>
        )}
      </button>
      <button
        className="primary next-card"
        onClick={() => {
          onComplete();
          onHome();
        }}
      >
        Finish review
      </button>
    </section>
  );
}
