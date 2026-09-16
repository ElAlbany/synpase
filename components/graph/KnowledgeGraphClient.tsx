"use client";

import dynamic from "next/dynamic";

const KnowledgeGraph = dynamic(
  () =>
    import("@/components/graph/KnowledgeGraph").then((m) => m.KnowledgeGraph),
  {
    ssr: false,
    loading: () => (
      <div className="grid h-full place-items-center text-sm text-faint">
        Loading graph…
      </div>
    ),
  }
);

export function KnowledgeGraphClient() {
  return <KnowledgeGraph />;
}
