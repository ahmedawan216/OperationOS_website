import Image from "next/image";

export default async function ControlPlaneLoginPage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const invalid = (await searchParams).error === "invalid";
  return <main id="control-panel-content" className="cp-login-shell">
    <section className="cp-login-card" aria-labelledby="control-login-title">
      <Image className="cp-login-logo" src="/brand/operationos-h1-horizontal-white.svg" width={236} height={40} priority alt="OperationOS" />
      <span className="cp-kicker">Private founder access</span>
      <h1 id="control-login-title">OperationOS Control Panel</h1>
      <p>Authenticate with the configured founder account. Access is server-authorized and deny-by-default.</p>
      {invalid && <p className="cp-login-error" role="alert">Authentication failed. Check the credentials or server configuration.</p>}
      <form action="/api/control-plane/auth/login" method="post">
        <label htmlFor="founder-password">Founder password</label>
        <input id="founder-password" name="password" type="password" autoComplete="current-password" minLength={8} maxLength={1024} required />
        <button type="submit">Enter Control Panel</button>
      </form>
      <small>No public signup · No recovery flow · No production action authority</small>
    </section>
  </main>;
}
