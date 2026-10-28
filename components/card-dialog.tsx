"use client";
import { useState, useEffect } from "react";
import Dialog from "./dialog";
import CardArchiveButton from "./card-archive-button";
import type { Card, Suggestion } from "@/lib/model";
import { ArrowUpRight, Check, Plus } from "lucide-react";
export default function CardDialog({
  suggestion,
  existing,
  error,
  onClose,
  onSave,
  onUpdate,
  onUnsave,
  onSource,
  canEdit,
  onRequestEditing,
  onStatusChange,
}: {
  suggestion: Suggestion;
  existing?: Card;
  error: string;
  onClose: () => void;
  onSave: (s: Suggestion) => void;
  onUpdate: (s: Suggestion) => void;
  onUnsave: (card: Card) => void;
  onSource: () => void;
  canEdit: boolean;
  onRequestEditing: () => void;
  onStatusChange: (id: string, status: Card["status"]) => void;
}) {
  const [draft, setDraft] = useState(suggestion);
  const [editing, setEditing] = useState(!suggestion.meaning);
  useEffect(() => {
    setDraft((prev) => ({
      ...prev,
      pinyin: suggestion.pinyin,
      meaning: suggestion.meaning,
    }));
  }, [suggestion.pinyin, suggestion.meaning]);
  return (
    <Dialog
      title={
        draft.kind === "grammar" ? "GRAMMAR & USAGE" : "EXPRESSION IN CONTEXT"
      }
      onClose={onClose}
    >
      <h2 className="dialog-word" lang="zh-Hant">
        {draft.text}
      </h2>
      <p className="dialog-pinyin">{draft.pinyin}</p>
      {error && (
        <p role="alert" className="import-error">
          {error}
        </p>
      )}
      {editing ? (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            existing ? onUpdate(draft) : onSave(draft);
          }}
        >
          <label>
            Characters / pattern
            <input
              required
              value={draft.text}
              onChange={(e) => setDraft({ ...draft, text: e.target.value })}
            />
          </label>
          <label>
            Pinyin
            <input
              required
              value={draft.pinyin}
              onChange={(e) => setDraft({ ...draft, pinyin: e.target.value })}
            />
          </label>
          <label>
            Meaning in context
            <textarea
              required
              value={draft.meaning}
              placeholder="What does this mean here?"
              onChange={(e) => setDraft({ ...draft, meaning: e.target.value })}
            />
          </label>
          <label>
            Original sentence
            <textarea
              required
              value={draft.sentence}
              onChange={(e) => setDraft({ ...draft, sentence: e.target.value })}
            />
          </label>
          <label>
            Card type
            <select
              value={draft.kind}
              onChange={(e) =>
                setDraft({
                  ...draft,
                  kind: e.target.value as "vocabulary" | "grammar",
                })
              }
            >
              <option value="vocabulary">Vocabulary</option>
              <option value="grammar">Grammar / usage</option>
            </select>
          </label>
          <button className="primary full" type="submit">
            {existing ? "Save changes" : "Save flashcard"} <Check size={17} />
          </button>
        </form>
      ) : (
        <>
          <p className="dialog-meaning">{draft.meaning}</p>
          <div className="context-label">FROM THE PASSAGE</div>
          <blockquote className="context-sentence" lang="zh-Hant">
            {draft.sentence}
          </blockquote>
          <div className="dialog-actions">
            <button
              className="text-button"
              onClick={() => {
                if (!canEdit) {
                  onRequestEditing();
                  return;
                }
                setEditing(true);
              }}
            >
              Edit card
            </button>
            <span className="card-archive-slot">
              {existing && (
                <CardArchiveButton
                  card={existing}
                  onChange={(id, status) => {
                    if (!canEdit) {
                      onRequestEditing();
                      return;
                    }
                    onStatusChange(id, status);
                  }}
                />
              )}
            </span>
            <button
              className={existing ? "secondary" : "primary"}
              disabled={existing?.status === "archived"}
              aria-pressed={Boolean(existing)}
              title={
                existing?.status === "active" ? "Remove from review" : undefined
              }
              onClick={() => (existing ? onUnsave(existing) : onSave(draft))}
            >
              {existing ? <Check size={17} /> : <Plus size={17} />}{" "}
              {existing
                ? existing.status === "archived"
                  ? "Archived"
                  : "Saved to review"
                : "Save flashcard"}
            </button>
          </div>
          <button
            className="source-link"
            onClick={onSource}
            disabled={!existing}
            style={{ visibility: existing ? "visible" : "hidden" }}
          >
            Return to original lesson <ArrowUpRight size={14} />
          </button>
        </>
      )}
    </Dialog>
  );
}
