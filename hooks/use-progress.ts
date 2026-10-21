"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { type StudyState } from "@/lib/model";
import { progressSchema, revisionSchema } from "@/lib/progress-schema";
import {
  ProgressConflictError,
  ProgressSaveError,
  ProgressSync,
} from "@/lib/progress-sync";

const STORAGE = "everyday-chinese-v1";

export function useProgress(
  initial: StudyState,
  initialRevision: number,
  localDemo: boolean,
) {
  const [state, setState] = useState(initial);
  const [loaded, setLoaded] = useState(false);
  const [syncError, setSyncError] = useState("");
  const [conflict, setConflict] = useState(false);
  const [storageError, setStorageError] = useState("");
  const sync = useRef<ProgressSync | null>(null);
  if (!sync.current)
    sync.current = new ProgressSync(
      initial,
      initialRevision,
      async (state, revision) => {
        const response = await fetch("/api/progress", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ state, revision }),
        });
        if (response.status === 401) {
          window.location.replace("/sign-in");
          throw new Error("Unlock the app to continue.");
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
  }, []);

  useEffect(() => {
    if (localDemo) {
      try {
        const raw = localStorage.getItem(STORAGE);
        if (raw) setState(progressSchema.parse(JSON.parse(raw)));
      } catch {
        setStorageError(
          "Browser progress could not be loaded. Export your work before closing this tab.",
        );
      }
    }
    setLoaded(true);
  }, [localDemo]);

  useEffect(() => {
    if (!loaded) return;
    if (localDemo) {
      try {
        localStorage.setItem(STORAGE, JSON.stringify(state));
      } catch {
        setStorageError("Progress could not be saved in this browser.");
      }
      return;
    }
    sync.current!.update(state);
    const timer = setTimeout(() => void retrySync(), 500);
    return () => clearTimeout(timer);
  }, [state, loaded, localDemo, retrySync]);

  return { state, setState, syncError, conflict, retrySync, storageError };
}
