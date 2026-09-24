"use client";

export default function ControlPanelError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <main className="cp-login-shell">
      <section className="cp-login-card" role="alert">
        <span className="cp-kicker">Authoritative data unavailable</span>
        <h1>Control Panel could not load</h1>
        <p>The request failed closed. No fixture data was substituted and no operational action was taken.</p>
        <button type="button" onClick={reset}>Try again</button>
      </section>
    </main>
  );
}
