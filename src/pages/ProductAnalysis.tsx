import { useState, useMemo } from 'react';
import {
  ComposedChart, Bar, Line, XAxis, YAxis, CartesianGrid,
  Tooltip as ReTooltip, ResponsiveContainer, Legend,
} from 'recharts';
import { DashboardHeader } from '@/components/dashboard/DashboardHeader';
import { NavLink } from '@/components/NavLink';
import { DraggableNav } from '@/components/DraggableNav';
import { useShopifyOrders } from '@/hooks/useShopifyOrders';
import { useShopifySalesSummary } from '@/hooks/useShopifySalesSummary';
import { useGoogleSheetsOrders } from '@/hooks/useGoogleSheetsOrders';
import { getSkuCollection } from '@/lib/mock-data';
import { useLanguage } from '@/contexts/LanguageContext';
import { Loader2 } from 'lucide-react';

// Collection → display product name
const COLLECTION_TO_PRODUCT: Record<string, string> = {
  'Winch Handle':               'FLIPPER',
  'Blocks':                     'OLLI BLOCK',
  'Low Friction & Solid Rings': 'OLLI RING',
  'JAKE':                       'JAKE',
  'Inflatable':                 'WAY2',
  'Side products':              'SIDE PRODUCTS',
};

const PRODUCTS = [
  'FLIPPER', 'OLLI BLOCK', 'OLLI RING', 'JAKE', 'WAY2', 'SIDE PRODUCTS',
] as const;

// Color per product
const PRODUCT_COLORS: Record<string, string> = {
  'FLIPPER':       'hsl(215,85%,55%)',
  'OLLI BLOCK':    'hsl(168,70%,42%)',
  'OLLI RING':     'hsl(42,96%,48%)',
  'JAKE':          'hsl(280,65%,55%)',
  'WAY2':          'hsl(0,65%,52%)',
  'SIDE PRODUCTS': 'hsl(200,60%,45%)',
};

const B2B_OPACITY = 0.45;

