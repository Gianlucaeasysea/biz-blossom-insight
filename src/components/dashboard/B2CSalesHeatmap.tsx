import { useMemo, useState } from 'react';
import { eachMonthOfInterval, startOfMonth, endOfMonth, format, isWithinInterval } from 'date-fns';
import { it } from 'date-fns/locale';
import { Map } from 'lucide-react';
import { Order } from '@/types/analytics';

interface B2CSalesHeatmapProps {
  orders: Order[];
  dateRange: { start: Date; end: Date };
}

export function B2CSalesHeatmap({ orders, dateRange }: B2CSalesHeatmapProps) {
  const [topN, setTopN] = useState(10);

  const { months, countries, matrix, maxValue } = useMemo(() => {
    const b2cOrders = orders.filter(o => o.customerType === 'B2C');

    const months = eachMonthOfInterval({ start: dateRange.start, end: dateRange.end }).map(d => ({
      start: startOfMonth(d),
      end: endOfMonth(d),
      label: format(d, 'MMM yy', { locale: it }),
    }));

    const countryTotals: Record<string, number> = {};
    b2cOrders.forEach(o => {
      const country = o.destinationCountry || o.country || 'Sconosciuto';
      countryTotals[country] = (countryTotals[country] || 0) + (o.netAmount ?? o.totalAmount);
    });

    const countries = Object.entries(countryTotals)
      .sort((a, b) => b[1] - a[1])
      .slice(0, topN)
      .map(([c]) => c);

    const matrix: Record<string, number[]> = {};
    countries.forEach(c => { matrix[c] = new Array(months.length).fill(0); });

    b2cOrders.forEach(o => {
      const country = o.destinationCountry || o.country || 'Sconosciuto';
      if (!matrix[country]) return;
      const amount = o.netAmount ?? o.totalAmount;
      const orderDate = o.date instanceof Date ? o.date : new Date(o.date);
      months.forEach((m, idx) => {
        if (isWithinInterval(orderDate, { start: m.start, end: m.end })) {
          matrix[country][idx] += amount;
        }
      });
    });

    let maxValue = 0;
    countries.forEach(c =>
      months.forEach((_, idx) => { if (matrix[c][idx] > maxValue) maxValue = matrix[c][idx]; })
    );

    return { months, countries, matrix, maxValue };
  }, [orders, dateRange, topN]);

  const getColor = (value: number) => {
    if (maxValue === 0 || value === 0) return 'hsl(215 30% 95%)';
    const t = value / maxValue;
    const lightness = Math.round(92 - t * 52);
    const saturation = Math.round(40 + t * 45);
    return `hsl(215 ${saturation}% ${lightness}%)`;
  };

  const fmtShort = (v: number) =>
    v >= 1000 ? `€${(v / 1000).toFixed(1)}k` : `€${Math.round(v)}`;

  const fmtFull = (v: number) =>
    new Intl.NumberFormat('it-IT', { style: 'currency', currency: 'EUR' }).format(v);

  return (
    <div className="chart-container">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
        <div className="flex items-center gap-2">
          <Map className="w-4 h-4 text-muted-foreground" />
          <h3 className="text-sm font-semibold">Heatmap Vendite B2C per Paese</h3>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs text-muted-foreground">Top</span>
          <select
            value={topN}
            onChange={e => setTopN(Number(e.target.value))}
            className="h-8 text-xs rounded-md border border-border/50 bg-muted/50 px-2 py-1 text-foreground"
          >
            <option value={5}>5 paesi</option>
            <option value={10}>10 paesi</option>
            <option value={15}>15 paesi</option>
            <option value={20}>20 paesi</option>
          </select>
        </div>
      </div>

      {countries.length === 0 ? (
        <p className="text-xs text-muted-foreground text-center py-6">Nessun dato B2C disponibile</p>
      ) : (
        <>
          <div className="overflow-x-auto scrollbar-custom">
            <table className="w-full text-xs border-separate border-spacing-1">
              <thead>
                <tr>
                  <th className="text-left text-muted-foreground font-medium py-1 pr-3 whitespace-nowrap min-w-[120px]">
                    Paese
                  </th>
                  {months.map(m => (
                    <th
                      key={m.label}
                      className="text-center text-muted-foreground font-medium py-1 px-1 whitespace-nowrap min-w-[68px]"
                    >
                      {m.label}
                    </th>
                  ))}
                  <th className="text-right text-muted-foreground font-medium py-1 pl-3 whitespace-nowrap">
                    Totale
                  </th>
                </tr>
              </thead>
              <tbody>
                {countries.map(country => {
                  const row = matrix[country];
                  const total = row.reduce((s, v) => s + v, 0);
                  return (
                    <tr key={country}>
                      <td className="text-foreground font-medium py-0.5 pr-3 whitespace-nowrap">{country}</td>
                      {row.map((value, idx) => {
                        const t = maxValue > 0 ? value / maxValue : 0;
                        return (
                          <td
                            key={idx}
                            className="text-center py-1.5 px-1 rounded font-mono transition-opacity hover:opacity-80"
                            style={{
                              backgroundColor: getColor(value),
                              color: t > 0.5 ? 'hsl(215 60% 18%)' : 'hsl(215 20% 45%)',
                            }}
                            title={`${country} – ${months[idx].label}: ${fmtFull(value)}`}
                          >
                            {value > 0 ? fmtShort(value) : '–'}
                          </td>
                        );
                      })}
                      <td className="text-right font-mono font-semibold py-0.5 pl-3 whitespace-nowrap text-foreground">
                        {fmtFull(total)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Legend */}
          <div className="flex items-center gap-2 mt-4 justify-end">
            <span className="text-xs text-muted-foreground">Basso</span>
            <div className="flex gap-0.5">
              {[0.05, 0.2, 0.4, 0.6, 0.8, 1].map(v => (
                <div
                  key={v}
                  className="w-5 h-3 rounded-sm"
                  style={{ backgroundColor: getColor(v * maxValue) }}
                />
              ))}
            </div>
            <span className="text-xs text-muted-foreground">Alto</span>
          </div>
        </>
      )}
    </div>
  );
}
