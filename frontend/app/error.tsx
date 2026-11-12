"use client";

import { useEffect } from "react";
import { AuthShell } from "@/components/shared/AuthShell";

export default function ErrorPage({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <AuthShell title="Something went wrong" subtitle="The page hit an unexpected problem. Your data is safe.">
      <button onClick={reset} className="w-full rounded-xl bg-slate-900 py-3 text-sm font-bold text-white hover:bg-slate-800 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cyan-600">
        Try again
      </button>
    </AuthShell>
  );
}
