import { useCallback, useEffect, useRef, useState } from "react";
import { emptyState, progressSchema, type StudyState } from "@/lib/model";
import { ProgressSaver } from "@/lib/progress-save";
export const PROGRESS_STORAGE = "everyday-chinese-v1";
export function useProgress(
  initialState: StudyState,
  localDemo: boolean,
  onLocked: () => void,
) {
  const [state, setState] = useState(initialState);
  const [loaded, setLoaded] = useState(!localDemo);
  const [storageError, setStorageError] = useState("");
  const [syncError, setSyncError] = useState("");
  const [blocked, setBlocked] = useState(false);
  const stateRef = useRef(state);
  stateRef.current = state;
  const onLockedRef = useRef(onLocked);
  onLockedRef.current = onLocked;
  const [saver] = useState(
    () =>
      new ProgressSaver(initialState, async (progress) => {
        const response = await fetch("/api/progress", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(progress),
        });
        if (response.status === 401) onLockedRef.current();
        if (!response.ok) throw new Error("Save failed");
      }),
  );
  const flush = useCallback(async () => {
    if (localDemo) return !blocked;
    saver.update(stateRef.current);
    try {
      await saver.flush();
      setSyncError("");
      return true;
    } catch {
      setSyncError(
        "Cloud save failed. Keep this tab open and retry to save your changes.",
      );
      return false;
    }
  }, [localDemo, blocked, saver]);
  useEffect(() => {
    if (!localDemo) return;
    try {
      const raw = localStorage.getItem(PROGRESS_STORAGE);
      if (raw) setState(progressSchema.parse(JSON.parse(raw)));
    } catch {
      setBlocked(true);
      setStorageError(
        "Saved progress could not be loaded. The original data has been kept. Export it before resetting local progress.",
      );
    }
    setLoaded(true);
  }, [localDemo]);
  useEffect(() => {
    if (!loaded || blocked) return;
    if (localDemo) {
      try {
        localStorage.setItem(PROGRESS_STORAGE, JSON.stringify(state));
      } catch {
        setStorageError("Progress could not be saved in this browser.");
      }
      return;
    }
    saver.update(state);
    if (!saver.dirty) return;
    const timer = setTimeout(() => void flush(), 500);
    return () => clearTimeout(timer);
  }, [state, loaded, localDemo, blocked, saver, flush]);
  useEffect(() => {
    if (localDemo) return;
    const warn = (event: BeforeUnloadEvent) => {
      saver.update(stateRef.current);
      if (saver.dirty) {
        event.preventDefault();
        event.returnValue = "";
      }
    };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [localDemo, saver]);
  function resetLocalProgress() {
    try {
      localStorage.removeItem(PROGRESS_STORAGE);
    } catch {
      setStorageError("Browser storage is unavailable.");
      return;
    }
    setState(emptyState);
    setBlocked(false);
    setStorageError("");
  }
  return {
    state,
    setState,
    flush,
    storageError,
    syncError,
    blocked,
    resetLocalProgress,
  };
}
