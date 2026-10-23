"use client";
import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type Dispatch,
  type SetStateAction,
} from "react";
import { BookOpen, Library, Layers, Check, Plus, X } from "lucide-react";
import Reader from "./reader";
import Review from "./review";
import LessonLibrary from "./lesson-library";
import CardDialog from "./card-dialog";
import ImportLesson from "./import-lesson";
import EditingAccess from "./editing-access";
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
  initialCanEdit = false,
}: {
  initialLessons: Lesson[];
  localDemo: boolean;
  initialState?: StudyState;
  initialRevision?: number | null;
  initialCanEdit?: boolean;
}) {
  const [page, setPage] = useState<Page>("today");
  const [lessons, setLessons] = useState<Lesson[]>(initialLessons);
  const [lessonId, setLessonId] = useState(
    initialLessons.at(-1)?.id ?? "empty",
  );
  const [canEdit, setCanEdit] = useState(localDemo || initialCanEdit);
  const [editingAccess, setEditingAccess] = useState(false);
  const onAccessExpired = useCallback(() => setCanEdit(false), []);
  const {
    state,
    setState: setProgress,
    syncError,
    conflict,
    retrySync,
    storageError,
    hasPendingChanges,
  } = useProgress(
    initialState,
    initialRevision,
    localDemo,
    canEdit,
    onAccessExpired,
  );
  const viewState = canEdit ? state : emptyState;
  function requestEditing() {
    setEditingAccess(true);
  }
  const setState: Dispatch<SetStateAction<StudyState>> = (action) => {
    if (!canEdit) {
      requestEditing();
      return;
    }
    setProgress(action);
  };
  function importLesson() {
    if (!canEdit) {
      requestEditing();
      return;
    }
    setImporting(true);
  }
  async function lockEditing() {
    if (hasPendingChanges() && !(await retrySync())) return;
    try {
      const response = await fetch("/api/lock", { method: "POST" });
      if (!response.ok) throw new Error();
      window.location.reload();
    } catch {
      setNotice("Could not lock editing. Check your connection and try again.");
    }
  }
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
  const [notice, setNotice] = useState("");
  useEffect(() => {
    if (!canEdit) {
      setModal(null);
      setSelection(null);
      setImporting(false);
    }
  }, [canEdit]);
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
  const active = viewState.cards.filter((c) => c.status === "active");
  const due = active.filter((c) => c.dueAt <= Date.now());
  const unread = canEdit
    ? lessons.filter((lesson) => !viewState.read.includes(lesson.id)).length
    : 0;
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 30000);
    return () => clearInterval(t);
  }, []);
  useEffect(() => {
    if (localDemo) return;
    let live = true;
    const check = async () => {
      try {
        const response = await fetch("/api/session", { cache: "no-store" });
        if (live && response.status === 401) setCanEdit(false);
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
    if (!canEdit) {
      requestEditing();
      return;
    }
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
  function unsaveCard(card: Card) {
    if (!canEdit) {
      requestEditing();
      return;
    }
    setState((prev) => ({
      ...prev,
      cards: prev.cards.filter((c) => c.id !== card.id),
    }));
    setNotice("Removed from your review deck");
  }
  function captureSelection() {
    if (page !== "today" || lessons.length === 0) return;
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
    if (!a || !f) return;
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
    if (!canEdit) {
      requestEditing();
      return;
    }
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
  function exportProgress() {
    const blob = new Blob([JSON.stringify(state, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "everyday-chinese-progress.json";
    link.click();
    URL.revokeObjectURL(url);
  }
  const emptyLessons = (
    <section className="empty-state">
      <BookOpen size={34} />
      <h1>No lessons yet</h1>
      <p>Import a lesson to start reading.</p>
      <button className="primary" onClick={importLesson}>
        <Plus size={16} /> Import your first lesson
      </button>
    </section>
  );
  return (
    <div className="app-shell">
      <aside className="sidebar">
        <button
          className="brand"
          aria-label="Today"
          onClick={() => navigate("today")}
        >
          <span className="brand-mark" lang="zh-Hant">
            中
          </span>
        </button>
        <nav>
          {(
            [
              { id: "today", label: "Today", icon: BookOpen },
              { id: "library", label: "Archive", icon: Library },
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
              {item.id === "library" && unread > 0 && (
                <span className="count" title="Unread lessons">
                  {unread}
                </span>
              )}
              {item.id === "review" && due.length > 0 && (
                <span className="count">{due.length}</span>
              )}
            </button>
          ))}
        </nav>
      </aside>
      <main>
        <header className="topbar">
          <span className="breadcrumb">
            {page === "today"
              ? "Today"
              : page === "library"
                ? "Archive"
                : "Review"}
          </span>
          <div className="topbar-right">
            {!localDemo && (
              <button
                className="text-button editing-trigger"
                onClick={canEdit ? lockEditing : requestEditing}
              >
                {canEdit ? "Lock editing" : "Enable editing"}
              </button>
            )}
            <button
              className="text-button import-trigger"
              onClick={importLesson}
            >
              <Plus size={16} />
              Import lesson
            </button>
          </div>
        </header>
        {(storageError || lessonStorageError) && (
          <div className="warning">{storageError || lessonStorageError}</div>
        )}
        {(canEdit || hasPendingChanges()) && syncError && (
          <div className="warning">
            {syncError}{" "}
            {!canEdit ? (
              <button onClick={requestEditing}>Enable editing</button>
            ) : conflict || initialRevision === null ? (
              <button onClick={exportProgress}>Export unsaved progress</button>
            ) : (
              <button onClick={retrySync}>Retry sync</button>
            )}
          </div>
        )}
        <div className="content" ref={reader}>
          {page === "today" &&
            (lessons.length === 0 ? (
              emptyLessons
            ) : (
              <Reader
                key={lesson.id}
                lesson={lesson}
                state={viewState}
                setState={setState}
                setModal={setModal}
                setNotice={setNotice}
                saveCard={saveCard}
                unsaveCard={unsaveCard}
                captureSelection={captureSelection}
                clearSelection={() => setSelection(null)}
                canEdit={canEdit}
                onRequestEditing={requestEditing}
              />
            ))}
          {page === "library" &&
            (lessons.length === 0 ? (
              emptyLessons
            ) : (
              <LessonLibrary
                lessons={lessons}
                state={viewState}
                openLesson={openLesson}
                canEdit={canEdit}
              />
            ))}
          {page === "review" &&
            (canEdit ? (
              <Review
                state={viewState}
                setState={setState}
                setModal={setModal}
                navigate={navigate}
                now={now}
              />
            ) : (
              <section className="empty-state">
                <Layers size={34} />
                <h1>Your review deck is private</h1>
                <p>Enable editing to view saved cards and review progress.</p>
                <button className="primary" onClick={requestEditing}>
                  Enable editing
                </button>
              </section>
            ))}
        </div>
      </main>
      <nav className="mobile-nav">
        {(
          [
            { id: "today", label: "Today", icon: BookOpen },
            { id: "library", label: "Archive", icon: Library },
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
              {item.id === "library" && unread ? ` · ${unread}` : ""}
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
          suggestion={findCard(viewState.cards, modal.text) ?? modal}
          existing={findCard(viewState.cards, modal.text)}
          onClose={closeModal}
          canEdit={canEdit}
          onRequestEditing={requestEditing}
          onSave={(s) => {
            if (!canEdit) {
              requestEditing();
              return;
            }
            saveCard(s);
            setModal(null);
          }}
          onUnsave={unsaveCard}
          onSource={() => {
            const c = findCard(viewState.cards, modal.text);
            if (c) {
              openLesson(c.lessonId);
              setModal(null);
            }
          }}
          onUpdate={(s) => {
            if (!canEdit) {
              requestEditing();
              return;
            }
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
      {importing && canEdit && (
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
      {editingAccess && (
        <EditingAccess
          onClose={() => setEditingAccess(false)}
          onUnlocked={() => {
            if (hasPendingChanges()) {
              setCanEdit(true);
              setEditingAccess(false);
            } else window.location.reload();
          }}
        />
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
