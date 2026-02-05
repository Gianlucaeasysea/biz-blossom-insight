import { motion } from 'framer-motion';
import { BarChart3, Settings, RefreshCw, Plug } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface DashboardHeaderProps {
  onRefresh?: () => void;
  isLoading?: boolean;
}

export function DashboardHeader({ onRefresh, isLoading }: DashboardHeaderProps) {
  return (
    <motion.header
      initial={{ opacity: 0, y: -20 }}
      animate={{ opacity: 1, y: 0 }}
      className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8"
    >
      <div className="flex items-center gap-4">
        <div className="p-3 rounded-xl bg-gradient-to-br from-primary/20 to-accent/20 glow-primary">
          <BarChart3 className="w-8 h-8 text-primary" />
        </div>
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">
            Analytics Dashboard
          </h1>
          <p className="text-muted-foreground">
            Vendite B2C + B2B unificate
          </p>
        </div>
      </div>

      <div className="flex items-center gap-2">
        <Button
          variant="outline"
          size="sm"
          className="bg-muted/50 border-border/50"
        >
          <Plug className="w-4 h-4 mr-2" />
          Connessioni
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={onRefresh}
          disabled={isLoading}
          className="bg-muted/50 border-border/50"
        >
          <RefreshCw className={`w-4 h-4 mr-2 ${isLoading ? 'animate-spin' : ''}`} />
          Aggiorna
        </Button>
        <Button
          variant="outline"
          size="sm"
          className="bg-muted/50 border-border/50"
        >
          <Settings className="w-4 h-4" />
        </Button>
      </div>
    </motion.header>
  );
}
