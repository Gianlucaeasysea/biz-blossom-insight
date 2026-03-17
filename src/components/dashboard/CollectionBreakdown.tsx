import { useState, useMemo } from 'react';
import { ArrowUpDown, Layers } from 'lucide-react';
import { Order } from '@/types/analytics';
import { getCollectionBreakdown } from '@/lib/mock-data';

interface CollectionBreakdownProps {
  orders: Order[];
}

export function CollectionBreakdown({ orders }: CollectionBreakdownProps) {
  const [channel, setChannel] = useState<'all' | 'B2C' | 'B2B'>('all');
  const [sortField, setSortField] = useState<'totalSales' | 'b2cSales' | 'b2bSales' | 'qtySold' | 'collection'>('totalSales');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');

  const data = useMemo(() => getCollectionBreakdown(orders, channel), [orders, channel]);

  const sorted = useMemo(() => {
    return [...data].sort((a, b) => {
      const cmp = typeof a[sortField] === 'string'
        ? (a[sortField] as string).localeCompare(b[sortField] as string)
        : (a[sortField] as number) - (b[sortField] as number);
      return sortDir === 'asc' ? cmp : -cmp;
    });
  }, [data, sortField, sortDir]);

  const handleSort = (f: typeof sortField) => {
    if (sortField === f) setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    else { setSortField(f); setSortDir('desc'); }
  };

  const fmt = (v: number) => new Intl.NumberFormat('it-IT', { style: 'currency', currency: 'EUR' }).format(v);

  const SortBtn = ({ field, children }: { field: typeof sortField; children: React.ReactNode }) => (
    <button onClick={() => handleSort(field)} className="flex items-center gap-1 hover:text-foreground transition-colors">
      {children}<ArrowUpDown className={`w-3 h-3 ${sortField === field ? 'text-primary' : ''}`} />
    </button>
  );

  return (
    <div className="chart-container">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
        <div className="flex items-center gap-2">
          <Layers className="w-4 h-4 text-muted-foreground" />
          <h3 className="text-sm font-semibold">Vendite per Collection</h3>
        </div>
        <div className="flex gap-1">
          {(['all', 'B2C', 'B2B'] as const).map(c => (
            <button
              key={c}
              onClick={() => setChannel(c)}
              className={`px-3 py-1 text-xs rounded-md transition-colors ${channel === c ? 'bg-primary text-primary-foreground' : 'bg-muted/50 text-muted-foreground hover:text-foreground'}`}
            >
              {c === 'all' ? 'Tutti' : c}
            </button>
          ))}
        </div>
      </div>
      <div className="overflow-x-auto scrollbar-custom">
        <table className="data-table">
          <thead><tr>
            <th><SortBtn field="collection">Collection</SortBtn></th>
            <th className="text-right"><SortBtn field="qtySold">Pezzi</SortBtn></th>
            <th className="text-right"><SortBtn field="b2cSales">B2C</SortBtn></th>
            <th className="text-right"><SortBtn field="b2bSales">B2B</SortBtn></th>
            <th className="text-right"><SortBtn field="totalSales">Totale</SortBtn></th>
          </tr></thead>
          <tbody>
            {sorted.map(r => (
              <tr key={r.collection}>
                <td className="text-xs font-medium">{r.collection}</td>
                <td className="text-right font-mono text-xs">{r.qtySold}</td>
                <td className="text-right font-mono text-xs">{fmt(r.b2cSales)}</td>
                <td className="text-right font-mono text-xs">{fmt(r.b2bSales)}</td>
                <td className="text-right font-mono text-xs font-semibold">{fmt(r.totalSales)}</td>
              </tr>
            ))}
            {!sorted.length && <tr><td colSpan={5} className="text-center text-muted-foreground py-6 text-xs">Nessun dato</td></tr>}
          </tbody>
          {sorted.length > 0 && (
            <tfoot><tr className="border-t-2 border-border font-semibold text-xs">
              <td>Totale</td>
              <td className="text-right font-mono">{sorted.reduce((s, r) => s + r.qtySold, 0)}</td>
              <td className="text-right font-mono">{fmt(sorted.reduce((s, r) => s + r.b2cSales, 0))}</td>
              <td className="text-right font-mono">{fmt(sorted.reduce((s, r) => s + r.b2bSales, 0))}</td>
              <td className="text-right font-mono">{fmt(sorted.reduce((s, r) => s + r.totalSales, 0))}</td>
            </tr></tfoot>
          )}
        </table>
      </div>
    </div>
  );
}
