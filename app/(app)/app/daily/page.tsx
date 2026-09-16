"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { CalendarDays, Loader2 } from "lucide-react";
import { getDailyNoteTitle, getOrCreateDailyNote } from "@/lib/daily";

export default function DailyPage() {
  const router = useRouter();
  const [error, setError] = React.useState(false);

  React.useEffect(() => {
    let alive = true;
    getOrCreateDailyNote()
      .then((note) => {
        if (alive) router.replace(`/app/note/${note.id}`);
      })
      .catch(() => {
        if (alive) setError(true);
      });
    return () => {
      alive = false;
    };
  }, [router]);

  return (
    <div className="grid h-full place-items-center px-6">
      <div className="flex flex-col items-center gap-3 text-center">
        <div className="grid size-12 place-items-center rounded-xl border border-accent/25 bg-accent/12">
          {error ? (
            <CalendarDays className="size-5 text-danger" />
          ) : (
            <Loader2 className="size-5 animate-spin text-accent" />
          )}
        </div>
        <p className="text-sm text-mute">
          {error
            ? "Couldn't open today's note. Please try again."
            : `Opening ${getDailyNoteTitle()}…`}
        </p>
      </div>
    </div>
  );
}
