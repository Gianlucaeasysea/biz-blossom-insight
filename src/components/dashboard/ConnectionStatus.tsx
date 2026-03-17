import { Check, AlertCircle, Loader2 } from 'lucide-react';

interface DataSourceStatus {
  name: string;
  type: 'shopify' | 'google_sheets';
  status: 'connected' | 'disconnected' | 'syncing';
  recordCount?: number;
}

interface ConnectionStatusProps {
  sources: DataSourceStatus[];
}

export function ConnectionStatus({ sources }: ConnectionStatusProps) {
  const icon = (status: DataSourceStatus['status']) => {
    if (status === 'connected') return <Check className="w-3.5 h-3.5 text-success" />;
    if (status === 'syncing') return <Loader2 className="w-3.5 h-3.5 text-warning animate-spin" />;
    return <AlertCircle className="w-3.5 h-3.5 text-destructive" />;
  };

  return (
    <div className="chart-container h-full">
      <p className="section-label">Fonti Dati</p>
      <div className="space-y-2">
        {sources.map(s => (
          <div key={s.name} className="flex items-center justify-between p-3 rounded-md bg-muted/40">
            <div>
              <p className="text-sm font-medium">{s.name}</p>
              <p className="text-xs text-muted-foreground">{s.recordCount?.toLocaleString('it-IT')} record</p>
            </div>
            {icon(s.status)}
          </div>
        ))}
      </div>
    </div>
  );
}
