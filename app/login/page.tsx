"use client";
import { signIn } from "next-auth/react";
import { useSearchParams } from "next/navigation";
import { Suspense } from "react";

function LoginContent() {
  const searchParams = useSearchParams();
  const error = searchParams.get("error");

  return (
    <div className="min-h-[70vh] flex items-center justify-center">
      <div className="bg-white rounded-2xl shadow-lg border border-[#d6dfeb] p-8 md:p-10 w-full max-w-md text-center">
        {/* Fordham logo mark */}
        <div className="w-16 h-16 rounded-xl bg-gradient-to-br from-[#8C1515] to-[#6B1010] flex items-center justify-center font-bold text-white text-2xl mx-auto mb-6 shadow-md">
          F
        </div>

        <h1 className="text-2xl font-bold text-[#122033] mb-1">ChatEHR Lab</h1>
        <p className="text-sm text-gray-500 mb-2">HINF 6117 — Artificial Intelligence in Healthcare</p>
        <p className="text-xs text-gray-400 mb-8">Sign in with your Fordham University Google account to access the lab.</p>

        {error === "AccessDenied" && (
          <div className="mb-6 rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">
            Access denied. Only <strong>@fordham.edu</strong> accounts are permitted.
            Please sign in with your Fordham University email.
          </div>
        )}
        {error && error !== "AccessDenied" && (
          <div className="mb-6 rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">
            Sign-in failed. Please try again.
          </div>
        )}

        <button
          onClick={() => signIn("google", { callbackUrl: "/" })}
          className="w-full flex items-center justify-center gap-3 bg-white border border-[#d6dfeb] rounded-lg px-5 py-3 text-sm font-medium text-[#122033] shadow-sm hover:bg-gray-50 hover:border-gray-300 transition-colors"
        >
          {/* Google "G" icon */}
          <svg viewBox="0 0 24 24" className="w-5 h-5" aria-hidden="true">
            <path
              d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
              fill="#4285F4"
            />
            <path
              d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
              fill="#34A853"
            />
            <path
              d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z"
              fill="#FBBC05"
            />
            <path
              d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
              fill="#EA4335"
            />
          </svg>
          Sign in with Google
        </button>

        <p className="mt-6 text-xs text-gray-400">
          Need the lab assignment?{" "}
          <a href="/lab" className="text-[#8C1515] underline underline-offset-2 hover:text-[#6B1010]">
            View lab instructions
          </a>{" "}
          (no sign-in required).
        </p>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={<div className="min-h-[70vh] flex items-center justify-center text-gray-400 text-sm">Loading...</div>}>
      <LoginContent />
    </Suspense>
  );
}
