import { useState, useMemo } from 'react';
import { motion } from 'framer-motion';
import { Search, ArrowUpDown, ChevronLeft, ChevronRight } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Order } from '@/types/analytics';
import { format } from 'date-fns';
import { it } from 'date-fns/locale';

interface DataTableProps {
  orders: Order[];
  title: string;
}

type SortField = 'date' | 'orderNumber' | 'customerName' | 'totalAmount' | 'customerType';
type SortDirection = 'asc' | 'desc';

export function DataTable({ orders, title }: DataTableProps) {
  const [search, setSearch] = useState('');
  const [sortField, setSortField] = useState<SortField>('date');
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc');
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;

  const filteredAndSortedOrders = useMemo(() => {
    let result = [...orders];

    // Filter
    if (search) {
      const searchLower = search.toLowerCase();
      result = result.filter(
        (order) =>
          order.orderNumber.toLowerCase().includes(searchLower) ||
          order.customerName.toLowerCase().includes(searchLower) ||
          order.products.some((p) => p.name.toLowerCase().includes(searchLower))
      );
    }

    // Sort
    result.sort((a, b) => {
      let comparison = 0;
      switch (sortField) {
        case 'date':
          comparison = a.date.getTime() - b.date.getTime();
          break;
        case 'orderNumber':
          comparison = a.orderNumber.localeCompare(b.orderNumber);
          break;
        case 'customerName':
          comparison = a.customerName.localeCompare(b.customerName);
          break;
        case 'totalAmount':
          comparison = a.totalAmount - b.totalAmount;
          break;
        case 'customerType':
          comparison = a.customerType.localeCompare(b.customerType);
          break;
      }
      return sortDirection === 'asc' ? comparison : -comparison;
    });

    return result;
  }, [orders, search, sortField, sortDirection]);

  const totalPages = Math.ceil(filteredAndSortedOrders.length / itemsPerPage);
  const paginatedOrders = filteredAndSortedOrders.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  );

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('desc');
    }
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('it-IT', {
      style: 'currency',
      currency: 'EUR',
    }).format(value);
  };

  const SortButton = ({ field, children }: { field: SortField; children: React.ReactNode }) => (
    <button
      onClick={() => handleSort(field)}
      className="flex items-center gap-1 hover:text-foreground transition-colors"
    >
      {children}
      <ArrowUpDown className={`w-3 h-3 ${sortField === field ? 'text-primary' : ''}`} />
    </button>
  );

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.4 }}
      className="chart-container"
    >
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div>
          <h3 className="text-lg font-semibold">{title}</h3>
          <p className="text-sm text-muted-foreground">
            {filteredAndSortedOrders.length} ordini trovati
          </p>
        </div>
        <div className="relative w-full sm:w-64">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Cerca ordini..."
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setCurrentPage(1);
            }}
            className="pl-10 bg-muted/50 border-border/50"
          />
        </div>
      </div>

      <div className="overflow-x-auto scrollbar-custom">
        <table className="data-table">
          <thead>
            <tr>
              <th><SortButton field="orderNumber">Ordine</SortButton></th>
              <th><SortButton field="date">Data</SortButton></th>
              <th><SortButton field="customerName">Cliente</SortButton></th>
              <th><SortButton field="customerType">Tipo</SortButton></th>
              <th>Canale</th>
              <th className="text-right"><SortButton field="totalAmount">Importo</SortButton></th>
            </tr>
          </thead>
          <tbody>
            {paginatedOrders.map((order) => (
              <tr key={order.id} className="group">
                <td className="font-mono text-sm">{order.orderNumber}</td>
                <td className="text-muted-foreground">
                  {format(order.date, 'dd MMM yyyy', { locale: it })}
                </td>
                <td>{order.customerName}</td>
                <td>
                  <span
                    className={`inline-flex px-2 py-1 rounded-md text-xs font-medium ${
                      order.customerType === 'B2B'
                        ? 'bg-accent/20 text-accent'
                        : 'bg-primary/20 text-primary'
                    }`}
                  >
                    {order.customerType}
                  </span>
                </td>
                <td className="text-muted-foreground">{order.channel}</td>
                <td className="text-right font-medium">{formatCurrency(order.totalAmount)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between mt-4 pt-4 border-t border-border/50">
          <span className="text-sm text-muted-foreground">
            Pagina {currentPage} di {totalPages}
          </span>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
              disabled={currentPage === 1}
              className="bg-muted/50"
            >
              <ChevronLeft className="w-4 h-4" />
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
              disabled={currentPage === totalPages}
              className="bg-muted/50"
            >
              <ChevronRight className="w-4 h-4" />
            </Button>
          </div>
        </div>
      )}
    </motion.div>
  );
}
