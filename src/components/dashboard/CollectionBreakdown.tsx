import { useMemo } from 'react';
import { ArrowUpDown, Layers } from 'lucide-react';
import { Order } from '@/types/analytics';
import { getB2CCollectionBreakdown, getB2BCollectionBreakdown, getCombinedCollectionBreakdown } from '@/lib/mock-data';

interface CollectionBreakdownProps {
  orders: Order[];
}

const fmt = (v: number) => new Intl.NumberFormat('it-IT', { style: 'currency', currency: 'EUR' }).format(v);

/* ── B2C Collection Table ── */
function B2CCollectionTable({ orders }: { orders: Order[] }) {
  const data = useMemo(() => getB2CCollectionBreakdown(orders), [orders]);
  return (
    <div className="chart-container">
      <div className="flex items-center gap-2 mb-3">
        <Layers className="w-4 h-4 text-muted-foreground" />
        <h3 className="text-sm font-semibold">Collection B2C</h3>
      </div>
      <div className="overflow-x-auto scrollbar-custom">
        <table className="data-table">
          <thead><tr>
            <th>Collection</th>
            <th className="text-right">Pezzi</th>
            <th className="text-right">Net Sales</th>
          </tr></thead>
          <tbody>
            {data.map(r => (
              <tr key={r.collection}>
                <td className="text-xs font-medium">{r.collection}</td>
                <td className="text-right font-mono text-xs">{r.qtySold}</td>
                <td className="text-right font-mono text-xs">{fmt(r.netSales)}</td>
              </tr>
            ))}
            {!data.length && <tr><td colSpan={3} className="text-center text-muted-foreground py-6 text-xs">Nessun dato</td></tr>}
          </tbody>
          {data.length > 0 && (
            <tfoot><tr className="border-t-2 border-border font-semibold text-xs">
              <td>Totale</td>
              <td className="text-right font-mono">{data.reduce((s, r) => s + r.qtySold, 0)}</td>
              <td className="text-right font-mono">{fmt(data.reduce((s, r) => s + r.netSales, 0))}</td>
            </tr></tfoot>
          )}
        </table>
      </div>
    </div>
  );
}

/* ── B2B Collection Table ── */
function B2BCollectionTable({ orders }: { orders: Order[] }) {
  const data = useMemo(() => getB2BCollectionBreakdown(orders), [orders]);
  return (
    <div className="chart-container">
      <div className="flex items-center gap-2 mb-3">
        <Layers className="w-4 h-4 text-muted-foreground" />
        <h3 className="text-sm font-semibold">Collection B2B</h3>
      </div>
      <div className="overflow-x-auto scrollbar-custom">
        <table className="data-table">
          <thead><tr>
            <th>Collection</th>
            <th className="text-right">Pezzi</th>
            <th className="text-right">Price Somma</th>
          </tr></thead>
          <tbody>
            {data.map(r => (
              <tr key={r.collection}>
                <td className="text-xs font-medium">{r.collection}</td>
                <td className="text-right font-mono text-xs">{r.qtySold}</td>
                <td className="text-right font-mono text-xs">{fmt(r.priceSomma)}</td>
              </tr>
            ))}
            {!data.length && <tr><td colSpan={3} className="text-center text-muted-foreground py-6 text-xs">Nessun dato</td></tr>}
          </tbody>
          {data.length > 0 && (
            <tfoot><tr className="border-t-2 border-border font-semibold text-xs">
              <td>Totale</td>
              <td className="text-right font-mono">{data.reduce((s, r) => s + r.qtySold, 0)}</td>
              <td className="text-right font-mono">{fmt(data.reduce((s, r) => s + r.priceSomma, 0))}</td>
            </tr></tfoot>
          )}
        </table>
      </div>
    </div>
  );
}

/* ── Combined Collection Table ── */
function CombinedCollectionTable({ orders }: { orders: Order[] }) {
  const data = useMemo(() => getCombinedCollectionBreakdown(orders), [orders]);
  return (
    <div className="chart-container">
      <div className="flex items-center gap-2 mb-3">
        <Layers className="w-4 h-4 text-muted-foreground" />
        <h3 className="text-sm font-semibold">Collection B2C + B2B</h3>
      </div>
      <div className="overflow-x-auto scrollbar-custom">
        <table className="data-table">
          <thead><tr>
            <th>Collection</th>
            <th className="text-right">Pezzi</th>
            <th className="text-right">B2C</th>
            <th className="text-right">B2B</th>
            <th className="text-right">Totale</th>
          </tr></thead>
          <tbody>
            {data.map(r => (
              <tr key={r.collection}>
                <td className="text-xs font-medium">{r.collection}</td>
                <td className="text-right font-mono text-xs">{r.qtySold}</td>
                <td className="text-right font-mono text-xs">{fmt(r.b2cSales)}</td>
                <td className="text-right font-mono text-xs">{fmt(r.b2bSales)}</td>
                <td className="text-right font-mono text-xs font-semibold">{fmt(r.totalSales)}</td>
              </tr>
            ))}
            {!data.length && <tr><td colSpan={5} className="text-center text-muted-foreground py-6 text-xs">Nessun dato</td></tr>}
          </tbody>
          {data.length > 0 && (
            <tfoot><tr className="border-t-2 border-border font-semibold text-xs">
              <td>Totale</td>
              <td className="text-right font-mono">{data.reduce((s, r) => s + r.qtySold, 0)}</td>
              <td className="text-right font-mono">{fmt(data.reduce((s, r) => s + r.b2cSales, 0))}</td>
              <td className="text-right font-mono">{fmt(data.reduce((s, r) => s + r.b2bSales, 0))}</td>
              <td className="text-right font-mono">{fmt(data.reduce((s, r) => s + r.totalSales, 0))}</td>
            </tr></tfoot>
          )}
        </table>
      </div>
    </div>
  );
}

/* ── Main Component ── */
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
