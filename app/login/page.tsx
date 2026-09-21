"use client";

import { signIn } from "next-auth/react";
import { useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";

function LoginCard() {
  const params = useSearchParams();
  const [loading, setLoading] = useState(false);
  const [testEmail, setTestEmail] = useState("e2e-student@fordham.edu");
  const [testRole, setTestRole] = useState("student");
  const [testAuth, setTestAuth] = useState(false);
  useEffect(() => {
    fetch("/api/auth/providers", { cache: "no-store" }).then((response) => (response.ok ? response.json() : {})).then((providers: Record<string, unknown>) => setTestAuth(Boolean(providers && providers["fordms-test"]))).catch(() => setTestAuth(false));
  }, []);
  const error = params.get("error");
  const reason = params.get("reason");
  const callbackUrl = params.get("callbackUrl") ?? "/";
  return <main className="login-page">
    <section className="login-brand" aria-label="FordMS EHR">
      <span className="login-mark">F</span>
      <span className="brand-university">Fordham University</span>
      <h1>FordMS EHR</h1>
      <p>HINF 6105 · Electronic Health Records</p>
    </section>
    <section className="login-card">
      <div className="login-card-head">Course sign in</div>
      <div className="login-card-body">
        <h2>Use your Fordham account</h2>
        <p>Sign in with your <strong>@fordham.edu</strong> Google account. Your course workspace, assignment progress, submissions, grades, and instructor feedback will be linked to that account.</p>
        {reason === "expired" && <div className="login-error">Your session ended after eight hours. Sign in again to continue; your work is saved in your course account.</div>}
        {error && <div className="login-error">Access was not granted. Use a verified Fordham email account or contact the instructor.</div>}
        <button className="google-button" disabled={loading} onClick={async () => { setLoading(true); await signIn("google", { callbackUrl }); }}>
          <span aria-hidden="true" className="google-g">G</span>
          {loading ? "Connecting to Fordham Google…" : "Continue with Fordham Google"}
        </button>
        <ul className="login-notes">
          <li>All patients and clinical events are fictional.</li>
          <li>Course activity is visible to the instructor.</li>
          <li>Do not enter real patient information.</li>
        </ul>
        {testAuth && <form className="test-auth" data-testid="test-auth" onSubmit={async (event) => { event.preventDefault(); setLoading(true); await signIn("fordms-test", { email: testEmail, role: testRole, callbackUrl }); }}>
          <h3>Automated test sign-in</h3>
          <label>Test email<input aria-label="Test email" value={testEmail} onChange={(e) => setTestEmail(e.target.value)} /></label>
          <label>Role<select aria-label="Test role" value={testRole} onChange={(e) => setTestRole(e.target.value)}><option>student</option><option>instructor</option><option>admin</option></select></label>
          <button type="submit">Sign in as test account</button>
        </form>}
      </div>
    </section>
    <p className="login-footer">Fordham University · Applied Health Informatics</p>
  </main>;
}

export default function LoginPage() {
  return <Suspense fallback={<main className="login-page"><p>Loading secure course sign-in…</p></main>}><LoginCard /></Suspense>;
}
