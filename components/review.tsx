"use client";
import {
  Layers,
  ArrowRight,
  Check,
  ChevronLeft,
  RotateCcw,
  Archive,
  Search,
  CheckCheck,
} from "lucide-react";
import { useState, type Dispatch, type SetStateAction } from "react";
import type { StudyState, Suggestion } from "@/lib/model";
import { rateCard, DAY } from "@/lib/cards";
import { matchesCardSearch } from "@/lib/card-search";
import { createReviewSession } from "@/lib/review-session";
export default function Review({
  state,
  setState,
  setModal,
  navigate,
  now,
}: {
  state: StudyState;
  setState: Dispatch<SetStateAction<StudyState>>;
  setModal: (suggestion: Suggestion) => void;
  navigate: (page: "today") => void;
  now: number;
}) {
  const active = state.cards.filter((c) => c.status === "active");
  const [filter, setFilter] = useState<"active" | "archived" | "all">("active");
  const [query, setQuery] = useState("");
  const [session, setSession] = useState<string[] | null>(null);
  const [cursor, setCursor] = useState(0);
  const [flipped, setFlipped] = useState(false);
  function startSession() {
    setSession(createReviewSession(active));
    setCursor(0);
    setFlipped(false);
  }
  function rate(archive: boolean) {
    if (!session) return;
    const id = session[cursor];
    setState((prev) => ({
      ...prev,
      cards: prev.cards.map((c) => (c.id === id ? rateCard(c, archive) : c)),
    }));
    if (!archive && session.filter((x) => x === id).length === 1)
      setSession((prev) => [...prev!, id]);
    setCursor((n) => n + 1);
    setFlipped(false);
  }
  const currentCard = session
    ? state.cards.find((c) => c.id === session[cursor])
    : null;
  const browse = (
    filter === "archived"
      ? state.cards.filter((c) => c.status === "archived")
      : filter === "active"
        ? active
        : state.cards
  ).filter((c) => matchesCardSearch(c, query));
  return (
    <>
      {session ? (
        <section className="review-session">
          <div className="session-header">
            <button className="text-button" onClick={() => setSession(null)}>
              <ChevronLeft size={16} />
              Back to deck
            </button>
            <span>
              {Math.min(cursor + 1, session.length)} / {session.length}
            </span>
          </div>
          {currentCard ? (
            <>
              <div className="progress">
                <span
                  style={{
                    width: `${(cursor / session.length) * 100}%`,
                  }}
                />
              </div>
              <button
                className={`flashcard ${flipped ? "flipped" : ""}`}
                onClick={() => setFlipped((v) => !v)}
                aria-label={flipped ? "Hide meaning" : "Reveal meaning"}
              >
                <span className="kind">
                  {currentCard.kind === "grammar"
                    ? "GRAMMAR PATTERN"
                    : "EXPRESSION"}
                </span>
                <h2 lang="zh-Hant">{currentCard.text}</h2>
                <div className="card-pinyin">{currentCard.pinyin}</div>
                {flipped ? (
                  <div className="card-answer">
                    <p>{currentCard.meaning}</p>
                    <blockquote lang="zh-Hant">
                      {currentCard.sentence}
                    </blockquote>
                  </div>
                ) : (
                  <span className="flip-hint">
                    Tap to reveal meaning & context <RotateCcw size={15} />
                  </span>
                )}
              </button>
              {flipped ? (
                <div className="rating-buttons">
                  <button className="secondary" onClick={() => rate(false)}>
                    <RotateCcw size={17} />
                    Keep reviewing
                  </button>
                  <button className="primary" onClick={() => rate(true)}>
                    <Check size={18} />
                    Understand already
                  </button>
                </div>
              ) : (
                <p className="session-hint">
                  Try recalling the meaning before you flip.
                </p>
              )}
              <p className="session-hint">
                Keep reviewing brings it back later in this session, once. Your
                session always has an end.
              </p>
            </>
          ) : (
            <div className="empty-state">
              <CheckCheck size={36} />
              <h2>A little more familiar.</h2>
              <p>Session complete. Active cards will return on a later day.</p>
              <button className="primary" onClick={() => setSession(null)}>
                Back to your cards
              </button>
            </div>
          )}
        </section>
      ) : (
        <>
          <div className="review-summary">
            <div>
              <h2>
                {active.length}{" "}
                <span>
                  {active.length === 1 ? "active card" : "active cards"}
                </span>
              </h2>
            </div>
            <button
              className="primary"
              disabled={!active.length}
              onClick={startSession}
            >
              Start review <ArrowRight size={18} />
            </button>
          </div>
          {state.cards.some(
            (c) => c.status === "archived" && c.dueAt <= now,
          ) && (
            <div className="sample-banner">
              <Archive size={18} />
              <span>
                A few archived cards are ready for a gentle refresher.
              </span>
              <button
                onClick={() => {
                  setSession(
                    state.cards
                      .filter((c) => c.status === "archived" && c.dueAt <= now)
                      .slice(0, 3)
                      .map((c) => c.id),
                  );
                  setCursor(0);
                  setFlipped(false);
                }}
              >
                Quick refresher <ArrowRight size={14} />
              </button>
            </div>
          )}
          <div className="deck-toolbar">
            <div className="tabs">
              {(
                [
                  { id: "active", label: "Active" },
                  { id: "archived", label: "Archived" },
                  { id: "all", label: "All" },
                ] as const
              ).map((t) => (
                <button
                  key={t.id}
                  onClick={() => setFilter(t.id)}
                  className={filter === t.id ? "active" : ""}
                  aria-pressed={filter === t.id}
                >
                  {t.label}
                </button>
              ))}
            </div>
            <label className="search">
              <Search size={16} />
              <input
                aria-label="Find a card"
                placeholder="Find a word or phrase…"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
              />
            </label>
          </div>
          {!browse.length ? (
            <div className="empty-state">
              <Layers size={34} />
              {state.cards.length > 0 && <h2>Nothing here right now.</h2>}
              <p>
                {state.cards.length
                  ? "Try another filter or search."
                  : "Save an expression from a lesson, or select any phrase to create a card."}
              </p>
              <button className="secondary" onClick={() => navigate("today")}>
                Return to reading <ArrowRight size={16} />
              </button>
            </div>
          ) : (
            <div className="deck-list">
              {browse.map((c) => (
                <article
                  key={c.id}
                  onClick={(event) => {
                    if (!(event.target as HTMLElement).closest("button"))
                      setModal(c);
                  }}
                >
                  <button className="deck-word" onClick={() => setModal(c)}>
                    <span lang="zh-Hant">{c.text}</span>
                    <small>{c.pinyin}</small>
                  </button>
                  <span className="deck-meaning">{c.meaning}</span>
                  <div className="deck-actions">
                    {c.status === "archived" ? (
                      <button
                        className="text-button"
                        onClick={() =>
                          setState((prev) => ({
                            ...prev,
                            cards: prev.cards.map((x) =>
                              x.id === c.id
                                ? {
                                    ...x,
                                    status: "active",
                                    dueAt: Date.now(),
                                  }
                                : x,
                            ),
                          }))
                        }
                      >
                        <RotateCcw size={14} />
                        Restore
                      </button>
                    ) : (
                      <button
                        className="icon-button"
                        aria-label={`Archive ${c.text}`}
                        onClick={() =>
                          setState((prev) => ({
                            ...prev,
                            cards: prev.cards.map((x) =>
                              x.id === c.id
                                ? {
                                    ...x,
                                    status: "archived",
                                    dueAt: Date.now() + 30 * DAY,
                                  }
                                : x,
                            ),
                          }))
                        }
                      >
                        <Archive size={16} />
                      </button>
                    )}
                  </div>
                </article>
              ))}
            </div>
          )}
        </>
      )}
    </>
  );
}
