import { useState, useMemo } from 'react';
import { subDays } from 'date-fns';
import { DashboardHeader } from '@/components/dashboard/DashboardHeader';
import { FilterBar } from '@/components/dashboard/FilterBar';
import { KPICard } from '@/components/dashboard/KPICard';
import { RevenueChart } from '@/components/dashboard/RevenueChart';
import { CategoryChart } from '@/components/dashboard/CategoryChart';
import { DataTable } from '@/components/dashboard/DataTable';
import { TopProducts, TopCustomers } from '@/components/dashboard/TopList';
import { ConnectionStatus } from '@/components/dashboard/ConnectionStatus';
import { CustomerType } from '@/types/analytics';
import { useShopifyOrders } from '@/hooks/useShopifyOrders';
import { useGoogleSheetsOrders } from '@/hooks/useGoogleSheetsOrders';
import {
  generateTimeSeriesData,
  generateCategoryData,
  generateChannelData,
  calculateKPIs,
  getTopProducts,
  getTopCustomers,
} from '@/lib/mock-data';
import { Loader2, AlertCircle } from 'lucide-react';

export default function Index() {
  const [customerTypeFilter, setCustomerTypeFilter] = useState<CustomerType | 'all'>('all');
  const [dateRange, setDateRange] = useState({
    start: subDays(new Date(), 30),
    end: new Date(),
  });

  // Fetch real Shopify orders
  const { data: shopifyOrders = [], isLoading: isLoadingShopify, isError: isErrorShopify, error: errorShopify, refetch: refetchShopify, isFetching: isFetchingShopify } = useShopifyOrders({
    limit: 250,
    status: 'any',
    createdAtMin: subDays(new Date(), 365),
    enabled: true,
  });

  // Fetch Google Sheets B2B orders
  const { data: gsOrders = [], isLoading: isLoadingGS, isError: isErrorGS, error: errorGS, refetch: refetchGS, isFetching: isFetchingGS } = useGoogleSheetsOrders(true);

  // Merge all orders
  const allOrders = useMemo(() => [...shopifyOrders, ...gsOrders], [shopifyOrders, gsOrders]);
  const isLoading = isLoadingShopify || isLoadingGS;
  const isFetching = isFetchingShopify || isFetchingGS;

  // Filter orders based on current filters
  const filteredOrders = useMemo(() => {
    return allOrders.filter((order) => {
      const orderDate = order.date instanceof Date ? order.date : new Date(order.date);
      const inDateRange = orderDate >= dateRange.start && orderDate <= dateRange.end;
      const matchesType = customerTypeFilter === 'all' || order.customerType === customerTypeFilter;
      return inDateRange && matchesType;
    });
  }, [allOrders, dateRange, customerTypeFilter]);

  // Calculate derived data
  const kpis = useMemo(() => calculateKPIs(filteredOrders), [filteredOrders]);
  const timeSeriesData = useMemo(() => generateTimeSeriesData(filteredOrders, 30), [filteredOrders]);
  const categoryData = useMemo(() => generateCategoryData(filteredOrders), [filteredOrders]);
  const channelData = useMemo(() => generateChannelData(filteredOrders), [filteredOrders]);
  const topProducts = useMemo(() => getTopProducts(filteredOrders), [filteredOrders]);
  const topCustomers = useMemo(() => getTopCustomers(filteredOrders), [filteredOrders]);

  // Data sources status
  const dataSources = [
    {
      name: 'Shopify Store',
      type: 'shopify' as const,
      status: isLoading ? 'syncing' as const : isError ? 'disconnected' as const : 'connected' as const,
      recordCount: shopifyOrders.length,
    },
    {
      name: 'Google Sheets B2B',
      type: 'google_sheets' as const,
      status: 'disconnected' as const,
      recordCount: 0,
    },
  ];

  const handleRefresh = () => {
    refetch();
  };

  return (
    <div className="min-h-screen bg-background p-4 sm:p-6 lg:p-8">
      <div className="max-w-[1600px] mx-auto">
        <DashboardHeader onRefresh={handleRefresh} isLoading={isFetching} />

        {/* Error Banner */}
        {isError && (
          <div className="mb-6 p-4 rounded-lg bg-destructive/10 border border-destructive/20 flex items-center gap-3">
            <AlertCircle className="w-5 h-5 text-destructive shrink-0" />
            <p className="text-sm text-destructive">
              Errore nel caricamento dati Shopify: {error instanceof Error ? error.message : 'Errore sconosciuto'}
            </p>
          </div>
        )}

        {/* Loading State */}
        {isLoading && (
          <div className="mb-6 flex items-center justify-center gap-3 p-12">
            <Loader2 className="w-6 h-6 animate-spin text-primary" />
            <p className="text-muted-foreground">Caricamento dati da Shopify...</p>
          </div>
        )}

        {/* Filter Bar */}
        <div className="mb-6">
          <FilterBar
            customerTypeFilter={customerTypeFilter}
            onCustomerTypeChange={setCustomerTypeFilter}
            dateRange={dateRange}
            onDateRangeChange={setDateRange}
          />
        </div>

        {/* KPI Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4 mb-6">
          {kpis.map((kpi, index) => (
            <KPICard key={kpi.label} data={kpi} index={index} />
          ))}
        </div>

        {/* Main Charts Row */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
          <div className="lg:col-span-2">
            <RevenueChart data={timeSeriesData} customerTypeFilter={customerTypeFilter} />
          </div>
          <div>
            <ConnectionStatus sources={dataSources} />
          </div>
        </div>

        {/* Secondary Charts Row */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-6">
          <CategoryChart
            data={categoryData}
            title="Vendite per Categoria"
            description="Distribuzione fatturato"
          />
          <CategoryChart
            data={channelData}
            title="Vendite per Canale"
            description="Performance canali"
          />
          <TopProducts products={topProducts} />
          <TopCustomers customers={topCustomers} />
        </div>

        {/* Data Table */}
        <DataTable orders={filteredOrders} title="Ordini Recenti" />
      </div>
    </div>
  );
}
