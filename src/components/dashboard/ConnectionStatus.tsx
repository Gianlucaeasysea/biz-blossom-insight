import { motion } from 'framer-motion';
import { Check, AlertCircle, Loader2 } from 'lucide-react';

interface DataSourceStatus {
  name: string;
  type: 'shopify' | 'google_sheets';
  status: 'connected' | 'disconnected' | 'syncing';
  lastSync?: Date;
  recordCount?: number;
}

interface ConnectionStatusProps {
  sources: DataSourceStatus[];
}

export function ConnectionStatus({ sources }: ConnectionStatusProps) {
  const getStatusIcon = (status: DataSourceStatus['status']) => {
    switch (status) {
      case 'connected':
        return <Check className="w-4 h-4 text-success" />;
      case 'disconnected':
        return <AlertCircle className="w-4 h-4 text-destructive" />;
      case 'syncing':
        return <Loader2 className="w-4 h-4 text-warning animate-spin" />;
    }
  };

  const getStatusText = (status: DataSourceStatus['status']) => {
    switch (status) {
      case 'connected':
        return 'Connesso';
      case 'disconnected':
        return 'Disconnesso';
      case 'syncing':
        return 'Sincronizzazione...';
    }
  };

  const getSourceIcon = (type: DataSourceStatus['type']) => {
    if (type === 'shopify') {
      return (
        <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
          <path d="M15.337 3.415c-.134-.067-.267-.067-.401-.067-.134 0-.668.067-.668.067s-.534.534-.668.668c0 0-.067.067-.134.067l-.401-1.736c-.134-.401-.534-.668-1.002-.668-.133 0-.267 0-.401.067l-.534.134c-.134-.401-.401-.802-.668-1.069-.534-.534-1.269-.802-2.004-.802-2.138 0-3.941 2.339-4.342 5.479-.802.267-1.336.401-1.403.401-.401.134-.468.134-.534.534-.067.267-1.002 7.683-1.002 7.683l7.95 1.403 4.275-1.069s-1.87-12.628-1.937-12.962c-.067-.334-.334-.534-.668-.668l.134-.134c.267-.267.534-.534.534-.802s-.067-.534-.134-.534zm-3.206 1.069c-.401.134-.869.267-1.336.401 0-.802.134-1.937.401-2.739.134-.401.401-.802.668-1.069.334.134.534.668.668 1.002.134.668.201 1.603.201 2.405h-.602zm-2.138-.668c-.267.802-.534 1.87-.534 2.873-.802.267-1.603.534-2.405.802.468-1.803 1.336-3.339 2.539-3.808.134 0 .267.067.401.134zm-.668-1.269c-.134 0-.267.067-.401.134-1.603.668-2.672 2.873-3.006 4.944l-1.87.601c.534-2.739 2.138-5.345 4.342-5.479.334 0 .668.134.935.401v-.601z" />
        </svg>
      );
    }
    return (
      <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
        <path d="M19.5 3H4.5C3.12 3 2 4.12 2 5.5v13C2 19.88 3.12 21 4.5 21h15c1.38 0 2.5-1.12 2.5-2.5v-13C22 4.12 20.88 3 19.5 3zm-15 1h15c.83 0 1.5.67 1.5 1.5V7H3V5.5C3 4.67 3.67 4 4.5 4zm15 16h-15c-.83 0-1.5-.67-1.5-1.5V8h18v10.5c0 .83-.67 1.5-1.5 1.5z" />
        <rect x="5" y="10" width="3" height="2" />
        <rect x="10" y="10" width="3" height="2" />
        <rect x="15" y="10" width="3" height="2" />
        <rect x="5" y="14" width="3" height="2" />
        <rect x="10" y="14" width="3" height="2" />
        <rect x="15" y="14" width="3" height="2" />
      </svg>
    );
  };

  return (
    <motion.div
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      className="glass-card p-4"
    >
      <h3 className="text-sm font-medium text-muted-foreground mb-4">Fonti Dati</h3>
      <div className="space-y-3">
        {sources.map((source) => (
          <div
            key={source.name}
            className="flex items-center justify-between p-3 rounded-lg bg-muted/30"
          >
            <div className="flex items-center gap-3">
              <div className="text-muted-foreground">{getSourceIcon(source.type)}</div>
              <div>
                <p className="font-medium text-sm">{source.name}</p>
                <p className="text-xs text-muted-foreground">
                  {source.recordCount?.toLocaleString('it-IT')} record
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              {getStatusIcon(source.status)}
              <span className="text-xs text-muted-foreground">{getStatusText(source.status)}</span>
            </div>
          </div>
        ))}
      </div>
    </motion.div>
  );
}
