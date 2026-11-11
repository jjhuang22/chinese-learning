"use client";
import { useEffect, useRef, type ReactNode } from "react";

// A text selection gesture must never count as a card flip.
export default function SelectableFlashcard({
  children,
  className = "",
  onToggle,
}: {
  children: ReactNode;
  className?: string;
  onToggle: () => void;
}) {
  const pending = useRef<ReturnType<typeof setTimeout> | null>(null);
  const gesture = useRef({
    x: 0,
    y: 0,
    started: 0,
    selecting: false,
    moved: false,
  });
  function cancelPending() {
    if (pending.current) clearTimeout(pending.current);
    pending.current = null;
  }
  useEffect(() => cancelPending, []);

  return (
    <div
      className={`flashcard ${className}`.trim()}
      onPointerDown={(event) => {
        cancelPending();
        gesture.current = {
          x: event.clientX,
          y: event.clientY,
          started: Date.now(),
          selecting: Boolean(window.getSelection()?.toString()),
          moved: false,
        };
      }}
      onPointerMove={(event) => {
        if (
          Math.hypot(
            event.clientX - gesture.current.x,
            event.clientY - gesture.current.y,
          ) > 8
        )
          gesture.current.moved = true;
      }}
      onPointerCancel={() => {
        gesture.current.moved = true;
        cancelPending();
      }}
      onDoubleClick={cancelPending}
      onScroll={cancelPending}
      onClick={(event) => {
        cancelPending();
        // The dedicated button handles its own click, including keyboard use.
        if ((event.target as HTMLElement).closest("button")) return;
        const { selecting, moved, started } = gesture.current;
        if (
          event.detail > 1 ||
          selecting ||
          moved ||
          Date.now() - started > 500 ||
          window.getSelection()?.toString()
        )
          return;
        // Give double/triple clicks time to select text before flipping.
        pending.current = setTimeout(() => {
          pending.current = null;
          if (!window.getSelection()?.toString()) onToggle();
        }, 300);
      }}
    >
      {children}
    </div>
  );
}
