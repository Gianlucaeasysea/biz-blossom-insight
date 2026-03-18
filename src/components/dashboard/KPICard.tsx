import { KPIData } from '@/types/analytics';

interface KPICardProps {
  data: KPIData;
}

function getCardTheme(label: string): { accent: string; bar: string; badge?: string; badgeLabel?: string } {
  const l = label.toLowerCase();
  if (l.includes('b2c')) return {
    accent: 'hsl(168,70%,42%)',
    bar: 'hsl(168,70%,42%)',
    badge: 'badge-b2c',
    badgeLabel: 'B2C',
  };
  if (l.includes('b2b')) return {
    accent: 'hsl(42,96%,48%)',
    bar: 'hsl(42,96%,48%)',
    badge: 'badge-b2b',
    badgeLabel: 'B2B',
  };
  return { accent: 'hsl(215,85%,50%)', bar: 'hsl(215,85%,50%)' };
}

export function KPICard({ data }: KPICardProps) {
  const formatValue = (value: number) => {
    if (data.format === 'currency') {
      return new Intl.NumberFormat('it-IT', {
        style: 'currency',
        currency: data.currency || 'EUR',
        minimumFractionDigits: 0,
        maximumFractionDigits: 0,
      }).format(value);
    }
    if (data.format === 'percent') return `${value.toFixed(1)}%`;
    return new Intl.NumberFormat('it-IT').format(value);
  };

  const theme = getCardTheme(data.label);

  // Strip "B2C" / "B2B" suffix from label for cleaner display
  const displayLabel = data.label.replace(/ B2C$/, '').replace(/ B2B$/, '');

  return (
    <div
      className="kpi-card group relative overflow-hidden"
      style={{ borderLeft: `3px solid ${theme.accent}` }}
    >
      {/* Top glow line */}
      <div
        className="absolute top-0 left-0 right-0 h-px opacity-60"
        style={{ background: `linear-gradient(90deg, ${theme.accent}, transparent)` }}
      />

      <div className="flex items-start justify-between mb-2.5 gap-1">
        <p className="text-[10px] text-muted-foreground font-semibold uppercase tracking-[0.12em] leading-tight">
          {displayLabel}
        </p>
        {theme.badge && (
          <span className={`shrink-0 inline-flex items-center px-1.5 py-px rounded text-[8px] font-bold tracking-wider uppercase ${theme.badge}`}>
            {theme.badgeLabel}
          </span>
        )}
      </div>

      <p
        className="text-2xl font-bold tracking-tight font-mono"
        style={{ color: theme.accent }}
      >
        {formatValue(data.value)}
      </p>
    </div>
  );
}
