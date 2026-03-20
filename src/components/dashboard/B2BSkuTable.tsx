import { useState, useMemo } from 'react';
import { Search, ArrowUpDown, Download } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { ProductFilter } from '@/components/dashboard/ProductFilter';
import { downloadCsv } from '@/lib/csv-export';

interface SkuRow { sku: string; name: string; qtySold: number; priceRaccolto: number; priceConsegnato: number; }
type SortField = 'sku' | 'name' | 'qtySold' | 'priceRaccolto' | 'priceConsegnato';

export function B2BSkuTable({ data, allProductNames = [], allSkus = [] }: { data: SkuRow[]; allProductNames?: string[]; allSkus?: string[] }) {
  const [search, setSearch] = useState('');
  const [selectedProduct, setSelectedProduct] = useState('');
  const [selectedSku, setSelectedSku] = useState('');
  const [sortField, setSortField] = useState<SortField>('priceRaccolto');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');

  const filtered = useMemo(() => {
    let result = [...data];
    if (selectedProduct) result = result.filter(r => r.name === selectedProduct);
    if (selectedSku) result = result.filter(r => r.sku === selectedSku);
    if (search) { const s = search.toLowerCase(); result = result.filter(r => r.sku.toLowerCase().includes(s) || r.name.toLowerCase().includes(s)); }
    result.sort((a, b) => { const cmp = typeof a[sortField] === 'string' ? (a[sortField] as string).localeCompare(b[sortField] as string) : (a[sortField] as number) - (b[sortField] as number); return sortDir === 'asc' ? cmp : -cmp; });
    return result;
  }, [data, search, selectedProduct, selectedSku, sortField, sortDir]);

  const handleSort = (f: SortField) => { if (sortField === f) setSortDir(d => d === 'asc' ? 'desc' : 'asc'); else { setSortField(f); setSortDir('desc'); } };
  const fmt = (v: number) => new Intl.NumberFormat('it-IT', { style: 'currency', currency: 'EUR' }).format(v);
  const SortBtn = ({ field, children }: { field: SortField; children: React.ReactNode }) => (
    <button onClick={() => handleSort(field)} className="flex items-center gap-1 hover:text-foreground transition-colors">
      {children}<ArrowUpDown className={`w-3 h-3 ${sortField === field ? 'text-primary' : ''}`} />
    </button>
  );

  const handleExport = () => {
    downloadCsv('b2b-sku', ['SKU', 'Product', 'Units Sold', 'Collected Order', 'Fulfilled Order'],
      filtered.map(r => [r.sku, r.name, r.qtySold, r.priceRaccolto, r.priceConsegnato]));
  };

  return (
    <div className="chart-container">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-3">
        <div className="flex items-center gap-2">
          <span className="badge-b2b inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold tracking-wider uppercase">B2B</span>
          <h3 className="text-sm font-semibold accent-b2b">B2B SKU Detail</h3>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <ProductFilter
            productNames={allProductNames} skus={allSkus}
            selectedProduct={selectedProduct} selectedSku={selectedSku}
            onProductChange={setSelectedProduct} onSkuChange={setSelectedSku}
          />
          <div className="relative w-full sm:w-40">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
            <Input placeholder="Search..." value={search} onChange={e => setSearch(e.target.value)} className="pl-9 h-7 text-xs bg-muted/50 border-border/50" />
          </div>
          <button onClick={handleExport} className="p-2 rounded-md hover:bg-muted/50 text-muted-foreground hover:text-foreground transition-colors" title="Export CSV">
            <Download className="w-4 h-4" />
          </button>
        </div>
      </div>
      <div className="table-scroll overflow-x-auto">
        <table className="data-table">
          <thead><tr>
            <th><SortBtn field="sku">SKU</SortBtn></th>
            <th><SortBtn field="name">Product</SortBtn></th>
            <th className="text-center"><SortBtn field="qtySold">Units Sold</SortBtn></th>
            <th className="text-right"><SortBtn field="priceRaccolto">Collected Order</SortBtn></th>
            <th className="text-right"><SortBtn field="priceConsegnato">Fulfilled Order</SortBtn></th>
          </tr></thead>
          <tbody>
            {filtered.map(r => (
              <tr key={r.sku}>
                <td className="font-mono text-xs">{r.sku}</td>
                <td className="text-xs">{r.name}</td>
                <td className="text-center text-xs">{r.qtySold}</td>
                <td className="text-right font-mono text-xs">{fmt(r.priceRaccolto)}</td>
                <td className="text-right font-mono text-xs">{fmt(r.priceConsegnato)}</td>
              </tr>
            ))}
            {!filtered.length && <tr><td colSpan={5} className="text-center text-muted-foreground py-6 text-xs">No data</td></tr>}
          </tbody>
          {filtered.length > 0 && (
            <tfoot><tr className="border-t-2 border-border font-semibold text-xs">
              <td colSpan={2}>Total</td>
              <td className="text-center">{filtered.reduce((s, r) => s + r.qtySold, 0)}</td>
              <td className="text-right font-mono">{fmt(filtered.reduce((s, r) => s + r.priceRaccolto, 0))}</td>
              <td className="text-right font-mono">{fmt(filtered.reduce((s, r) => s + r.priceConsegnato, 0))}</td>
            </tr></tfoot>
          )}
        </table>
      </div>
    </div>
  );
}
