import { Search } from "lucide-react";

export default function SearchPage() {
  return (
    <div className="grid h-full place-items-center px-6">
      <div className="w-full max-w-md rounded-2xl border border-line bg-raised p-10 text-center">
        <div className="mx-auto grid size-14 place-items-center rounded-2xl border border-accent/25 bg-accent/12">
          <Search className="size-6 stroke-accent-ink" />
        </div>
        <h2 className="mt-5 text-xl font-semibold">Full-text search arrives in Phase 3</h2>
        <p className="mt-2 text-sm leading-relaxed text-mute">
          MiniSearch will index every title and block, with highlighted matches
          and tag filters — all client-side, all instant.
        </p>
      </div>
    </div>
  );
}
