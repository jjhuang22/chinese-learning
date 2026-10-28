"use client";
import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type Dispatch,
  type SetStateAction,
} from "react";
import { BookOpen, Home, Archive, Layers, Check, Plus, X } from "lucide-react";
import DailyReview from "./daily-review";
import {
  startDailySet,
  viewDailyCard,
  finishDailySet,
} from "@/lib/daily-review";
import Reader from "./reader";
import Review from "./review";
import LessonArchive from "./lesson-archive";
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
  suggestionSchema,
  StudyState,
  Suggestion,
} from "@/lib/model";
import { addCards, cardCollision, changeCardStatus } from "@/lib/cards";
import { downloadJson } from "@/lib/download";
import { PROGRESS_STORAGE } from "@/hooks/use-progress";
import { useProgress } from "@/hooks/use-progress";
type Page = "home" | "today" | "archive" | "review" | "daily-review";
type Pick = { text: string; sentence: string };
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
  const [page, setPage] = useState<Page>("home");
  const [lessons, setLessons] = useState<Lesson[]>(initialLessons);
  const [lessonId, setLessonId] = useState(
    initialLessons.at(-1)?.id ?? "empty",
  );
  const [canEdit, setCanEdit] = useState(localDemo || initialCanEdit);
  const [editingAccess, setEditingAccess] = useState(false);
  const onAccessExpired = useCallback(() => setCanEdit(false), []);
  const {
    loaded,
    state,
    setState: setProgress,
    syncError,
    conflict,
    retrySync,
    storageError,
    localBlocked,
    resetLocalProgress,
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
  const [locking, setLocking] = useState(false);
  async function lockEditing() {
    if (locking) return;
    setLocking(true);
    try {
      if (hasPendingChanges() && !(await retrySync())) return;
      const response = await fetch("/api/lock", { method: "POST" });
      if (!response.ok) throw new Error();
      window.location.reload();
    } catch {
      setNotice("Could not lock editing. Check your connection and try again.");
    } finally {
      setLocking(false);
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
  const [cardError, setCardError] = useState("");
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
  const archiveScroll = useRef(0);
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
  const unread = canEdit
    ? lessons.filter((lesson) => !viewState.read.includes(lesson.id)).length
    : 0;
  const [now, setNow] = useState(() => Date.now());
  const today = localDate(new Date(now));
  const latestLesson = lessons.filter((l) => l.date <= today).at(-1);
  const reviewDone = viewState.reviewedOn === today;
  const lessonDone = !!latestLesson && viewState.read.includes(latestLesson.id);
  const savedDailyCards =
    viewState.dailyReview?.date === today &&
    viewState.dailyReview.cardIds.some((id) =>
      viewState.cards.some((card) => card.id === id),
    );
  function openDailyReview() {
    if (!canEdit) {
      requestEditing();
      return;
    }
    setState((prev) => startDailySet(prev));
    navigate("daily-review");
  }
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
  function openCard(s: Suggestion) {
    setCardError("");
    setModal(s);
  }
  const closeModal = useCallback(() => setModal(null), []);
  function navigate(next: Page) {
    if (page === "archive") archiveScroll.current = window.scrollY;
    setPage(next);
    setSelection(null);
    requestAnimationFrame(() => {
      window.scrollTo({
        top: next === "archive" ? archiveScroll.current : 0,
        behavior: "instant",
      });
    });
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
    if (!canEdit) {
      requestEditing();
      return;
    }
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
  function onCardStatusChange(id: string, status: Card["status"]) {
    if (!canEdit) {
      requestEditing();
      return;
    }
    setState((prev) => changeCardStatus(prev, id, status));
    setNotice(status === "archived" ? "Card archived" : "Card restored");
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
    setSelection({ text, sentence: context });
  }
  useEffect(() => {
    const selected = () => {
      const s = window.getSelection();
      if (!s?.isCollapsed) captureSelection();
    };
    document.addEventListener("selectionchange", selected);
    return () => document.removeEventListener("selectionchange", selected);
  });
  function createSelected() {
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
      openCard(found);
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
    openCard(draft);
  }
  function exportProgress() {
    downloadJson(
      JSON.stringify(state, null, 2),
      "everyday-chinese-progress.json",
    );
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
          aria-label="Home"
          onClick={() => navigate("home")}
        >
          <span className="brand-mark" lang="zh-Hant">
            中
          </span>
        </button>
        <nav>
          {(
            [
              { id: "home", label: "Home", icon: Home },
              { id: "today", label: "Today", icon: BookOpen },
              { id: "archive", label: "Archive", icon: Archive },
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
              {item.id === "archive" && unread > 0 && (
                <span className="count" title="Unread lessons">
                  {unread}
                </span>
              )}
              {item.id === "review" && active.length > 0 && (
                <span className="count">{active.length}</span>
              )}
            </button>
          ))}
        </nav>
      </aside>
      <main>
        <header className="topbar">
          <span className="breadcrumb">
            {page === "home"
              ? "Home"
              : page === "today"
                ? "Today"
                : page === "archive"
                  ? "Archive"
                  : "Review"}
          </span>
          <div className="topbar-right">
            {!localDemo && (
              <button
                className="text-button editing-trigger"
                onClick={canEdit ? lockEditing : requestEditing}
                disabled={locking}
              >
                {locking
                  ? "Saving and locking…"
                  : canEdit
                    ? "Lock editing"
                    : "Enable editing"}
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
          <div className="warning">
            {storageError || lessonStorageError}
            {localBlocked && (
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
          {page === "home" &&
            (lessons.length === 0 ? (
              emptyLessons
            ) : (
              <>
                <div className="daily-activities">
                  <section className="daily-activity">
                    <div className="daily-activity-heading">
                      <Layers size={23} aria-hidden="true" />
                      <h1>Daily review</h1>
                      {reviewDone && (
                        <span
                          className="activity-complete"
                          role="img"
                          aria-label="Daily review completed"
                        >
                          <Check size={17} aria-hidden="true" />
                        </span>
                      )}
                    </div>
                    <button
                      className="primary"
                      disabled={
                        canEdit &&
                        (!loaded || (!active.length && !savedDailyCards))
                      }
                      onClick={openDailyReview}
                    >
                      {!canEdit
                        ? "Unlock daily review"
                        : reviewDone
                          ? "Review again"
                          : "Start review"}
                    </button>
                  </section>
                  <section className="daily-activity">
                    <div className="daily-activity-heading">
                      <BookOpen size={23} aria-hidden="true" />
                      <h2>Daily lesson</h2>
                      {lessonDone && (
                        <span
                          className="activity-complete"
                          role="img"
                          aria-label="Daily lesson completed"
                        >
                          <Check size={17} aria-hidden="true" />
                        </span>
                      )}
                    </div>
                    <button
                      className="primary"
                      disabled={!loaded || !latestLesson}
                      onClick={() =>
                        latestLesson && openLesson(latestLesson.id)
                      }
                    >
                      {lessonDone ? "Read again" : "Read lesson"}
                    </button>
                  </section>
                </div>
              </>
            ))}
          {page === "daily-review" &&
            (canEdit && loaded && viewState.dailyReview ? (
              <DailyReview
                key={viewState.dailyReview.date}
                cards={viewState.cards}
                session={viewState.dailyReview}
                onHome={() => navigate("home")}
                onStatusChange={onCardStatusChange}
                onReviewed={(id) => setState((prev) => viewDailyCard(prev, id))}
                onComplete={() => setState(finishDailySet)}
              />
            ) : (
              <section className="empty-state">
                <h1>Unlock your daily review</h1>
                <p>Enable editing to continue your private practice.</p>
                <button className="primary" onClick={requestEditing}>
                  Unlock daily review
                </button>
              </section>
            ))}
          {page === "today" &&
            (lessons.length === 0 ? (
              emptyLessons
            ) : (
              <Reader
                key={lesson.id}
                lesson={lesson}
                state={viewState}
                setState={setState}
                setModal={openCard}
                setNotice={setNotice}
                saveCard={saveCard}
                unsaveCard={unsaveCard}
                captureSelection={captureSelection}
                clearSelection={() => setSelection(null)}
                canEdit={canEdit}
                onRequestEditing={requestEditing}
              />
            ))}
          <div hidden={page !== "archive"}>
            {lessons.length > 0 ? (
              <LessonArchive
                lessons={lessons}
                state={viewState}
                onOpenLesson={openLesson}
                canEdit={canEdit}
              />
            ) : page === "archive" ? (
              emptyLessons
            ) : null}
          </div>
          {page === "review" &&
            (canEdit ? (
              <Review
                state={viewState}
                setState={setState}
                setModal={openCard}
                navigate={navigate}
                now={now}
                onStatusChange={onCardStatusChange}
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
            { id: "home", label: "Home", icon: Home },
            { id: "today", label: "Today", icon: BookOpen },
            { id: "archive", label: "Archive", icon: Archive },
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
              {item.id === "archive" && unread ? ` · ${unread}` : ""}
              {item.id === "review" && active.length
                ? ` · ${active.length}`
                : ""}
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
          error={cardError}
          onClose={closeModal}
          canEdit={canEdit}
          onRequestEditing={requestEditing}
          onSave={(s) => {
            if (!canEdit) {
              requestEditing();
              return;
            }
            if (saveCard(s)) setModal(null);
          }}
          onUnsave={unsaveCard}
          onStatusChange={onCardStatusChange}
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
