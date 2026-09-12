const NODES: [number, number][] = [
  [500, 200], [300, 120], [700, 110], [190, 250], [360, 310], [640, 300],
  [820, 230], [760, 60], [120, 140], [520, 360], [880, 340], [280, 60],
];

const EDGES: [number, number][] = [
  [0, 1], [0, 2], [1, 3], [1, 4], [0, 5], [2, 6], [2, 7], [3, 8],
  [5, 9], [6, 10], [1, 11], [4, 5], [0, 4],
];

const LABELED = new Map<number, string>([[0, "design-principles.md"]]);

export function GraphSection() {
  return (
    <section id="graph" className="mx-auto max-w-[1120px] px-6 pb-[110px]">
      <div className="mb-3.5 font-mono text-xs tracking-[0.1em] text-accent uppercase">
        {"// the graph"}
      </div>
      <h2 className="text-[clamp(28px,4vw,44px)] leading-[1.15] font-bold tracking-[-0.02em]">
        Watch your thinking <span className="text-aurora">take shape.</span>
      </h2>
      <p className="mt-3.5 max-w-[56ch] text-base leading-relaxed text-mute">
        Every link is an edge, every note a node. Hover to isolate a thought cluster —
        click to dive straight into the note.
      </p>

      <div className="graph-wrap gwrap mt-14 rounded-[20px] border border-line bg-raised p-6 md:p-9">
        <svg viewBox="0 0 1000 420" className="block h-auto w-full">
          <defs>
            <linearGradient id="eg" x1="0" y1="0" x2="1" y2="1">
              <stop offset="0" stopColor="#6E6BFF" />
              <stop offset="1" stopColor="#2DD4BF" />
            </linearGradient>
            <radialGradient id="ng">
              <stop offset="0" stopColor="#A78BFA" />
              <stop offset="1" stopColor="#6E6BFF" />
            </radialGradient>
          </defs>

          <g>
            {EDGES.map(([a, b], i) => (
              <line
                key={i}
                x1={NODES[a][0]}
                y1={NODES[a][1]}
                x2={NODES[b][0]}
                y2={NODES[b][1]}
                className={`edge ${i % 5 === 0 ? "a" : ""}`}
              />
            ))}
          </g>

          <g>
            {NODES.map(([x, y], i) => {
              const s = i === 0 ? 13 : i % 3 === 0 ? 9 : 6.5;
              return (
                <g key={i} className="gnode glow">
                  <circle
                    cx={x}
                    cy={y}
                    r={s + 7}
                    fill={`rgba(110,107,255,${i === 0 ? 0.22 : 0.1})`}
                  />
                  <circle
                    cx={x}
                    cy={y}
                    r={s}
                    fill={i === 0 ? "url(#ng)" : "#1A1C24"}
                    stroke={i === 0 ? "none" : "rgba(110,107,255,.7)"}
                    strokeWidth="1.4"
                  />
                  {LABELED.has(i) && (
                    <text
                      x={x}
                      y={y - 22}
                      textAnchor="middle"
                      className="nlabel"
                      fill="var(--accent-ink)"
                    >
                      {LABELED.get(i)}
                    </text>
                  )}
                  {i !== 0 && i % 4 === 0 && (
                    <text x={x} y={y + 22} textAnchor="middle" className="nlabel">
                      note-{i}
                    </text>
                  )}
                </g>
              );
            })}
          </g>
        </svg>
      </div>
    </section>
  );
}
