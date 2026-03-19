import { RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import companyLogo from '@/assets/company-logo.png';

interface DashboardHeaderProps {
  onRefresh?: () => void;
  isLoading?: boolean;
}

export function DashboardHeader({ onRefresh, isLoading }: DashboardHeaderProps) {
  return (
    <header className="flex items-center justify-between mb-4 sm:mb-8">
      <div className="flex items-center gap-3 sm:gap-5">
        <img src={companyLogo} alt="EasySea Logo" className="h-10 sm:h-14 w-auto" />
        <div className="h-8 w-px bg-border/50" />
        <div>
          <h1 className="text-xl font-bold tracking-tight text-foreground">
            EASYSEA ANALYTICS
          </h1>
          <p className="text-xs text-muted-foreground mt-0.5">Dashboard B2C + B2B</p>
        </div>
      </div>

      <Button
        variant="ghost"
        size="sm"
        onClick={onRefresh}
        disabled={isLoading}
        className="text-muted-foreground hover:text-foreground"
      >
        <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
      </Button>
    </header>
  );
}
