import { useState, useMemo } from 'react';
import { subDays, format } from 'date-fns';
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
import { RevenueTarget } from '@/components/dashboard/RevenueTarget';
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
import { Loader2, AlertCircle, Package } from 'lucide-react';

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

  const kpis = useMemo(() => {
    const computed = calculateKPIs(filteredOrders);
    // When Shopify Analytics summary is available, use its net_sales as the canonical B2C figure
    // (same source as B2C Sales Breakdown — correct to the cent)
    if (shopifySalesSummary?.netSales !== undefined && customerTypeFilter !== 'B2B') {
      const analyticsNetSales = shopifySalesSummary.netSales;
      return computed.map(k => {
        if (k.label === 'Total Order B2C') return { ...k, value: analyticsNetSales };
        if (k.label === 'Total Order') {
          const b2bVal = computed.find(c => c.label === 'Total Order B2B')?.value ?? 0;
          return { ...k, value: analyticsNetSales + b2bVal };
        }
        if (k.label === 'AOV B2C') {
          const b2cCount = computed.find(c => c.label === 'Total Orders B2C')?.value ?? 0;
          return { ...k, value: b2cCount > 0 ? analyticsNetSales / b2cCount : 0 };
        }
        return k;
      });
    }
    return computed;
  }, [filteredOrders, shopifySalesSummary, customerTypeFilter]);
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
    lines.push(`Total orders loaded: ${allOrders.length}`);
    lines.push(`Ordini nel periodo filtrato: ${filteredOrders.length}`);
    lines.push('--- KPI ---');
    kpis.forEach(k => {
      const val = k.format === 'currency' ? `€${k.value.toLocaleString('it-IT', { minimumFractionDigits: 2 })}` : k.value.toLocaleString('it-IT');
      lines.push(`${k.label}: ${val}`);
    });
    const countryMap: Record<string, { orders: number; revenue: number }> = {};
    filteredOrders.forEach(o => {
      const c = o.destinationCountry || o.country || 'Unknown';
      if (!countryMap[c]) countryMap[c] = { orders: 0, revenue: 0 };
      countryMap[c].orders++;
      countryMap[c].revenue += o.customerType === 'B2C' ? (o.netAmount ?? o.totalAmount) : o.totalAmount;
    });
    Object.entries(countryMap).sort((a, b) => b[1].revenue - a[1].revenue).slice(0, 10).forEach(([c, d]) =>
      lines.push(`${c}: ${d.orders} orders, €${d.revenue.toLocaleString('it-IT', { minimumFractionDigits: 2 })}`)
    );
    return lines.join('\n');
  }, [dateRange, customerTypeFilter, allOrders, filteredOrders, kpis]);

  const dataSources = [
    { name: 'Shopify', type: 'shopify' as const, status: isLoadingShopify ? 'syncing' as const : isErrorShopify ? 'disconnected' as const : 'connected' as const, recordCount: shopifyOrders.length },
    { name: 'Google Sheets B2B', type: 'google_sheets' as const, status: isLoadingGS ? 'syncing' as const : isErrorGS ? 'disconnected' as const : 'connected' as const, recordCount: gsOrders.length },
  ];

  const handleRefresh = () => { refetchShopify(); refetchGS(); };

  const b2cVal = kpiMap['Total Order B2C']?.value ?? 0;
  const b2bVal = kpiMap['Total Order B2B']?.value ?? 0;
  const totalVal = b2cVal + b2bVal;
  const B2C_COLOR = 'hsl(168,70%,42%)';
  const B2B_COLOR = 'hsl(42,96%,48%)';
  const pieData = [
    { name: 'B2C', value: b2cVal, fill: B2C_COLOR },
    { name: 'B2B', value: b2bVal, fill: B2B_COLOR },
  ];

  // Section header helper
  const SectionHeader = ({ label, badge, badgeClass }: { label: string; badge?: string; badgeClass?: string }) => (
    <div className="flex items-center gap-2 mb-3">
      {badge && <span className={`inline-flex items-center px-1.5 py-px rounded text-[9px] font-bold tracking-wider uppercase ${badgeClass}`}>{badge}</span>}
      <p className="section-label mb-0">{label}</p>
      <div className="flex-1 h-px bg-border/30" />
    </div>
  );

  return (
    <div className="min-h-screen bg-background p-4 sm:p-6">
      <div className="max-w-[1520px] mx-auto space-y-5">

        {/* ── Header ──────────────────────────────────────────── */}
        <DashboardHeader onRefresh={handleRefresh} isLoading={isFetching} />

        {/* ── Revenue Target ─────────────────────────────────── */}
        <RevenueTarget currentRevenue={totalVal} />

        {/* ── Nav + Filters bar ───────────────────────────────── */}
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex gap-1.5">
            <NavLink to="/" className="px-3.5 py-1.5 rounded-lg text-xs font-semibold bg-muted text-muted-foreground hover:text-foreground transition-colors" activeClassName="bg-primary text-primary-foreground">Sales Dashboard</NavLink>
            <NavLink to="/meta-ads" className="px-3.5 py-1.5 rounded-lg text-xs font-semibold bg-muted text-muted-foreground hover:text-foreground transition-colors" activeClassName="bg-primary text-primary-foreground">Meta Ads</NavLink>
          </div>
          <FilterBar customerTypeFilter={customerTypeFilter} onCustomerTypeChange={setCustomerTypeFilter} dateRange={dateRange} onDateRangeChange={setDateRange} />
        </div>

        {/* ── Errors ─────────────────────────────────────────── */}
        {isErrorShopify && (
          <div className="p-3 rounded-lg bg-destructive/10 border border-destructive/20 flex items-center gap-2 text-xs text-destructive">
            <AlertCircle className="w-4 h-4 shrink-0" />
            Shopify: {errorShopify instanceof Error ? errorShopify.message : 'Error'}
          </div>
        )}
        {isErrorGS && (
          <div className="p-3 rounded-lg bg-destructive/10 border border-destructive/20 flex items-center gap-2 text-xs text-destructive">
            <AlertCircle className="w-4 h-4 shrink-0" />
            Google Sheets: {errorGS instanceof Error ? errorGS.message : 'Error'}
          </div>
        )}
        {isLoading && (
          <div className="flex items-center justify-center gap-2 py-16">
            <Loader2 className="w-5 h-5 animate-spin text-primary" />
            <p className="text-sm text-muted-foreground">Loading data...</p>
          </div>
        )}

        {/* ═══════════════════════════════════════════════════════
            OVERVIEW — KPI + Pie + Top 3 + B2C Breakdown
        ═══════════════════════════════════════════════════════ */}
        <div>
          <SectionHeader label="Overview — Main KPIs" />
          <div className="grid grid-cols-1 xl:grid-cols-[1fr_260px] gap-4">

            {/* KPI grid left */}
            <div className="space-y-3">
              {/* Row 1: totals */}
              <div className="grid grid-cols-3 gap-3">
                {kpiMap['Total Order'] && <KPICard data={kpiMap['Total Order']} />}
                {kpiMap['Total Order B2C'] && <KPICard data={kpiMap['Total Order B2C']} />}
                {kpiMap['Total Order B2B'] && <KPICard data={kpiMap['Total Order B2B']} />}
              </div>
              {/* Row 2: revenue + n° orders — alternating B2C/B2B */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                {kpiMap['Revenue B2C'] && <KPICard data={kpiMap['Revenue B2C']} />}
                {kpiMap['Revenue B2B'] && <KPICard data={kpiMap['Revenue B2B']} />}
                {kpiMap['Total Orders B2C'] && <KPICard data={kpiMap['Total Orders B2C']} />}
                {kpiMap['Total Orders B2B'] && <KPICard data={kpiMap['Total Orders B2B']} />}
              </div>
              {/* Row 3: AOV + Top3 + Pie */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                {kpiMap['AOV B2C'] && <KPICard data={kpiMap['AOV B2C']} />}
                {kpiMap['AOV B2B'] && <KPICard data={kpiMap['AOV B2B']} />}

                {/* Top 3 Prodotti */}
                <div className="kpi-card relative overflow-hidden" style={{ borderLeft: '3px solid hsl(215,85%,50%)' }}>
                  <div className="absolute top-0 left-0 right-0 h-px opacity-50" style={{ background: 'linear-gradient(90deg, hsl(215,85%,50%), transparent)' }} />
                  <div className="flex items-center gap-1.5 mb-2">
                    <Package className="w-3 h-3" style={{ color: 'hsl(215,85%,60%)' }} />
                    <p className="text-[10px] text-muted-foreground font-semibold uppercase tracking-[0.12em]">Top 3 Products</p>
                  </div>
                  <div className="space-y-1.5">
                    {top3Products.length === 0 && <p className="text-xs text-muted-foreground">No data</p>}
                    {top3Products.map((p, i) => (
                      <div key={p.sku} className="flex items-center gap-1.5">
                        <span className="text-[9px] font-bold text-muted-foreground/60 w-3 shrink-0 font-mono">{i + 1}</span>
                        <div className="flex-1 min-w-0">
                          <p className="text-[11px] font-medium text-foreground truncate">{p.name}</p>
                        </div>
                        <span className="text-xs font-bold font-mono shrink-0" style={{ color: 'hsl(215,85%,60%)' }}>{p.qty}</span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Torta B2C / B2B */}
                <div className="kpi-card relative overflow-hidden" style={{ borderLeft: '3px solid hsl(220,20%,30%)' }}>
                  <p className="text-[10px] text-muted-foreground font-semibold uppercase tracking-[0.12em] mb-2">Mix B2C / B2B</p>
                  {totalVal === 0 ? (
                    <p className="text-xs text-muted-foreground">No data</p>
                  ) : (
                    <div className="flex items-center gap-3">
                      <div className="w-14 h-14 shrink-0">
                        <ResponsiveContainer width="100%" height="100%">
                          <PieChart>
                            <Pie data={pieData} dataKey="value" cx="50%" cy="50%" innerRadius={16} outerRadius={27} strokeWidth={0}>
                              {pieData.map((entry, idx) => <Cell key={idx} fill={entry.fill} />)}
                            </Pie>
                            <ReTooltip
                              formatter={(v: number) => [`€${v.toLocaleString('it-IT', { maximumFractionDigits: 0 })}`, '']}
                              contentStyle={{ background: 'hsl(220,25%,12%)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8, fontSize: 11 }}
                            />
                          </PieChart>
                        </ResponsiveContainer>
                      </div>
                      <div className="space-y-2 min-w-0">
                        {pieData.map(d => (
                          <div key={d.name} className="flex items-center gap-1.5">
                            <div className="w-2 h-2 rounded-sm shrink-0" style={{ background: d.fill }} />
                            <span className="text-[10px] font-semibold" style={{ color: d.fill }}>{d.name}</span>
                            <span className="text-[11px] font-bold font-mono text-foreground ml-auto">
                              {((d.value / totalVal) * 100).toFixed(0)}%
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* B2C Breakdown right panel */}
            <B2CSalesBreakdown
              summary={shopifySalesSummary}
              orderCount={filteredOrders.filter(o => o.customerType === 'B2C').length}
              isLoading={isLoadingShopifySummary}
            />
          </div>
        </div>

        {/* ═══════════════════════════════════════════════════════
            ANDAMENTO ORDINI
        ═══════════════════════════════════════════════════════ */}
        <div>
          <SectionHeader label="Orders Trend" />
          <OrdersTrendChart orders={filteredOrders} allOrders={allOrders} dateRange={dateRange} />
        </div>

        {/* ═══════════════════════════════════════════════════════
            DETTAGLIO SKU — B2C poi B2B poi Combined
        ═══════════════════════════════════════════════════════ */}
        <div>
          <SectionHeader label="SKU Sales Detail" />
          {/* B2C + B2B side by side, Combined below */}
          <div className="grid grid-cols-1 xl:grid-cols-2 gap-4 mb-4">
            <B2CSkuTable data={b2cSkuData} />
            <B2BSkuTable data={b2bSkuData} />
          </div>
          <CombinedSkuTable data={combinedSkuData} />
        </div>

        {/* ═══════════════════════════════════════════════════════
            MAPPA B2C
        ═══════════════════════════════════════════════════════ */}
        <div>
          <SectionHeader label="Geographic Distribution" badge="B2C" badgeClass="badge-b2c" />
          <B2CSalesHeatmap orders={filteredOrders} dateRange={dateRange} />
        </div>

        {/* ═══════════════════════════════════════════════════════
            COLLECTION + COUNTRY
        ═══════════════════════════════════════════════════════ */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <div>
            <SectionHeader label="Sales by Collection" />
            <CollectionBreakdown orders={filteredOrders} />
          </div>
          <div>
            <SectionHeader label="Sales by Country" />
            <CountryBreakdown orders={filteredOrders} allSkus={allSkus} />
          </div>
        </div>

        {/* ═══════════════════════════════════════════════════════
            TREND VENDITE
        ═══════════════════════════════════════════════════════ */}
        <div>
          <SectionHeader label="Sales Trend Over Time" />
          <SalesTrendChart orders={filteredOrders} dateRange={dateRange} />
        </div>

        {/* ── Connection status ────────────────────────────────── */}
        <ConnectionStatus sources={dataSources} />
      </div>

      <AiAssistant dashboardContext={aiDashboardContext} />
    </div>
  );
}
