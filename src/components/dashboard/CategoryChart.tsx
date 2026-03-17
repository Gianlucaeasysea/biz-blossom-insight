import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from 'recharts';
import { CategoryData } from '@/types/analytics';

interface CategoryChartProps {
  data: CategoryData[];
  title: string;
  description: string;
}

export function CategoryChart({ data, title, description }: CategoryChartProps) {
  const fmt = (v: number) => new Intl.NumberFormat('it-IT', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(v);
  const total = data.reduce((s, i) => s + i.value, 0);

  const CustomTooltip = ({ active, payload }: any) => {
    if (!active || !payload?.length) return null;
    const item = payload[0];
    return (
      <div className="bg-popover border border-border rounded-md p-2.5 text-xs shadow-lg">
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 rounded-full" style={{ backgroundColor: item.payload.fill }} />
          <span className="font-medium">{item.name}</span>
        </div>
        <p className="text-muted-foreground mt-1">{fmt(item.value)} ({((item.value / total) * 100).toFixed(1)}%)</p>
      </div>
    );
  };

  return (
    <div className="chart-container">
      <div className="mb-3">
        <h3 className="text-sm font-semibold">{title}</h3>
        <p className="text-xs text-muted-foreground">{description}</p>
      </div>
      <div className="flex items-center">
        <div className="w-1/2 h-[160px]">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie data={data} cx="50%" cy="50%" innerRadius={40} outerRadius={65} paddingAngle={2} dataKey="value">
                {data.map((entry, i) => <Cell key={i} fill={entry.fill} />)}
              </Pie>
              <Tooltip content={<CustomTooltip />} />
            </PieChart>
          </ResponsiveContainer>
        </div>
        <div className="w-1/2 pl-3 space-y-1.5">
          {data.slice(0, 5).map((item, i) => (
            <div key={i} className="flex items-center justify-between text-xs">
              <div className="flex items-center gap-1.5">
                <div className="w-2 h-2 rounded-full" style={{ backgroundColor: item.fill }} />
                <span className="text-muted-foreground truncate max-w-[80px]">{item.name}</span>
              </div>
              <span className="font-mono">{fmt(item.value)}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
