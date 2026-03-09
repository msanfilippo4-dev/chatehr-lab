"use client";

import { Suspense, useState } from "react";
import { signIn } from "next-auth/react";
import { useSearchParams } from "next/navigation";
import { LogIn } from "lucide-react";

function LoginForm() {
  const searchParams = useSearchParams();
  const error = searchParams.get("error");
  const [loading, setLoading] = useState(false);

  const handleGoogleSignIn = async () => {
    setLoading(true);
    await signIn("google", { callbackUrl: "/workspace" });
  };

  return (
    <div className="flex min-h-screen flex-col items-center justify-center px-4">
      {/* Header */}
      <div className="mb-8 text-center">
        <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-xl bg-gradient-to-br from-fordham-maroon to-fordham-dark shadow-lg">
          <span className="text-xl font-bold text-white">C</span>
        </div>
        <h1 className="t-heading text-xl tracking-tight">ChartEHR Project</h1>
        <p className="t-caption t-secondary mt-1">
          Fordham HINF 6117 &mdash; AI in Healthcare
        </p>
      </div>

      {/* Card */}
      <div className="ehr-shell w-full max-w-sm">
        <div className="ehr-shell-header text-center">Sign In</div>
        <div className="flex flex-col gap-4 p-6">
          {error && (
            <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 t-small text-red-700">
              {error === "OAuthAccountNotLinked"
                ? "This email is already linked to another account."
                : "An error occurred during sign in. Please try again."}
            </div>
          )}

          <p className="t-body t-secondary text-center">
            Sign in with your Fordham Google account to access the team
            competition platform.
          </p>

          <button
            onClick={handleGoogleSignIn}
            disabled={loading}
            className="flex w-full items-center justify-center gap-2.5 rounded-lg border border-gray-200 bg-white px-4 py-2.5 t-body font-medium text-gray-700 shadow-sm transition-all hover:bg-gray-50 hover:shadow-md disabled:cursor-not-allowed disabled:opacity-60"
          >
            {loading ? (
              <div className="h-4 w-4 animate-spin rounded-full border-2 border-gray-400 border-t-transparent" />
            ) : (
              <svg className="h-4 w-4" viewBox="0 0 24 24">
                <path
                  d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 01-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z"
                  fill="#4285F4"
                />
                <path
                  d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                  fill="#34A853"
                />
                <path
                  d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                  fill="#FBBC05"
                />
                <path
                  d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                  fill="#EA4335"
                />
              </svg>
            )}
            <span>{loading ? "Signing in..." : "Sign in with Google"}</span>
          </button>

          <div className="flex items-center gap-3">
            <div className="h-px flex-1 bg-gray-200" />
            <span className="t-micro t-tertiary uppercase">or</span>
            <div className="h-px flex-1 bg-gray-200" />
          </div>

          <button
            onClick={() => signIn("credentials", { callbackUrl: "/workspace" })}
            className="flex w-full items-center justify-center gap-2 rounded-lg bg-fordham-maroon px-4 py-2.5 t-body font-medium text-white shadow-sm transition-all hover:bg-fordham-dark"
          >
            <LogIn size={16} />
            <span>Demo Sign In</span>
          </button>
        </div>
      </div>

      {/* Footer */}
      <p className="mt-6 t-micro t-tertiary">
        Fordham University &middot; Graduate School of Arts &amp; Sciences
      </p>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-fordham-maroon border-t-transparent" />
        </div>
      }
    >
      <LoginForm />
    </Suspense>
  );
}
