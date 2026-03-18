import { useState, useMemo } from 'react';
import { Search, ArrowUpDown, Download, ShoppingBag } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { downloadCsv } from '@/lib/csv-export';
import { ShopifySkuRow } from '@/hooks/useShopifySkuBreakdown';

type SortField = 'sku' | 'name' | 'netQuantity' | 'grossSales' | 'discounts' | 'returns' | 'netSales';

export function B2CSkuTable({ data, isLoading }: { data: ShopifySkuRow[]; isLoading?: boolean }) {
  const [search, setSearch] = useState('');
  const [sortField, setSortField] = useState<SortField>('netSales');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');

  const filtered = useMemo(() => {
    let result = [...data];
    if (search) {
      const s = search.toLowerCase();
      result = result.filter(r => r.sku.toLowerCase().includes(s) || r.name.toLowerCase().includes(s));
    }
    result.sort((a, b) => {
      const cmp = typeof a[sortField] === 'string'
        ? (a[sortField] as string).localeCompare(b[sortField] as string)
        : (a[sortField] as number) - (b[sortField] as number);
      return sortDir === 'asc' ? cmp : -cmp;
    });
    return result;
  }, [data, search, sortField, sortDir]);

  const handleSort = (f: SortField) => {
    if (sortField === f) setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    else { setSortField(f); setSortDir('desc'); }
  };

  const fmt = (v: number) => new Intl.NumberFormat('it-IT', { style: 'currency', currency: 'EUR' }).format(v);

  const SortBtn = ({ field, children }: { field: SortField; children: React.ReactNode }) => (
    <button onClick={() => handleSort(field)} className="flex items-center gap-1 hover:text-foreground transition-colors">
      {children}<ArrowUpDown className={`w-3 h-3 ${sortField === field ? 'text-primary' : ''}`} />
    </button>
  );

  const handleExport = () => {
    downloadCsv('b2c-sku', ['SKU', 'Prodotto', 'Pezzi', 'Gross Sales', 'Sconti', 'Resi', 'Net Sales'],
      filtered.map(r => [r.sku, r.name, r.netQuantity, r.grossSales, r.discounts, r.returns, r.netSales]));
  };

  if (isLoading) {
    return (
      <div className="chart-container">
        <div className="flex items-center gap-2 mb-4">
          <ShoppingBag className="w-4 h-4 text-blue-400" />
          <h3 className="text-sm font-semibold">Dettaglio B2C per SKU</h3>
          <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-blue-500/10 text-blue-400 font-medium">B2C</span>
        </div>
        <div className="flex items-center justify-center py-8 text-sm text-muted-foreground">Caricamento report Shopify...</div>
      </div>
    );
  }

  return (
    <div className="chart-container">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
        <div className="flex items-center gap-2">
          <ShoppingBag className="w-4 h-4 text-blue-400" />
          <h3 className="text-sm font-semibold">Dettaglio B2C per SKU</h3>
          <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-blue-500/10 text-blue-400 font-medium">Report Shopify</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="relative w-full sm:w-56">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
            <Input placeholder="Cerca SKU o prodotto..." value={search} onChange={e => setSearch(e.target.value)} className="pl-9 h-8 text-xs bg-muted/50 border-border/50" />
          </div>
          <button onClick={handleExport} className="p-2 rounded-md hover:bg-muted/50 text-muted-foreground hover:text-foreground transition-colors" title="Esporta CSV">
            <Download className="w-4 h-4" />
          </button>
        </div>
      </div>
      <div className="overflow-x-auto scrollbar-custom">
        <table className="data-table">
          <thead><tr>
            <th><SortBtn field="sku">SKU</SortBtn></th>
            <th><SortBtn field="name">Prodotto</SortBtn></th>
            <th className="text-center"><SortBtn field="netQuantity">Pezzi</SortBtn></th>
            <th className="text-right"><SortBtn field="grossSales">Gross Sales</SortBtn></th>
            <th className="text-right"><SortBtn field="discounts">Sconti</SortBtn></th>
            <th className="text-right"><SortBtn field="returns">Resi</SortBtn></th>
            <th className="text-right"><SortBtn field="netSales">Net Sales</SortBtn></th>
          </tr></thead>
          <tbody>
            {filtered.map(r => (
              <tr key={r.sku}>
                <td className="font-mono text-xs">{r.sku}</td>
                <td className="text-xs max-w-[220px] truncate" title={r.name}>{r.name}</td>
                <td className="text-center text-xs">{r.netQuantity}</td>
                <td className="text-right font-mono text-xs">{fmt(r.grossSales)}</td>
                <td className="text-right font-mono text-xs text-orange-400">{r.discounts !== 0 ? fmt(r.discounts) : '—'}</td>
                <td className="text-right font-mono text-xs text-red-400">{r.returns !== 0 ? fmt(r.returns) : '—'}</td>
                <td className="text-right font-mono text-xs font-semibold">{fmt(r.netSales)}</td>
              </tr>
            ))}
            {!filtered.length && <tr><td colSpan={7} className="text-center text-muted-foreground py-6 text-xs">Nessun dato</td></tr>}
          </tbody>
          {filtered.length > 0 && (
            <tfoot><tr className="border-t-2 border-border font-semibold text-xs">
              <td colSpan={2}>Totale</td>
              <td className="text-center">{filtered.reduce((s, r) => s + r.netQuantity, 0)}</td>
              <td className="text-right font-mono">{fmt(filtered.reduce((s, r) => s + r.grossSales, 0))}</td>
              <td className="text-right font-mono text-orange-400">{fmt(filtered.reduce((s, r) => s + r.discounts, 0))}</td>
              <td className="text-right font-mono text-red-400">{fmt(filtered.reduce((s, r) => s + r.returns, 0))}</td>
              <td className="text-right font-mono">{fmt(filtered.reduce((s, r) => s + r.netSales, 0))}</td>
            </tr></tfoot>
          )}
        </table>
      </div>
    </div>
  );
}
