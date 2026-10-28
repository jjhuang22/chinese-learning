"use client";
import { useState } from "react";
import Dialog from "./dialog";

export default function EditingAccess({
  onClose,
  onUnlocked,
}: {
  onClose: () => void;
  onUnlocked: () => void;
}) {
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  return (
    <Dialog
      title="EDITING ACCESS"
      onClose={() => {
        if (!busy) onClose();
      }}
    >
      <p>Enter the password to import lessons and change cards or progress.</p>
      <form
        className="editing-access-form"
        onSubmit={async (event) => {
          event.preventDefault();
          if (busy) return;
          setBusy(true);
          setError("");
          try {
            const response = await fetch("/api/unlock", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ passcode: password }),
            });
            const result = await response.json();
            if (!response.ok)
              throw new Error(result.error ?? "Could not enable editing.");
            setPassword("");
            onUnlocked();
          } catch (error) {
            setError(
              error instanceof Error
                ? error.message
                : "Check your connection and try again.",
            );
            setPassword("");
          } finally {
            setBusy(false);
          }
        }}
      >
        <label htmlFor="editing-password">Password</label>
        <input
          id="editing-password"
          type="password"
          autoComplete="current-password"
          autoFocus
          required
          maxLength={128}
          value={password}
          onChange={(event) => setPassword(event.target.value)}
        />
        {error && <p role="alert">{error}</p>}
        <button className="primary full" disabled={busy || !password}>
          {busy ? "Checking…" : "Enable editing"}
        </button>
      </form>
    </Dialog>
  );
}
