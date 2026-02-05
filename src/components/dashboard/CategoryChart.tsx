import { motion } from 'framer-motion';
import { 
  PieChart, 
  Pie, 
  Cell, 
  ResponsiveContainer,
  Tooltip,
  Legend
} from 'recharts';
import { CategoryData } from '@/types/analytics';

interface CategoryChartProps {
  data: CategoryData[];
  title: string;
  description: string;
}

export function CategoryChart({ data, title, description }: CategoryChartProps) {
  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('it-IT', {
      style: 'currency',
      currency: 'EUR',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(value);
  };

  const total = data.reduce((sum, item) => sum + item.value, 0);

  const CustomTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
      const item = payload[0];
      const percentage = ((item.value / total) * 100).toFixed(1);
      return (
        <div className="glass-card p-3 !bg-popover/95 border border-border">
          <div className="flex items-center gap-2 mb-1">
            <div 
              className="w-3 h-3 rounded-full" 
              style={{ backgroundColor: item.payload.fill }}
            />
            <span className="font-medium">{item.name}</span>
          </div>
          <div className="text-sm text-muted-foreground">
            {formatCurrency(item.value)} ({percentage}%)
          </div>
        </div>
      );
    }
    return null;
  };

  const renderLegend = () => (
    <div className="space-y-2 mt-4">
      {data.slice(0, 5).map((item, index) => (
        <div key={index} className="flex items-center justify-between text-sm">
          <div className="flex items-center gap-2">
            <div 
              className="w-3 h-3 rounded-full" 
              style={{ backgroundColor: item.fill }}
            />
            <span className="text-muted-foreground truncate max-w-[100px]">{item.name}</span>
          </div>
          <span className="font-medium">{formatCurrency(item.value)}</span>
        </div>
      ))}
    </div>
  );

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.3 }}
      className="chart-container"
    >
      <div className="mb-4">
        <h3 className="text-lg font-semibold">{title}</h3>
        <p className="text-sm text-muted-foreground">{description}</p>
      </div>

      <div className="flex items-center">
        <div className="w-1/2 h-[200px]">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={data}
                cx="50%"
                cy="50%"
                innerRadius={50}
                outerRadius={80}
                paddingAngle={2}
                dataKey="value"
              >
                {data.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={entry.fill} />
                ))}
              </Pie>
              <Tooltip content={<CustomTooltip />} />
            </PieChart>
          </ResponsiveContainer>
        </div>
        <div className="w-1/2 pl-4">
          {renderLegend()}
        </div>
      </div>
    </motion.div>
  );
}
