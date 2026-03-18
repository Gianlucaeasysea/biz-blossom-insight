import { ShopifySalesSummary } from '@/types/analytics';
import { TrendingDown, TrendingUp, ShieldCheck, AlertTriangle } from 'lucide-react';

interface B2CSalesBreakdownProps {
  summary?: ShopifySalesSummary;
  orderCount: number;
  isLoading?: boolean;
}

export function B2CSalesBreakdown({ summary, orderCount, isLoading = false }: B2CSalesBreakdownProps) {
  const fmt = (v: number) =>
    new Intl.NumberFormat('it-IT', { style: 'currency', currency: 'EUR' }).format(v);

  const isOfficial = summary?.source === 'shopify_analytics';

  const rows: Array<{ label: string; value: number; highlight?: boolean; indent?: boolean }> = [
    { label: 'Gross Sales', value: summary?.grossSales ?? 0 },
    { label: 'Discounts', value: summary?.discounts ?? 0, indent: true },
    { label: 'Returns', value: summary?.returns ?? 0, indent: true },
    { label: 'Net Sales', value: summary?.netSales ?? 0, highlight: true },
    { label: 'Shipping', value: summary?.shippingCharges ?? 0, indent: true },
    { label: 'Taxes', value: summary?.taxes ?? 0, indent: true },
    { label: 'Total Sales', value: summary?.totalSales ?? 0 },
  ];

  return (
    <div className="chart-container">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="text-sm font-semibold">Spaccato Vendite B2C</h3>
          <div className="flex items-center gap-2 mt-1">
            <span className="text-xs text-muted-foreground">{orderCount} ordini</span>
            <span className={`inline-flex items-center gap-1 text-[10px] font-medium px-2 py-0.5 rounded-full ${
              isOfficial
                ? 'bg-success/15 text-success'
                : 'bg-warning/15 text-warning'
            }`}>
              {isOfficial ? <ShieldCheck className="w-3 h-3" /> : <AlertTriangle className="w-3 h-3" />}
              {isOfficial ? 'Report Ufficiale' : 'Fallback Ordini'}
            </span>
          </div>
          {summary?.warning ? (
            <p className="text-xs text-destructive mt-1">{summary.warning}</p>
          ) : null}
        </div>
      </div>

      <div className="space-y-0">
        {rows.map((row) => (
          <div
            key={row.label}
            className={`flex items-center justify-between py-2.5 px-3 text-sm transition-colors ${
              row.highlight
                ? 'bg-primary/10 rounded-md font-semibold my-1'
                : 'border-b border-border/20'
            }`}
          >
            <span className={`${row.highlight ? 'text-primary' : row.indent ? 'text-muted-foreground pl-3' : 'text-foreground font-medium'}`}>
              {row.label}
            </span>
            <span className={`font-mono text-xs tabular-nums ${
              row.highlight ? 'text-primary' : row.value < 0 ? 'text-destructive' : 'text-foreground'
            }`}>
              {isLoading ? '…' : fmt(row.value)}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
