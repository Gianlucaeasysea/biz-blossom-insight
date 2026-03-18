import { useState, useMemo, useCallback } from 'react';
import { subDays, format } from 'date-fns';
import { Responsive, WidthProvider, Layout, Layouts } from 'react-grid-layout';
import 'react-grid-layout/css/styles.css';
import 'react-resizable/css/styles.css';
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
import { B2CSalesHeatmap } from '@/components/dashboard/B2CSalesHeatmap';
import { ConnectionStatus } from '@/components/dashboard/ConnectionStatus';
import { AiAssistant } from '@/components/dashboard/AiAssistant';
import { B2CSalesBreakdown } from '@/components/dashboard/B2CSalesBreakdown';
import { DashboardWidget } from '@/components/dashboard/DashboardWidget';
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
import { Loader2, AlertCircle, Lock, Unlock } from 'lucide-react';

const ResponsiveGridLayout = WidthProvider(Responsive);

const STORAGE_KEY = 'dashboard-layouts';

const DEFAULT_LAYOUTS: Layouts = {
  lg: [
    { i: 'kpis', x: 0, y: 0, w: 8, h: 4, minW: 4, minH: 3 },
    { i: 'b2c-breakdown', x: 8, y: 0, w: 4, h: 4, minW: 3, minH: 3 },
    { i: 'orders-trend', x: 0, y: 4, w: 12, h: 5, minW: 6, minH: 4 },
    { i: 'b2c-sku', x: 0, y: 9, w: 12, h: 6, minW: 6, minH: 4 },
    { i: 'b2b-sku', x: 0, y: 15, w: 12, h: 6, minW: 6, minH: 4 },
    { i: 'combined-sku', x: 0, y: 21, w: 12, h: 6, minW: 6, minH: 4 },
    { i: 'heatmap', x: 0, y: 27, w: 12, h: 7, minW: 6, minH: 5 },
    { i: 'collections', x: 0, y: 34, w: 6, h: 6, minW: 4, minH: 4 },
    { i: 'countries', x: 6, y: 34, w: 6, h: 6, minW: 4, minH: 4 },
    { i: 'sales-trend', x: 0, y: 40, w: 12, h: 5, minW: 6, minH: 4 },
    { i: 'connection', x: 0, y: 45, w: 12, h: 3, minW: 4, minH: 2 },
  ],
  md: [
    { i: 'kpis', x: 0, y: 0, w: 6, h: 4, minW: 4, minH: 3 },
    { i: 'b2c-breakdown', x: 6, y: 0, w: 4, h: 4, minW: 3, minH: 3 },
    { i: 'orders-trend', x: 0, y: 4, w: 10, h: 5, minW: 5, minH: 4 },
    { i: 'b2c-sku', x: 0, y: 9, w: 10, h: 6, minW: 5, minH: 4 },
    { i: 'b2b-sku', x: 0, y: 15, w: 10, h: 6, minW: 5, minH: 4 },
    { i: 'combined-sku', x: 0, y: 21, w: 10, h: 6, minW: 5, minH: 4 },
    { i: 'heatmap', x: 0, y: 27, w: 10, h: 7, minW: 5, minH: 5 },
    { i: 'collections', x: 0, y: 34, w: 5, h: 6, minW: 4, minH: 4 },
    { i: 'countries', x: 5, y: 34, w: 5, h: 6, minW: 4, minH: 4 },
    { i: 'sales-trend', x: 0, y: 40, w: 10, h: 5, minW: 5, minH: 4 },
    { i: 'connection', x: 0, y: 45, w: 10, h: 3, minW: 4, minH: 2 },
  ],
  sm: [
    { i: 'kpis', x: 0, y: 0, w: 6, h: 5, minW: 3, minH: 4 },
    { i: 'b2c-breakdown', x: 0, y: 5, w: 6, h: 4, minW: 3, minH: 3 },
    { i: 'orders-trend', x: 0, y: 9, w: 6, h: 5, minW: 3, minH: 4 },
    { i: 'b2c-sku', x: 0, y: 14, w: 6, h: 6, minW: 3, minH: 4 },
    { i: 'b2b-sku', x: 0, y: 20, w: 6, h: 6, minW: 3, minH: 4 },
    { i: 'combined-sku', x: 0, y: 26, w: 6, h: 6, minW: 3, minH: 4 },
    { i: 'heatmap', x: 0, y: 32, w: 6, h: 6, minW: 3, minH: 4 },
    { i: 'collections', x: 0, y: 38, w: 6, h: 5, minW: 3, minH: 4 },
    { i: 'countries', x: 0, y: 43, w: 6, h: 5, minW: 3, minH: 4 },
    { i: 'sales-trend', x: 0, y: 48, w: 6, h: 5, minW: 3, minH: 4 },
    { i: 'connection', x: 0, y: 53, w: 6, h: 3, minW: 3, minH: 2 },
  ],
  xs: [
    { i: 'kpis', x: 0, y: 0, w: 4, h: 6, minW: 2, minH: 5 },
    { i: 'b2c-breakdown', x: 0, y: 6, w: 4, h: 4, minW: 2, minH: 3 },
    { i: 'orders-trend', x: 0, y: 10, w: 4, h: 5, minW: 2, minH: 4 },
    { i: 'b2c-sku', x: 0, y: 15, w: 4, h: 6, minW: 2, minH: 4 },
    { i: 'b2b-sku', x: 0, y: 21, w: 4, h: 6, minW: 2, minH: 4 },
    { i: 'combined-sku', x: 0, y: 27, w: 4, h: 6, minW: 2, minH: 4 },
    { i: 'heatmap', x: 0, y: 33, w: 4, h: 5, minW: 2, minH: 4 },
    { i: 'collections', x: 0, y: 38, w: 4, h: 5, minW: 2, minH: 4 },
    { i: 'countries', x: 0, y: 43, w: 4, h: 5, minW: 2, minH: 4 },
    { i: 'sales-trend', x: 0, y: 48, w: 4, h: 5, minW: 2, minH: 4 },
    { i: 'connection', x: 0, y: 53, w: 4, h: 3, minW: 2, minH: 2 },
  ],
};

