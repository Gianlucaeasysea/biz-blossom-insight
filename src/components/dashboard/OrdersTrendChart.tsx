import { useState, useMemo } from 'react';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
} from 'recharts';
import { Order, TimeSeriesData } from '@/types/analytics';
import { format, eachDayOfInterval, eachWeekOfInterval, eachMonthOfInterval, startOfWeek, endOfWeek, startOfMonth, endOfMonth, isWithinInterval } from 'date-fns';
import { it } from 'date-fns/locale';

type Granularity = 'day' | 'week' | 'month';

interface OrdersTrendChartProps {
  orders: Order[];
  dateRange: { start: Date; end: Date };
}

export function OrdersTrendChart({ orders, dateRange }: OrdersTrendChartProps) {
  const [granularity, setGranularity] = useState<Granularity>('month');

  const chartData = useMemo(() => {
    let intervals: { start: Date; end: Date; label: string }[] = [];
    if (granularity === 'day') {
      intervals = eachDayOfInterval({ start: dateRange.start, end: dateRange.end }).map(d => ({
        start: d, end: d, label: format(d, 'dd MMM', { locale: it }),
      }));
    } else if (granularity === 'week') {
      intervals = eachWeekOfInterval({ start: dateRange.start, end: dateRange.end }, { weekStartsOn: 1 }).map(d => ({
        start: startOfWeek(d, { weekStartsOn: 1 }), end: endOfWeek(d, { weekStartsOn: 1 }),
        label: format(startOfWeek(d, { weekStartsOn: 1 }), 'dd MMM', { locale: it }),
      }));
    } else {
      intervals = eachMonthOfInterval({ start: dateRange.start, end: dateRange.end }).map(d => ({
        start: startOfMonth(d), end: endOfMonth(d),
        label: format(d, 'MMM yy', { locale: it }),
      }));
    }

    return intervals.map(interval => {
      const inRange = orders.filter(o => {
        const od = o.date instanceof Date ? o.date : new Date(o.date);
        return isWithinInterval(od, { start: interval.start, end: interval.end });
      });

      const b2c = inRange.filter(o => o.customerType === 'B2C').reduce((s, o) => s + o.totalAmount, 0);
      const b2bNormal = inRange.filter(o => o.customerType === 'B2B' && (!o.orderType || o.orderType.toLowerCase() !== 'custom')).reduce((s, o) => s + o.totalAmount, 0);
      const b2bCustom = inRange.filter(o => o.customerType === 'B2B' && o.orderType?.toLowerCase() === 'custom').reduce((s, o) => s + o.totalAmount, 0);

      return { date: interval.label, b2c: Math.round(b2c), b2b: Math.round(b2bNormal), b2bCustom: Math.round(b2bCustom) };
    });
  }, [orders, dateRange, granularity]);

  const granularities = [
    { value: 'day' as Granularity, label: 'Giorno' },
    { value: 'week' as Granularity, label: 'Settimana' },
    { value: 'month' as Granularity, label: 'Mese' },
  ];

  const formatCurrency = (value: number) => `€${(value / 1000).toFixed(0)}k`;

  const CustomTooltip = ({ active, payload, label }: any) => {
    if (!active || !payload?.length) return null;
    return (
      <div className="bg-popover border border-border rounded-md p-3 text-xs shadow-lg">
        <p className="font-medium mb-2 text-foreground">{label}</p>
        {payload.map((entry: any, i: number) => (
          <div key={i} className="flex items-center gap-2 py-0.5">
            <div className="w-2 h-2 rounded-full" style={{ backgroundColor: entry.color }} />
            <span className="text-muted-foreground flex-1">{entry.name}</span>
            <span className="font-mono font-medium">
              {new Intl.NumberFormat('it-IT', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(entry.value)}
            </span>
          </div>
        ))}
      </div>
    );
  };

  return (
    <div className="chart-container">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-5">
        <div>
          <h3 className="text-sm font-semibold text-foreground">Andamento Ordini</h3>
          <p className="text-xs text-muted-foreground">B2C + B2B (+ B2B Custom)</p>
        </div>
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
      </div>

      <div className="h-[320px]">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={chartData} margin={{ top: 5, right: 5, left: 0, bottom: 0 }}>
            <CartesianGrid stroke="hsl(220, 15%, 12%)" strokeDasharray="3 3" vertical={false} />
            <XAxis dataKey="date" stroke="hsl(220, 10%, 35%)" fontSize={10} tickLine={false} axisLine={false} />
            <YAxis stroke="hsl(220, 10%, 35%)" fontSize={10} tickLine={false} axisLine={false} tickFormatter={formatCurrency} />
            <Tooltip content={<CustomTooltip />} />
            <Line type="monotone" dataKey="b2c" name="B2C" stroke="hsl(190, 100%, 50%)" strokeWidth={2} dot={false} />
            <Line type="monotone" dataKey="b2b" name="B2B" stroke="hsl(270, 60%, 55%)" strokeWidth={2} dot={false} />
            <Line type="monotone" dataKey="b2bCustom" name="B2B Custom" stroke="hsl(40, 90%, 55%)" strokeWidth={2} strokeDasharray="5 5" dot={false} />
          </LineChart>
        </ResponsiveContainer>
      </div>

      <div className="flex flex-wrap gap-x-4 gap-y-1 mt-4">
        <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <div className="w-3 h-0.5 rounded" style={{ backgroundColor: 'hsl(190, 100%, 50%)' }} />
          <span>B2C</span>
        </div>
        <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <div className="w-3 h-0.5 rounded" style={{ backgroundColor: 'hsl(270, 60%, 55%)' }} />
          <span>B2B</span>
        </div>
        <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <div className="w-3 h-0.5 rounded border-dashed" style={{ backgroundColor: 'hsl(40, 90%, 55%)' }} />
          <span>B2B Custom</span>
        </div>
      </div>
    </div>
  );
}
