"use client";
import { BookOpen, ArrowUpRight, Check } from "lucide-react";
import type { Lesson, StudyState } from "@/lib/model";
function shortDate(date: string) {
  return new Date(date + "T12:00:00").toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  });
}
export default function LessonLibrary({
  lessons,
  state,
  openLesson,
}: {
  lessons: Lesson[];
  state: StudyState;
  openLesson: (id: string) => void;
}) {
  return (
    <>
      <span className="eyebrow">YOUR READING SHELF</span>
      <div className="page-heading">
        <h1>Every lesson, kept.</h1>
        <p>Pick up where you left off, or return to a familiar passage.</p>
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
                  {state.cards.filter((c) => c.lessonId === l.id).length} saved
                  cards
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
  );
}
