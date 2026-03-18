import { useState, useMemo, useCallback } from 'react';
import { subDays, format } from 'date-fns';
import { ResponsiveGridLayout, Responsive } from 'react-grid-layout';
import type { Layout, Layouts } from 'react-grid-layout';
import 'react-grid-layout/css/styles.css';
import 'react-resizable/css/styles.css';
import { PieChart, Pie, Cell, Tooltip as ReTooltip, ResponsiveContainer } from 'recharts';
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
  getTop3ProductsByQty,
} from '@/lib/mock-data';
import { Loader2, AlertCircle, Lock, Unlock, Package } from 'lucide-react';



const STORAGE_KEY = 'dashboard-layouts';

const DEFAULT_LAYOUTS: Layouts = {
  lg: [
    { i: 'kpis', x: 0, y: 0, w: 8, h: 6, minW: 4, minH: 5 },
    { i: 'b2c-breakdown', x: 8, y: 0, w: 4, h: 6, minW: 3, minH: 4 },
    { i: 'orders-trend', x: 0, y: 6, w: 12, h: 6, minW: 6, minH: 4 },
    { i: 'b2c-sku', x: 0, y: 12, w: 12, h: 6, minW: 6, minH: 4 },
    { i: 'b2b-sku', x: 0, y: 18, w: 12, h: 6, minW: 6, minH: 4 },
    { i: 'combined-sku', x: 0, y: 24, w: 12, h: 6, minW: 6, minH: 4 },
    { i: 'heatmap', x: 0, y: 30, w: 12, h: 8, minW: 6, minH: 6 },
    { i: 'collections', x: 0, y: 38, w: 6, h: 6, minW: 4, minH: 4 },
    { i: 'countries', x: 6, y: 38, w: 6, h: 6, minW: 4, minH: 4 },
    { i: 'sales-trend', x: 0, y: 44, w: 12, h: 5, minW: 6, minH: 4 },
    { i: 'connection', x: 0, y: 49, w: 12, h: 3, minW: 4, minH: 2 },
  ],
  md: [
    { i: 'kpis', x: 0, y: 0, w: 6, h: 6, minW: 4, minH: 5 },
    { i: 'b2c-breakdown', x: 6, y: 0, w: 4, h: 6, minW: 3, minH: 4 },
    { i: 'orders-trend', x: 0, y: 6, w: 10, h: 6, minW: 5, minH: 4 },
    { i: 'b2c-sku', x: 0, y: 12, w: 10, h: 6, minW: 5, minH: 4 },
    { i: 'b2b-sku', x: 0, y: 18, w: 10, h: 6, minW: 5, minH: 4 },
    { i: 'combined-sku', x: 0, y: 24, w: 10, h: 6, minW: 5, minH: 4 },
    { i: 'heatmap', x: 0, y: 30, w: 10, h: 8, minW: 5, minH: 6 },
    { i: 'collections', x: 0, y: 38, w: 5, h: 6, minW: 4, minH: 4 },
    { i: 'countries', x: 5, y: 38, w: 5, h: 6, minW: 4, minH: 4 },
    { i: 'sales-trend', x: 0, y: 44, w: 10, h: 5, minW: 5, minH: 4 },
    { i: 'connection', x: 0, y: 49, w: 10, h: 3, minW: 4, minH: 2 },
  ],
  sm: [
    { i: 'kpis', x: 0, y: 0, w: 6, h: 7, minW: 3, minH: 5 },
    { i: 'b2c-breakdown', x: 0, y: 7, w: 6, h: 5, minW: 3, minH: 4 },
    { i: 'orders-trend', x: 0, y: 12, w: 6, h: 6, minW: 3, minH: 4 },
    { i: 'b2c-sku', x: 0, y: 18, w: 6, h: 6, minW: 3, minH: 4 },
    { i: 'b2b-sku', x: 0, y: 24, w: 6, h: 6, minW: 3, minH: 4 },
    { i: 'combined-sku', x: 0, y: 30, w: 6, h: 6, minW: 3, minH: 4 },
    { i: 'heatmap', x: 0, y: 36, w: 6, h: 7, minW: 3, minH: 5 },
    { i: 'collections', x: 0, y: 43, w: 6, h: 5, minW: 3, minH: 4 },
    { i: 'countries', x: 0, y: 48, w: 6, h: 5, minW: 3, minH: 4 },
    { i: 'sales-trend', x: 0, y: 53, w: 6, h: 5, minW: 3, minH: 4 },
    { i: 'connection', x: 0, y: 58, w: 6, h: 3, minW: 3, minH: 2 },
  ],
  xs: [
    { i: 'kpis', x: 0, y: 0, w: 4, h: 8, minW: 2, minH: 6 },
    { i: 'b2c-breakdown', x: 0, y: 8, w: 4, h: 5, minW: 2, minH: 4 },
    { i: 'orders-trend', x: 0, y: 13, w: 4, h: 6, minW: 2, minH: 4 },
    { i: 'b2c-sku', x: 0, y: 19, w: 4, h: 6, minW: 2, minH: 4 },
    { i: 'b2b-sku', x: 0, y: 25, w: 4, h: 6, minW: 2, minH: 4 },
    { i: 'combined-sku', x: 0, y: 31, w: 4, h: 6, minW: 2, minH: 4 },
    { i: 'heatmap', x: 0, y: 37, w: 4, h: 7, minW: 2, minH: 5 },
    { i: 'collections', x: 0, y: 44, w: 4, h: 5, minW: 2, minH: 4 },
    { i: 'countries', x: 0, y: 49, w: 4, h: 5, minW: 2, minH: 4 },
    { i: 'sales-trend', x: 0, y: 54, w: 4, h: 5, minW: 2, minH: 4 },
    { i: 'connection', x: 0, y: 59, w: 4, h: 3, minW: 2, minH: 2 },
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
  const top3Products = useMemo(() => getTop3ProductsByQty(filteredOrders), [filteredOrders]);

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

  const b2cVal = kpiMap['Total Order B2C']?.value ?? 0;
  const b2bVal = kpiMap['Total Order B2B']?.value ?? 0;
  const totalVal = b2cVal + b2bVal;
  const pieData = [
    { name: 'B2C', value: b2cVal, fill: 'hsl(215, 85%, 55%)' },
    { name: 'B2B', value: b2bVal, fill: 'hsl(25, 95%, 55%)' },
  ];

  return (
    <div className="min-h-screen bg-background p-3 sm:p-4 lg:p-6">
      <div className="max-w-[1600px] mx-auto">
        <DashboardHeader onRefresh={handleRefresh} isLoading={isFetching} />

        <div className="flex items-center justify-between gap-2 mb-4">
          <div className="flex gap-2">
            <NavLink to="/" className="px-4 py-2 rounded-lg text-sm font-medium bg-secondary text-secondary-foreground hover:bg-secondary/80 transition-colors" activeClassName="bg-primary text-primary-foreground">Sales Dashboard</NavLink>
            <NavLink to="/meta-ads" className="px-4 py-2 rounded-lg text-sm font-medium bg-secondary text-secondary-foreground hover:bg-secondary/80 transition-colors" activeClassName="bg-primary text-primary-foreground">Meta Ads</NavLink>
          </div>
          <div className="flex items-center gap-1.5">
            <button onClick={() => setIsLocked(l => !l)} className="p-2 rounded-lg border border-border/50 bg-muted/50 hover:bg-muted text-muted-foreground hover:text-foreground transition-colors" title={isLocked ? 'Sblocca layout' : 'Blocca layout'}>
              {isLocked ? <Lock className="w-3.5 h-3.5" /> : <Unlock className="w-3.5 h-3.5" />}
            </button>
            <button onClick={resetLayout} className="px-3 py-2 rounded-lg border border-border/50 bg-muted/50 hover:bg-muted text-muted-foreground hover:text-foreground transition-colors text-xs">Reset layout</button>
          </div>
        </div>

        {isErrorShopify && (
          <div className="mb-3 p-3 rounded-md bg-destructive/10 border border-destructive/20 flex items-center gap-2 text-xs text-destructive">
            <AlertCircle className="w-4 h-4 shrink-0" />Shopify: {errorShopify instanceof Error ? errorShopify.message : 'Errore'}
          </div>
        )}
        {isErrorGS && (
          <div className="mb-3 p-3 rounded-md bg-destructive/10 border border-destructive/20 flex items-center gap-2 text-xs text-destructive">
            <AlertCircle className="w-4 h-4 shrink-0" />Google Sheets: {errorGS instanceof Error ? errorGS.message : 'Errore'}
          </div>
        )}
        {isLoading && (
          <div className="mb-4 flex items-center justify-center gap-2 p-12">
            <Loader2 className="w-5 h-5 animate-spin text-primary" />
            <p className="text-sm text-muted-foreground">Caricamento dati...</p>
          </div>
        )}

        <div className="mb-4">
          <FilterBar customerTypeFilter={customerTypeFilter} onCustomerTypeChange={setCustomerTypeFilter} dateRange={dateRange} onDateRangeChange={setDateRange} />
        </div>

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
          {/* KPIs — Overview */}
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
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  {kpiMap['AOV B2C'] && <KPICard data={kpiMap['AOV B2C']} />}
                  {kpiMap['AOV B2B'] && <KPICard data={kpiMap['AOV B2B']} />}
                  <div className="kpi-card col-span-2 sm:col-span-1">
                    <div className="flex items-center gap-1.5 mb-2">
                      <Package className="w-3 h-3 text-muted-foreground" />
                      <p className="text-[11px] text-muted-foreground font-medium uppercase tracking-wider">Top 3 Prodotti</p>
                    </div>
                    <div className="space-y-1.5">
                      {top3Products.length === 0 && <p className="text-xs text-muted-foreground">Nessun dato</p>}
                      {top3Products.map((p, i) => (
                        <div key={p.sku} className="flex items-center gap-2">
                          <span className="text-[10px] font-bold text-muted-foreground w-3 shrink-0">{i + 1}.</span>
                          <div className="flex-1 min-w-0">
                            <p className="text-[11px] font-medium text-foreground truncate leading-tight">{p.name}</p>
                            <p className="text-[10px] text-muted-foreground">{p.sku}</p>
                          </div>
                          <span className="text-sm font-bold font-mono text-primary shrink-0">{p.qty}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                  <div className="kpi-card col-span-2 sm:col-span-1">
                    <p className="text-[11px] text-muted-foreground font-medium uppercase tracking-wider mb-1">Incidenza B2C / B2B</p>
                    {totalVal === 0 ? (
                      <p className="text-xs text-muted-foreground mt-2">Nessun dato</p>
                    ) : (
                      <div className="flex items-center gap-2">
                        <div className="w-16 h-16 shrink-0">
                          <ResponsiveContainer width="100%" height="100%">
                            <PieChart>
                              <Pie data={pieData} dataKey="value" cx="50%" cy="50%" innerRadius={18} outerRadius={30} strokeWidth={0}>
                                {pieData.map((entry, idx) => <Cell key={idx} fill={entry.fill} />)}
                              </Pie>
                              <ReTooltip formatter={(v: number) => [`€${v.toLocaleString('it-IT', { maximumFractionDigits: 0 })}`, '']} contentStyle={{ background: 'hsl(220,25%,12%)', border: '1px solid hsl(220,20%,22%)', borderRadius: 6, fontSize: 11 }} />
                            </PieChart>
                          </ResponsiveContainer>
                        </div>
                        <div className="space-y-1.5 min-w-0">
                          {pieData.map(d => (
                            <div key={d.name} className="flex items-center gap-1.5">
                              <div className="w-2 h-2 rounded-full shrink-0" style={{ background: d.fill }} />
                              <span className="text-[10px] text-muted-foreground">{d.name}</span>
                              <span className="text-[11px] font-bold font-mono text-foreground ml-auto">{((d.value / totalVal) * 100).toFixed(0)}%</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </DashboardWidget>
          </div>

          <div key="b2c-breakdown">
            <DashboardWidget title="Spaccato Vendite B2C" subtitle="Report ufficiale">
              <B2CSalesBreakdown summary={shopifySalesSummary} orderCount={filteredOrders.filter(o => o.customerType === 'B2C').length} isLoading={isLoadingShopifySummary} />
            </DashboardWidget>
          </div>

          <div key="orders-trend">
            <DashboardWidget title="Andamento Ordini" subtitle="Trend per periodo / anno">
              <OrdersTrendChart orders={filteredOrders} allOrders={allOrders} dateRange={dateRange} />
            </DashboardWidget>
          </div>

          <div key="b2c-sku">
            <DashboardWidget title="Dettaglio SKU B2C" subtitle="Net Sales per variante">
              <B2CSkuTable data={b2cSkuData} />
            </DashboardWidget>
          </div>

          <div key="b2b-sku">
            <DashboardWidget title="Dettaglio SKU B2B" subtitle="Raccolto e consegnato">
              <B2BSkuTable data={b2bSkuData} />
            </DashboardWidget>
          </div>

          <div key="combined-sku">
            <DashboardWidget title="SKU Combinato" subtitle="B2C + B2B totale">
              <CombinedSkuTable data={combinedSkuData} />
            </DashboardWidget>
          </div>

          <div key="heatmap">
            <DashboardWidget title="Mappa Vendite B2C" subtitle="Per paese / città">
              <B2CSalesHeatmap orders={filteredOrders} dateRange={dateRange} />
            </DashboardWidget>
          </div>

          <div key="collections">
            <DashboardWidget title="Vendite per Collection">
              <CollectionBreakdown orders={filteredOrders} />
            </DashboardWidget>
          </div>

          <div key="countries">
            <DashboardWidget title="Vendite per Paese">
              <CountryBreakdown orders={filteredOrders} allSkus={allSkus} />
            </DashboardWidget>
          </div>

          <div key="sales-trend">
            <DashboardWidget title="Andamento Vendite" subtitle="Per canale/prodotto">
              <SalesTrendChart orders={filteredOrders} dateRange={dateRange} />
            </DashboardWidget>
          </div>

          <div key="connection">
            <DashboardWidget title="Stato Connessioni">
              <ConnectionStatus sources={dataSources} />
            </DashboardWidget>
          </div>
        </ResponsiveGridLayout>
      </div>

      <AiAssistant dashboardContext={aiDashboardContext} />
    </div>
  );
}
