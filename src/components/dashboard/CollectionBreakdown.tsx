import { useMemo, useState } from 'react';
import { Layers, Download, ChevronDown, ChevronRight } from 'lucide-react';
import { Order } from '@/types/analytics';
import { getB2CCollectionBreakdown, getB2BCollectionBreakdown, getCombinedCollectionBreakdown, SkuDetail } from '@/lib/mock-data';
import { downloadCsv } from '@/lib/csv-export';

interface CollectionBreakdownProps {
  orders: Order[];
}

const fmt = (v: number) => new Intl.NumberFormat('it-IT', { style: 'currency', currency: 'EUR' }).format(v);

function SkuDetailRows({ skus, salesLabel }: { skus: SkuDetail[]; salesLabel: string }) {
  return (
    <tr>
      <td colSpan={3} className="p-0">
        <div className="bg-muted/30 border-t border-border/40">
          <table className="w-full">
            <thead>
              <tr className="text-[10px] text-muted-foreground/70 uppercase tracking-wider">
                <th className="pl-10 pr-2 py-1.5 text-left font-medium">SKU</th>
                <th className="px-2 py-1.5 text-left font-medium">Prodotto</th>
                <th className="px-2 py-1.5 text-right font-medium">Qty</th>
                <th className="px-2 py-1.5 text-right font-medium pr-4">{salesLabel}</th>
              </tr>
            </thead>
            <tbody>
              {skus.map(s => (
                <tr key={s.sku} className="border-t border-border/20 hover:bg-muted/40 transition-colors">
                  <td className="pl-10 pr-2 py-1 text-[11px] font-mono text-muted-foreground">{s.sku || '—'}</td>
                  <td className="px-2 py-1 text-[11px] truncate max-w-[160px]">{s.name}</td>
                  <td className="px-2 py-1 text-right text-[11px] font-mono">{s.qty}</td>
                  <td className="px-2 py-1 text-right text-[11px] font-mono pr-4">{fmt(s.sales)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </td>
    </tr>
  );
}

function B2CCollectionTable({ orders }: { orders: Order[] }) {
  const data = useMemo(() => getB2CCollectionBreakdown(orders), [orders]);
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const toggle = (c: string) => setExpanded(prev => ({ ...prev, [c]: !prev[c] }));

  const handleExport = () => {
    downloadCsv('collection-b2c', ['Collection', 'Units', 'Net Sales'],
      data.map(r => [r.collection, r.qtySold, r.netSales]));
  };
  return (
    <div className="chart-container">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <Layers className="w-4 h-4 text-muted-foreground" />
          <h3 className="text-sm font-semibold">Collection B2C</h3>
        </div>
        <button onClick={handleExport} className="p-2 rounded-md hover:bg-muted/50 text-muted-foreground hover:text-foreground transition-colors" title="Export CSV">
          <Download className="w-4 h-4" />
        </button>
      </div>
      <div className="overflow-x-auto scrollbar-custom">
        <table className="data-table">
          <thead><tr><th>Collection</th><th className="text-right">Units</th><th className="text-right">Net Sales</th></tr></thead>
          <tbody>
            {data.map(r => (
              <>
                <tr key={r.collection} className="cursor-pointer hover:bg-muted/40 transition-colors" onClick={() => toggle(r.collection)}>
                  <td className="text-xs font-medium">
                    <span className="inline-flex items-center gap-1">
                      {expanded[r.collection] ? <ChevronDown className="w-3 h-3 text-muted-foreground" /> : <ChevronRight className="w-3 h-3 text-muted-foreground" />}
                      {r.collection}
                    </span>
                  </td>
                  <td className="text-right font-mono text-xs">{r.qtySold}</td>
                  <td className="text-right font-mono text-xs">{fmt(r.netSales)}</td>
                </tr>
                {expanded[r.collection] && <SkuDetailRows key={`${r.collection}-detail`} skus={r.skus} salesLabel="Net Sales" />}
              </>
            ))}
            {!data.length && <tr><td colSpan={3} className="text-center text-muted-foreground py-6 text-xs">No data</td></tr>}
          </tbody>
          {data.length > 0 && (<tfoot><tr className="border-t-2 border-border font-semibold text-xs"><td>Total</td><td className="text-right font-mono">{data.reduce((s, r) => s + r.qtySold, 0)}</td><td className="text-right font-mono">{fmt(data.reduce((s, r) => s + r.netSales, 0))}</td></tr></tfoot>)}
        </table>
      </div>
    </div>
  );
}

function B2BCollectionTable({ orders }: { orders: Order[] }) {
  const data = useMemo(() => getB2BCollectionBreakdown(orders), [orders]);
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const toggle = (c: string) => setExpanded(prev => ({ ...prev, [c]: !prev[c] }));

  const handleExport = () => {
    downloadCsv('collection-b2b', ['Collection', 'Units', 'Total Price'],
      data.map(r => [r.collection, r.qtySold, r.priceSomma]));
  };
  return (
    <div className="chart-container">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <Layers className="w-4 h-4 text-muted-foreground" />
          <h3 className="text-sm font-semibold">Collection B2B</h3>
        </div>
        <button onClick={handleExport} className="p-2 rounded-md hover:bg-muted/50 text-muted-foreground hover:text-foreground transition-colors" title="Export CSV">
          <Download className="w-4 h-4" />
        </button>
      </div>
      <div className="overflow-x-auto scrollbar-custom">
        <table className="data-table">
          <thead><tr><th>Collection</th><th className="text-right">Units</th><th className="text-right">Total Price</th></tr></thead>
          <tbody>
            {data.map(r => (
              <>
                <tr key={r.collection} className="cursor-pointer hover:bg-muted/40 transition-colors" onClick={() => toggle(r.collection)}>
                  <td className="text-xs font-medium">
                    <span className="inline-flex items-center gap-1">
                      {expanded[r.collection] ? <ChevronDown className="w-3 h-3 text-muted-foreground" /> : <ChevronRight className="w-3 h-3 text-muted-foreground" />}
                      {r.collection}
                    </span>
                  </td>
                  <td className="text-right font-mono text-xs">{r.qtySold}</td>
                  <td className="text-right font-mono text-xs">{fmt(r.priceSomma)}</td>
                </tr>
                {expanded[r.collection] && <SkuDetailRows key={`${r.collection}-detail`} skus={r.skus} salesLabel="Price" />}
              </>
            ))}
            {!data.length && <tr><td colSpan={3} className="text-center text-muted-foreground py-6 text-xs">No data</td></tr>}
          </tbody>
          {data.length > 0 && (<tfoot><tr className="border-t-2 border-border font-semibold text-xs"><td>Total</td><td className="text-right font-mono">{data.reduce((s, r) => s + r.qtySold, 0)}</td><td className="text-right font-mono">{fmt(data.reduce((s, r) => s + r.priceSomma, 0))}</td></tr></tfoot>)}
        </table>
      </div>
    </div>
  );
}

function CombinedCollectionTable({ orders }: { orders: Order[] }) {
  const data = useMemo(() => getCombinedCollectionBreakdown(orders), [orders]);
  const handleExport = () => {
    downloadCsv('collection-combined', ['Collection', 'Units', 'B2C', 'B2B', 'Total'],
      data.map(r => [r.collection, r.qtySold, r.b2cSales, r.b2bSales, r.totalSales]));
  };
  return (
    <div className="chart-container">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <Layers className="w-4 h-4 text-muted-foreground" />
          <h3 className="text-sm font-semibold">Collection B2C + B2B</h3>
        </div>
        <button onClick={handleExport} className="p-2 rounded-md hover:bg-muted/50 text-muted-foreground hover:text-foreground transition-colors" title="Export CSV">
          <Download className="w-4 h-4" />
        </button>
      </div>
      <div className="overflow-x-auto scrollbar-custom">
        <table className="data-table">
          <thead><tr><th>Collection</th><th className="text-right">Units</th><th className="text-right">B2C</th><th className="text-right">B2B</th><th className="text-right">Total</th></tr></thead>
          <tbody>
            {data.map(r => (<tr key={r.collection}><td className="text-xs font-medium">{r.collection}</td><td className="text-right font-mono text-xs">{r.qtySold}</td><td className="text-right font-mono text-xs">{fmt(r.b2cSales)}</td><td className="text-right font-mono text-xs">{fmt(r.b2bSales)}</td><td className="text-right font-mono text-xs font-semibold">{fmt(r.totalSales)}</td></tr>))}
            {!data.length && <tr><td colSpan={5} className="text-center text-muted-foreground py-6 text-xs">No data</td></tr>}
          </tbody>
          {data.length > 0 && (<tfoot><tr className="border-t-2 border-border font-semibold text-xs"><td>Total</td><td className="text-right font-mono">{data.reduce((s, r) => s + r.qtySold, 0)}</td><td className="text-right font-mono">{fmt(data.reduce((s, r) => s + r.b2cSales, 0))}</td><td className="text-right font-mono">{fmt(data.reduce((s, r) => s + r.b2bSales, 0))}</td><td className="text-right font-mono">{fmt(data.reduce((s, r) => s + r.totalSales, 0))}</td></tr></tfoot>)}
        </table>
      </div>
    </div>
  );
}

export function CollectionBreakdown({ orders }: CollectionBreakdownProps) {
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <B2CCollectionTable orders={orders} />
        <B2BCollectionTable orders={orders} />
      </div>
      <CombinedCollectionTable orders={orders} />
    </div>
  );
}
