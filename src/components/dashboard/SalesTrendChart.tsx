import { useState, useMemo } from 'react';
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from 'recharts';
import { Download } from 'lucide-react';
import { Order } from '@/types/analytics';
import { format, eachDayOfInterval, eachWeekOfInterval, eachMonthOfInterval, startOfWeek, endOfWeek, startOfMonth, endOfMonth, isWithinInterval } from 'date-fns';
import { it } from 'date-fns/locale';
import { downloadCsv } from '@/lib/csv-export';

type Granularity = 'day' | 'week' | 'month';
type ViewMode = 'channel' | 'product';

interface SalesTrendChartProps {
  orders: Order[];
  dateRange: { start: Date; end: Date };
}

export function SalesTrendChart({ orders, dateRange }: SalesTrendChartProps) {
  const [granularity, setGranularity] = useState<Granularity>('month');
  const [viewMode, setViewMode] = useState<ViewMode>('channel');

  const { chartData, keys, colors } = useMemo(() => {
    const keySet = new Set<string>();
    orders.forEach(o => {
      if (viewMode === 'channel') keySet.add(o.channel || 'Altro');
      else o.products.forEach(p => keySet.add(p.name));
    });
    const keys = Array.from(keySet).sort();

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

    const chartData = intervals.map(interval => {
      const row: Record<string, string | number> = { date: interval.label };
      const intervalOrders = orders.filter(o => {
        const od = o.date instanceof Date ? o.date : new Date(o.date);
        return isWithinInterval(od, { start: interval.start, end: interval.end });
      });
      keys.forEach(key => {
        if (viewMode === 'channel') {
          row[key] = intervalOrders.filter(o => (o.channel || 'Altro') === key).reduce((sum, o) => sum + o.totalAmount, 0);
        } else {
          row[key] = intervalOrders.reduce((sum, o) => sum + o.products.filter(p => p.name === key).reduce((ps, p) => ps + p.totalPrice, 0), 0);
        }
      });
      return row;
    });

    const palette = [
      'hsl(215, 85%, 55%)', 'hsl(25, 95%, 55%)', 'hsl(160, 60%, 45%)',
      'hsl(40, 90%, 55%)', 'hsl(0, 70%, 55%)', 'hsl(195, 80%, 50%)',
      'hsl(330, 60%, 55%)', 'hsl(150, 50%, 50%)',
    ];
    const colors = Object.fromEntries(keys.map((k, i) => [k, palette[i % palette.length]]));
    return { chartData, keys, colors };
  }, [orders, dateRange, granularity, viewMode]);

  const handleExport = () => {
    downloadCsv(`vendite-${viewMode}`, ['Data', ...keys],
      chartData.map(r => [r.date as string, ...keys.map(k => r[k] as number)]));
  };

  const formatCurrency = (value: number) => `€${(value / 1000).toFixed(0)}k`;

  const CustomTooltip = ({ active, payload, label }: any) => {
    if (!active || !payload?.length) return null;
    return (
      <div className="bg-popover border border-border rounded-md p-3 text-xs shadow-lg">
        <p className="font-medium mb-2 text-foreground">{label}</p>
        {payload.map((entry: any, i: number) => (
          <div key={i} className="flex items-center gap-2 py-0.5">
            <div className="w-2 h-2 rounded-full" style={{ backgroundColor: entry.color }} />
            <span className="text-muted-foreground flex-1 truncate max-w-[120px]">{entry.name}</span>
            <span className="font-mono font-medium">
              {new Intl.NumberFormat('it-IT', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(entry.value)}
            </span>
          </div>
        ))}
      </div>
    );
  };

  const tabs = [
    { value: 'channel' as ViewMode, label: 'Canale' },
    { value: 'product' as ViewMode, label: 'Prodotto' },
  ];
  const granularities = [
    { value: 'day' as Granularity, label: 'Giorno' },
    { value: 'week' as Granularity, label: 'Settimana' },
    { value: 'month' as Granularity, label: 'Mese' },
  ];

  return (
    <div className="chart-container">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-5">
        <div>
          <h3 className="text-sm font-semibold text-foreground">Andamento Vendite</h3>
          <p className="text-xs text-muted-foreground">Per {viewMode === 'channel' ? 'canale' : 'prodotto'}</p>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex rounded-md bg-muted p-0.5">
            {tabs.map(t => (
              <button key={t.value} onClick={() => setViewMode(t.value)}
                className={`px-3 py-1 text-xs font-medium rounded transition-colors ${viewMode === t.value ? 'bg-secondary text-foreground' : 'text-muted-foreground hover:text-foreground'}`}>
                {t.label}
              </button>
            ))}
          </div>
          <div className="flex rounded-md bg-muted p-0.5">
            {granularities.map(g => (
              <button key={g.value} onClick={() => setGranularity(g.value)}
                className={`px-3 py-1 text-xs font-medium rounded transition-colors ${granularity === g.value ? 'bg-secondary text-foreground' : 'text-muted-foreground hover:text-foreground'}`}>
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
          <AreaChart data={chartData} margin={{ top: 5, right: 5, left: 0, bottom: 0 }}>
            <CartesianGrid stroke="hsl(218, 25%, 14%)" strokeDasharray="3 3" vertical={false} />
            <XAxis dataKey="date" stroke="hsl(215, 15%, 35%)" fontSize={10} tickLine={false} axisLine={false} />
            <YAxis stroke="hsl(215, 15%, 35%)" fontSize={10} tickLine={false} axisLine={false} tickFormatter={formatCurrency} />
            <Tooltip content={<CustomTooltip />} />
            {keys.map(key => (
              <Area key={key} type="monotone" dataKey={key} name={key} stroke={colors[key]} strokeWidth={1.5} fill={colors[key]} fillOpacity={0.08} stackId="1" />
            ))}
          </AreaChart>
        </ResponsiveContainer>
      </div>

      <div className="flex flex-wrap gap-x-4 gap-y-1 mt-4">
        {keys.map(key => (
          <div key={key} className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <div className="w-2 h-2 rounded-full" style={{ backgroundColor: colors[key] }} />
            <span className="truncate max-w-[100px]">{key}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
