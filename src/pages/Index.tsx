import { useState, useMemo } from 'react';
import { subDays } from 'date-fns';
import { DashboardHeader } from '@/components/dashboard/DashboardHeader';
import { FilterBar } from '@/components/dashboard/FilterBar';
import { KPICard } from '@/components/dashboard/KPICard';
import { RevenueChart } from '@/components/dashboard/RevenueChart';
import { SalesTrendChart } from '@/components/dashboard/SalesTrendChart';
import { CategoryChart } from '@/components/dashboard/CategoryChart';
import { DataTable } from '@/components/dashboard/DataTable';
import { TopProducts, TopCustomers } from '@/components/dashboard/TopList';
import { ConnectionStatus } from '@/components/dashboard/ConnectionStatus';
import { B2CSkuTable } from '@/components/dashboard/B2CSkuTable';
import { B2BSkuTable } from '@/components/dashboard/B2BSkuTable';
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
  getB2CSkuBreakdown,
  getB2BSkuBreakdown,
} from '@/lib/mock-data';
import { Loader2, AlertCircle } from 'lucide-react';

export default function Index() {
  const [customerTypeFilter, setCustomerTypeFilter] = useState<CustomerType | 'all'>('all');
  const [dateRange, setDateRange] = useState(() => ({
    start: subDays(new Date(), 30),
    end: new Date(),
  }));
  const [shopifyMinDate] = useState(() => new Date('2025-01-01T00:00:00Z'));

  const { data: shopifyOrders = [], isLoading: isLoadingShopify, isError: isErrorShopify, error: errorShopify, refetch: refetchShopify, isFetching: isFetchingShopify } = useShopifyOrders({ limit: 250, status: 'any', createdAtMin: shopifyMinDate, enabled: true });
  const { data: gsOrders = [], isLoading: isLoadingGS, isError: isErrorGS, error: errorGS, refetch: refetchGS, isFetching: isFetchingGS } = useGoogleSheetsOrders(true);

  const allOrders = useMemo(() => [...shopifyOrders, ...gsOrders], [shopifyOrders, gsOrders]);
  const isLoading = isLoadingShopify || isLoadingGS;
  const isFetching = isFetchingShopify || isFetchingGS;

  const filteredOrders = useMemo(() => {
    return allOrders.filter(order => {
      const orderDate = order.date instanceof Date ? order.date : new Date(order.date);
      const inDateRange = orderDate >= dateRange.start && orderDate <= dateRange.end;
      const matchesType = customerTypeFilter === 'all' || order.customerType === customerTypeFilter;
      return inDateRange && matchesType;
    });
  }, [allOrders, dateRange, customerTypeFilter]);

  const kpis = useMemo(() => calculateKPIs(filteredOrders), [filteredOrders]);
  const timeSeriesData = useMemo(() => generateTimeSeriesData(filteredOrders, 30), [filteredOrders]);
  const categoryData = useMemo(() => generateCategoryData(filteredOrders), [filteredOrders]);
  const channelData = useMemo(() => generateChannelData(filteredOrders), [filteredOrders]);
  const topProducts = useMemo(() => getTopProducts(filteredOrders), [filteredOrders]);
  const topCustomers = useMemo(() => getTopCustomers(filteredOrders), [filteredOrders]);
  const b2cSkuData = useMemo(() => getB2CSkuBreakdown(filteredOrders), [filteredOrders]);
  const b2bSkuData = useMemo(() => getB2BSkuBreakdown(filteredOrders), [filteredOrders]);

  // Split KPIs into groups
  const totalKpi = kpis.find(k => k.label === 'Fatturato Totale');
  const ordersKpi = kpis.find(k => k.label === 'Numero Ordini');
  const b2cKpis = kpis.filter(k => k.label.includes('B2C'));
  const b2bKpis = kpis.filter(k => k.label.includes('B2B'));

  const dataSources = [
    { name: 'Shopify', type: 'shopify' as const, status: isLoadingShopify ? 'syncing' as const : isErrorShopify ? 'disconnected' as const : 'connected' as const, recordCount: shopifyOrders.length },
    { name: 'Google Sheets B2B', type: 'google_sheets' as const, status: isLoadingGS ? 'syncing' as const : isErrorGS ? 'disconnected' as const : 'connected' as const, recordCount: gsOrders.length },
  ];

  const handleRefresh = () => { refetchShopify(); refetchGS(); };

  return (
    <div className="min-h-screen bg-background p-4 sm:p-6 lg:p-8">
      <div className="max-w-[1600px] mx-auto">
        <DashboardHeader onRefresh={handleRefresh} isLoading={isFetching} />

        {/* Errors */}
        {isErrorShopify && (
          <div className="mb-4 p-3 rounded-md bg-destructive/10 border border-destructive/20 flex items-center gap-2 text-xs text-destructive">
            <AlertCircle className="w-4 h-4 shrink-0" />
            Shopify: {errorShopify instanceof Error ? errorShopify.message : 'Errore'}
          </div>
        )}
        {isErrorGS && (
          <div className="mb-4 p-3 rounded-md bg-destructive/10 border border-destructive/20 flex items-center gap-2 text-xs text-destructive">
            <AlertCircle className="w-4 h-4 shrink-0" />
            Google Sheets: {errorGS instanceof Error ? errorGS.message : 'Errore'}
          </div>
        )}

        {isLoading && (
          <div className="mb-6 flex items-center justify-center gap-2 p-12">
            <Loader2 className="w-5 h-5 animate-spin text-primary" />
            <p className="text-sm text-muted-foreground">Caricamento dati...</p>
          </div>
        )}

        {/* Filters */}
        <div className="mb-6">
          <FilterBar customerTypeFilter={customerTypeFilter} onCustomerTypeChange={setCustomerTypeFilter} dateRange={dateRange} onDateRangeChange={setDateRange} />
        </div>

        {/* Summary KPIs */}
        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-2 gap-3 mb-6">
          {totalKpi && <KPICard data={totalKpi} />}
          {ordersKpi && <KPICard data={ordersKpi} />}
        </div>

        {/* B2C Section */}
        <div className="mb-8">
          <p className="section-label">B2C</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 mb-4">
            {b2cKpis.map(kpi => <KPICard key={kpi.label} data={kpi} />)}
          </div>
          <B2CSkuTable data={b2cSkuData} />
        </div>

        {/* B2B Section */}
        <div className="mb-8">
          <p className="section-label">B2B</p>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-4">
            {b2bKpis.map(kpi => <KPICard key={kpi.label} data={kpi} />)}
          </div>
          <B2BSkuTable data={b2bSkuData} />
        </div>

        {/* Charts */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-6">
          <div className="lg:col-span-2">
            <RevenueChart data={timeSeriesData} customerTypeFilter={customerTypeFilter} />
          </div>
          <ConnectionStatus sources={dataSources} />
        </div>

        {/* Sales Trend by Channel/Product */}
        <div className="mb-6">
          <SalesTrendChart orders={filteredOrders} dateRange={dateRange} />
        </div>

        {/* Breakdown Charts + Top Lists */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
          <CategoryChart data={categoryData} title="Per Categoria" description="Distribuzione fatturato" />
          <CategoryChart data={channelData} title="Per Canale" description="Performance canali" />
          <TopProducts products={topProducts} />
          <TopCustomers customers={topCustomers} />
        </div>

        {/* Orders Table */}
        <DataTable orders={filteredOrders} title="Ordini Recenti" />
      </div>
    </div>
  );
}
