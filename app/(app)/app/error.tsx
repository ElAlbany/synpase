"use client";

import { useEffect } from "react";
import Link from "next/link";
import { TriangleAlert } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function AppError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-5 px-6 py-20 text-center">
      <div className="flex size-14 items-center justify-center rounded-2xl bg-aurora shadow-[0_8px_32px_rgba(110,107,255,.35)]">
        <TriangleAlert className="size-6 text-white" />
      </div>

      <div>
        <h1 className="text-xl font-semibold text-ink">Something went sideways</h1>
        <p className="mt-1.5 text-[13px] text-mute">
          Synapse ran into a problem while rendering this view.
        </p>
      </div>

      {(error.message || error.digest) && (
        <pre className="max-w-md overflow-auto rounded-xl border border-line bg-raised p-3.5 font-mono text-[11.5px] leading-relaxed text-faint">
          {error.digest ? `digest: ${error.digest}\n` : ""}
          {error.message}
        </pre>
      )}

      <div className="flex items-center gap-3">
        <Button variant="primary" size="sm" onClick={reset}>
          Try again
        </Button>
        <Link
          href="/app"
          className="rounded-[10px] border border-line bg-overlay px-4 py-2 text-sm font-medium text-ink transition-all duration-200 [transition-timing-function:cubic-bezier(.16,1,.3,1)] hover:-translate-y-0.5 hover:border-line-strong"
        >
          Back home
        </Link>
      </div>
    </div>
  );
}
