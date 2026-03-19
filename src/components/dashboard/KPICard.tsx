import { KPIData } from '@/types/analytics';

interface KPICardProps {
  data: KPIData;
}

type CardTheme = { accentHsl: string; badge: string; badgeLabel: string } | { accentHsl?: undefined; badge?: undefined; badgeLabel?: undefined };

function getCardTheme(label: string): CardTheme {
  const l = label.toLowerCase();
  if (l.includes('b2c')) return { accentHsl: 'hsl(168,42%,38%)', badge: 'badge-b2c', badgeLabel: 'B2C' };
  if (l.includes('b2b')) return { accentHsl: 'hsl(38,55%,46%)', badge: 'badge-b2b', badgeLabel: 'B2B' };
  return {};
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
  const displayLabel = data.label.replace(/ B2C$/, '').replace(/ B2B$/, '');

  return (
    <div
      className="kpi-card"
      style={theme.accentHsl ? { borderLeft: `2px solid ${theme.accentHsl}` } : { borderLeft: '2px solid hsl(220,20%,22%)' }}
    >
      <div className="flex items-center justify-between gap-1 mb-2">
        <p className="text-[10px] font-semibold uppercase tracking-[0.1em] text-muted-foreground leading-tight truncate">
          {displayLabel}
        </p>
        {theme.badge && (
          <span className={`shrink-0 inline-flex items-center px-1.5 py-px rounded text-[9px] font-bold tracking-wider uppercase ${theme.badge}`}>
            {theme.badgeLabel}
          </span>
        )}
      </div>
      <p className="text-base sm:text-2xl font-bold tracking-tight font-mono text-foreground break-all">
        {formatValue(data.value)}
      </p>
    </div>
  );
}
