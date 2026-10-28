"use client";
import { useNow } from "./use-now";
import { useCallback, useEffect, useState } from "react";
import {
  BookOpen,
  Library,
  Layers,
  Plus,
  Settings,
  Check,
  LogOut,
} from "lucide-react";
import Dialog from "./dialog";
import ImportLesson from "./import-lesson";
import ReaderScreen from "./reader-screen";
import LibraryScreen from "./library-screen";
import ReviewScreen from "./review-screen";
import CardDialog from "./card-dialog";
import { useProgress, PROGRESS_STORAGE } from "./use-progress";
import { addCards, cardCollision } from "@/lib/cards";
import {
  emptyState,
  findCard,
  lessonSchema,
  suggestionSchema,
  localDate,
  type Lesson,
  type StudyState,
  type Suggestion,
} from "@/lib/model";
import { downloadJson } from "@/lib/download";
type Page = "today" | "library" | "review";
const navigation = [
  { id: "today", label: "Today", icon: BookOpen },
  { id: "library", label: "Library", icon: Library },
  { id: "review", label: "Review", icon: Layers },
] as const;
export default function StudyApp({
  initialLessons,
  localDemo,
  initialState = emptyState,
}: {
  initialLessons: Lesson[];
  localDemo: boolean;
  initialState?: StudyState;
}) {
  const [page, setPage] = useState<Page>("today");
  const [lessons, setLessons] = useState<Lesson[]>(initialLessons);
  const [lessonId, setLessonId] = useState(
    initialLessons.at(-1)?.id ?? "empty",
  );
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
      setStorageError("Local lessons could not be loaded.");
    }
  }, [localDemo]);
  const [modal, setModal] = useState<Suggestion | null>(null);
  const [importing, setImporting] = useState(false);
  const [settings, setSettings] = useState(false);
  const [notice, setNotice] = useState("");
  const [lessonStorageError, setStorageError] = useState("");
  const [cardError, setCardError] = useState("");
  const returnToLock = useCallback(() => {
    window.location.replace("/sign-in");
  }, []);
  const {
    state,
    setState,
    flush,
    syncError,
    storageError,
    blocked,
    resetLocalProgress,
  } = useProgress(initialState, localDemo, returnToLock);
  function openCard(s: Suggestion) {
    setCardError("");
    setModal(s);
  }
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
  const now = useNow();
  const due = state.cards.filter(
    (c) => c.status === "active" && c.dueAt <= now,
  );
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
  const closeModal = useCallback(() => setModal(null), []);
  function navigate(next: Page) {
    setPage(next);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }
  function openLesson(id: string) {
    setLessonId(id);
    navigate("today");
  }
  function validateCard(s: Suggestion) {
    if (
      !suggestionSchema.safeParse(s).success ||
      cardCollision(state.cards, s)
    ) {
      setCardError(
        "Enter all card fields and choose an expression that is not already saved.",
      );
      return false;
    }
    return true;
  }
  function saveCard(s: Suggestion) {
    const found = findCard(state.cards, s.text);
    if (found) {
      setCardError(
        found.status === "archived"
          ? "This card is archived. Restore it from Review."
          : "Already saved to your review deck.",
      );
      return;
    }
    if (!validateCard(s)) return false;
    setState((prev) => addCards(prev, [s], lesson.id));
    setNotice("Saved to your review deck");
    return true;
  }
  async function retrySync() {
    if (await flush()) setNotice("Your progress is synced.");
  }
  const [locking, setLocking] = useState(false);
  async function lockApp() {
    if (locking) return;
    setLocking(true);
    try {
      if (!(await flush())) return;
      const response = await fetch("/api/lock", { method: "POST" });
      if (!response.ok) throw new Error();
      returnToLock();
    } catch {
      setNotice("Could not lock the app. Check your connection and try again.");
    } finally {
      setLocking(false);
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
          {navigation.map((item) => (
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
        {lessonStorageError && (
          <div className="warning">{lessonStorageError}</div>
        )}
        {storageError && (
          <div className="warning">
            {storageError}{" "}
            {blocked && (
              <>
                <button
                  onClick={() => {
                    const raw = localStorage.getItem(PROGRESS_STORAGE);
                    if (raw)
                      downloadJson(
                        raw,
                        "everyday-chinese-original-progress.json",
                      );
                  }}
                >
                  Export original data
                </button>
                <button onClick={resetLocalProgress}>
                  Reset local progress
                </button>
              </>
            )}
          </div>
        )}
        {syncError && (
          <div className="warning">
            {syncError} <button onClick={retrySync}>Retry sync</button>
          </div>
        )}
        <div className="content">
          {page === "today" && (
            <ReaderScreen
              key={lesson.id}
              lesson={lesson}
              state={state}
              setState={setState}
              saveCard={saveCard}
              setModal={openCard}
              setNotice={setNotice}
            />
          )}
          {page === "library" && (
            <LibraryScreen
              lessons={lessons}
              state={state}
              openLesson={openLesson}
            />
          )}
          {page === "review" && (
            <ReviewScreen
              state={state}
              setState={setState}
              setModal={openCard}
              onRead={() => navigate("today")}
            />
          )}
        </div>
      </main>
      <nav className="mobile-nav">
        {navigation.map((item) => (
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
      {modal && (
        <CardDialog
          key={modal.id}
          suggestion={findCard(state.cards, modal.text) ?? modal}
          existing={findCard(state.cards, modal.text)}
          error={cardError}
          onClose={closeModal}
          onSave={(s) => {
            if (saveCard(s)) setModal(null);
          }}
          onSource={() => {
            const c = findCard(state.cards, modal.text);
            if (c) {
              openLesson(c.lessonId);
              setModal(null);
            }
          }}
          onUpdate={(s) => {
            if (!validateCard(s)) return;
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
                {syncError && <p role="alert">{syncError}</p>}
                <button
                  className="secondary"
                  onClick={lockApp}
                  disabled={locking}
                >
                  <LogOut size={16} />
                  {locking ? "Saving and locking…" : "Lock this device"}
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
                downloadJson(
                  JSON.stringify(state, null, 2),
                  "everyday-chinese-progress.json",
                );
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
