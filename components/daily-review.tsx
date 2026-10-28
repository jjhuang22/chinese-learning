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
  const [finished, setFinished] = useState(false);
  const selected = session.cardIds.flatMap((id) => {
    const card = cards.find((c) => c.id === id);
    return card ? [card] : [];
  });
  const card = selected[index];
  const allSeen =
    selected.length > 0 &&
    selected.every((c) => session.seenIds.includes(c.id));
  if (finished || !card)
    return (
      <section className="review-session daily-review daily-complete">
        <h1>{selected.length ? "Daily review complete" : "No saved cards"}</h1>
        <div className="daily-complete-actions">
          {selected.length > 0 && (
            <button
              className="primary"
              onClick={() => {
                setIndex(0);
                setRevealed([]);
                setFinished(false);
              }}
            >
              Review these again
            </button>
          )}
          <button className="primary" onClick={onHome}>
            Back to Home
          </button>
        </div>
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
      {index === selected.length - 1 && (
        <button
          className="primary next-card"
          disabled={!allSeen}
          onClick={() => {
            onComplete();
            setFinished(true);
          }}
        >
          Finish review
        </button>
      )}
    </section>
  );
}
