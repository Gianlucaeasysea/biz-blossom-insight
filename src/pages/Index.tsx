import { useState, useMemo } from 'react';
import { subDays, format } from 'date-fns';
import { DashboardHeader } from '@/components/dashboard/DashboardHeader';
import { FilterBar } from '@/components/dashboard/FilterBar';
import { KPICard } from '@/components/dashboard/KPICard';
import { OrdersTrendChart } from '@/components/dashboard/OrdersTrendChart';
import { SalesTrendChart } from '@/components/dashboard/SalesTrendChart';
import { B2CSkuTable } from '@/components/dashboard/B2CSkuTable';
import { B2BSkuTable } from '@/components/dashboard/B2BSkuTable';
import { CombinedSkuTable } from '@/components/dashboard/CombinedSkuTable';
import { CountryBreakdown } from '@/components/dashboard/CountryBreakdown';
import { CollectionBreakdown } from '@/components/dashboard/CollectionBreakdown';
import { ConnectionStatus } from '@/components/dashboard/ConnectionStatus';
import { AiAssistant } from '@/components/dashboard/AiAssistant';
import { B2CSalesBreakdown } from '@/components/dashboard/B2CSalesBreakdown';
import { CustomerType } from '@/types/analytics';
import { NavLink } from '@/components/NavLink';
import { useShopifyOrders } from '@/hooks/useShopifyOrders';
import { useShopifySalesSummary } from '@/hooks/useShopifySalesSummary';
import { useGoogleSheetsOrders } from '@/hooks/useGoogleSheetsOrders';
import {
  calculateKPIs,
  getB2CSkuBreakdown,
  getB2BSkuBreakdown,
  getCombinedSkuBreakdown,
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
      // Ensure end date includes the full day (23:59:59.999)
      const endOfDay = new Date(dateRange.end);
      endOfDay.setHours(23, 59, 59, 999);
      const inDateRange = orderDate >= dateRange.start && orderDate <= endOfDay;
      const matchesType = customerTypeFilter === 'all' || order.customerType === customerTypeFilter;
      return inDateRange && matchesType;
    });
  }, [allOrders, dateRange, customerTypeFilter]);

  const { data: shopifySalesSummary, isLoading: isLoadingShopifySummary } = useShopifySalesSummary({
    start: dateRange.start,
    end: dateRange.end,
    enabled: customerTypeFilter !== 'B2B',
  });

  const kpis = useMemo(() => calculateKPIs(filteredOrders), [filteredOrders]);
  const b2cSkuData = useMemo(() => getB2CSkuBreakdown(filteredOrders), [filteredOrders]);
  const b2bSkuData = useMemo(() => getB2BSkuBreakdown(filteredOrders), [filteredOrders]);
  const combinedSkuData = useMemo(() => getCombinedSkuBreakdown(filteredOrders), [filteredOrders]);

  // All unique SKUs for country filter
  const allSkus = useMemo(() => {
    const skuSet = new Set<string>();
    filteredOrders.forEach(o => o.products.forEach(p => skuSet.add(p.sku)));
    return Array.from(skuSet).sort();
  }, [filteredOrders]);

  // KPIs by label
  const kpiMap = useMemo(() => Object.fromEntries(kpis.map(k => [k.label, k])), [kpis]);

  // Build AI context string from dashboard data
  const aiDashboardContext = useMemo(() => {
    const lines: string[] = [];
    lines.push(`Periodo: ${format(dateRange.start, 'dd/MM/yyyy')} - ${format(dateRange.end, 'dd/MM/yyyy')}`);
    lines.push(`Filtro tipo cliente: ${customerTypeFilter}`);
    lines.push(`Totale ordini caricati: ${allOrders.length} (Shopify: ${shopifyOrders.length}, Google Sheets B2B: ${gsOrders.length})`);
    lines.push(`Ordini nel periodo filtrato: ${filteredOrders.length}`);
    lines.push('');
    lines.push('--- KPI ---');
    kpis.forEach(k => {
      const val = k.format === 'currency' ? `€${k.value.toLocaleString('it-IT', { minimumFractionDigits: 2 })}` : k.value.toLocaleString('it-IT');
      lines.push(`${k.label}: ${val}`);
    });
    lines.push('');
    lines.push('--- Top SKU B2C (per net sales) ---');
    b2cSkuData.slice(0, 15).forEach(s => lines.push(`${s.sku} (${s.name}): qty ${s.qtySold}, net sales €${s.netSalesTotal.toLocaleString('it-IT', { minimumFractionDigits: 2 })}, evasi €${s.netSalesFulfilled.toLocaleString('it-IT', { minimumFractionDigits: 2 })}`));
    lines.push('');
    lines.push('--- Top SKU B2B (per price raccolto) ---');
    b2bSkuData.slice(0, 15).forEach(s => lines.push(`${s.sku} (${s.name}): qty ${s.qtySold}, raccolto €${s.priceRaccolto.toLocaleString('it-IT', { minimumFractionDigits: 2 })}, consegnato €${s.priceConsegnato.toLocaleString('it-IT', { minimumFractionDigits: 2 })}`));
    lines.push('');
    lines.push('--- Top SKU Combinato ---');
    combinedSkuData.slice(0, 15).forEach(s => lines.push(`${s.sku} (${s.name}): qty ${s.qtySold}, totale €${s.totalValue.toLocaleString('it-IT', { minimumFractionDigits: 2 })}`));
    lines.push('');
    // Country breakdown
    const countryMap: Record<string, { orders: number; revenue: number }> = {};
    filteredOrders.forEach(o => {
      const c = o.destinationCountry || o.country || 'Sconosciuto';
      if (!countryMap[c]) countryMap[c] = { orders: 0, revenue: 0 };
      countryMap[c].orders++;
      countryMap[c].revenue += o.customerType === 'B2C' ? (o.netAmount ?? o.totalAmount) : o.totalAmount;
    });
    lines.push('--- Vendite per Paese ---');
    Object.entries(countryMap).sort((a, b) => b[1].revenue - a[1].revenue).slice(0, 10).forEach(([c, d]) =>
      lines.push(`${c}: ${d.orders} ordini, €${d.revenue.toLocaleString('it-IT', { minimumFractionDigits: 2 })}`)
    );
    return lines.join('\n');
  }, [dateRange, customerTypeFilter, allOrders, shopifyOrders, gsOrders, filteredOrders, kpis, b2cSkuData, b2bSkuData, combinedSkuData]);

  const dataSources = [
    { name: 'Shopify', type: 'shopify' as const, status: isLoadingShopify ? 'syncing' as const : isErrorShopify ? 'disconnected' as const : 'connected' as const, recordCount: shopifyOrders.length },
    { name: 'Google Sheets B2B', type: 'google_sheets' as const, status: isLoadingGS ? 'syncing' as const : isErrorGS ? 'disconnected' as const : 'connected' as const, recordCount: gsOrders.length },
  ];

  const handleRefresh = () => { refetchShopify(); refetchGS(); };

  return (
    <div className="min-h-screen bg-background p-4 sm:p-6 lg:p-8">
      <div className="max-w-[1600px] mx-auto">
        <DashboardHeader onRefresh={handleRefresh} isLoading={isFetching} />

        {/* Navigation */}
        <div className="flex gap-2 mb-6">
          <NavLink to="/" className="px-4 py-2 rounded-lg text-sm font-medium bg-secondary text-secondary-foreground hover:bg-secondary/80 transition-colors" activeClassName="bg-primary text-primary-foreground">Sales Dashboard</NavLink>
          <NavLink to="/meta-ads" className="px-4 py-2 rounded-lg text-sm font-medium bg-secondary text-secondary-foreground hover:bg-secondary/80 transition-colors" activeClassName="bg-primary text-primary-foreground">Meta Ads</NavLink>
        </div>

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

        {/* === KPI SECTION === */}
        {/* Total Order */}
        <div className="mb-6">
          <p className="section-label mb-2">Overview</p>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {kpiMap['Total Order'] && <KPICard data={kpiMap['Total Order']} />}
            {kpiMap['Total Order B2C'] && <KPICard data={kpiMap['Total Order B2C']} />}
            {kpiMap['Total Order B2B'] && <KPICard data={kpiMap['Total Order B2B']} />}
          </div>
        </div>

        {/* Fatturato + Ordini count */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
          {kpiMap['Fatturato B2C'] && <KPICard data={kpiMap['Fatturato B2C']} />}
          {kpiMap['Fatturato B2B'] && <KPICard data={kpiMap['Fatturato B2B']} />}
          {kpiMap['Totale Ordini B2C'] && <KPICard data={kpiMap['Totale Ordini B2C']} />}
          {kpiMap['Totale Ordini B2B'] && <KPICard data={kpiMap['Totale Ordini B2B']} />}
        </div>

        {/* === B2C SALES BREAKDOWN === */}
        <div className="mb-6">
          <B2CSalesBreakdown orders={filteredOrders} />
        </div>

        <div className="mb-6">
          <OrdersTrendChart orders={filteredOrders} dateRange={dateRange} />
        </div>

        {/* === SKU DETAIL SECTION === */}
        <div className="mb-8">
          <p className="section-label mb-3">Dettaglio Vendite SKU</p>
          
          {/* B2C SKU */}
          <div className="mb-4">
            <B2CSkuTable data={b2cSkuData} />
          </div>

          {/* B2B SKU */}
          <div className="mb-4">
            <B2BSkuTable data={b2bSkuData} />
          </div>

          {/* Combined */}
          <div>
            <CombinedSkuTable data={combinedSkuData} />
          </div>
        </div>

        {/* === COLLECTION BREAKDOWN === */}
        <div className="mb-6">
          <p className="section-label mb-3">Vendite per Collection</p>
          <CollectionBreakdown orders={filteredOrders} />
        </div>

        {/* === COUNTRY BREAKDOWN === */}
        <div className="mb-6">
          <p className="section-label mb-3">Vendite per Paese</p>
          <CountryBreakdown orders={filteredOrders} allSkus={allSkus} />
        </div>

        {/* === Sales Trend by Channel/Product === */}
        <div className="mb-6">
          <SalesTrendChart orders={filteredOrders} dateRange={dateRange} />
        </div>

        {/* Connection Status */}
        <div className="mb-6">
          <ConnectionStatus sources={dataSources} />
        </div>
      </div>

      {/* AI Assistant */}
      <AiAssistant dashboardContext={aiDashboardContext} />
    </div>
  );
}
