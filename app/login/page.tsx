"use client";

import { signIn } from "next-auth/react";
import { useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";

function LoginCard() {
  const params = useSearchParams();
  const [loading, setLoading] = useState(false);
  const error = params.get("error");
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
        {error && <div className="login-error">Access was not granted. Use a verified Fordham email account or contact the instructor.</div>}
        <button className="google-button" disabled={loading} onClick={async () => {
          setLoading(true);
          await signIn("google", { callbackUrl: "/" });
        }}>
          <span aria-hidden="true" className="google-g">G</span>
          {loading ? "Connecting to Fordham Google…" : "Continue with Fordham Google"}
        </button>
        <ul className="login-notes">
          <li>All patients and clinical events are fictional.</li>
          <li>Course activity is visible to the instructor.</li>
          <li>Do not enter real patient information.</li>
        </ul>
      </div>
    </section>
    <p className="login-footer">Fordham University · Applied Health Informatics</p>
  </main>;
}

export default function LoginPage() {
  return <Suspense fallback={<main className="login-page"><p>Loading secure course sign-in…</p></main>}><LoginCard /></Suspense>;
}
