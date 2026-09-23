export default async function ControlPlaneLoginPage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const invalid = (await searchParams).error === "invalid";
  return <main className="cp-login-shell">
    <section className="cp-login-card" aria-labelledby="control-login-title">
      <span className="cp-kicker">Private founder access</span>
      <h1 id="control-login-title">OperationOS Control Plane</h1>
      <p>Authenticate with the configured founder account. Access is server-authorized and deny-by-default.</p>
      {invalid && <p className="cp-login-error" role="alert">Authentication failed. Check the credentials or server configuration.</p>}
      <form action="/api/control-plane/auth/login" method="post">
        <label htmlFor="founder-password">Founder password</label>
        <input id="founder-password" name="password" type="password" autoComplete="current-password" minLength={8} maxLength={1024} required />
        <button type="submit">Enter Control Plane</button>
      </form>
      <small>No public signup · No recovery flow · No production action authority</small>
    </section>
  </main>;
}
