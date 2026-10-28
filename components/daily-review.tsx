"use client";
import { useState } from "react";
import { Card, cardKey, Lesson } from "@/lib/model";
import { dailyQuestions } from "@/lib/daily-review";

export default function DailyReview({
  cards,
  lessons,
  onResult,
  onComplete,
  onHome,
}: {
  cards: Card[];
  lessons: Lesson[];
  onResult: (id: string, recalled: boolean) => void;
  onComplete: () => void;
  onHome: () => void;
}) {
  const [questions] = useState(() => dailyQuestions(cards));
  const [index, setIndex] = useState(0);
  const [answer, setAnswer] = useState("");
  const [hint, setHint] = useState(false);
  const [result, setResult] = useState<null | boolean>(null);
  const [score, setScore] = useState(0);
  const q = questions[index];
  if (!q)
    return (
      <section className="empty-state">
        <h1>
          {questions.length
            ? "Daily review complete."
            : "No words due right now."}
        </h1>
        <p>
          {questions.length
            ? `${score} of ${questions.length} recalled without help. Your words will return over the next few days.`
            : "Save a few expressions while reading to build your review."}
        </p>
        <button className="primary" onClick={onHome}>
          Back to Home
        </button>
      </section>
    );
  function next() {
    onResult(q.card.id, result === true);
    if (result) setScore((s) => s + 1);
    if (index === questions.length - 1) onComplete();
    setIndex((i) => i + 1);
    setAnswer("");
    setHint(false);
    setResult(null);
  }
  return (
    <section className="review-session daily-review">
      <div className="session-header">
        <button className="text-button" onClick={onHome}>
          Back to Home
        </button>
        <span>
          {index + 1} / {questions.length}
        </span>
      </div>
      <div
        className="progress"
        role="progressbar"
        aria-label="Daily review progress"
        aria-valuemin={0}
        aria-valuemax={questions.length}
        aria-valuenow={index}
      >
        <span style={{ width: `${(index / questions.length) * 100}%` }} />
      </div>
      <span className="eyebrow">
        {q.contextual ? "BACK TO THE PASSAGE" : "MIXED RECALL"}
      </span>
      <h1>
        {q.contextual ? "Complete the sentence" : "Recall the word or pattern"}
      </h1>
      <p
        className={
          q.contextual ? "review-prompt chinese-text" : "review-prompt"
        }
        lang={q.contextual ? "zh-Hant" : "en"}
      >
        {q.prompt}
      </p>
      {q.contextual && <p className="muted">Meaning: {q.card.meaning}</p>}
      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (result === null && answer.trim())
            setResult(
              !hint &&
                cardKey(answer.normalize("NFKC")) ===
                  cardKey(q.card.text.normalize("NFKC")),
            );
        }}
      >
        <label htmlFor="recall-answer">Your answer (Chinese characters)</label>
        <input
          id="recall-answer"
          autoComplete="off"
          value={answer}
          disabled={result !== null}
          onChange={(e) => setAnswer(e.target.value)}
        />
        {result === null && (
          <div className="rating-buttons">
            <button type="submit" className="primary" disabled={!answer.trim()}>
              Check answer
            </button>
            <button
              type="button"
              className="secondary"
              onClick={() => setResult(false)}
            >
              Show answer
            </button>
          </div>
        )}
      </form>
      {result === null && (
        <button className="text-button" onClick={() => setHint(true)}>
          Pinyin hint
        </button>
      )}
      {hint && <p>{q.card.pinyin}</p>}
      {result !== null && (
        <div className="recall-feedback" role="status">
          <strong>{result ? "Recalled!" : "Another look"}</strong>
          <h2 lang="zh-Hant">{q.card.text}</h2>
          <p>{q.card.pinyin}</p>
          <p>{q.card.meaning}</p>
          <blockquote lang="zh-Hant">{q.card.sentence}</blockquote>
          <p className="muted">
            {result
              ? "This word will return later."
              : "This word will return tomorrow. Hints and alternate answers get another look too."}
          </p>
          <button className="primary" onClick={next}>
            {index === questions.length - 1 ? "Finish review" : "Next question"}
          </button>
        </div>
      )}
      <p className="session-hint">
        From{" "}
        {lessons.find((l) => l.id === q.card.lessonId)?.title ??
          "your saved vocabulary"}
      </p>
    </section>
  );
}