const fmt = (v: number) =>
  new Intl.NumberFormat('it-IT', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(v);
const fmtK = (v: number) =>
  v >= 1000 ? `€${(v / 1000).toFixed(1)}k` : `€${Math.round(v)}`;

interface MonthRow {
  month: string;
  b2c: number;
  b2b: number;
  total: number;
  weight: number; // % of grand total for that month
}

const NAV_CLS = 'px-3.5 py-1.5 rounded-lg text-xs font-semibold bg-muted text-muted-foreground hover:text-foreground transition-colors';
const NAV_ACTIVE = 'bg-primary text-primary-foreground';

// Custom tooltip for composed chart
const CustomTooltip = ({ active, payload, label, t }: any) => {
  if (!active || !payload?.length) return null;
  const b2c = payload.find((p: any) => p.dataKey === 'b2c')?.value ?? 0;
  const b2b = payload.find((p: any) => p.dataKey === 'b2b')?.value ?? 0;
  const weight = payload.find((p: any) => p.dataKey === 'weight')?.value ?? 0;
  return (
    <div className="bg-card border border-border rounded-lg px-3 py-2 shadow-lg text-xs font-mono">
      <p className="font-bold text-foreground mb-1">{label}</p>
      {b2c > 0 && <p className="text-blue-400">B2C: {fmt(b2c)}</p>}
      {b2b > 0 && <p className="text-orange-400">B2B: {fmt(b2b)}</p>}
      <p className="text-foreground/70">Tot: {fmt(b2c + b2b)}</p>
      <p className="text-yellow-400">% {weight.toFixed(1)}%</p>
    </div>
  );
};

export default function ProductAnalysis() {
  const { t, months } = useLanguage();

  const [selectedYear, setSelectedYear] = useState(() => new Date().getFullYear());
  const [selectedCountry, setSelectedCountry] = useState<string>('all');
  const [shopifyMinDate] = useState(() => new Date('2025-01-01T00:00:00Z'));

  const { data: shopifyOrders = [], isLoading: isLoadingShopify, isFetching: isFetchingShopify, refetch: refetchShopify } = useShopifyOrders({
    limit: 250, status: 'any', createdAtMin: shopifyMinDate, enabled: true,
  });
  const { data: gsOrders = [], isLoading: isLoadingGS, isFetching: isFetchingGS, refetch: refetchGS } = useGoogleSheetsOrders(true);

  // Shopify Analytics net sales for the selected year (canonical B2C figure)
  const yearSummaryRange = useMemo(() => {
    const start = new Date(`${selectedYear}-01-01T00:00:00Z`);
    const end = new Date().getFullYear() === selectedYear
      ? new Date()
      : new Date(`${selectedYear}-12-31T23:59:59Z`);
    return { start, end };
  }, [selectedYear]);

  const { data: yearSalesSummary } = useShopifySalesSummary({
    start: yearSummaryRange.start,
    end: yearSummaryRange.end,
    enabled: true,
  });

  const allOrders = useMemo(() => [...shopifyOrders, ...gsOrders], [shopifyOrders, gsOrders]);
  const isLoading = isLoadingShopify || isLoadingGS;
  const isFetching = isFetchingShopify || isFetchingGS;

  // Extract unique countries
  const availableCountries = useMemo(() => {
    const set = new Set<string>();
    allOrders.forEach(o => {
      const c = o.customerType === 'B2C' ? (o.destinationCountry || o.country) : o.country;
      if (c) set.add(c);
    });
    return [...set].sort();
  }, [allOrders]);

  // Filtered orders by country
  const filteredOrders = useMemo(() => {
    if (selectedCountry === 'all') return allOrders;
    return allOrders.filter(o => {
      const c = o.customerType === 'B2C' ? (o.destinationCountry || o.country) : o.country;
      return c === selectedCountry;
    });
  }, [allOrders, selectedCountry]);

  // Scale factor: aligns sum(order.netAmount) to Shopify Analytics netSales (same logic as Index.tsx)
  const b2cNetScaleFactor = useMemo(() => {
    if (!yearSalesSummary?.netSales || selectedCountry !== 'all') return 1;
    const rawB2CNet = filteredOrders
      .filter(o => {
        const d = o.date instanceof Date ? o.date : new Date(o.date);
        return o.customerType === 'B2C' && d.getFullYear() === selectedYear;
      })
      .reduce((s, o) => s + (o.netAmount ?? o.totalAmount), 0);
    return rawB2CNet > 0 ? yearSalesSummary.netSales / rawB2CNet : 1;
  }, [filteredOrders, yearSalesSummary, selectedYear, selectedCountry]);

  const handleRefresh = () => { refetchShopify(); refetchGS(); };

  // Build per-product monthly data for the selected year
  const { productData, grandTotals } = useMemo(() => {
    // monthly totals per product: [product][month] = { b2c, b2b }
    const grid: Record<string, { b2c: number[]; b2b: number[] }> = {};
    PRODUCTS.forEach(p => { grid[p] = { b2c: new Array(12).fill(0), b2b: new Array(12).fill(0) }; });

    // monthly grand totals (all products combined)
    const monthTotal: number[] = new Array(12).fill(0);

    // Aggregate orders
    allOrders.forEach(order => {
      const d = order.date instanceof Date ? order.date : new Date(order.date);
      if (d.getFullYear() !== selectedYear) return;
      const mo = d.getMonth();

      const isCustom = order.orderType && order.orderType.toLowerCase() === 'custom';

      order.products.forEach(prod => {
        const collection = getSkuCollection(prod.sku);
        const product = COLLECTION_TO_PRODUCT[collection];
        if (!product) return; // skip Shipping, Other, etc.

        if (order.customerType === 'B2C') {
          // Net sales per line item: distribute order.netAmount proportionally by gross line price,
          // then scale by b2cNetScaleFactor to align with Shopify Analytics net sales (ground truth).
          const orderNet = order.netAmount ?? order.totalAmount;
          const itemsGross = order.products.reduce((s, p) => s + p.totalPrice, 0);
          const itemNet = (itemsGross > 0 ? orderNet * (prod.totalPrice / itemsGross) : 0) * b2cNetScaleFactor;
          grid[product].b2c[mo] += itemNet;
          monthTotal[mo] += itemNet;
        } else if (order.customerType === 'B2B' && !isCustom) {
          grid[product].b2b[mo] += prod.totalPrice;
          monthTotal[mo] += prod.totalPrice;
        }
      });
    });

    // Build per-product chart rows
    const productData: Record<string, MonthRow[]> = {};
    PRODUCTS.forEach(product => {
      productData[product] = months.map((label, mo) => {
        const b2c = Math.round(grid[product].b2c[mo]);
        const b2b = Math.round(grid[product].b2b[mo]);
        const total = b2c + b2b;
        const weight = monthTotal[mo] > 0 ? (total / monthTotal[mo]) * 100 : 0;
        return { month: label, b2c, b2b, total, weight };
      });
    });

    // Grand totals per product
    const grandTotals: Record<string, { b2c: number; b2b: number; total: number }> = {};
    PRODUCTS.forEach(product => {
      const b2c = Math.round(grid[product].b2c.reduce((s, v) => s + v, 0));
      const b2b = Math.round(grid[product].b2b.reduce((s, v) => s + v, 0));
      grandTotals[product] = { b2c, b2b, total: b2c + b2b };
    });

    return { productData, grandTotals };
  }, [allOrders, selectedYear, months, b2cNetScaleFactor]);

  const overallTotal = PRODUCTS.reduce((s, p) => s + grandTotals[p].total, 0);
  const overallB2C   = PRODUCTS.reduce((s, p) => s + grandTotals[p].b2c, 0);
  const overallB2B   = PRODUCTS.reduce((s, p) => s + grandTotals[p].b2b, 0);
  const topProduct   = PRODUCTS.reduce((best, p) =>
    grandTotals[p].total > grandTotals[best].total ? p : best, PRODUCTS[0]);

  const availableYears = [2025, 2026];

  return (
    <div className="min-h-screen bg-background text-foreground p-3 sm:p-4 md:p-6">
      <DashboardHeader onRefresh={handleRefresh} isLoading={isFetching} />

      <div className="max-w-[1520px] mx-auto space-y-3 sm:space-y-5">

        {/* Nav */}
        <DraggableNav />

        {/* Page title + year selector */}
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-foreground">{t('products.title')}</h1>
            <p className="text-sm text-muted-foreground mt-0.5">{t('products.subtitle')}</p>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs text-muted-foreground uppercase tracking-widest">{t('products.year')}</span>
            <div className="flex gap-1">
              {availableYears.map(y => (
                <button
                  key={y}
                  onClick={() => setSelectedYear(y)}
                  className={`px-3 py-1 rounded text-xs font-bold transition-colors ${
                    selectedYear === y
                      ? 'bg-primary text-primary-foreground'
                      : 'bg-muted text-muted-foreground hover:text-foreground'
                  }`}
                >{y}</button>
              ))}
            </div>
          </div>
        </div>

        {/* Loading */}
        {isLoading && (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="w-8 h-8 animate-spin text-primary" />
            <span className="ml-3 text-muted-foreground">{t('common.loading')}</span>
          </div>
        )}

        {!isLoading && (
          <>
            {/* KPI row */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {[
                { label: t('products.kpi.total'), value: fmt(overallTotal), color: 'hsl(215,85%,55%)' },
                { label: t('products.kpi.b2c'),   value: fmt(overallB2C),   color: 'hsl(168,70%,42%)' },
                { label: t('products.kpi.b2b'),   value: fmt(overallB2B),   color: 'hsl(42,96%,48%)' },
                { label: t('products.kpi.top'),   value: topProduct,        color: PRODUCT_COLORS[topProduct] },
              ].map(({ label, value, color }) => (
                <div key={label} className="rounded-xl border border-border/60 bg-card/80 px-4 py-3">
                  <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground leading-none">{label}</p>
                  <p className="mt-1.5 text-lg font-bold font-mono" style={{ color }}>{value}</p>
                </div>
              ))}
            </div>

            {/* Product grid */}
            <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-4">
              {PRODUCTS.map(product => {
                const color = PRODUCT_COLORS[product];
                const data = productData[product];
                const totals = grandTotals[product];
                const hasData = totals.total > 0;
                const avgWeight = overallTotal > 0 ? (totals.total / overallTotal) * 100 : 0;

                return (
                  <div
                    key={product}
                    className="rounded-xl border border-border/60 bg-card/80 backdrop-blur-sm p-4 flex flex-col gap-3"
                  >
                    {/* Card header */}
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <div className="w-2.5 h-2.5 rounded-full" style={{ background: color }} />
                        <span className="text-sm font-bold text-foreground font-mono">{product}</span>
                      </div>
                      {hasData && (
                        <div className="flex gap-3 text-right">
                          <div>
                            <p className="text-[9px] text-muted-foreground uppercase tracking-wider leading-none">{t('products.total_revenue')}</p>
                            <p className="text-sm font-bold font-mono" style={{ color }}>{fmtK(totals.total)}</p>
                          </div>
                          <div>
                            <p className="text-[9px] text-muted-foreground uppercase tracking-wider leading-none">{t('products.avg_weight')}</p>
                            <p className="text-sm font-bold font-mono text-yellow-400">{avgWeight.toFixed(1)}%</p>
                          </div>
                        </div>
                      )}
                    </div>

                    {/* B2C / B2B sub-totals */}
                    {hasData && (
                      <div className="flex gap-4 text-xs font-mono text-muted-foreground">
                        <span><span className="text-blue-400 font-semibold">B2C</span> {fmtK(totals.b2c)}</span>
                        <span><span className="text-orange-400 font-semibold">B2B</span> {fmtK(totals.b2b)}</span>
                      </div>
                    )}

                    {!hasData ? (
                      <div className="flex items-center justify-center h-32 text-muted-foreground text-sm">
                        {t('products.no_data')}
                      </div>
                    ) : (
                      <ResponsiveContainer width="100%" height={160}>
                        <ComposedChart data={data} margin={{ top: 4, right: 20, bottom: 0, left: 0 }}>
                          <CartesianGrid strokeDasharray="3 3" stroke="hsl(220,15%,16%)" vertical={false} />
                          <XAxis
                            dataKey="month"
                            tick={{ fontSize: 9, fill: 'hsl(215,20%,55%)' }}
                            axisLine={false}
                            tickLine={false}
                          />
                          <YAxis
                            yAxisId="revenue"
                            orientation="left"
                            tick={{ fontSize: 9, fill: 'hsl(215,20%,55%)' }}
                            axisLine={false}
                            tickLine={false}
                            tickFormatter={v => v >= 1000 ? `${(v / 1000).toFixed(0)}k` : String(v)}
                            width={32}
                          />
                          <YAxis
                            yAxisId="pct"
                            orientation="right"
                            tick={{ fontSize: 9, fill: 'hsl(42,80%,60%)' }}
                            axisLine={false}
                            tickLine={false}
                            tickFormatter={v => `${v.toFixed(0)}%`}
                            domain={[0, 'auto']}
                            width={30}
                          />
                          <ReTooltip content={<CustomTooltip t={t} />} />
                          <Bar
                            yAxisId="revenue"
                            dataKey="b2c"
                            name="B2C"
                            stackId="rev"
                            fill={color}
                            radius={[0, 0, 0, 0]}
                          />
                          <Bar
                            yAxisId="revenue"
                            dataKey="b2b"
                            name="B2B"
                            stackId="rev"
                            fill={color}
                            opacity={B2B_OPACITY}
                            radius={[3, 3, 0, 0]}
                          />
                          <Line
                            yAxisId="pct"
                            dataKey="weight"
                            name="% peso"
                            type="monotone"
                            stroke="hsl(42,96%,55%)"
                            strokeWidth={1.5}
                            dot={{ r: 2, fill: 'hsl(42,96%,55%)', strokeWidth: 0 }}
                            activeDot={{ r: 4 }}
                          />
                        </ComposedChart>
                      </ResponsiveContainer>
                    )}
                  </div>
                );
              })}
            </div>

            {/* Summary table */}
            <div className="rounded-xl border border-border/60 bg-card/80 backdrop-blur-sm overflow-hidden">
              <div className="px-5 py-3 border-b border-border/40">
                <h2 className="text-sm font-semibold text-foreground">{t('products.title')} — {selectedYear}</h2>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="border-b border-border/30">
                      <th className="text-left px-4 py-2 text-muted-foreground font-medium">Prodotto</th>
                      <th className="text-right px-4 py-2 text-muted-foreground font-medium">{t('products.b2c_revenue')}</th>
                      <th className="text-right px-4 py-2 text-muted-foreground font-medium">{t('products.b2b_revenue')}</th>
                      <th className="text-right px-4 py-2 text-muted-foreground font-medium">{t('products.total_revenue')}</th>
                      <th className="text-right px-4 py-2 text-muted-foreground font-medium">% tot.</th>
                    </tr>
                  </thead>
                  <tbody>
                    {PRODUCTS.map(product => {
                      const color = PRODUCT_COLORS[product];
                      const totals = grandTotals[product];
                      const pct = overallTotal > 0 ? (totals.total / overallTotal) * 100 : 0;
                      return (
                        <tr key={product} className="border-b border-border/20 hover:bg-muted/30 transition-colors">
                          <td className="px-4 py-2">
                            <div className="flex items-center gap-2">
                              <div className="w-2 h-2 rounded-full" style={{ background: color }} />
                              <span className="font-mono font-semibold text-foreground">{product}</span>
                            </div>
                          </td>
                          <td className="px-4 py-2 text-right font-mono text-blue-400">{fmt(totals.b2c)}</td>
                          <td className="px-4 py-2 text-right font-mono text-orange-400">{fmt(totals.b2b)}</td>
                          <td className="px-4 py-2 text-right font-mono font-bold text-foreground">{fmt(totals.total)}</td>
                          <td className="px-4 py-2 text-right font-mono text-yellow-400">{pct.toFixed(1)}%</td>
                        </tr>
                      );
                    })}
                    <tr className="bg-muted/20">
                      <td className="px-4 py-2 font-bold text-foreground">{t('products.total_revenue')}</td>
                      <td className="px-4 py-2 text-right font-mono font-bold text-blue-400">{fmt(overallB2C)}</td>
                      <td className="px-4 py-2 text-right font-mono font-bold text-orange-400">{fmt(overallB2B)}</td>
                      <td className="px-4 py-2 text-right font-mono font-bold text-foreground">{fmt(overallTotal)}</td>
                      <td className="px-4 py-2 text-right font-mono text-yellow-400">100%</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
