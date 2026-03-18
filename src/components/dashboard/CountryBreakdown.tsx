import { useState, useMemo } from 'react';
import { ArrowUpDown, Globe, Download } from 'lucide-react';
import { Order } from '@/types/analytics';
import { getCountryBreakdown } from '@/lib/mock-data';
import { downloadCsv } from '@/lib/csv-export';

interface CountryBreakdownProps {
  orders: Order[];
  allSkus: string[];
}

export function CountryBreakdown({ orders, allSkus }: CountryBreakdownProps) {
  const [skuFilter, setSkuFilter] = useState<string>('');
  const [sortField, setSortField] = useState<'totalSales' | 'b2cSales' | 'b2bSales' | 'country'>('totalSales');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');

  const data = useMemo(() => getCountryBreakdown(orders, skuFilter || undefined), [orders, skuFilter]);

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

  const handleExport = () => {
    downloadCsv('vendite-paese', ['Paese', 'B2C', 'B2B', 'Totale'],
      sorted.map(r => [r.country, r.b2cSales, r.b2bSales, r.totalSales]));
  };

  return (
    <div className="chart-container">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
        <div className="flex items-center gap-2">
          <Globe className="w-4 h-4 text-muted-foreground" />
          <h3 className="text-sm font-semibold">Vendite per Paese</h3>
        </div>
        <div className="flex items-center gap-2">
          <select
            value={skuFilter}
            onChange={e => setSkuFilter(e.target.value)}
            className="h-8 text-xs rounded-md border border-border/50 bg-muted/50 px-3 py-1 text-foreground"
          >
            <option value="">Tutti gli SKU</option>
            {allSkus.map(sku => (
              <option key={sku} value={sku}>{sku}</option>
            ))}
          </select>
          <button onClick={handleExport} className="p-2 rounded-md hover:bg-muted/50 text-muted-foreground hover:text-foreground transition-colors" title="Esporta CSV">
            <Download className="w-4 h-4" />
          </button>
        </div>
      </div>
      <div className="overflow-x-auto scrollbar-custom">
        <table className="data-table">
          <thead><tr>
            <th><SortBtn field="country">Paese</SortBtn></th>
            <th className="text-right"><SortBtn field="b2cSales">B2C</SortBtn></th>
            <th className="text-right"><SortBtn field="b2bSales">B2B</SortBtn></th>
            <th className="text-right"><SortBtn field="totalSales">Totale</SortBtn></th>
          </tr></thead>
          <tbody>
            {sorted.map(r => (
              <tr key={r.country}>
                <td className="text-xs">{r.country}</td>
                <td className="text-right font-mono text-xs">{fmt(r.b2cSales)}</td>
                <td className="text-right font-mono text-xs">{fmt(r.b2bSales)}</td>
                <td className="text-right font-mono text-xs font-semibold">{fmt(r.totalSales)}</td>
              </tr>
            ))}
            {!sorted.length && <tr><td colSpan={4} className="text-center text-muted-foreground py-6 text-xs">Nessun dato</td></tr>}
          </tbody>
          {sorted.length > 0 && (
            <tfoot><tr className="border-t-2 border-border font-semibold text-xs">
              <td>Totale</td>
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
