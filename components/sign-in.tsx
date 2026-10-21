"use client";
import { useState, useEffect } from "react";
import { LockKeyhole } from "lucide-react";
export default function SignIn() {
  useEffect(() => {
    let live = true;
    void fetch("/api/session", { cache: "no-store" })
      .then((response) => {
        if (live && response.status === 204) window.location.replace("/");
      })
      .catch(() => {});
    return () => {
      live = false;
    };
  }, []);
  const [passcode, setPasscode] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  async function unlock(event: React.FormEvent) {
    event.preventDefault();
    if (busy) return;
    setBusy(true);
    setMessage("");
    try {
      const response = await fetch("/api/unlock", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ passcode }),
      });
      const result = await response.json();
      if (!response.ok) {
        setMessage(result.error ?? "Unable to unlock. Try again.");
        setPasscode("");
        return;
      }
      setPasscode("");
      window.location.replace("/");
    } catch {
      setMessage("Unable to connect. Please try again.");
    } finally {
      setBusy(false);
    }
  }
  return (
    <main className="sign-in-page">
      <section className="sign-in-card">
        <span className="brand-mark">日</span>
        <h1>Unlock your lessons</h1>
        <form onSubmit={unlock}>
          <label htmlFor="passcode">Passcode</label>
          <input
            id="passcode"
            type="password"
            autoComplete="current-password"
            required
            maxLength={128}
            value={passcode}
            onChange={(e) => setPasscode(e.target.value)}
            autoFocus
          />
          <button className="primary full" disabled={busy || !passcode}>
            <LockKeyhole size={17} />
            {busy ? "Unlocking…" : "Unlock"}
          </button>
        </form>
        {message && <p role="status">{message}</p>}
      </section>
    </main>
  );
}
