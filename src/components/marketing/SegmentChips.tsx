import { SegmentDefinition, SegmentKey } from '@/hooks/useCustomerSegmentation';

interface Props {
  segments: SegmentDefinition[];
  active: SegmentKey | null;
  onChange: (key: SegmentKey | null) => void;
  fmt: (v: number) => string;
}

export function SegmentChips({ segments, active, onChange, fmt }: Props) {
  return (
    <div className="glass-card p-3">
      <div className="flex items-center justify-between mb-2">
        <h3 className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
          🎯 Segmenti comportamentali
        </h3>
        {active && (
          <button onClick={() => onChange(null)}
            className="text-[10px] text-muted-foreground hover:text-foreground underline">
            cancella filtro
          </button>
        )}
      </div>
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-2">
        {segments.map(s => {
          const isActive = active === s.key;
          const count = s.ids.size;
          return (
            <button
              key={s.key}
              onClick={() => onChange(isActive ? null : s.key)}
              disabled={count === 0}
              className={`text-left rounded-lg border p-2.5 transition-all disabled:opacity-40 disabled:cursor-not-allowed ${
                isActive
                  ? 'border-primary bg-primary/10 ring-1 ring-primary/40'
                  : 'border-border/40 bg-card/60 hover:border-primary/50 hover:bg-muted/30'
              }`}
              title={s.description}
            >
              <div className="flex items-center justify-between mb-1">
                <span className="text-base leading-none">{s.emoji}</span>
                <span className="text-sm font-mono font-bold">{count}</span>
              </div>
              <p className="text-[11px] font-semibold leading-tight">{s.label}</p>
              <p className="text-[9px] text-muted-foreground font-mono mt-0.5">{fmt(s.totalLTV)}</p>
            </button>
          );
        })}
      </div>
    </div>
  );
}
