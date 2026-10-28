"use client";

import { useState } from "react";
import { ArrowUpRight, BookOpen, Check, ChevronRight } from "lucide-react";
import type { Lesson, StudyState } from "@/lib/model";

function lessonCount(count: number, unreadOnly: boolean) {
  return `${count} ${unreadOnly ? "unread " : ""}lesson${count === 1 ? "" : "s"}`;
}

export default function LessonArchive({
  lessons,
  state,
  onOpenLesson,
  canEdit,
}: {
  lessons: Lesson[];
  state: StudyState;
  onOpenLesson: (id: string) => void;
  canEdit: boolean;
}) {
  const [filterUnread, setUnreadOnly] = useState(false);
  const unreadOnly = canEdit && filterUnread;
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const read = new Set(state.read);
  const visibleLessons = lessons
    .filter((lesson) => !unreadOnly || !read.has(lesson.id))
    .sort((a, b) => b.date.localeCompare(a.date));
  // Derive defaults from the available lessons, including locally loaded imports.
  const newestYear = visibleLessons[0]?.date.slice(0, 4);
  const newestMonth = visibleLessons[0]?.date.slice(0, 7);
  const years = new Map<string, Map<string, Lesson[]>>();
  for (const lesson of visibleLessons) {
    const year = lesson.date.slice(0, 4);
    const month = lesson.date.slice(0, 7);
    if (!years.has(year)) years.set(year, new Map());
    const months = years.get(year)!;
    if (!months.has(month)) months.set(month, []);
    months.get(month)!.push(lesson);
  }
  function toggle(key: string, currentlyOpen: boolean) {
    setExpanded((previous) => ({ ...previous, [key]: !currentlyOpen }));
  }

  return (
    <>
      <div className="archive-summary">
        <BookOpen size={20} />
        <span aria-live="polite">
          {lessonCount(visibleLessons.length, unreadOnly)}
        </span>
        {canEdit && !unreadOnly && (
          <>
            <span className="meta-divider" />
            <span>
              {lessons.filter((lesson) => read.has(lesson.id)).length} read
            </span>
          </>
        )}
        {canEdit && (
          <label className="archive-filter">
            <input
              type="checkbox"
              checked={unreadOnly}
              onChange={(event) => {
                setUnreadOnly(event.target.checked);
                setExpanded({});
              }}
            />
            Unread only
          </label>
        )}
      </div>
      {visibleLessons.length === 0 && (
        <p className="archive-empty" role="status">
          {unreadOnly
            ? "You're all caught up. No unread lessons."
            : "Your lessons will appear here after you import them."}
        </p>
      )}
      {[...years].map(([year, months]) => {
        const yearOpen = expanded[year] ?? year === newestYear;
        const count = [...months.values()].reduce(
          (total, items) => total + items.length,
          0,
        );
        return (
          <section className="archive-year" key={year}>
            <h2>
              <button
                className="archive-disclosure"
                aria-expanded={yearOpen}
                aria-controls={`archive-year-${year}`}
                onClick={() => toggle(year, yearOpen)}
              >
                <ChevronRight size={17} />
                {year}
                <span className="archive-count">
                  {lessonCount(count, unreadOnly)}
                </span>
              </button>
            </h2>
            <div
              id={`archive-year-${year}`}
              hidden={!yearOpen}
              className="archive-months"
            >
              {yearOpen &&
                [...months].map(([month, items]) => {
                  const monthOpen = expanded[month] ?? month === newestMonth;
                  const monthName = new Date(
                    `${month}-01T12:00:00`,
                  ).toLocaleDateString("en-US", { month: "long" });
                  return (
                    <section className="archive-month" key={month}>
                      <h3>
                        <button
                          className="archive-disclosure"
                          aria-expanded={monthOpen}
                          aria-controls={`archive-month-${month}`}
                          onClick={() => toggle(month, monthOpen)}
                        >
                          <ChevronRight size={15} />
                          {monthName}
                          <span className="archive-count">
                            {lessonCount(items.length, unreadOnly)}
                          </span>
                        </button>
                      </h3>
                      <div id={`archive-month-${month}`} hidden={!monthOpen}>
                        {monthOpen &&
                          items.map((lesson) => (
                            <button
                              className="archive-lesson"
                              key={lesson.id}
                              onClick={() => onOpenLesson(lesson.id)}
                            >
                              <span className="archive-day">
                                {new Date(
                                  `${lesson.date}T12:00:00`,
                                ).toLocaleDateString("en-US", {
                                  month: "short",
                                  day: "numeric",
                                })}
                              </span>
                              <div>
                                <h4 lang="zh-Hant">{lesson.title}</h4>
                                {lesson.subtitle && <p>{lesson.subtitle}</p>}
                                <span>
                                  {lesson.passages.length} passages
                                  {canEdit && (
                                    <>
                                      {" "}
                                      ·{" "}
                                      {
                                        state.cards.filter(
                                          (card) => card.lessonId === lesson.id,
                                        ).length
                                      }{" "}
                                      saved cards
                                    </>
                                  )}
                                </span>
                              </div>
                              {canEdit && (
                                <span className="read-status">
                                  {read.has(lesson.id) ? (
                                    <>
                                      <Check size={15} />
                                      Read
                                    </>
                                  ) : (
                                    "Unread"
                                  )}
                                </span>
                              )}
                              <ArrowUpRight size={20} />
                            </button>
                          ))}
                      </div>
                    </section>
                  );
                })}
            </div>
          </section>
        );
      })}
    </>
  );
}
