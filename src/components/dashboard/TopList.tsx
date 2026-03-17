import { Package, Users } from 'lucide-react';
import { Product, Customer } from '@/types/analytics';

const fmt = (v: number) => new Intl.NumberFormat('it-IT', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(v);

export function TopProducts({ products }: { products: Product[] }) {
  const max = Math.max(...products.map(p => p.revenue), 1);
  return (
    <div className="chart-container">
      <div className="flex items-center gap-2 mb-4">
        <Package className="w-4 h-4 text-primary" />
        <h3 className="text-sm font-semibold">Top Prodotti</h3>
      </div>
      <div className="space-y-3">
        {products.map((p, i) => (
          <div key={p.id}>
            <div className="flex items-center justify-between text-xs mb-1">
              <div className="flex items-center gap-2">
                <span className="text-muted-foreground w-4">{i + 1}</span>
                <span className="truncate max-w-[140px]">{p.name}</span>
              </div>
              <span className="font-mono">{fmt(p.revenue)}</span>
            </div>
            <div className="ml-6 h-1 bg-muted rounded-full overflow-hidden">
              <div className="h-full bg-primary/60 rounded-full" style={{ width: `${(p.revenue / max) * 100}%` }} />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export function TopCustomers({ customers }: { customers: Customer[] }) {
  const max = Math.max(...customers.map(c => c.totalSpent), 1);
  return (
    <div className="chart-container">
      <div className="flex items-center gap-2 mb-4">
        <Users className="w-4 h-4 text-accent" />
        <h3 className="text-sm font-semibold">Top Clienti</h3>
      </div>
      <div className="space-y-3">
        {customers.map((c, i) => (
          <div key={c.id}>
            <div className="flex items-center justify-between text-xs mb-1">
              <div className="flex items-center gap-2">
                <span className="text-muted-foreground w-4">{i + 1}</span>
                <span className="truncate max-w-[110px]">{c.name}</span>
                <span className={`text-[10px] px-1 py-0.5 rounded font-medium ${c.type === 'B2B' ? 'bg-accent/15 text-accent' : 'bg-primary/15 text-primary'}`}>
                  {c.type}
                </span>
              </div>
              <span className="font-mono">{fmt(c.totalSpent)}</span>
            </div>
            <div className="ml-6 h-1 bg-muted rounded-full overflow-hidden">
              <div className="h-full bg-accent/60 rounded-full" style={{ width: `${(c.totalSpent / max) * 100}%` }} />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
