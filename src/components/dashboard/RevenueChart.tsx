import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';
import { TimeSeriesData, CustomerType } from '@/types/analytics';

interface RevenueChartProps {
  data: TimeSeriesData[];
  customerTypeFilter: CustomerType | 'all';
}

export function RevenueChart({ data, customerTypeFilter }: RevenueChartProps) {
  const CustomTooltip = ({ active, payload, label }: any) => {
    if (!active || !payload?.length) return null;
    return (
      <div className="bg-popover border border-border rounded-md p-3 text-xs shadow-lg">
        <p className="font-medium mb-2">{label}</p>
        {payload.map((entry: any, i: number) => (
          <div key={i} className="flex items-center gap-2 py-0.5">
            <div className="w-2 h-2 rounded-full" style={{ backgroundColor: entry.color }} />
            <span className="text-muted-foreground">{entry.name}:</span>
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
      <div className="mb-5">
        <h3 className="text-sm font-semibold">Andamento Fatturato</h3>
        <p className="text-xs text-muted-foreground">B2C vs B2B nel periodo</p>
      </div>

      <div className="h-[280px]">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={data} margin={{ top: 5, right: 5, left: 0, bottom: 0 }}>
            <defs>
              <linearGradient id="gB2C" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="hsl(190, 100%, 50%)" stopOpacity={0.15} />
                <stop offset="95%" stopColor="hsl(190, 100%, 50%)" stopOpacity={0} />
              </linearGradient>
              <linearGradient id="gB2B" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="hsl(270, 60%, 55%)" stopOpacity={0.15} />
                <stop offset="95%" stopColor="hsl(270, 60%, 55%)" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid stroke="hsl(220, 15%, 12%)" strokeDasharray="3 3" vertical={false} />
            <XAxis dataKey="date" stroke="hsl(220, 10%, 35%)" fontSize={10} tickLine={false} axisLine={false} />
            <YAxis stroke="hsl(220, 10%, 35%)" fontSize={10} tickLine={false} axisLine={false}
              tickFormatter={v => `€${(v / 1000).toFixed(0)}k`} />
            <Tooltip content={<CustomTooltip />} />
            {(customerTypeFilter === 'all' || customerTypeFilter === 'B2C') && (
              <Area type="monotone" dataKey="b2c" name="B2C" stroke="hsl(190, 100%, 50%)" strokeWidth={1.5} fill="url(#gB2C)" />
            )}
            {(customerTypeFilter === 'all' || customerTypeFilter === 'B2B') && (
              <Area type="monotone" dataKey="b2b" name="B2B" stroke="hsl(270, 60%, 55%)" strokeWidth={1.5} fill="url(#gB2B)" />
            )}
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
