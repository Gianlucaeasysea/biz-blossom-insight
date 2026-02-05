import { motion } from 'framer-motion';
import { TrendingUp, Package, Users } from 'lucide-react';
import { Product, Customer } from '@/types/analytics';

interface TopProductsProps {
  products: Product[];
}

interface TopCustomersProps {
  customers: Customer[];
}

export function TopProducts({ products }: TopProductsProps) {
  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('it-IT', {
      style: 'currency',
      currency: 'EUR',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(value);
  };

  const maxRevenue = Math.max(...products.map((p) => p.revenue));

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.5 }}
      className="chart-container"
    >
      <div className="flex items-center gap-3 mb-6">
        <div className="p-2 rounded-lg bg-primary/10">
          <Package className="w-5 h-5 text-primary" />
        </div>
        <div>
          <h3 className="text-lg font-semibold">Top Prodotti</h3>
          <p className="text-sm text-muted-foreground">Per fatturato</p>
        </div>
      </div>

      <div className="space-y-4">
        {products.map((product, index) => (
          <div key={product.id} className="group">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-3">
                <span className="text-sm font-medium text-muted-foreground w-5">
                  {index + 1}
                </span>
                <div>
                  <p className="font-medium truncate max-w-[180px]">{product.name}</p>
                  <p className="text-xs text-muted-foreground">{product.totalSold} venduti</p>
                </div>
              </div>
              <span className="font-semibold">{formatCurrency(product.revenue)}</span>
            </div>
            <div className="ml-8 h-1.5 bg-muted/50 rounded-full overflow-hidden">
              <motion.div
                initial={{ width: 0 }}
                animate={{ width: `${(product.revenue / maxRevenue) * 100}%` }}
                transition={{ delay: 0.6 + index * 0.1, duration: 0.5 }}
                className="h-full rounded-full bg-gradient-to-r from-primary to-accent"
              />
            </div>
          </div>
        ))}
      </div>
    </motion.div>
  );
}

export function TopCustomers({ customers }: TopCustomersProps) {
  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('it-IT', {
      style: 'currency',
      currency: 'EUR',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(value);
  };

  const maxSpent = Math.max(...customers.map((c) => c.totalSpent));

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.5 }}
      className="chart-container"
    >
      <div className="flex items-center gap-3 mb-6">
        <div className="p-2 rounded-lg bg-accent/10">
          <Users className="w-5 h-5 text-accent" />
        </div>
        <div>
          <h3 className="text-lg font-semibold">Top Clienti</h3>
          <p className="text-sm text-muted-foreground">Per valore totale</p>
        </div>
      </div>

      <div className="space-y-4">
        {customers.map((customer, index) => (
          <div key={customer.id} className="group">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-3">
                <span className="text-sm font-medium text-muted-foreground w-5">
                  {index + 1}
                </span>
                <div>
                  <div className="flex items-center gap-2">
                    <p className="font-medium truncate max-w-[140px]">{customer.name}</p>
                    <span
                      className={`inline-flex px-1.5 py-0.5 rounded text-[10px] font-medium ${
                        customer.type === 'B2B'
                          ? 'bg-accent/20 text-accent'
                          : 'bg-primary/20 text-primary'
                      }`}
                    >
                      {customer.type}
                    </span>
                  </div>
                  <p className="text-xs text-muted-foreground">{customer.totalOrders} ordini</p>
                </div>
              </div>
              <span className="font-semibold">{formatCurrency(customer.totalSpent)}</span>
            </div>
            <div className="ml-8 h-1.5 bg-muted/50 rounded-full overflow-hidden">
              <motion.div
                initial={{ width: 0 }}
                animate={{ width: `${(customer.totalSpent / maxSpent) * 100}%` }}
                transition={{ delay: 0.6 + index * 0.1, duration: 0.5 }}
                className="h-full rounded-full bg-gradient-to-r from-accent to-primary"
              />
            </div>
          </div>
        ))}
      </div>
    </motion.div>
  );
}
