"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  BookOpen,
  Library,
  Layers,
  Check,
  Plus,
  X,
  Settings,
  LogOut,
} from "lucide-react";
import Dialog from "./dialog";
import Reader from "./reader";
import Review from "./review";
import LessonLibrary from "./lesson-library";
import CardDialog from "./card-dialog";
import ImportLesson from "./import-lesson";
import { pinyin } from "pinyin-pro";
import {
  Card,
  emptyState,
  findCard,
  Lesson,
  localDate,
  lessonSchema,
  StudyState,
  Suggestion,
} from "@/lib/model";
import { useProgress } from "@/hooks/use-progress";
type Page = "today" | "library" | "review";
type Pick = { text: string; sentence: string; lessonId: string };
export default function StudyApp({
  initialLessons,
  localDemo,
  initialState = emptyState,
  initialRevision = 0,
}: {
  initialLessons: Lesson[];
  localDemo: boolean;
  initialState?: StudyState;
  initialRevision?: number;
}) {
  const [page, setPage] = useState<Page>("today");
  const [lessons, setLessons] = useState<Lesson[]>(initialLessons);
  const [lessonId, setLessonId] = useState(
    initialLessons.at(-1)?.id ?? "empty",
  );
  const { state, setState, syncError, conflict, retrySync, storageError } =
    useProgress(initialState, initialRevision, localDemo);
  const [lessonStorageError, setLessonStorageError] = useState("");
  useEffect(() => {
    if (!localDemo) return;
    try {
      const raw = localStorage.getItem("everyday-chinese-imports-v1");
      if (raw) {
        const imported = lessonSchema.array().parse(JSON.parse(raw));
        if (Array.isArray(imported) && imported.length) {
          setLessons((prev) =>
            [
              ...prev.filter((l) => !imported.some((i) => i.date === l.date)),
              ...imported,
            ].sort((a, b) => a.date.localeCompare(b.date)),
          );
          setLessonId(imported.at(-1)!.id);
        }
      }
    } catch {
      setLessonStorageError("Local lessons could not be loaded.");
    }
  }, [localDemo]);
  const [modal, setModal] = useState<Suggestion | null>(null);
  const [selection, setSelection] = useState<Pick | null>(null);
  const [importing, setImporting] = useState(false);
  const [settings, setSettings] = useState(false);
  const [notice, setNotice] = useState("");
  const reader = useRef<HTMLDivElement>(null);
  const lesson = lessons.find((l) => l.id === lessonId) ??
    lessons[lessons.length - 1] ?? {
      id: "empty",
      date: localDate(),
      title: "Your first lesson",
      subtitle: "",
      passages: [],
      suggestions: [],
      notes: [],
    };
  const active = state.cards.filter((c) => c.status === "active");
  const due = active.filter((c) => c.dueAt <= Date.now());
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 30000);
    return () => clearInterval(t);
  }, []);
  function returnToLock() {
    window.location.replace("/sign-in");
  }
  useEffect(() => {
    if (localDemo) return;
    let live = true;
    const check = async () => {
      try {
        const response = await fetch("/api/session", { cache: "no-store" });
        if (live && response.status === 401) returnToLock();
      } catch {
        /* Keep unsaved work while offline. */
      }
    };
    window.addEventListener("focus", check);
    window.addEventListener("pageshow", check);
    return () => {
      live = false;
      window.removeEventListener("focus", check);
      window.removeEventListener("pageshow", check);
    };
  }, [localDemo]);
  useEffect(() => {
    if (!notice) return;
    const t = setTimeout(() => setNotice(""), 4500);
    return () => clearTimeout(t);
  }, [notice]);
  useEffect(() => {
    setSelection(null);
  }, [lessonId]);
  const closeModal = useCallback(() => setModal(null), []);
  function navigate(next: Page) {
    setPage(next);
    setSelection(null);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }
  function openLesson(id: string) {
    setLessonId(id);
    navigate("today");
  }
  function saveCard(s: Suggestion) {
    const found = findCard(state.cards, s.text);
    if (found) {
      setNotice(
        found.status === "archived"
          ? "This card is archived. Restore it from Review."
          : "Already saved to your review deck.",
      );
      return;
    }
    const card: Card = {
      ...s,
      lessonId: lesson.id,
      status: "active",
      dueAt: Date.now(),
      reviews: 0,
      createdAt: Date.now(),
    };
    setState((prev) => ({
      ...prev,
      cards: [...prev.cards, card],
      dismissed: prev.dismissed.filter((id) => id !== s.id),
    }));
    setNotice("Saved to your review deck");
  }
  function captureSelection() {
    const sel = window.getSelection();
    const text = sel?.toString().trim();
    if (
      !sel ||
      !text ||
      !reader.current?.contains(sel.anchorNode) ||
      !reader.current?.contains(sel.focusNode)
    )
      return;
    const a = sel.anchorNode?.parentElement?.closest("[data-sentence]");
    const f = sel.focusNode?.parentElement?.closest("[data-sentence]");
    const context = a === f ? (a?.getAttribute("data-sentence") ?? text) : text;
    setSelection({ text, sentence: context, lessonId: lesson.id });
  }
  useEffect(() => {
    const selected = () => {
      const s = window.getSelection();
      if (!s?.isCollapsed) captureSelection();
    };
    document.addEventListener("selectionchange", selected);
    return () => document.removeEventListener("selectionchange", selected);
  });
  async function createSelected() {
    if (!selection) return;
    const selected = selection;
    setSelection(null);
    window.getSelection()?.removeAllRanges();
    const found =
      findCard(state.cards, selected.text) ??
      lesson.suggestions.find((s) => s.text === selected.text);
    if (found) {
      setModal(found);
      return;
    }
    const draft: Suggestion = {
      id: crypto.randomUUID(),
      text: selected.text,
      pinyin: pinyin(selected.text),
      meaning: "",
      sentence: selected.sentence,
      kind: "vocabulary",
    };
    setModal(draft);
  }
  async function lockApp() {
    try {
      const response = await fetch("/api/lock", { method: "POST" });
      if (!response.ok) throw new Error();
      returnToLock();
    } catch {
      setNotice("Could not lock the app. Check your connection and try again.");
    }
  }
  return (
    <div className="app-shell">
      <aside className="sidebar">
        <a className="brand" href="/" aria-label="Everyday Chinese home">
          <span className="brand-mark">日</span>
          <span>
            日常<small>EVERYDAY CHINESE</small>
          </span>
        </a>

        <nav>
          {(
            [
              { id: "today", label: "Today", icon: BookOpen },
              { id: "library", label: "Library", icon: Library },
              { id: "review", label: "Review", icon: Layers },
            ] as const
          ).map((item) => (
            <button
              key={item.id}
              className={page === item.id ? "nav-active" : ""}
              onClick={() => navigate(item.id)}
            >
              <item.icon size={19} />
              <span>{item.label}</span>
              {item.id === "review" && due.length > 0 && (
                <span className="count">{due.length}</span>
              )}
            </button>
          ))}
        </nav>
        <div className="sidebar-bottom">
          <button className="settings-button" onClick={() => setSettings(true)}>
            <Settings size={17} /> Settings & account
          </button>
          <div className="connection">
            <span className={!localDemo ? "dot connected" : "dot"} />
            {!localDemo ? "Private cloud sync" : "Saved on this device"}
          </div>
        </div>
      </aside>
      <main>
        <header className="topbar">
          <span className="breadcrumb">
            {page === "today"
              ? "Today"
              : page === "library"
                ? "Library"
                : "Review"}
          </span>
          <div className="topbar-right">
            <button
              aria-label="Open settings"
              className="mobile-settings icon-button"
              onClick={() => setSettings(true)}
            >
              <Settings size={20} />
            </button>
            <button
              className="text-button import-trigger"
              onClick={() => setImporting(true)}
            >
              <Plus size={16} />
              Import lesson
            </button>
          </div>
        </header>
        {(storageError || lessonStorageError) && (
          <div className="warning">{storageError || lessonStorageError}</div>
        )}
        {syncError && (
          <div className="warning">
            {syncError}{" "}
            {!conflict && <button onClick={retrySync}>Retry sync</button>}
          </div>
        )}
        <div className="content" ref={reader}>
          {page === "today" && (
            <Reader
              key={lesson.id}
              lesson={lesson}
              state={state}
              setState={setState}
              setModal={setModal}
              setNotice={setNotice}
              saveCard={saveCard}
              captureSelection={captureSelection}
              clearSelection={() => setSelection(null)}
            />
          )}
          {page === "library" && (
            <LessonLibrary
              lessons={lessons}
              state={state}
              openLesson={openLesson}
            />
          )}
          {page === "review" && (
            <Review
              state={state}
              setState={setState}
              setModal={setModal}
              navigate={navigate}
              now={now}
            />
          )}
        </div>
      </main>
      <nav className="mobile-nav">
        {(
          [
            { id: "today", label: "Today", icon: BookOpen },
            { id: "library", label: "Library", icon: Library },
            { id: "review", label: "Review", icon: Layers },
          ] as const
        ).map((item) => (
          <button
            key={item.id}
            className={page === item.id ? "active" : ""}
            onClick={() => navigate(item.id)}
          >
            <item.icon size={21} />
            <span>
              {item.label}
              {item.id === "review" && due.length ? ` · ${due.length}` : ""}
            </span>
          </button>
        ))}
      </nav>
      {selection && (
        <div
          className="selection-bar"
          role="region"
          aria-label="Selected text actions"
          onPointerDown={(e) => e.preventDefault()}
        >
          <span lang="zh-Hant">
            {selection.text.length > 18
              ? selection.text.slice(0, 18) + "…"
              : selection.text}
          </span>
          <button onClick={createSelected}>
            <Plus size={16} />
            Create flashcard
          </button>
          <button
            className="icon-button"
            aria-label="Cancel selection"
            onClick={() => {
              setSelection(null);
              window.getSelection()?.removeAllRanges();
            }}
          >
            <X size={17} />
          </button>
        </div>
      )}
      {modal && (
        <CardDialog
          key={modal.id}
          suggestion={findCard(state.cards, modal.text) ?? modal}
          existing={findCard(state.cards, modal.text)}
          onClose={closeModal}
          onSave={(s) => {
            saveCard(s);
            setModal(null);
          }}
          onSource={() => {
            const c = findCard(state.cards, modal.text);
            if (c) {
              openLesson(c.lessonId);
              setModal(null);
            }
          }}
          onUpdate={(s) => {
            setState((prev) => ({
              ...prev,
              cards: prev.cards.map((c) =>
                c.id === s.id ? { ...c, ...s } : c,
              ),
            }));
            setNotice("Card updated");
            setModal(null);
          }}
        />
      )}
      {importing && (
        <ImportLesson
          localDemo={localDemo}
          existingDates={lessons.map((l) => l.date)}
          onClose={() => setImporting(false)}
          onImported={(lesson) => {
            setLessons((prev) =>
              [...prev, lesson].sort((a, b) => a.date.localeCompare(b.date)),
            );
            setLessonId(lesson.id);
            navigate("today");
            setImporting(false);
            setNotice(
              localDemo
                ? "Lesson saved on this device"
                : "Lesson saved privately to Supabase",
            );
          }}
        />
      )}
      {settings && (
        <Dialog title="Your daily practice" onClose={() => setSettings(false)}>
          <div className="settings-section">
            <span className="eyebrow">READING ROUTINE</span>
            <h3>Import from ChatGPT</h3>
            <p>
              Traditional characters, Taiwan Mandarin. Two connected passages
              with occasional variations in format.
            </p>
            <p className="muted">
              Paste your ChatGPT lesson using Import lesson. No API key or
              separate AI billing is needed. For custom cards, edit the
              suggested pinyin and enter the meaning yourself.
            </p>
          </div>
          <div className="settings-section">
            <h3>Private access</h3>
            {localDemo ? (
              <p>This local prototype saves on this device.</p>
            ) : (
              <>
                <p>
                  This device stays unlocked for 30 days. Your lessons and cards
                  sync privately to Supabase.
                </p>
                <button className="secondary" onClick={lockApp}>
                  <LogOut size={16} />
                  Lock this device
                </button>
              </>
            )}
          </div>
          <div className="settings-section">
            <h3>On your iPhone</h3>
            <p>
              Open the deployed website in Safari, then Share → Add to Home
              Screen. Your passcode gives this device access to the same private
              library.
            </p>
          </div>
          <div className="settings-section">
            <h3>Keep a backup</h3>
            <button
              className="secondary"
              onClick={() => {
                const blob = new Blob([JSON.stringify(state, null, 2)], {
                  type: "application/json",
                });
                const url = URL.createObjectURL(blob);
                const a = document.createElement("a");
                a.href = url;
                a.download = "everyday-chinese-progress.json";
                a.click();
                URL.revokeObjectURL(url);
              }}
            >
              Export progress
            </button>
          </div>
        </Dialog>
      )}
      {notice && (
        <div className="toast" role="status">
          <Check size={17} />
          {notice}
        </div>
      )}
    </div>
  );
}
