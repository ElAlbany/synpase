const items = [
  "Block-based editor",
  "Bi-directional links",
  "Interactive knowledge graph",
  "Instant full-text search",
  "Offline-first IndexedDB",
  "Daily notes",
  "Markdown export",
  "Command palette",
];

export function Marquee() {
  const row = (key: string) => (
    <div key={key} className="flex items-center gap-14">
      {items.map((item) => (
        <span key={`${key}-${item}`} className="flex items-center gap-2.5 text-sm text-mute">
          <span className="text-[10px] text-accent">◆</span>
          {item}
        </span>
      ))}
    </div>
  );

  return (
    <div className="overflow-hidden border-y border-line bg-overlay py-5">
      <div className="mq">
        {row("a")}
        {row("b")}
      </div>
    </div>
  );
}
