import { Network } from "lucide-react";

export default function GraphPage() {
  return (
    <div className="grid h-full place-items-center px-6">
      <div className="w-full max-w-md rounded-2xl border border-line bg-raised p-10 text-center">
        <div className="mx-auto grid size-14 place-items-center rounded-2xl border border-accent/25 bg-accent/12">
          <Network className="size-6 stroke-[#B9B7FF]" />
        </div>
        <h2 className="mt-5 text-xl font-semibold">The graph is coming</h2>
        <p className="mt-2 text-sm leading-relaxed text-mute">
          Phase 3 renders your notes as a living constellation — nodes, glowing
          edges, cluster isolation, and click-to-open navigation.
        </p>
      </div>
    </div>
  );
}
