import { ShopifySalesSummary } from '@/types/analytics';

interface B2CSalesBreakdownProps {
  summary?: ShopifySalesSummary;
  orderCount: number;
  isLoading?: boolean;
}

export function B2CSalesBreakdown({ summary, orderCount, isLoading = false }: B2CSalesBreakdownProps) {
  const fmt = (v: number) =>
    new Intl.NumberFormat('it-IT', { style: 'currency', currency: 'EUR' }).format(v);

  const rows: Array<{ label: string; value: number; highlight?: boolean }> = [
    { label: 'Gross Sales B2C', value: summary?.grossSales ?? 0 },
    { label: 'Discounts B2C', value: summary?.discounts ?? 0 },
    { label: 'Returns B2C', value: summary?.returns ?? 0 },
    { label: 'Net Sales B2C', value: summary?.netSales ?? 0, highlight: true },
    { label: 'Shipping Charges B2C', value: summary?.shippingCharges ?? 0 },
    { label: 'Taxes B2C', value: summary?.taxes ?? 0 },
    { label: 'Fees B2C', value: summary?.returnFees ?? 0 },
    { label: 'Total Sales B2C', value: summary?.totalSales ?? 0 },
  ];

  return (
    <div className="chart-container">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="text-sm font-semibold">Spaccato Vendite B2C</h3>
          <p className="text-xs text-muted-foreground mt-0.5">
            {orderCount} ordini · {summary?.source === 'shopify_analytics' ? 'fonte report Shopify' : 'fallback ordini'}
          </p>
          {summary?.warning ? (
            <p className="text-xs text-destructive mt-1">{summary.warning}</p>
          ) : null}
        </div>
      </div>
      <div className="space-y-0">
        {rows.map((row) => {
          const valueClass = row.highlight
            ? 'text-primary'
            : row.value < 0
              ? 'text-destructive'
              : 'text-foreground';

          return (
            <div
              key={row.label}
              className={`flex items-center justify-between py-3 px-3 text-sm ${
                row.highlight
                  ? 'bg-primary/10 rounded-md font-semibold'
                  : 'border-b border-border/30'
              }`}
            >
              <span className={row.highlight ? 'text-primary' : 'text-muted-foreground'}>
                {row.label}
              </span>
              <span className={`font-mono text-xs ${valueClass}`}>
                {isLoading ? '…' : fmt(row.value)}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
