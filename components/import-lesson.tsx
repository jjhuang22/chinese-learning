"use client";
import { useState } from "react";
import { ArrowLeft, Check } from "lucide-react";
import Dialog from "./dialog";
import { parseLessonImport } from "@/lib/import-lesson";
import type { Lesson } from "@/lib/model";
export default function ImportLesson({
  localDemo,
  existingDates,
  onClose,
  onImported,
}: {
  localDemo: boolean;
  existingDates: string[];
  onClose: () => void;
  onImported: (lesson: Lesson) => void;
}) {
  const [raw, setRaw] = useState("");
  const [preview, setPreview] = useState<Lesson | null>(null);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  function validate() {
    setError("");
    try {
      const lesson = parseLessonImport(raw);
      if (existingDates.includes(lesson.date))
        throw new Error(
          "A lesson already exists for this date. Nothing was replaced. Change the date or open the existing lesson.",
        );
      setPreview(lesson);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Invalid lesson.");
    }
  }
  async function save() {
    if (!preview) return;
    setSaving(true);
    setError("");
    try {
      if (localDemo) {
        const existing = JSON.parse(
          localStorage.getItem("everyday-chinese-imports-v1") ?? "[]",
        ) as Lesson[];
        if (existing.some((l) => l.date === preview.date))
          throw new Error("A lesson already exists for this date.");
        localStorage.setItem(
          "everyday-chinese-imports-v1",
          JSON.stringify([...existing, preview]),
        );
        onImported(preview);
        return;
      }
      const response = await fetch("/api/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: raw,
      });
      const result = await response.json();
      if (!response.ok)
        throw new Error(result.error ?? "Could not import the lesson.");
      onImported(result.lesson);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not save the lesson.");
    } finally {
      setSaving(false);
    }
  }
  return (
    <Dialog
      title="IMPORT LESSON"
      onClose={() => {
        if (!saving) onClose();
      }}
    >
      {preview ? (
        <>
          <button
            className="text-button"
            onClick={() => {
              setPreview(null);
              setError("");
            }}
            disabled={saving}
          >
            <ArrowLeft size={15} />
            Edit pasted lesson
          </button>
          <div className="import-preview">
            <span className="date">{preview.date}</span>
            <h2 lang="zh-Hant">{preview.title}</h2>
            {preview.passages.map((p, i) => (
              <div key={i}>
                <h3 lang="zh-Hant">{p.title}</h3>
                <p lang="zh-Hant">{p.sentences.map((s) => s.text).join("")}</p>
              </div>
            ))}
            <p>
              {preview.suggestions.length} suggested cards ·{" "}
              {preview.notes.length} usage notes
            </p>
            <p className="muted">
              Cards enter review only when you approve them.
            </p>
          </div>
          <button className="primary full" onClick={save} disabled={saving}>
            <Check size={17} />
            {saving
              ? "Saving…"
              : localDemo
                ? "Save on this device"
                : "Save to my library"}
          </button>
        </>
      ) : (
        <>
          <p className="import-help">
            Paste the JSON lesson from your ChatGPT automation.
          </p>
          <label className="import-label" htmlFor="lesson-json">
            Lesson JSON
          </label>
          <textarea
            id="lesson-json"
            className="import-input"
            spellCheck={false}
            value={raw}
            onChange={(e) => {
              setRaw(e.target.value);
              setError("");
            }}
            placeholder={
              '{\n  "schemaVersion": 1,\n  "date": "YYYY-MM-DD",\n  ...\n}'
            }
          />
          <div className="import-resources">
            <a
              href="/automation-instructions.txt"
              target="_blank"
              rel="noreferrer"
            >
              Automation instructions ↗
            </a>
            <a href="/example-lesson.json" target="_blank" rel="noreferrer">
              Example JSON ↗
            </a>
          </div>
          <button
            className="primary full"
            onClick={validate}
            disabled={!raw.trim()}
          >
            Preview lesson
          </button>
        </>
      )}
      {error && (
        <p className="import-error" role="alert">
          {error}
        </p>
      )}
    </Dialog>
  );
}
