"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";

export default function RootPage() {
  const router = useRouter();
  const { status } = useSession();

  useEffect(() => {
    if (status === "loading") return;

    if (status === "unauthenticated") {
      router.replace("/login");
      return;
    }

    let isCancelled = false;

    const resolveDestination = async () => {
      try {
        const res = await fetch("/api/teams?scope=current", {
          cache: "no-store",
        });

        if (isCancelled) return;

        if (res.ok) {
          router.replace("/dashboard");
          return;
        }

        if (res.status === 404) {
          router.replace("/join-team");
          return;
        }

        router.replace("/dashboard");
      } catch {
        if (!isCancelled) {
          router.replace("/dashboard");
        }
      }
    };

    void resolveDestination();

    return () => {
      isCancelled = true;
    };
  }, [router, status]);

  return (
    <div className="flex h-screen w-full items-center justify-center">
      <div className="flex flex-col items-center gap-3">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-fordham-maroon border-t-transparent" />
        <p className="t-small t-secondary">Loading your workspace...</p>
      </div>
    </div>
  );
}
