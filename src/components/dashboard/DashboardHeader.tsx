import { RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import companyLogo from '@/assets/company-logo.png';

interface DashboardHeaderProps {
  onRefresh?: () => void;
  isLoading?: boolean;
}

export function DashboardHeader({ onRefresh, isLoading }: DashboardHeaderProps) {
  return (
    <header className="flex items-center justify-between mb-8">
      <div className="flex items-center gap-4">
        <img src={companyLogo} alt="Logo" className="h-8 w-auto brightness-90" />
        <div className="h-6 w-px bg-border" />
        <div>
          <h1 className="text-lg font-semibold tracking-tight text-foreground">
            Analytics
          </h1>
          <p className="text-xs text-muted-foreground">B2C + B2B</p>
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
