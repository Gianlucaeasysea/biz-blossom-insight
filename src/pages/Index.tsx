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
import {
  generateMockOrders,
  generateTimeSeriesData,
  generateCategoryData,
  generateChannelData,
  calculateKPIs,
  getTopProducts,
  getTopCustomers,
} from '@/lib/mock-data';

export default function Index() {
  const [customerTypeFilter, setCustomerTypeFilter] = useState<CustomerType | 'all'>('all');
  const [dateRange, setDateRange] = useState({
    start: subDays(new Date(), 30),
    end: new Date(),
  });
  const [isLoading, setIsLoading] = useState(false);

  // Generate mock data
  const allOrders = useMemo(() => generateMockOrders(500), []);

  // Filter orders based on current filters
  const filteredOrders = useMemo(() => {
    return allOrders.filter((order) => {
      const inDateRange = order.date >= dateRange.start && order.date <= dateRange.end;
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

  // Mock data sources
  const dataSources = [
    {
      name: 'Shopify Store',
      type: 'shopify' as const,
      status: 'connected' as const,
      recordCount: allOrders.filter((o) => o.source === 'shopify').length,
    },
    {
      name: 'Google Sheets B2B',
      type: 'google_sheets' as const,
      status: 'connected' as const,
      recordCount: allOrders.filter((o) => o.source === 'google_sheets').length,
    },
  ];

  const handleRefresh = () => {
    setIsLoading(true);
    setTimeout(() => setIsLoading(false), 1500);
  };

  return (
    <div className="min-h-screen bg-background p-4 sm:p-6 lg:p-8">
      <div className="max-w-[1600px] mx-auto">
        <DashboardHeader onRefresh={handleRefresh} isLoading={isLoading} />

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
