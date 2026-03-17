import { useState, useMemo } from 'react';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from 'recharts';
import { Download } from 'lucide-react';
import { Order } from '@/types/analytics';
import { format, eachDayOfInterval, eachWeekOfInterval, eachMonthOfInterval, startOfWeek, endOfWeek, startOfMonth, endOfMonth, isWithinInterval } from 'date-fns';
import { it } from 'date-fns/locale';
import { downloadCsv } from '@/lib/csv-export';

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

  const handleExport = () => {
    downloadCsv('andamento-ordini', ['Data', 'B2C', 'B2B', 'B2B Custom'],
      chartData.map(r => [r.date, r.b2c, r.b2b, r.b2bCustom]));
  };

  const granularities = [
    { value: 'day' as Granularity, label: 'Giorno' },
    { value: 'week' as Granularity, label: 'Settimana' },
    { value: 'month' as Granularity, label: 'Mese' },
  ];

  const formatCurrency = (value: number) => `€${(value / 1000).toFixed(0)}k`;

  // Custom dot that only renders on peak (local maximum) values
  const createPeakDot = (dataKey: string, color: string) => {
    return (props: any) => {
      const { cx, cy, index } = props;
      if (cx == null || cy == null || !chartData.length) return null;
      const val = chartData[index]?.[dataKey as keyof typeof chartData[0]] as number;
      const prev = index > 0 ? (chartData[index - 1]?.[dataKey as keyof typeof chartData[0]] as number) : -1;
      const next = index < chartData.length - 1 ? (chartData[index + 1]?.[dataKey as keyof typeof chartData[0]] as number) : -1;
      const isPeak = val > 0 && val >= prev && val >= next && (val > prev || val > next);
      if (!isPeak) return null;
      return (
        <circle cx={cx} cy={cy} r={4} fill={color} stroke="hsl(var(--background))" strokeWidth={2} />
      );
    };
  };

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
        <div className="flex items-center gap-2">
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
          <button onClick={handleExport} className="p-2 rounded-md hover:bg-muted/50 text-muted-foreground hover:text-foreground transition-colors" title="Esporta CSV">
            <Download className="w-4 h-4" />
          </button>
        </div>
      </div>

      <div className="h-[320px]">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={chartData} margin={{ top: 5, right: 5, left: 0, bottom: 0 }}>
            <CartesianGrid stroke="hsl(218, 25%, 14%)" strokeDasharray="3 3" vertical={false} />
            <XAxis dataKey="date" stroke="hsl(215, 15%, 35%)" fontSize={10} tickLine={false} axisLine={false} />
            <YAxis stroke="hsl(215, 15%, 35%)" fontSize={10} tickLine={false} axisLine={false} tickFormatter={formatCurrency} />
            <Tooltip content={<CustomTooltip />} />
            <Line type="monotone" dataKey="b2c" name="B2C" stroke="hsl(215, 85%, 55%)" strokeWidth={2} dot={createPeakDot('b2c', 'hsl(215, 85%, 55%)')} activeDot={{ r: 5 }} />
            <Line type="monotone" dataKey="b2b" name="B2B" stroke="hsl(25, 95%, 55%)" strokeWidth={2} dot={createPeakDot('b2b', 'hsl(25, 95%, 55%)')} activeDot={{ r: 5 }} />
            <Line type="monotone" dataKey="b2bCustom" name="B2B Custom" stroke="hsl(40, 90%, 55%)" strokeWidth={2} strokeDasharray="5 5" dot={createPeakDot('b2bCustom', 'hsl(40, 90%, 55%)')} activeDot={{ r: 5 }} />
          </LineChart>
        </ResponsiveContainer>
      </div>

      <div className="flex flex-wrap gap-x-4 gap-y-1 mt-4">
        <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <div className="w-3 h-0.5 rounded" style={{ backgroundColor: 'hsl(215, 85%, 55%)' }} />
          <span>B2C</span>
        </div>
        <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <div className="w-3 h-0.5 rounded" style={{ backgroundColor: 'hsl(25, 95%, 55%)' }} />
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
