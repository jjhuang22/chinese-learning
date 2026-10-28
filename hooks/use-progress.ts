"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { emptyState, type StudyState } from "@/lib/model";
import { progressSchema, revisionSchema } from "@/lib/progress-schema";
import {
  ProgressConflictError,
  ProgressSaveError,
  ProgressSync,
} from "@/lib/progress-sync";

export const PROGRESS_STORAGE = "everyday-chinese-v1";

export function useProgress(
  initial: StudyState,
  initialRevision: number | null,
  localDemo: boolean,
  canEdit: boolean,
  onAccessExpired: () => void,
) {
  const [state, setState] = useState(initial);
  const [loaded, setLoaded] = useState(false);
  const [syncError, setSyncError] = useState(
    initialRevision === null
      ? "Saving is unavailable until the database update is complete. Export any changes before reloading."
      : "",
  );
  const [conflict, setConflict] = useState(false);
  const [storageError, setStorageError] = useState("");
  const [localBlocked, setLocalBlocked] = useState(false);
  const stateRef = useRef(state);
  stateRef.current = state;
  const sync = useRef<ProgressSync | null>(null);
  if (!sync.current)
    sync.current = new ProgressSync(
      initial,
      initialRevision ?? 0,
      async (state, revision) => {
        const response = await fetch("/api/progress", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ state, revision }),
        });
        if (response.status === 401) {
          onAccessExpired();
          throw new ProgressSaveError(
            "Editing access expired. Enable editing again to save your changes.",
          );
        }
        const result = await response.json();
        if (response.status === 409)
          throw new ProgressConflictError(result.error);
        if (!response.ok)
          throw new ProgressSaveError(
            typeof result.error === "string"
              ? result.error
              : "Could not save progress.",
          );
        return revisionSchema.parse(result.revision);
      },
    );

  const retrySync = useCallback(async () => {
    if (localDemo) return !localBlocked;
    if (!canEdit || initialRevision === null) return false;
    sync.current!.update(stateRef.current);
    try {
      const saved = await sync.current!.save();
      if (saved) setSyncError("");
      return saved;
    } catch (error) {
      if (error instanceof ProgressConflictError) setConflict(true);
      setSyncError(
        error instanceof ProgressConflictError
          ? error.message
          : error instanceof ProgressSaveError
            ? `${error.message} Keep this tab open and retry to save your changes.`
            : "Cloud save failed. Keep this tab open and retry to save your changes.",
      );
      return false;
    }
  }, [initialRevision, canEdit, localDemo, localBlocked]);

  useEffect(() => {
    if (localDemo) {
      try {
        const raw = localStorage.getItem(PROGRESS_STORAGE);
        if (raw) setState(progressSchema.parse(JSON.parse(raw)));
      } catch {
        setLocalBlocked(true);
        setStorageError(
          "Saved progress could not be loaded. The original data has been kept. Export it before resetting local progress.",
        );
      }
    }
    setLoaded(true);
  }, [localDemo]);

  useEffect(() => {
    if (!loaded || localBlocked) return;
    if (localDemo) {
      try {
        localStorage.setItem(PROGRESS_STORAGE, JSON.stringify(state));
      } catch {
        setStorageError("Progress could not be saved in this browser.");
      }
      return;
    }
    sync.current!.update(state);
    if (!canEdit || initialRevision === null) return;
    const timer = setTimeout(() => void retrySync(), 500);
    return () => clearTimeout(timer);
  }, [
    state,
    loaded,
    localDemo,
    retrySync,
    initialRevision,
    canEdit,
    localBlocked,
  ]);

  useEffect(() => {
    if (localDemo) return;
    const warn = (event: BeforeUnloadEvent) => {
      sync.current!.update(stateRef.current);
      if (sync.current!.hasPendingChanges()) {
        event.preventDefault();
        event.returnValue = "";
      }
    };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [localDemo]);
  function resetLocalProgress() {
    try {
      localStorage.removeItem(PROGRESS_STORAGE);
    } catch {
      setStorageError("Browser storage is unavailable.");
      return;
    }
    setState(emptyState);
    setLocalBlocked(false);
    setStorageError("");
  }
  return {
    loaded,
    state,
    setState,
    syncError,
    conflict,
    retrySync,
    storageError,
    localBlocked,
    resetLocalProgress,
    hasPendingChanges: () => {
      sync.current!.update(stateRef.current);
      return sync.current!.hasPendingChanges();
    },
  };
}
