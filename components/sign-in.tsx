"use client";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
export default function SignIn() {
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    const error = new URLSearchParams(window.location.search).get("error");
    if (error === "setup") setMessage("Account setup is not complete yet.");
    if (error === "forbidden") setMessage("This account does not have access.");
    if (error === "link")
      setMessage(
        "This link has expired or could not be used. Request another link.",
      );
  }, []);
  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (!supabase) return;
    setBusy(true);
    try {
      const { error } = await supabase.auth.signInWithOtp({
        email,
        options: {
          shouldCreateUser: false,
          emailRedirectTo: window.location.origin + "/auth/callback",
        },
      });
      setMessage(
        error
          ? "Unable to send a link. Check your email and account setup."
          : "Check your email for a sign-in link.",
      );
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
        <h1>Sign in</h1>
        <form onSubmit={submit}>
          <label htmlFor="email">Email address</label>
          <input
            id="email"
            type="email"
            autoComplete="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
          <button className="primary full" disabled={!supabase || busy}>
            {busy ? "Sending…" : "Email me a sign-in link"}
          </button>
        </form>
        {message && <p role="status">{message}</p>}
        {!supabase && <p>Account setup is not complete yet.</p>}
        <button
          className="text-button"
          onClick={async () => {
            await supabase?.auth.signOut();
            window.location.replace("/sign-in");
          }}
        >
          Use another account
        </button>
      </section>
    </main>
  );
}
