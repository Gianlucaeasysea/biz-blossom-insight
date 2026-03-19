import { useState, useMemo } from 'react';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
} from 'recharts';
import { Download } from 'lucide-react';
import { Order } from '@/types/analytics';
import { format, eachDayOfInterval, eachWeekOfInterval, eachMonthOfInterval, startOfWeek, endOfWeek, startOfMonth, endOfMonth, isWithinInterval } from 'date-fns';
import { enUS } from 'date-fns/locale';
import { downloadCsv } from '@/lib/csv-export';

type Granularity = 'day' | 'week' | 'month';
const YEARS = [2024, 2025, 2026] as const;

interface OrdersTrendChartProps {
  orders: Order[];          // filtered by global date range
  allOrders: Order[];       // unfiltered, used when year button is active
  dateRange: { start: Date; end: Date };
}

const fmtCurrency = (v: number) =>
  new Intl.NumberFormat('it-IT', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(v);

export function OrdersTrendChart({ orders, allOrders, dateRange }: OrdersTrendChartProps) {
  const [granularity, setGranularity] = useState<Granularity>('month');
  const [activeYear, setActiveYear] = useState<number | null>(null);

  // When a year is selected, use allOrders filtered to that year; otherwise use the filtered orders
  const effectiveOrders = useMemo(() => {
    if (!activeYear) return orders;
    return allOrders.filter(o => {
      const d = o.date instanceof Date ? o.date : new Date(o.date);
      return d.getFullYear() === activeYear;
    });
  }, [orders, allOrders, activeYear]);

  const effectiveDateRange = useMemo(() => {
    if (!activeYear) return dateRange;
    return {
      start: new Date(`${activeYear}-01-01T00:00:00`),
      end: new Date(`${activeYear}-12-31T23:59:59`),
    };
  }, [activeYear, dateRange]);

  const chartData = useMemo(() => {
    let intervals: { start: Date; end: Date; label: string }[] = [];
    const { start, end } = effectiveDateRange;

    // Force month granularity for full-year views
    const gran = activeYear ? 'month' : granularity;

    if (gran === 'day') {
      intervals = eachDayOfInterval({ start, end }).map(d => ({
        start: d, end: d, label: format(d, 'dd MMM', { locale: enUS }),
      }));
    } else if (gran === 'week') {
      intervals = eachWeekOfInterval({ start, end }, { weekStartsOn: 1 }).map(d => ({
        start: startOfWeek(d, { weekStartsOn: 1 }),
        end: endOfWeek(d, { weekStartsOn: 1 }),
        label: format(startOfWeek(d, { weekStartsOn: 1 }), 'dd MMM', { locale: enUS }),
      }));
    } else {
      intervals = eachMonthOfInterval({ start, end }).map(d => ({
        start: startOfMonth(d), end: endOfMonth(d),
        label: format(d, 'MMM yy', { locale: enUS }),
      }));
    }

    return intervals.map(interval => {
      const inRange = effectiveOrders.filter(o => {
        const od = o.date instanceof Date ? o.date : new Date(o.date);
        return isWithinInterval(od, { start: interval.start, end: interval.end });
      });

      const b2c = inRange.filter(o => o.customerType === 'B2C')
        .reduce((s, o) => s + (o.netAmount ?? o.totalAmount), 0);
      const b2bNormal = inRange.filter(o => o.customerType === 'B2B' && (!o.orderType || o.orderType.toLowerCase() !== 'custom'))
        .reduce((s, o) => s + o.totalAmount, 0);
      const b2bCustom = inRange.filter(o => o.customerType === 'B2B' && o.orderType?.toLowerCase() === 'custom')
        .reduce((s, o) => s + o.totalAmount, 0);

      return { date: interval.label, b2c: Math.round(b2c), b2b: Math.round(b2bNormal), b2bCustom: Math.round(b2bCustom) };
    });
  }, [effectiveOrders, effectiveDateRange, granularity, activeYear]);

  const handleExport = () => {
    downloadCsv('orders-trend', ['Date', 'B2C', 'B2B', 'B2B Custom'],
      chartData.map(r => [r.date, r.b2c, r.b2b, r.b2bCustom]));
  };

  const granularities = [
    { value: 'day' as Granularity, label: 'Day' },
    { value: 'week' as Granularity, label: 'Week' },
    { value: 'month' as Granularity, label: 'Month' },
  ];

  const formatYAxis = (value: number) =>
    value >= 1000 ? `€${(value / 1000).toFixed(0)}k` : `€${value}`;

  // Custom dot: only on local maxima
  const createPeakDot = (dataKey: string, color: string) => (props: any) => {
    const { cx, cy, index } = props;
    if (cx == null || cy == null || !chartData.length) return null;
    const val = chartData[index]?.[dataKey as keyof typeof chartData[0]] as number;
    const prev = index > 0 ? (chartData[index - 1]?.[dataKey as keyof typeof chartData[0]] as number) : -1;
    const next = index < chartData.length - 1 ? (chartData[index + 1]?.[dataKey as keyof typeof chartData[0]] as number) : -1;
    const isPeak = val > 0 && val >= prev && val >= next && (val > prev || val > next);
    if (!isPeak) return null;
    const label = val >= 1000 ? `€${(val / 1000).toFixed(1)}k` : `€${val}`;
    return (
      <g>
        <circle cx={cx} cy={cy} r={4} fill={color} stroke="hsl(var(--background))" strokeWidth={2} />
        <text x={cx} y={cy - 10} textAnchor="middle" fill={color} fontSize={9} fontWeight={600}>{label}</text>
      </g>
    );
  };

  const CustomTooltip = ({ active, payload, label }: any) => {
    if (!active || !payload?.length) return null;
    const total = payload.reduce((s: number, e: any) => s + (e.value || 0), 0);
    return (
      <div className="bg-popover border border-border rounded-md p-3 text-xs shadow-lg min-w-[160px]">
        <p className="font-semibold mb-2 text-foreground">{label}</p>
        {payload.map((entry: any, i: number) => (
          <div key={i} className="flex items-center gap-2 py-0.5">
            <div className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: entry.color }} />
            <span className="text-muted-foreground flex-1">{entry.name}</span>
            <span className="font-mono font-semibold">{fmtCurrency(entry.value)}</span>
          </div>
        ))}
        {payload.length > 1 && (
          <div className="flex items-center gap-2 pt-1.5 mt-1 border-t border-border/50">
            <span className="text-muted-foreground flex-1">Total</span>
            <span className="font-mono font-bold text-foreground">{fmtCurrency(total)}</span>
          </div>
        )}
      </div>
    );
  };

  const B2C_COLOR = 'hsl(215, 85%, 55%)';
  const B2B_COLOR = 'hsl(25, 95%, 55%)';
  const B2B_CUSTOM_COLOR = 'hsl(40, 90%, 55%)';

  return (
    <div className="chart-container">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-5">
        <div>
          <h3 className="text-sm font-semibold text-foreground">Orders Trend</h3>
          <p className="text-xs text-muted-foreground">
            {activeYear ? `Year ${activeYear} — monthly` : 'B2C + B2B (+ B2B Custom)'}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {/* Year filter buttons */}
          <div className="flex rounded-md bg-muted p-0.5">
            <button
              onClick={() => setActiveYear(null)}
              className={`px-2.5 py-1 text-xs font-medium rounded transition-colors ${
                activeYear === null ? 'bg-secondary text-foreground' : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              All
            </button>
            {YEARS.map(y => (
              <button
                key={y}
                onClick={() => setActiveYear(activeYear === y ? null : y)}
                className={`px-2.5 py-1 text-xs font-medium rounded transition-colors ${
                  activeYear === y ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                {y}
              </button>
            ))}
          </div>

          {/* Granularity (hidden when year is active — forces month) */}
          {!activeYear && (
            <div className="flex rounded-md bg-muted p-0.5">
              {granularities.map(g => (
                <button
                  key={g.value}
                  onClick={() => setGranularity(g.value)}
                  className={`px-3 py-1 text-xs font-medium rounded transition-colors ${
                    granularity === g.value ? 'bg-secondary text-foreground' : 'text-muted-foreground hover:text-foreground'
                  }`}
                >
                  {g.label}
                </button>
              ))}
            </div>
          )}

          <button onClick={handleExport} className="p-2 rounded-md hover:bg-muted/50 text-muted-foreground hover:text-foreground transition-colors" title="Export CSV">
            <Download className="w-4 h-4" />
          </button>
        </div>
      </div>

      <div className="h-[340px]">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={chartData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
            <CartesianGrid stroke="hsl(218, 25%, 14%)" strokeDasharray="3 3" vertical={false} />
            <XAxis dataKey="date" stroke="hsl(215, 15%, 35%)" fontSize={10} tickLine={false} axisLine={false} />
            <YAxis stroke="hsl(215, 15%, 35%)" fontSize={10} tickLine={false} axisLine={false} tickFormatter={formatYAxis} width={52} />
            <Tooltip content={<CustomTooltip />} />
            <Line type="monotone" dataKey="b2c" name="B2C" stroke={B2C_COLOR} strokeWidth={2.5}
              dot={createPeakDot('b2c', B2C_COLOR)} activeDot={{ r: 5, strokeWidth: 2 }} />
            <Line type="monotone" dataKey="b2b" name="B2B" stroke={B2B_COLOR} strokeWidth={2.5}
              dot={createPeakDot('b2b', B2B_COLOR)} activeDot={{ r: 5, strokeWidth: 2 }} />
            <Line type="monotone" dataKey="b2bCustom" name="B2B Custom" stroke={B2B_CUSTOM_COLOR}
              strokeWidth={2} strokeDasharray="6 4"
              dot={createPeakDot('b2bCustom', B2B_CUSTOM_COLOR)} activeDot={{ r: 5, strokeWidth: 2 }} />
          </LineChart>
        </ResponsiveContainer>
      </div>

      <div className="flex flex-wrap gap-x-5 gap-y-1 mt-3">
        {[
          { color: B2C_COLOR, label: 'B2C', dashed: false },
          { color: B2B_COLOR, label: 'B2B', dashed: false },
          { color: B2B_CUSTOM_COLOR, label: 'B2B Custom', dashed: true },
        ].map(({ color, label, dashed }) => (
          <div key={label} className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <div className={`w-5 h-0.5 rounded ${dashed ? 'border-t border-dashed' : ''}`} style={{ backgroundColor: dashed ? 'transparent' : color, borderColor: dashed ? color : undefined }} />
            {dashed && <div className="w-5 h-0.5 rounded" style={{ backgroundColor: color, opacity: 0.4, marginLeft: -18 }} />}
            <span>{label}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
