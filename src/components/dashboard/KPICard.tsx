import { motion } from 'framer-motion';
import { TrendingUp, TrendingDown, Minus } from 'lucide-react';
import { KPIData } from '@/types/analytics';

interface KPICardProps {
  data: KPIData;
  index: number;
}

export function KPICard({ data, index }: KPICardProps) {
  const formatValue = (value: number) => {
    if (data.format === 'currency') {
      return new Intl.NumberFormat('it-IT', {
        style: 'currency',
        currency: data.currency || 'EUR',
        minimumFractionDigits: 0,
        maximumFractionDigits: 0,
      }).format(value);
    }
    if (data.format === 'percent') {
      return `${value.toFixed(1)}%`;
    }
    return new Intl.NumberFormat('it-IT').format(value);
  };

  const TrendIcon = data.trend === 'up' ? TrendingUp : data.trend === 'down' ? TrendingDown : Minus;
  const trendColor = data.trend === 'up' 
    ? 'text-success' 
    : data.trend === 'down' 
    ? 'text-destructive' 
    : 'text-muted-foreground';

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.1, duration: 0.4 }}
      className="kpi-card group"
    >
      <div className="flex items-start justify-between mb-3">
        <span className="text-sm font-medium text-muted-foreground">{data.label}</span>
        {data.changePercent !== undefined && (
          <div className={`flex items-center gap-1 text-xs font-medium ${trendColor}`}>
            <TrendIcon className="w-3 h-3" />
            <span>{Math.abs(data.changePercent)}%</span>
          </div>
        )}
      </div>
      
      <div className="mb-2">
        <span className="text-3xl font-bold tracking-tight">
          {formatValue(data.value)}
        </span>
      </div>

      {data.previousValue !== undefined && (
        <div className="text-xs text-muted-foreground">
          vs {formatValue(data.previousValue)} periodo precedente
        </div>
      )}

      {/* Decorative gradient line */}
      <div className="absolute bottom-0 left-0 right-0 h-1 rounded-b-xl overflow-hidden opacity-0 group-hover:opacity-100 transition-opacity">
        <div className="h-full w-full bg-gradient-to-r from-primary via-accent to-primary" />
      </div>
    </motion.div>
  );
}
