import { useState, useMemo } from 'react';
import { motion } from 'framer-motion';
import { Package, Search, ArrowUpDown, ChevronLeft, ChevronRight, Loader2, AlertCircle, RefreshCw } from 'lucide-react';
import { DraggableNav } from '@/components/DraggableNav';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { useShopifyProducts, ShopifyProductRow } from '@/hooks/useShopifyProducts';

type SortField = 'sku' | 'product' | 'quantity' | 'price';
type SortDir = 'asc' | 'desc';

export default function Stock() {
  const { data: products = [], isLoading, isError, error, refetch, isFetching } = useShopifyProducts();
  const [search, setSearch] = useState('');
  const [sortField, setSortField] = useState<SortField>('product');
  const [sortDir, setSortDir] = useState<SortDir>('asc');
  const [page, setPage] = useState(1);
  const perPage = 25;

  const filtered = useMemo(() => {
    let rows = [...products];
    if (search) {
      const q = search.toLowerCase();
      rows = rows.filter(r =>
        r.sku.toLowerCase().includes(q) ||
        r.productTitle.toLowerCase().includes(q) ||
        (r.variantTitle || '').toLowerCase().includes(q)
      );
    }
    rows.sort((a, b) => {
      let cmp = 0;
      switch (sortField) {
        case 'sku': cmp = a.sku.localeCompare(b.sku); break;
        case 'product': cmp = a.productTitle.localeCompare(b.productTitle); break;
        case 'quantity': cmp = a.inventoryQuantity - b.inventoryQuantity; break;
        case 'price': cmp = a.price - b.price; break;
      }
      return sortDir === 'asc' ? cmp : -cmp;
    });
    return rows;
  }, [products, search, sortField, sortDir]);

  const totalPages = Math.ceil(filtered.length / perPage);
  const paginated = filtered.slice((page - 1) * perPage, page * perPage);

  const totalUnits = useMemo(() => products.reduce((s, r) => s + r.inventoryQuantity, 0), [products]);
  const outOfStock = useMemo(() => products.filter(r => r.inventoryQuantity <= 0).length, [products]);
  const lowStock = useMemo(() => products.filter(r => r.inventoryQuantity > 0 && r.inventoryQuantity <= 5).length, [products]);

  const handleSort = (field: SortField) => {
    if (sortField === field) setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    else { setSortField(field); setSortDir(field === 'quantity' ? 'desc' : 'asc'); }
    setPage(1);
  };

  const SortBtn = ({ field, children }: { field: SortField; children: React.ReactNode }) => (
    <button onClick={() => handleSort(field)} className="flex items-center gap-1 hover:text-foreground transition-colors">
      {children}
      <ArrowUpDown className={`w-3 h-3 ${sortField === field ? 'text-primary' : ''}`} />
    </button>
  );

  const navClass = "px-3.5 py-1.5 rounded-lg text-xs font-semibold bg-muted text-muted-foreground hover:text-foreground transition-colors";

  const qtyColor = (qty: number) => {
    if (qty <= 0) return 'text-destructive font-semibold';
    if (qty <= 5) return 'text-amber-500 font-medium';
    return 'text-foreground';
  };

  return (
    <div className="min-h-screen bg-background p-4 sm:p-6">
      <div className="max-w-[1520px] mx-auto space-y-5">

        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
              <Package className="w-5 h-5 text-primary" />
            </div>
            <div>
              <h1 className="text-xl font-bold tracking-tight">Stock Prodotti</h1>
              <p className="text-xs text-muted-foreground">Inventario Shopify in tempo reale</p>
            </div>
          </div>
          <Button variant="outline" size="sm" onClick={() => refetch()} disabled={isFetching} className="gap-1.5">
            <RefreshCw className={`w-3.5 h-3.5 ${isFetching ? 'animate-spin' : ''}`} />
            Aggiorna
          </Button>
        </div>

        {/* Nav */}
        <DraggableNav />

        {/* Loading / Error */}
        {isLoading && (
          <div className="flex items-center justify-center py-20 gap-3 text-muted-foreground">
            <Loader2 className="w-5 h-5 animate-spin" /> Caricamento inventario…
          </div>
        )}
        {isError && (
          <div className="p-3 rounded-lg bg-destructive/10 border border-destructive/20 flex items-center gap-2 text-xs text-destructive">
            <AlertCircle className="w-4 h-4 shrink-0" />
            {error instanceof Error ? error.message : 'Errore'}
          </div>
        )}

        {!isLoading && !isError && (
          <>
            {/* KPIs */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {[
                { label: 'Varianti Totali', value: products.length.toLocaleString('it-IT') },
                { label: 'Unità Totali', value: totalUnits.toLocaleString('it-IT') },
                { label: 'Esaurito', value: outOfStock.toLocaleString('it-IT'), color: outOfStock > 0 ? 'text-destructive' : undefined },
                { label: 'Stock Basso (≤5)', value: lowStock.toLocaleString('it-IT'), color: lowStock > 0 ? 'text-amber-500' : undefined },
              ].map(kpi => (
                <motion.div key={kpi.label} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="rounded-xl border border-border/50 bg-card p-4">
                  <p className="text-[11px] text-muted-foreground uppercase tracking-wider mb-1">{kpi.label}</p>
                  <p className={`text-2xl font-bold tabular-nums ${kpi.color || ''}`}>{kpi.value}</p>
                </motion.div>
              ))}
            </div>

            {/* Search */}
            <div className="relative max-w-sm">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="Cerca SKU, prodotto…"
                value={search}
                onChange={e => { setSearch(e.target.value); setPage(1); }}
                className="pl-10 bg-muted/50 border-border/50"
              />
            </div>

            {/* Table */}
            <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }} className="chart-container">
              <div className="overflow-x-auto scrollbar-custom">
                <table className="data-table w-full">
                  <thead>
                    <tr>
                      <th className="w-[140px]"><SortBtn field="sku">SKU</SortBtn></th>
                      <th><SortBtn field="product">Prodotto</SortBtn></th>
                      <th>Variante</th>
                      <th className="text-right w-[100px]"><SortBtn field="quantity">Quantità</SortBtn></th>
                      <th className="text-right w-[100px]"><SortBtn field="price">Prezzo</SortBtn></th>
                    </tr>
                  </thead>
                  <tbody>
                    {paginated.map(row => (
                      <tr key={`${row.productId}-${row.variantId}`}>
                        <td className="font-mono text-xs">{row.sku || '—'}</td>
                        <td className="font-medium text-sm">{row.productTitle}</td>
                        <td className="text-sm text-muted-foreground">{row.variantTitle || '—'}</td>
                        <td className={`text-right tabular-nums ${qtyColor(row.inventoryQuantity)}`}>{row.inventoryQuantity}</td>
                        <td className="text-right tabular-nums text-sm">€{row.price.toLocaleString('it-IT', { minimumFractionDigits: 2 })}</td>
                      </tr>
                    ))}
                    {paginated.length === 0 && (
                      <tr><td colSpan={5} className="text-center text-muted-foreground py-8">Nessun prodotto trovato</td></tr>
                    )}
                  </tbody>
                </table>
              </div>

              {totalPages > 1 && (
                <div className="flex items-center justify-between mt-4 pt-4 border-t border-border/50">
                  <span className="text-sm text-muted-foreground">
                    {filtered.length} risultati — Pagina {page} di {totalPages}
                  </span>
                  <div className="flex items-center gap-2">
                    <Button variant="outline" size="sm" onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1} className="bg-muted/50">
                      <ChevronLeft className="w-4 h-4" />
                    </Button>
                    <Button variant="outline" size="sm" onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages} className="bg-muted/50">
                      <ChevronRight className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              )}
            </motion.div>
          </>
        )}
      </div>
    </div>
  );
}
