"use client";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
export default function SignIn() {
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [errorDetail, setErrorDetail] = useState("");
  useEffect(() => {
    const error = new URLSearchParams(window.location.search).get("error");
    if (error === "setup") setMessage("Account setup is not complete yet.");
    if (error === "forbidden") setMessage("This account does not have access.");
    if (error === "browser")
      setMessage(
        "This link belongs to a different browser or login request. Request a new link here, then open it in this same browser. Avoid switching between an email app’s browser, Safari, Chrome, or private tabs.",
      );
    if (error === "link")
      setMessage(
        "This link has expired or could not be used. Request another link.",
      );
  }, []);
  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (!supabase || busy) return;
    setBusy(true);
    setMessage("");
    setErrorDetail("");
    try {
      const { error } = await supabase.auth.signInWithOtp({
        email: email.trim(),
        options: {
          shouldCreateUser: false,
          emailRedirectTo: window.location.origin + "/auth/callback",
        },
      });
      if (error) {
        const hints: Record<string, string> = {
          email_address_not_authorized:
            "Supabase’s default email service cannot send to this address. Use an address authorized for your Supabase organization, or configure custom SMTP.",
          over_email_send_rate_limit:
            "Supabase’s sign-in email limit has been reached. Wait before trying again, or configure custom SMTP.",
          over_request_rate_limit:
            "Too many sign-in requests. Wait before trying again.",
          signup_disabled:
            "This email does not have an existing account in this Supabase project. Check Authentication → Users for the exact email. Public signup should stay disabled.",
          otp_disabled:
            "Email-link sign-in is unavailable for this account. Check the account in Supabase Authentication → Users and the Email provider settings.",
          email_provider_disabled:
            "Email sign-in is disabled in Supabase. Enable the Email provider in Authentication → Sign In / Providers.",
          email_address_invalid:
            "Supabase rejected this email address. Check the address and try again.",
        };
        setMessage(
          hints[error.code ?? ""] ??
            (error.status === 429
              ? "Supabase’s sign-in email limit has been reached. Wait before trying again."
              : "Supabase could not send the sign-in link. See the error details below."),
        );
        setErrorDetail([error.code, error.message].filter(Boolean).join(": "));
      } else
        setMessage(
          "Check your email for a sign-in link. Open it in this same browser.",
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
        {errorDetail && (
          <details className="auth-error-detail">
            <summary>Error details</summary>
            <p>{errorDetail}</p>
          </details>
        )}
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
