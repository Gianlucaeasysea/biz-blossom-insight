import { useState, useMemo } from 'react';
import { motion } from 'framer-motion';
import { Search, ArrowUpDown } from 'lucide-react';
import { Input } from '@/components/ui/input';

interface SkuRow {
  sku: string;
  name: string;
  fatturato: number;
  ordiniRaccolti: number;
  qtyEvasi: number;
  qtyTotali: number;
}

interface B2CSkuTableProps {
  data: SkuRow[];
}

type SortField = 'sku' | 'name' | 'fatturato' | 'ordiniRaccolti';

export function B2CSkuTable({ data }: B2CSkuTableProps) {
  const [search, setSearch] = useState('');
  const [sortField, setSortField] = useState<SortField>('ordiniRaccolti');
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

  const handleSort = (field: SortField) => {
    if (sortField === field) setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    else { setSortField(field); setSortDir('desc'); }
  };

  const fmt = (v: number) => new Intl.NumberFormat('it-IT', { style: 'currency', currency: 'EUR' }).format(v);

  const SortBtn = ({ field, children }: { field: SortField; children: React.ReactNode }) => (
    <button onClick={() => handleSort(field)} className="flex items-center gap-1 hover:text-foreground transition-colors">
      {children}
      <ArrowUpDown className={`w-3 h-3 ${sortField === field ? 'text-primary' : ''}`} />
    </button>
  );

  return (
    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.5 }} className="chart-container">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div>
          <h3 className="text-lg font-semibold">Dettaglio B2C per SKU</h3>
          <p className="text-sm text-muted-foreground">{filtered.length} SKU trovati</p>
        </div>
        <div className="relative w-full sm:w-64">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input placeholder="Cerca SKU..." value={search} onChange={e => setSearch(e.target.value)} className="pl-10 bg-muted/50 border-border/50" />
        </div>
      </div>

      <div className="overflow-x-auto scrollbar-custom">
        <table className="data-table">
          <thead>
            <tr>
              <th><SortBtn field="sku">SKU</SortBtn></th>
              <th><SortBtn field="name">Prodotto</SortBtn></th>
              <th className="text-right"><SortBtn field="fatturato">Fatturato B2C</SortBtn></th>
              <th className="text-center">Qty Evasi</th>
              <th className="text-right"><SortBtn field="ordiniRaccolti">Ordini Raccolti B2C</SortBtn></th>
              <th className="text-center">Qty Totali</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map(row => (
              <tr key={row.sku}>
                <td className="font-mono text-sm">{row.sku}</td>
                <td>{row.name}</td>
                <td className="text-right font-medium">{fmt(row.fatturato)}</td>
                <td className="text-center text-muted-foreground">{row.qtyEvasi}</td>
                <td className="text-right font-medium">{fmt(row.ordiniRaccolti)}</td>
                <td className="text-center text-muted-foreground">{row.qtyTotali}</td>
              </tr>
            ))}
            {filtered.length === 0 && (
              <tr><td colSpan={6} className="text-center text-muted-foreground py-8">Nessun dato disponibile</td></tr>
            )}
          </tbody>
          {filtered.length > 0 && (
            <tfoot>
              <tr className="border-t-2 border-border font-semibold">
                <td colSpan={2}>Totale</td>
                <td className="text-right">{fmt(filtered.reduce((s, r) => s + r.fatturato, 0))}</td>
                <td className="text-center">{filtered.reduce((s, r) => s + r.qtyEvasi, 0)}</td>
                <td className="text-right">{fmt(filtered.reduce((s, r) => s + r.ordiniRaccolti, 0))}</td>
                <td className="text-center">{filtered.reduce((s, r) => s + r.qtyTotali, 0)}</td>
              </tr>
            </tfoot>
          )}
        </table>
      </div>
    </motion.div>
  );
}
