import { Loader2 } from "lucide-react";

export default function AppLoading() {
  return (
    <div className="grid h-full place-items-center px-6">
      <div className="flex flex-col items-center gap-4">
        <Loader2 className="size-5 animate-spin text-accent" />
        <div className="w-full space-y-2.5">
          <div className="h-3 w-48 animate-pulse rounded-full bg-overlay" />
          <div className="h-3 w-32 animate-pulse rounded-full bg-overlay" />
        </div>
        <p className="text-sm text-mute">Loading your workspace…</p>
      </div>
    </div>
  );
}
