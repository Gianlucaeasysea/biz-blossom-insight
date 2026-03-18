import { TrendingUp, TrendingDown, Minus } from 'lucide-react';
import { KPIData } from '@/types/analytics';

interface KPICardProps {
  data: KPIData;
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

  const TrendIcon = data.trend === 'up' ? TrendingUp : data.trend === 'down' ? TrendingDown : Minus;
  const trendColor = data.trend === 'up'
    ? 'text-success'
    : data.trend === 'down'
    ? 'text-destructive'
    : 'text-muted-foreground';

  return (
    <div className="kpi-card group">
      <div className="flex items-center justify-between mb-2">
        <p className="text-[11px] text-muted-foreground font-medium uppercase tracking-wider truncate">{data.label}</p>
        {data.changePercent !== undefined && (
          <div className={`flex items-center gap-1 text-[10px] ${trendColor}`}>
            <TrendIcon className="w-3 h-3" />
            <span>{Math.abs(data.changePercent)}%</span>
          </div>
        )}
      </div>
      <p className="text-2xl font-bold tracking-tight font-mono text-foreground">
        {formatValue(data.value)}
      </p>
    </div>
  );
}
