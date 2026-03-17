import { useState, useMemo } from 'react';
import { Search, ArrowUpDown } from 'lucide-react';
import { Input } from '@/components/ui/input';

interface SkuRow { sku: string; name: string; fatturato: number; ordiniRaccolti: number; qtyEvasi: number; qtyTotali: number; }
type SortField = 'sku' | 'name' | 'fatturato' | 'ordiniRaccolti';

export function B2CSkuTable({ data }: { data: SkuRow[] }) {
  const [search, setSearch] = useState('');
  const [sortField, setSortField] = useState<SortField>('ordiniRaccolti');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');

  const filtered = useMemo(() => {
    let result = [...data];
    if (search) { const s = search.toLowerCase(); result = result.filter(r => r.sku.toLowerCase().includes(s) || r.name.toLowerCase().includes(s)); }
    result.sort((a, b) => { const cmp = typeof a[sortField] === 'string' ? (a[sortField] as string).localeCompare(b[sortField] as string) : (a[sortField] as number) - (b[sortField] as number); return sortDir === 'asc' ? cmp : -cmp; });
    return result;
  }, [data, search, sortField, sortDir]);

  const handleSort = (f: SortField) => { if (sortField === f) setSortDir(d => d === 'asc' ? 'desc' : 'asc'); else { setSortField(f); setSortDir('desc'); } };
  const fmt = (v: number) => new Intl.NumberFormat('it-IT', { style: 'currency', currency: 'EUR' }).format(v);
  const SortBtn = ({ field, children }: { field: SortField; children: React.ReactNode }) => (
    <button onClick={() => handleSort(field)} className="flex items-center gap-1 hover:text-foreground transition-colors">
      {children}<ArrowUpDown className={`w-3 h-3 ${sortField === field ? 'text-primary' : ''}`} />
    </button>
  );

  return (
    <div className="chart-container">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
        <h3 className="text-sm font-semibold">Dettaglio B2C per SKU</h3>
        <div className="relative w-full sm:w-56">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
          <Input placeholder="Cerca SKU..." value={search} onChange={e => setSearch(e.target.value)} className="pl-9 h-8 text-xs bg-muted/50 border-border/50" />
        </div>
      </div>
      <div className="overflow-x-auto scrollbar-custom">
        <table className="data-table">
          <thead><tr>
            <th><SortBtn field="sku">SKU</SortBtn></th>
            <th><SortBtn field="name">Prodotto</SortBtn></th>
            <th className="text-right"><SortBtn field="fatturato">Fatturato</SortBtn></th>
            <th className="text-center">Qty Evasi</th>
            <th className="text-right"><SortBtn field="ordiniRaccolti">Raccolti</SortBtn></th>
            <th className="text-center">Qty Tot</th>
          </tr></thead>
          <tbody>
            {filtered.map(r => (
              <tr key={r.sku}>
                <td className="font-mono text-xs">{r.sku}</td>
                <td className="text-xs">{r.name}</td>
                <td className="text-right font-mono text-xs">{fmt(r.fatturato)}</td>
                <td className="text-center text-xs text-muted-foreground">{r.qtyEvasi}</td>
                <td className="text-right font-mono text-xs">{fmt(r.ordiniRaccolti)}</td>
                <td className="text-center text-xs text-muted-foreground">{r.qtyTotali}</td>
              </tr>
            ))}
            {!filtered.length && <tr><td colSpan={6} className="text-center text-muted-foreground py-6 text-xs">Nessun dato</td></tr>}
          </tbody>
          {filtered.length > 0 && (
            <tfoot><tr className="border-t-2 border-border font-semibold text-xs">
              <td colSpan={2}>Totale</td>
              <td className="text-right font-mono">{fmt(filtered.reduce((s, r) => s + r.fatturato, 0))}</td>
              <td className="text-center">{filtered.reduce((s, r) => s + r.qtyEvasi, 0)}</td>
              <td className="text-right font-mono">{fmt(filtered.reduce((s, r) => s + r.ordiniRaccolti, 0))}</td>
              <td className="text-center">{filtered.reduce((s, r) => s + r.qtyTotali, 0)}</td>
            </tr></tfoot>
          )}
        </table>
      </div>
    </div>
  );
}
