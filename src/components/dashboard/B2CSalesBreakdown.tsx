import { useMemo } from 'react';
import { Order } from '@/types/analytics';

interface B2CSalesBreakdownProps {
  orders: Order[];
}

export function B2CSalesBreakdown({ orders }: B2CSalesBreakdownProps) {
  const b2cOrders = useMemo(() => orders.filter(o => o.customerType === 'B2C'), [orders]);

  const breakdown = useMemo(() => {
    const grossSales = b2cOrders.reduce((s, o) => s + (o.grossSales ?? o.totalAmount), 0);
    const discounts = b2cOrders.reduce((s, o) => s + (o.totalDiscounts ?? 0), 0);
    const returns = b2cOrders.reduce((s, o) => s + (o.totalRefunds ?? 0), 0);
    const shippingCharges = b2cOrders.reduce((s, o) => s + (o.shippingCharges ?? 0), 0);
    const taxes = b2cOrders.reduce((s, o) => s + (o.taxes ?? 0), 0);
    const fees = b2cOrders.reduce((s, o) => s + (o.fees ?? 0), 0);
    const netSales = b2cOrders.reduce((s, o) => s + (o.netAmount ?? o.totalAmount), 0);
    const totalSales = b2cOrders.reduce(
      (s, o) => s + (o.totalSales ?? ((o.netAmount ?? o.totalAmount) + (o.shippingCharges ?? 0) + (o.taxes ?? 0) + (o.fees ?? 0))),
      0
    );

    return { grossSales, discounts, returns, shippingCharges, taxes, fees, netSales, totalSales, orderCount: b2cOrders.length };
  }, [b2cOrders]);

  const fmt = (v: number) =>
    new Intl.NumberFormat('it-IT', { style: 'currency', currency: 'EUR' }).format(v);

  const rows: Array<{ label: string; value: number; negative?: boolean; highlight?: boolean }> = [
    { label: 'Gross Sales B2C', value: breakdown.grossSales },
    { label: 'Discounts B2C', value: breakdown.discounts, negative: true },
    { label: 'Returns B2C', value: breakdown.returns, negative: true },
    { label: 'Net Sales B2C', value: breakdown.netSales, highlight: true },
    { label: 'Shipping Charges B2C', value: breakdown.shippingCharges },
    { label: 'Taxes B2C', value: breakdown.taxes },
    { label: 'Fees B2C', value: breakdown.fees },
    { label: 'Total Sales B2C', value: breakdown.totalSales },
  ];

  return (
    <div className="chart-container">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="text-sm font-semibold">Spaccato Vendite B2C</h3>
          <p className="text-xs text-muted-foreground mt-0.5">{breakdown.orderCount} ordini</p>
        </div>
      </div>
      <div className="space-y-0">
        {rows.map((row) => (
          <div
            key={row.label}
            className={`flex items-center justify-between py-3 px-3 text-sm ${
              row.highlight
                ? 'bg-primary/10 rounded-md font-semibold'
                : 'border-b border-border/30'
            }`}
          >
            <span className={`${row.highlight ? 'text-primary' : 'text-muted-foreground'}`}>
              {row.label}
            </span>
            <span className={`font-mono text-xs ${
              row.negative ? 'text-destructive' : row.highlight ? 'text-primary' : 'text-foreground'
            }`}>
              {row.negative ? '-' : ''}{fmt(Math.abs(row.value))}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

