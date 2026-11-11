"use client";
import CardArchiveButton from "./card-archive-button";
import SelectableFlashcard from "./selectable-flashcard";
import { useState } from "react";
import { Card, StudyState } from "@/lib/model";

export default function DailyReview({
  cards,
  session,
  onReviewed,
  onComplete,
  onHome,
  onStatusChange,
}: {
  cards: Card[];
  session: NonNullable<StudyState["dailyReview"]>;
  onReviewed: (id: string) => void;
  onComplete: () => void;
  onHome: () => void;
  onStatusChange: (id: string, status: Card["status"]) => void;
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
  function toggleMeaning() {
    if (!visible) onReviewed(card.id);
    setRevealed((prev) =>
      visible ? prev.filter((id) => id !== card.id) : [...prev, card.id],
    );
  }
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
      <SelectableFlashcard key={card.id} onToggle={toggleMeaning}>
        <h2 lang="zh-Hant">{card.text}</h2>
        <div className="card-pinyin">{card.pinyin}</div>
        {visible ? (
          <div className="card-answer" id="daily-review-answer">
            <p>{card.meaning}</p>
            <blockquote lang="zh-Hant">{card.sentence}</blockquote>
          </div>
        ) : null}
        <button
          type="button"
          className="flip-hint"
          onClick={toggleMeaning}
          aria-expanded={visible}
          aria-controls={visible ? "daily-review-answer" : undefined}
        >
          {visible ? "Hide meaning" : "Reveal meaning"}
        </button>
      </SelectableFlashcard>
      <div className="session-card-actions">
        <CardArchiveButton card={card} onChange={onStatusChange} />
      </div>
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
