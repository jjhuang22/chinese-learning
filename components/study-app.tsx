"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  BookOpen,
  Library,
  Layers,
  ArrowUpRight,
  ArrowRight,
  Check,
  ChevronLeft,
  ChevronRight,
  Plus,
  X,
  Settings,
  RotateCcw,
  Archive,
  Search,
  Type,
  LogOut,
  CheckCheck,
} from "lucide-react";
import Dialog from "./dialog";
import ImportLesson from "./import-lesson";
import { pinyin } from "pinyin-pro";
import {
  Card,
  emptyState,
  findCard,
  Lesson,
  localDate,
  paragraphGroups,
  StudyState,
  Suggestion,
} from "@/lib/model";
import { cloudEnabled, supabase } from "@/lib/supabase";
const STORAGE = "everyday-chinese-v1";
type Page = "today" | "library" | "review";
type Pick = { text: string; sentence: string; lessonId: string };
function shortDate(date: string) {
  return new Date(date + "T12:00:00").toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  });
}
function dateLabel(date: string) {
  return new Date(date + "T12:00:00").toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
  });
}

export default function StudyApp({
  initialLessons,
  localDemo,
}: {
  initialLessons: Lesson[];
  localDemo: boolean;
}) {
  const sampleLessons = initialLessons;
  const [page, setPage] = useState<Page>("today");
  const [lessons, setLessons] = useState<Lesson[]>(sampleLessons);
  const [lessonId, setLessonId] = useState(
    initialLessons.at(-1)?.id ?? "empty",
  );
  const [state, setState] = useState<StudyState>(emptyState);
  const [loaded, setLoaded] = useState(false);
  useEffect(() => {
    if (!localDemo) return;
    try {
      const raw = localStorage.getItem("everyday-chinese-imports-v1");
      if (raw) {
        const imported = JSON.parse(raw) as Lesson[];
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
  const [showAll, setShowAll] = useState(false);
  const [revealed, setRevealed] = useState<string[]>([]);
  const [modal, setModal] = useState<Suggestion | null>(null);
  const [selection, setSelection] = useState<Pick | null>(null);
  const [importing, setImporting] = useState(false);
  const [settings, setSettings] = useState(false);
  const [notice, setNotice] = useState("");
  const [syncError, setSyncError] = useState("");
  const [storageError, setStorageError] = useState("");
  const [userId, setUserId] = useState<string | null>(null);
  const [email, setEmail] = useState("");
  const [signedEmail, setSignedEmail] = useState("");
  const [cloudReady, setCloudReady] = useState(false);

  const [filter, setFilter] = useState<"due" | "all" | "archived">("due");
  const [query, setQuery] = useState("");
  const [session, setSession] = useState<string[] | null>(null);
  const [cursor, setCursor] = useState(0);
  const [flipped, setFlipped] = useState(false);
  const reader = useRef<HTMLDivElement>(null);
  const reconnect = useRef<null | (() => Promise<void>)>(null);
  const stateRef = useRef(state);
  stateRef.current = state;
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
  useEffect(() => {
    if (!localDemo) {
      setLoaded(true);
      return;
    }
    try {
      const raw = localStorage.getItem(STORAGE);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (
          Array.isArray(parsed.cards) &&
          Array.isArray(parsed.dismissed) &&
          Array.isArray(parsed.read) &&
          parsed.feedback
        )
          setState(parsed);
      }
    } catch {
      setStorageError(
        "Browser storage is unavailable. Your progress may not persist.",
      );
    }
    setLoaded(true);
  }, []);
  useEffect(() => {
    if (!loaded || !localDemo) return;
    try {
      localStorage.setItem(STORAGE, JSON.stringify(state));
    } catch {
      setStorageError("Progress could not be saved in this browser.");
    }
  }, [state, loaded]);
  useEffect(() => {
    if (!supabase) return;
    let live = true;
    let revision = 0;
    async function connect(id: string | null, emailAddress: string = "") {
      const request = ++revision;
      setCloudReady(false);
      setUserId(id);
      setSignedEmail(emailAddress);
      if (!id) {
        if (!localDemo) window.location.replace("/sign-in");
        return;
      }
      const [stored, history] = await Promise.all([
        supabase!
          .from("learner_state")
          .select("data")
          .eq("user_id", id)
          .maybeSingle(),
        supabase!
          .from("lessons")
          .select("content")
          .eq("user_id", id)
          .order("lesson_date"),
      ]);
      if (!live || request !== revision) return;
      if (stored.error || history.error) {
        setSyncError(
          "Cloud sync is unavailable. Keep this tab open and retry to save your changes.",
        );
        return;
      }
      if (stored.data?.data) setState(stored.data.data as StudyState);
      if (history.data?.length) {
        const generated = history.data.map((row) => row.content as Lesson);
        setLessons(generated);
        setLessonId(generated[generated.length - 1].id);
      }
      setSyncError("");
      setCloudReady(true);
    }
    reconnect.current = async () => {
      const { data } = await supabase!.auth.getSession();
      await connect(data.session?.user.id ?? null, data.session?.user.email);
    };
    void supabase.auth
      .getSession()
      .then(({ data }) =>
        connect(data.session?.user.id ?? null, data.session?.user.email),
      );
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, s) => {
      if (_event === "INITIAL_SESSION" || _event === "TOKEN_REFRESHED") return;
      setTimeout(() => void connect(s?.user.id ?? null, s?.user.email), 0);
    });
    return () => {
      live = false;
      subscription.unsubscribe();
    };
  }, []);
  useEffect(() => {
    if (!loaded || !userId || !cloudReady || !supabase) return;
    const t = setTimeout(() => {
      void supabase!
        .from("learner_state")
        .upsert({
          user_id: userId,
          data: state,
          updated_at: new Date().toISOString(),
        })
        .then(({ error }) =>
          setSyncError(
            error
              ? "Cloud save failed. Keep this tab open and retry to save your changes."
              : "",
          ),
        );
    }, 500);
    return () => clearTimeout(t);
  }, [state, loaded, userId, cloudReady]);
  useEffect(() => {
    if (!notice) return;
    const t = setTimeout(() => setNotice(""), 4500);
    return () => clearTimeout(t);
  }, [notice]);
  useEffect(() => {
    setShowAll(false);
    setRevealed([]);
    setSelection(null);
  }, [lessonId]);
  const closeModal = useCallback(() => setModal(null), []);
  function navigate(next: Page) {
    setPage(next);
    setSession(null);
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
  function dismiss(s: Suggestion) {
    setState((prev) => ({
      ...prev,
      dismissed: prev.dismissed.includes(s.id)
        ? prev.dismissed.filter((x) => x !== s.id)
        : [...prev.dismissed, s.id],
    }));
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
  async function signIn(e: React.FormEvent) {
    e.preventDefault();
    if (!supabase) return;
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: {
        emailRedirectTo: window.location.origin + "/auth/callback",
        shouldCreateUser: false,
      },
    });
    setNotice(
      error
        ? "Could not send sign-in link. Check your account and Supabase setup."
        : "Check your email for a sign-in link.",
    );
  }
  async function retrySync() {
    if (!supabase || !userId) return;
    if (!cloudReady) {
      await reconnect.current?.();
      return;
    }
    const { error } = await supabase.from("learner_state").upsert({
      user_id: userId,
      data: stateRef.current,
      updated_at: new Date().toISOString(),
    });
    if (!error) {
      setSyncError("");
      setCloudReady(true);
      setNotice("Your progress is synced.");
    } else
      setNotice(
        "Still unable to sync. Check the Supabase table and connection.",
      );
  }
  function startSession() {
    setSession(due.slice(0, 12).map((c) => c.id));
    setCursor(0);
    setFlipped(false);
  }
  function rate(archive: boolean) {
    if (!session) return;
    const id = session[cursor];
    setState((prev) => ({
      ...prev,
      cards: prev.cards.map((c) =>
        c.id === id
          ? {
              ...c,
              status: archive ? "archived" : "active",
              reviews: c.reviews + 1,
              dueAt:
                now +
                (archive
                  ? 30 * 86400000
                  : Math.min(7, c.reviews + 1) * 86400000),
            }
          : c,
      ),
    }));
    if (!archive && session.filter((x) => x === id).length === 1)
      setSession((prev) => [...prev!, id]);
    setCursor((n) => n + 1);
    setFlipped(false);
  }
  const currentCard = session
    ? state.cards.find((c) => c.id === session[cursor])
    : null;
  const pending = lesson.suggestions.filter(
    (s) => !findCard(state.cards, s.text) && !state.dismissed.includes(s.id),
  );
  const browse = (
    filter === "archived"
      ? state.cards.filter((c) => c.status === "archived")
      : filter === "due"
        ? due
        : state.cards
  ).filter((c) =>
    `${c.text} ${c.pinyin} ${c.meaning}`
      .toLowerCase()
      .includes(query.toLowerCase()),
  );
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
            <span className={userId && cloudReady ? "dot connected" : "dot"} />
            {userId && cloudReady ? "Cloud connected" : "Saved on this device"}
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
        {storageError && <div className="warning">{storageError}</div>}
        {syncError && (
          <div className="warning">
            {syncError} <button onClick={retrySync}>Retry sync</button>
          </div>
        )}
        <div className="content" ref={reader}>
          {page === "today" && (
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
                  Tap text for pinyin, highlights for meaning. Select a phrase
                  to make a card.
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
                                    if (window.getSelection()?.toString())
                                      return;
                                    setSelection(null);
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
                      <div
                        className="usage-note-text"
                        data-sentence={note.text}
                      >
                        {note.text}
                      </div>
                    </details>
                  ))}
                </section>
              )}
              <div className="reading-complete">
                <button
                  className={
                    state.read.includes(lesson.id) ? "secondary" : "primary"
                  }
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
                  {state.read.includes(lesson.id)
                    ? "Lesson read"
                    : "Mark as read"}
                </button>
                <div className="difficulty">
                  <span>How did this feel?</span>
                  {["Too easy", "About right", "Too hard"].map((f) => (
                    <button
                      className={
                        state.feedback[lesson.id] === f ? "selected" : ""
                      }
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
                            a.findIndex((x) => x.text === s.text) === i,
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
                              {dismissed ? (
                                <RotateCcw size={15} />
                              ) : (
                                <X size={15} />
                              )}
                            </button>
                          )}
                        </div>
                        <button
                          className="expression-link"
                          onClick={() => setModal(s)}
                        >
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
          )}
          {page === "library" && (
            <>
              <span className="eyebrow">YOUR READING SHELF</span>
              <div className="page-heading">
                <h1>Every lesson, kept.</h1>
                <p>
                  Pick up where you left off, or return to a familiar passage.
                </p>
              </div>
              <div className="library-summary">
                <BookOpen size={20} />
                <span>{lessons.length} lessons</span>
                <span className="meta-divider" />
                <span>{state.read.length} read</span>
              </div>
              {Object.entries(
                Object.groupBy(
                  [...lessons].sort((a, b) => b.date.localeCompare(a.date)),
                  (l) =>
                    new Date(l.date + "T12:00:00").toLocaleDateString("en-US", {
                      month: "long",
                      year: "numeric",
                    }),
                ),
              ).map(([month, items]) => (
                <section key={month} className="library-month">
                  <h2>{month}</h2>
                  {items?.map((l) => (
                    <button
                      className="library-lesson"
                      key={l.id}
                      onClick={() => openLesson(l.id)}
                    >
                      <span className="library-day">{shortDate(l.date)}</span>
                      <div>
                        <h3 lang="zh-Hant">{l.title}</h3>
                        <p>{l.subtitle}</p>
                        <span>
                          {l.passages.length} passages ·{" "}
                          {
                            state.cards.filter((c) => c.lessonId === l.id)
                              .length
                          }{" "}
                          saved cards
                        </span>
                      </div>
                      <span className="read-status">
                        {state.read.includes(l.id) ? (
                          <>
                            <Check size={15} />
                            Read
                          </>
                        ) : (
                          "Unread"
                        )}
                      </span>
                      <ArrowUpRight size={20} />
                    </button>
                  ))}
                </section>
              ))}
            </>
          )}
          {page === "review" && (
            <>
              <span className="eyebrow">MAKE IT STICK</span>
              <div className="page-heading">
                <h1>
                  A little repetition.
                  <br />A lasting vocabulary.
                </h1>
                <p>
                  Your words and patterns, with the context that made them
                  matter.
                </p>
              </div>
              {session ? (
                <section className="review-session">
                  <div className="session-header">
                    <button
                      className="text-button"
                      onClick={() => setSession(null)}
                    >
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
                            Tap to reveal meaning & context{" "}
                            <RotateCcw size={15} />
                          </span>
                        )}
                      </button>
                      {flipped ? (
                        <div className="rating-buttons">
                          <button
                            className="secondary"
                            onClick={() => rate(false)}
                          >
                            <RotateCcw size={17} />
                            Keep reviewing
                          </button>
                          <button
                            className="primary"
                            onClick={() => rate(true)}
                          >
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
                        Keep reviewing brings it back later in this session,
                        once. Your session always has an end.
                      </p>
                    </>
                  ) : (
                    <div className="empty-state">
                      <CheckCheck size={36} />
                      <h2>A little more familiar.</h2>
                      <p>
                        Session complete. Active cards will return on a later
                        day.
                      </p>
                      <button
                        className="primary"
                        onClick={() => setSession(null)}
                      >
                        Back to your cards
                      </button>
                    </div>
                  )}
                </section>
              ) : (
                <>
                  <div className="review-summary">
                    <div>
                      <span className="eyebrow">READY WHEN YOU ARE</span>
                      <h2>
                        {due.length} <span>cards to revisit</span>
                      </h2>
                      <p>
                        A short session. Up to 12 cards, plus a second look at
                        the ones you keep.
                      </p>
                    </div>
                    <button
                      className="primary"
                      disabled={!due.length}
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
                              .filter(
                                (c) =>
                                  c.status === "archived" && c.dueAt <= now,
                              )
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
                          { id: "due", label: "Due" },
                          { id: "all", label: "Browse all" },
                          { id: "archived", label: "Archive" },
                        ] as const
                      ).map((t) => (
                        <button
                          key={t.id}
                          onClick={() => setFilter(t.id)}
                          className={filter === t.id ? "active" : ""}
                        >
                          {t.label}
                        </button>
                      ))}
                    </div>
                    <label className="search">
                      <Search size={16} />
                      <input
                        aria-label="Find a card"
                        placeholder="Find a word or pattern…"
                        value={query}
                        onChange={(e) => setQuery(e.target.value)}
                      />
                    </label>
                  </div>
                  {!browse.length ? (
                    <div className="empty-state">
                      <Layers size={34} />
                      <h2>
                        {state.cards.length
                          ? "Nothing here right now."
                          : "Your vocabulary starts with a phrase."}
                      </h2>
                      <p>
                        {state.cards.length
                          ? "Try another view, or return when cards are due."
                          : "Save an expression from a lesson, or select any phrase to create a card."}
                      </p>
                      <button
                        className="secondary"
                        onClick={() => navigate("today")}
                      >
                        Return to reading <ArrowRight size={16} />
                      </button>
                    </div>
                  ) : (
                    <div className="deck-list">
                      {browse.map((c) => (
                        <article key={c.id}>
                          <button
                            className="deck-word"
                            onClick={() => setModal(c)}
                          >
                            <span lang="zh-Hant">{c.text}</span>
                            <small>{c.pinyin}</small>
                          </button>
                          <span className="deck-meaning">{c.meaning}</span>
                          <div className="deck-actions">
                            <button
                              className="text-button"
                              onClick={() => {
                                setSession([c.id]);
                                setCursor(0);
                                setFlipped(false);
                              }}
                            >
                              Practice
                            </button>
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
                                            dueAt: Date.now() + 30 * 86400000,
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
          busy={false}
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
            <h3>{userId ? "Your account" : "Keep your learning in sync"}</h3>
            {userId ? (
              <>
                <p>{signedEmail}</p>
                <button
                  className="secondary"
                  onClick={async () => {
                    await supabase?.auth.signOut();
                    setCloudReady(false);
                    setState(emptyState);
                    localStorage.removeItem(STORAGE);
                    if (!localDemo) window.location.replace("/sign-in");
                  }}
                >
                  <LogOut size={16} />
                  Sign out
                </button>
              </>
            ) : cloudEnabled ? (
              <form onSubmit={signIn}>
                <label>
                  Email address
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="you@example.com"
                  />
                </label>
                <button className="primary" type="submit">
                  Email me a sign-in link <ArrowRight size={16} />
                </button>
              </form>
            ) : (
              <p>
                This version saves cards and reading progress in your browser.
                Connect Supabase to sign in and sync between your phone and
                desktop.
              </p>
            )}
          </div>
          <div className="settings-section">
            <h3>On your iPhone</h3>
            <p>
              Open the deployed website in Safari, then Share → Add to Home
              Screen. Your account keeps your progress together.
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
function CardDialog({
  suggestion,
  existing,
  busy,
  onClose,
  onSave,
  onUpdate,
  onSource,
}: {
  suggestion: Suggestion;
  existing?: Card;
  busy: boolean;
  onClose: () => void;
  onSave: (s: Suggestion) => void;
  onUpdate: (s: Suggestion) => void;
  onSource: () => void;
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
      {busy && <p role="status">Preparing a contextual meaning…</p>}
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
          <button className="primary full" disabled={busy} type="submit">
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
            <button className="text-button" onClick={() => setEditing(true)}>
              Edit card
            </button>
            <button
              className={existing ? "secondary" : "primary"}
              disabled={Boolean(existing)}
              onClick={() => onSave(draft)}
            >
              {existing ? <Check size={17} /> : <Plus size={17} />}{" "}
              {existing
                ? existing.status === "archived"
                  ? "Archived"
                  : "Saved to review"
                : "Save flashcard"}
            </button>
          </div>
          {existing && (
            <button className="source-link" onClick={onSource}>
              Return to original lesson <ArrowUpRight size={14} />
            </button>
          )}
        </>
      )}
    </Dialog>
  );
}