function loadLayouts(): Layouts {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) return JSON.parse(saved);
  } catch {}
  return DEFAULT_LAYOUTS;
}

export default function Index() {
  const [customerTypeFilter, setCustomerTypeFilter] = useState<CustomerType | 'all'>('all');
  const [dateRange, setDateRange] = useState(() => ({
    start: subDays(new Date(), 30),
    end: new Date(),
  }));
  const [shopifyMinDate] = useState(() => new Date('2025-01-01T00:00:00Z'));
  const [layouts, setLayouts] = useState<Layouts>(loadLayouts);
  const [isLocked, setIsLocked] = useState(false);

  const { data: shopifyOrders = [], isLoading: isLoadingShopify, isError: isErrorShopify, error: errorShopify, refetch: refetchShopify, isFetching: isFetchingShopify } = useShopifyOrders({ limit: 250, status: 'any', createdAtMin: shopifyMinDate, enabled: true });
  const { data: gsOrders = [], isLoading: isLoadingGS, isError: isErrorGS, error: errorGS, refetch: refetchGS, isFetching: isFetchingGS } = useGoogleSheetsOrders(true);

  const allOrders = useMemo(() => [...shopifyOrders, ...gsOrders], [shopifyOrders, gsOrders]);
  const isLoading = isLoadingShopify || isLoadingGS;
  const isFetching = isFetchingShopify || isFetchingGS;

  const filteredOrders = useMemo(() => {
    return allOrders.filter(order => {
      const orderDate = order.date instanceof Date ? order.date : new Date(order.date);
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

  const allSkus = useMemo(() => {
    const skuSet = new Set<string>();
    filteredOrders.forEach(o => o.products.forEach(p => skuSet.add(p.sku)));
    return Array.from(skuSet).sort();
  }, [filteredOrders]);

  const kpiMap = useMemo(() => Object.fromEntries(kpis.map(k => [k.label, k])), [kpis]);

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

  const onLayoutChange = useCallback((_: Layout[], allLayouts: Layouts) => {
    setLayouts(allLayouts);
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(allLayouts)); } catch {}
  }, []);

  const resetLayout = useCallback(() => {
    setLayouts(DEFAULT_LAYOUTS);
    localStorage.removeItem(STORAGE_KEY);
  }, []);

  return (
    <div className="min-h-screen bg-background p-3 sm:p-4 lg:p-6">
      <div className="max-w-[1600px] mx-auto">
        <DashboardHeader onRefresh={handleRefresh} isLoading={isFetching} />

        {/* Navigation + Layout Controls */}
        <div className="flex items-center justify-between gap-2 mb-4">
          <div className="flex gap-2">
            <NavLink to="/" className="px-4 py-2 rounded-lg text-sm font-medium bg-secondary text-secondary-foreground hover:bg-secondary/80 transition-colors" activeClassName="bg-primary text-primary-foreground">Sales Dashboard</NavLink>
            <NavLink to="/meta-ads" className="px-4 py-2 rounded-lg text-sm font-medium bg-secondary text-secondary-foreground hover:bg-secondary/80 transition-colors" activeClassName="bg-primary text-primary-foreground">Meta Ads</NavLink>
          </div>
          <div className="flex items-center gap-1.5">
            <button
              onClick={() => setIsLocked(l => !l)}
              className="p-2 rounded-lg border border-border/50 bg-muted/50 hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
              title={isLocked ? 'Sblocca layout' : 'Blocca layout'}
            >
              {isLocked ? <Lock className="w-3.5 h-3.5" /> : <Unlock className="w-3.5 h-3.5" />}
            </button>
            <button
              onClick={resetLayout}
              className="px-3 py-2 rounded-lg border border-border/50 bg-muted/50 hover:bg-muted text-muted-foreground hover:text-foreground transition-colors text-xs"
              title="Reset layout"
            >
              Reset
            </button>
          </div>
        </div>

        {/* Errors */}
        {isErrorShopify && (
          <div className="mb-3 p-3 rounded-md bg-destructive/10 border border-destructive/20 flex items-center gap-2 text-xs text-destructive">
            <AlertCircle className="w-4 h-4 shrink-0" />
            Shopify: {errorShopify instanceof Error ? errorShopify.message : 'Errore'}
          </div>
        )}
        {isErrorGS && (
          <div className="mb-3 p-3 rounded-md bg-destructive/10 border border-destructive/20 flex items-center gap-2 text-xs text-destructive">
            <AlertCircle className="w-4 h-4 shrink-0" />
            Google Sheets: {errorGS instanceof Error ? errorGS.message : 'Errore'}
          </div>
        )}

        {isLoading && (
          <div className="mb-4 flex items-center justify-center gap-2 p-12">
            <Loader2 className="w-5 h-5 animate-spin text-primary" />
            <p className="text-sm text-muted-foreground">Caricamento dati...</p>
          </div>
        )}

        {/* Filters */}
        <div className="mb-4">
          <FilterBar customerTypeFilter={customerTypeFilter} onCustomerTypeChange={setCustomerTypeFilter} dateRange={dateRange} onDateRangeChange={setDateRange} />
        </div>

        {/* Drag & Drop Grid */}
        <ResponsiveGridLayout
          className="dashboard-grid"
          layouts={layouts}
          breakpoints={{ lg: 1200, md: 900, sm: 600, xs: 0 }}
          cols={{ lg: 12, md: 10, sm: 6, xs: 4 }}
          rowHeight={60}
          isDraggable={!isLocked}
          isResizable={!isLocked}
          draggableHandle=".drag-handle"
          onLayoutChange={onLayoutChange}
          margin={[12, 12]}
          containerPadding={[0, 0]}
          useCSSTransforms
        >
          {/* KPIs */}
          <div key="kpis">
            <DashboardWidget title="Overview" subtitle="KPI principali">
              <div className="space-y-3">
                <div className="grid grid-cols-3 gap-2">
                  {kpiMap['Total Order'] && <KPICard data={kpiMap['Total Order']} />}
                  {kpiMap['Total Order B2C'] && <KPICard data={kpiMap['Total Order B2C']} />}
                  {kpiMap['Total Order B2B'] && <KPICard data={kpiMap['Total Order B2B']} />}
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  {kpiMap['Fatturato B2C'] && <KPICard data={kpiMap['Fatturato B2C']} />}
                  {kpiMap['Fatturato B2B'] && <KPICard data={kpiMap['Fatturato B2B']} />}
                  {kpiMap['Totale Ordini B2C'] && <KPICard data={kpiMap['Totale Ordini B2C']} />}
                  {kpiMap['Totale Ordini B2B'] && <KPICard data={kpiMap['Totale Ordini B2B']} />}
                </div>
              </div>
            </DashboardWidget>
          </div>

          {/* B2C Sales Breakdown */}
          <div key="b2c-breakdown">
            <DashboardWidget title="Spaccato Vendite B2C" subtitle="Report ufficiale">
              <B2CSalesBreakdown
                summary={shopifySalesSummary}
                orderCount={filteredOrders.filter(o => o.customerType === 'B2C').length}
                isLoading={isLoadingShopifySummary}
              />
            </DashboardWidget>
          </div>

          {/* Orders Trend */}
          <div key="orders-trend">
            <DashboardWidget title="Andamento Ordini" subtitle="Trend giornaliero">
              <OrdersTrendChart orders={filteredOrders} dateRange={dateRange} />
            </DashboardWidget>
          </div>

          {/* B2C SKU */}
          <div key="b2c-sku">
            <DashboardWidget title="Dettaglio SKU B2C" subtitle="Net Sales per variante">
              <B2CSkuTable data={b2cSkuData} />
            </DashboardWidget>
          </div>

          {/* B2B SKU */}
          <div key="b2b-sku">
            <DashboardWidget title="Dettaglio SKU B2B" subtitle="Raccolto e consegnato">
              <B2BSkuTable data={b2bSkuData} />
            </DashboardWidget>
          </div>

          {/* Combined SKU */}
          <div key="combined-sku">
            <DashboardWidget title="SKU Combinato" subtitle="B2C + B2B totale">
              <CombinedSkuTable data={combinedSkuData} />
            </DashboardWidget>
          </div>

          {/* Heatmap */}
          <div key="heatmap">
            <DashboardWidget title="Mappa Vendite B2C" subtitle="Per paese">
              <B2CSalesHeatmap orders={filteredOrders} dateRange={dateRange} />
            </DashboardWidget>
          </div>

          {/* Collections */}
          <div key="collections">
            <DashboardWidget title="Vendite per Collection">
              <CollectionBreakdown orders={filteredOrders} />
            </DashboardWidget>
          </div>

          {/* Countries */}
          <div key="countries">
            <DashboardWidget title="Vendite per Paese">
              <CountryBreakdown orders={filteredOrders} allSkus={allSkus} />
            </DashboardWidget>
          </div>

          {/* Sales Trend */}
          <div key="sales-trend">
            <DashboardWidget title="Andamento Vendite" subtitle="Per canale/prodotto">
              <SalesTrendChart orders={filteredOrders} dateRange={dateRange} />
            </DashboardWidget>
          </div>

          {/* Connection Status */}
          <div key="connection">
            <DashboardWidget title="Stato Connessioni">
              <ConnectionStatus sources={dataSources} />
            </DashboardWidget>
          </div>
        </ResponsiveGridLayout>
      </div>

      {/* AI Assistant */}
      <AiAssistant dashboardContext={aiDashboardContext} />
    </div>
  );
}
