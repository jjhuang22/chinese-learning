"use client";
import { Check, Plus, X, RotateCcw, Type, CheckCheck } from "lucide-react";
import { useState, type Dispatch, type SetStateAction } from "react";
import {
  type Lesson,
  type StudyState,
  type Suggestion,
  type Card,
  findCard,
  cardKey,
  paragraphGroups,
} from "@/lib/model";
function dateLabel(date: string) {
  return new Date(date + "T12:00:00").toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
  });
}

export default function Reader({
  lesson,
  state,
  setState,
  setModal,
  setNotice,
  saveCard,
  captureSelection,
  clearSelection,
}: {
  lesson: Lesson;
  state: StudyState;
  setState: Dispatch<SetStateAction<StudyState>>;
  setModal: (suggestion: Suggestion) => void;
  setNotice: (notice: string) => void;
  saveCard: (suggestion: Suggestion) => void;
  captureSelection: () => void;
  clearSelection: () => void;
}) {
  const [showAll, setShowAll] = useState(false);
  const [revealed, setRevealed] = useState<string[]>([]);
  function dismiss(s: Suggestion) {
    setState((prev) => ({
      ...prev,
      dismissed: prev.dismissed.includes(s.id)
        ? prev.dismissed.filter((x) => x !== s.id)
        : [...prev.dismissed, s.id],
    }));
  }
  function textParts(text: string) {
    const terms = lesson.suggestions
      .filter((s) => s.kind === "vocabulary" && text.includes(s.text))
      .sort((a, b) => b.text.length - a.text.length);
    if (!terms.length) return text;
    const escaped = terms.map((s) =>
      s.text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"),
    );
    const parts = text.split(new RegExp(`(${escaped.join("|")})`, "g"));
    return parts.map((part, i) => {
      const suggestion = terms.find((s) => s.text === part);
      return suggestion ? (
        <button
          className={`word ${findCard(state.cards, part) ? "word-saved" : ""}`}
          key={i}
          onClick={(e) => {
            e.stopPropagation();
            if (window.getSelection()?.toString()) return;
            setModal(suggestion);
          }}
          aria-label={`Look up ${part}`}
        >
          {part}
        </button>
      ) : (
        part
      );
    });
  }
  const pending = lesson.suggestions.filter(
    (s) => !findCard(state.cards, s.text) && !state.dismissed.includes(s.id),
  );
  return (
    <>
      <div className="page-eyebrow">
        <span className="date">{dateLabel(lesson.date)}</span>
      </div>
      <div className="lesson-heading">
        <h1 lang="zh-Hant">{lesson.title}</h1>
      </div>
      <div className="reader-toolbar">
        <div>
          <span className="tiny-dot" />
          Tap text for pinyin, highlights for meaning. Select a phrase to make a
          card.
        </div>
        <button
          className={`toggle ${showAll ? "on" : ""}`}
          onClick={() => setShowAll((v) => !v)}
          aria-pressed={showAll}
        >
          <Type size={16} />
          <span>Show all pinyin</span>
          <span className="switch" />
        </button>
      </div>
      <div
        className="reader"
        onMouseUp={captureSelection}
        onTouchEnd={captureSelection}
      >
        {lesson.passages.map((passage, p) => (
          <section className="passage" key={p}>
            <div className="passage-heading">
              <span className="passage-number">0{p + 1}</span>
              <div>
                <h2 lang="zh-Hant">{passage.title}</h2>
              </div>
            </div>
            <div className="chinese-text" lang="zh-Hant">
              {paragraphGroups(passage).map((group, paragraphIndex) => (
                <p className="reading-paragraph" key={paragraphIndex}>
                  {group.map(({ sentence: s, index: i }) => {
                    const key = `${p}-${i}`;
                    const visible = showAll || revealed.includes(key);
                    return (
                      <span
                        className="sentence-block"
                        key={key}
                        data-sentence={s.text}
                      >
                        <span
                          className="sentence"
                          role="button"
                          tabIndex={0}
                          aria-label={`Pronunciation: ${s.text}`}
                          aria-expanded={visible}
                          onKeyDown={(e) => {
                            if (e.target !== e.currentTarget) return;
                            if (e.key === "Enter" || e.key === " ") {
                              e.preventDefault();
                              setRevealed((prev) =>
                                prev.includes(key)
                                  ? prev.filter((k) => k !== key)
                                  : [...prev, key],
                              );
                            }
                          }}
                          onClick={() => {
                            if (window.getSelection()?.toString()) return;
                            clearSelection();
                            setRevealed((prev) =>
                              prev.includes(key)
                                ? prev.filter((k) => k !== key)
                                : [...prev, key],
                            );
                          }}
                        >
                          {textParts(s.text)}
                        </span>
                        {visible && (
                          <span lang="zh-Latn" className="pinyin-line">
                            {s.pinyin}
                          </span>
                        )}
                      </span>
                    );
                  })}
                </p>
              ))}
            </div>
          </section>
        ))}
      </div>
      {(lesson.notes ?? []).length > 0 && (
        <section className="usage-notes">
          {lesson.notes.map((note, i) => (
            <details key={i}>
              <summary lang="zh-Hant">
                {note.title}
                <Plus size={16} />
              </summary>
              <div className="usage-note-text" data-sentence={note.text}>
                {note.text}
              </div>
            </details>
          ))}
        </section>
      )}
      <div className="reading-complete">
        <button
          className={state.read.includes(lesson.id) ? "secondary" : "primary"}
          onClick={() =>
            setState((prev) => ({
              ...prev,
              read: prev.read.includes(lesson.id)
                ? prev.read.filter((id) => id !== lesson.id)
                : [...prev.read, lesson.id],
            }))
          }
        >
          <CheckCheck size={18} />
          {state.read.includes(lesson.id) ? "Lesson read" : "Mark as read"}
        </button>
        <div className="difficulty">
          <span>How did this feel?</span>
          {["Too easy", "About right", "Too hard"].map((f) => (
            <button
              className={state.feedback[lesson.id] === f ? "selected" : ""}
              key={f}
              onClick={() =>
                setState((prev) => ({
                  ...prev,
                  feedback: { ...prev.feedback, [lesson.id]: f },
                }))
              }
            >
              {f}
            </button>
          ))}
        </div>
      </div>
      <section className="suggestions">
        <div className="section-title">
          <div>
            <h2>Suggested cards</h2>
          </div>
          <button
            className="secondary"
            disabled={!pending.length}
            onClick={() => {
              const additions: Card[] = pending
                .filter(
                  (s, i, a) =>
                    a.findIndex((x) => cardKey(x.text) === cardKey(s.text)) ===
                    i,
                )
                .map((s) => ({
                  ...s,
                  lessonId: lesson.id,
                  status: "active",
                  dueAt: Date.now(),
                  reviews: 0,
                  createdAt: Date.now(),
                }));
              setState((prev) => ({
                ...prev,
                cards: [...prev.cards, ...additions],
              }));
              setNotice(`${additions.length} cards saved`);
            }}
          >
            <Plus size={16} />
            Save remaining ({pending.length})
          </button>
        </div>
        <div className="suggestion-grid">
          {lesson.suggestions.map((s) => {
            const saved = findCard(state.cards, s.text);
            const dismissed = state.dismissed.includes(s.id);
            return (
              <article
                key={s.id}
                className={`suggestion-card ${dismissed ? "dismissed" : ""}`}
              >
                <div className="suggestion-top">
                  <span className="kind">
                    {s.kind === "grammar" ? "PATTERN" : "EXPRESSION"}
                  </span>
                  {!saved && (
                    <button
                      className="icon-button"
                      aria-label={`${dismissed ? "Undo dismissal of" : "Dismiss"} ${s.text}`}
                      onClick={() => dismiss(s)}
                    >
                      {dismissed ? <RotateCcw size={15} /> : <X size={15} />}
                    </button>
                  )}
                </div>
                <button className="expression-link" onClick={() => setModal(s)}>
                  <h3 lang="zh-Hant">{s.text}</h3>
                  <span>{s.pinyin}</span>
                </button>
                <p>{s.meaning}</p>
                <button
                  className={saved ? "saved-card" : "save-card"}
                  disabled={Boolean(saved) || dismissed}
                  onClick={() => saveCard(s)}
                >
                  {saved ? <Check size={15} /> : <Plus size={15} />}{" "}
                  {saved
                    ? saved.status === "archived"
                      ? "Archived"
                      : "Saved"
                    : dismissed
                      ? "Dismissed"
                      : "Save flashcard"}
                </button>
              </article>
            );
          })}
        </div>
      </section>
    </>
  );
}
