"use client";
import { useRef, type ReactNode } from "react";

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
  const gesture = useRef({
    x: 0,
    y: 0,
    started: 0,
    selecting: false,
    moved: false,
  });

  return (
    <div
      className={`flashcard ${className}`.trim()}
      onPointerDown={(event) => {
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
      }}
      onScroll={() => {
        gesture.current.moved = true;
      }}
      onClick={(event) => {
        // Share this marker with the cursor styles so text areas never flip.
        // The dedicated button handles its own click, including keyboard use.
        if ((event.target as Element).closest("button, [data-flashcard-text]"))
          return;
        const { selecting, moved, started } = gesture.current;
        if (
          event.detail > 1 ||
          event.button !== 0 ||
          selecting ||
          moved ||
          Date.now() - started > 500 ||
          window.getSelection()?.toString()
        )
          return;
        onToggle();
      }}
    >
      {children}
    </div>
  );
}
