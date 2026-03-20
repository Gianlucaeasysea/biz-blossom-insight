import { useState, useMemo, useCallback } from 'react';
import { DraggableNav } from '@/components/DraggableNav';
import { format, subDays, startOfYear } from 'date-fns';
import { it } from 'date-fns/locale';
import { enUS } from 'date-fns/locale';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell, LineChart, Line, Legend } from 'recharts';
import ReactMarkdown from 'react-markdown';
import { DashboardHeader } from '@/components/dashboard/DashboardHeader';
import { NavLink } from '@/components/NavLink';
import { useLanguage } from '@/contexts/LanguageContext';
import { useShopifyOrders } from '@/hooks/useShopifyOrders';
import { Order } from '@/types/analytics';
import { Globe, Sparkles, Loader2, TrendingUp, Calendar as CalendarIcon, Ship, Anchor, ChevronDown, Package } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';

// ── Country normalizer ──
const COUNTRY_MAP: Record<string, string> = {
  'IT':'Italia','FR':'Francia','DE':'Germania','ES':'Spagna','GB':'Regno Unito',
  'UK':'Regno Unito','US':'Stati Uniti','USA':'Stati Uniti',
  'CH':'Svizzera','NL':'Paesi Bassi','BE':'Belgio','AT':'Austria',
  'PT':'Portogallo','SE':'Svezia','NO':'Norvegia','DK':'Danimarca',
  'FI':'Finlandia','PL':'Polonia','CZ':'Rep. Ceca','HU':'Ungheria',
  'GR':'Grecia','HR':'Croazia','SI':'Slovenia','TR':'Turchia',
  'IE':'Irlanda','MT':'Malta','CY':'Cipro','LU':'Lussemburgo',
  'EE':'Estonia','LV':'Lettonia','LT':'Lituania',
  'Italia':'Italia','Italy':'Italia','France':'Francia','Germany':'Germania',
  'Deutschland':'Germania','Spain':'Spagna','España':'Spagna',
  'United Kingdom':'Regno Unito','Switzerland':'Svizzera','Suisse':'Svizzera',
  'Netherlands':'Paesi Bassi','Belgium':'Belgio','Austria':'Austria',
  'Portugal':'Portogallo','Sweden':'Svezia','Norway':'Norvegia',
  'Denmark':'Danimarca','Finland':'Finlandia','Poland':'Polonia',
  'Greece':'Grecia','Croatia':'Croazia','Slovenia':'Slovenia',
  'Turkey':'Turchia','Ireland':'Irlanda','Malta':'Malta','Cyprus':'Cipro',
  'Australia':'Australia','AU':'Australia','Canada':'Canada','CA':'Canada',
  'New Zealand':'Nuova Zelanda','NZ':'Nuova Zelanda',
  'United Arab Emirates':'Emirati Arabi','AE':'Emirati Arabi',
};
function normalizeCountry(raw: string): string {
  if (!raw?.trim()) return 'Unknown';
  const t = raw.trim();
  return COUNTRY_MAP[t] || COUNTRY_MAP[t.toUpperCase()] || t;
}

const MONTHS_IT = ['Gen','Feb','Mar','Apr','Mag','Giu','Lug','Ago','Set','Ott','Nov','Dic'];

// Sailing season by country group
const SEASON_DATA: Record<string, { nav: number[]; buy: number[] }> = {
  'Italia':       { nav: [4,5,6,7,8,9,10],   buy: [2,3,4,10,11,12] },
  'Francia':      { nav: [4,5,6,7,8,9,10],   buy: [2,3,4,10,11,12] },
  'Spagna':       { nav: [4,5,6,7,8,9,10],   buy: [2,3,4,10,11,12] },
  'Grecia':       { nav: [4,5,6,7,8,9,10],   buy: [2,3,4,10,11,12] },
  'Croazia':      { nav: [4,5,6,7,8,9,10],   buy: [2,3,4,10,11,12] },
  'Germania':     { nav: [5,6,7,8,9],         buy: [3,4,5,9,10,11] },
  'Paesi Bassi':  { nav: [5,6,7,8,9],         buy: [3,4,5,9,10,11] },
  'Regno Unito':  { nav: [5,6,7,8,9],         buy: [3,4,5,9,10,11] },
  'Svezia':       { nav: [5,6,7,8,9],         buy: [3,4,5,9,10,11] },
  'Norvegia':     { nav: [5,6,7,8,9],         buy: [3,4,5,9,10,11] },
  'Danimarca':    { nav: [5,6,7,8,9],         buy: [3,4,5,9,10,11] },
  'Portogallo':   { nav: [5,6,7,8,9,10],      buy: [3,4,5,10,11] },
  'Svizzera':     { nav: [5,6,7,8,9],         buy: [3,4,5,9,10,11] },
  'Australia':    { nav: [10,11,12,1,2,3],    buy: [8,9,10,3,4,5] },
};
const DEFAULT_SEASON = { nav: [4,5,6,7,8,9,10], buy: [2,3,4,10,11,12] };

const fmt = (v: number) => new Intl.NumberFormat('it-IT', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(v);

interface CountryMonthly { month: string; netSales: number; orders: number; monthNum: number; }
interface CountryAgg { country: string; netSales: number; orders: number; pct: number; monthly: CountryMonthly[]; }
interface ProductByCountry { product: string; sku: string; countries: Record<string, { qty: number; netSales: number }>; totalQty: number; totalNetSales: number; }

export default function GeoInsights() {
  const { t } = useLanguage();
  // ── Date range state ──
  const [dateRange, setDateRange] = useState<{ start: Date; end: Date }>({
    start: startOfYear(new Date()),
    end: new Date(),
  });
  const [calendarOpen, setCalendarOpen] = useState(false);

  const presets = [
    { label: 'YTD', fn: () => ({ start: startOfYear(new Date()), end: new Date() }) },
    { label: '30g', fn: () => ({ start: subDays(new Date(), 30), end: new Date() }) },
    { label: '90g', fn: () => ({ start: subDays(new Date(), 90), end: new Date() }) },
    { label: '6m', fn: () => ({ start: subDays(new Date(), 180), end: new Date() }) },
    { label: '1a', fn: () => ({ start: subDays(new Date(), 365), end: new Date() }) },
    { label: 'Tutto', fn: () => ({ start: new Date('2024-01-01'), end: new Date() }) },
  ];

  const { data: shopifyOrders = [], isLoading, refetch, isFetching } = useShopifyOrders({
    limit: 250,
    status: 'any',
    createdAtMin: dateRange.start,
    createdAtMax: dateRange.end,
    enabled: true,
  });

  const [aiInsight, setAiInsight] = useState('');
  const [aiLoading, setAiLoading] = useState(false);
  const [selectedCountry, setSelectedCountry] = useState<string | null>(null);

  // ── Aggregate B2C orders by country & month ──
  const { countryData, totalNetSales, monthlyAll } = useMemo(() => {
    const byCountry: Record<string, { netSales: number; orders: number; monthly: Record<number, { netSales: number; orders: number }> }> = {};
    let total = 0;

    shopifyOrders.forEach(order => {
      if (order.customerType !== 'B2C') return;
      const ns = order.netAmount ?? order.totalAmount;
      const country = normalizeCountry(order.destinationCountry || order.country || '');
      if (country === 'Unknown') return;

      if (!byCountry[country]) byCountry[country] = { netSales: 0, orders: 0, monthly: {} };
      byCountry[country].netSales += ns;
      byCountry[country].orders++;
      total += ns;

      const d = order.date instanceof Date ? order.date : new Date(order.date);
      const m = d.getMonth() + 1;
      if (!byCountry[country].monthly[m]) byCountry[country].monthly[m] = { netSales: 0, orders: 0 };
      byCountry[country].monthly[m].netSales += ns;
      byCountry[country].monthly[m].orders++;
    });

    const data: CountryAgg[] = Object.entries(byCountry)
      .map(([country, v]) => ({
        country,
        netSales: v.netSales,
        orders: v.orders,
        pct: total > 0 ? (v.netSales / total) * 100 : 0,
        monthly: Array.from({ length: 12 }, (_, i) => ({
          month: MONTHS_IT[i],
          monthNum: i + 1,
          netSales: v.monthly[i + 1]?.netSales ?? 0,
          orders: v.monthly[i + 1]?.orders ?? 0,
        })),
      }))
      .sort((a, b) => b.netSales - a.netSales);

    const mAll = Array.from({ length: 12 }, (_, i) => ({
      month: MONTHS_IT[i],
      monthNum: i + 1,
      netSales: data.reduce((s, c) => s + (c.monthly[i]?.netSales ?? 0), 0),
      orders: data.reduce((s, c) => s + (c.monthly[i]?.orders ?? 0), 0),
    }));

    return { countryData: data, totalNetSales: total, monthlyAll: mAll };
  }, [shopifyOrders]);

  // ── Product breakdown by country ──
  const { productData, topCountriesForProducts } = useMemo(() => {
    const byProduct: Record<string, { sku: string; countries: Record<string, { qty: number; netSales: number }> }> = {};
    const countriesSet = new Set<string>();

    shopifyOrders.forEach(order => {
      if (order.customerType !== 'B2C') return;
      const country = normalizeCountry(order.destinationCountry || order.country || '');
      if (country === 'Unknown') return;
      countriesSet.add(country);

      order.products?.forEach(p => {
        const key = p.sku || p.name;
        if (!byProduct[key]) byProduct[key] = { sku: p.sku, countries: {} };
        if (!byProduct[key].countries[country]) byProduct[key].countries[country] = { qty: 0, netSales: 0 };
        byProduct[key].countries[country].qty += p.quantity;
        byProduct[key].countries[country].netSales += p.totalPrice;
      });
    });

    const products: ProductByCountry[] = Object.entries(byProduct)
      .map(([product, v]) => ({
        product,
        sku: v.sku,
        countries: v.countries,
        totalQty: Object.values(v.countries).reduce((s, c) => s + c.qty, 0),
        totalNetSales: Object.values(v.countries).reduce((s, c) => s + c.netSales, 0),
      }))
      .filter(p => p.totalQty > 0)
      .sort((a, b) => b.totalNetSales - a.totalNetSales);

    // Top countries by total product sales
    const countryTotals: Record<string, number> = {};
    products.forEach(p => {
      Object.entries(p.countries).forEach(([c, v]) => {
        countryTotals[c] = (countryTotals[c] || 0) + v.netSales;
      });
    });
    const topC = Object.entries(countryTotals)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 8)
      .map(([c]) => c);

    return { productData: products, topCountriesForProducts: topC };
  }, [shopifyOrders]);

  // ── Product concentration by country (which products are disproportionately popular) ──
  const productConcentration = useMemo(() => {
    if (productData.length === 0 || topCountriesForProducts.length === 0) return [];

    return topCountriesForProducts.map(country => {
      const countryProducts = productData
        .filter(p => p.countries[country]?.qty > 0)
        .map(p => {
          const countryShare = p.totalQty > 0 ? (p.countries[country].qty / p.totalQty) * 100 : 0;
          const countryRevShare = p.totalNetSales > 0 ? (p.countries[country].netSales / p.totalNetSales) * 100 : 0;
          // Country's share of total B2C - if product share > country avg, it's over-indexed
          const countryAvgShare = countryData.find(c => c.country === country)?.pct ?? 0;
          const indexScore = countryAvgShare > 0 ? countryShare / countryAvgShare : 0;
          return {
            product: p.product,
            sku: p.sku,
            qty: p.countries[country].qty,
            netSales: p.countries[country].netSales,
            countryShare,
            indexScore, // >1 means over-represented
          };
        })
        .sort((a, b) => b.netSales - a.netSales);

      return { country, products: countryProducts };
    });
  }, [productData, topCountriesForProducts, countryData]);

  const activeCountry = selectedCountry ? countryData.find(c => c.country === selectedCountry) : null;
  const season = activeCountry ? (SEASON_DATA[activeCountry.country] || DEFAULT_SEASON) : DEFAULT_SEASON;

  // ── AI analysis ──
  const generateInsights = useCallback(async () => {
    if (countryData.length === 0) return;
    setAiLoading(true);
    setAiInsight('');

    const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
    const anonKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

    try {
      const resp = await fetch(`${supabaseUrl}/functions/v1/geo-insights`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${anonKey}`,
          'apikey': anonKey,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          countryData: countryData.slice(0, 15),
          totalNetSales,
          productByCountry: productConcentration.slice(0, 8).map(c => ({
            country: c.country,
            topProducts: c.products.slice(0, 10).map(p => ({
              product: p.product,
              qty: p.qty,
              netSales: p.netSales,
              indexScore: p.indexScore,
            })),
          })),
        }),
      });

      if (!resp.ok) {
        const err = await resp.json().catch(() => ({}));
        throw new Error(err.error || `HTTP ${resp.status}`);
      }

      const reader = resp.body?.getReader();
      if (!reader) throw new Error('No stream');
      const decoder = new TextDecoder();
      let buffer = '';
      let accumulated = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });

        let nlIdx: number;
        while ((nlIdx = buffer.indexOf('\n')) !== -1) {
          let line = buffer.slice(0, nlIdx);
          buffer = buffer.slice(nlIdx + 1);
          if (line.endsWith('\r')) line = line.slice(0, -1);
          if (!line.startsWith('data: ')) continue;
          const jsonStr = line.slice(6).trim();
          if (jsonStr === '[DONE]') break;
          try {
            const parsed = JSON.parse(jsonStr);
            const content = parsed.choices?.[0]?.delta?.content;
            if (content) {
              accumulated += content;
              setAiInsight(accumulated);
            }
          } catch { /* partial */ }
        }
      }
    } catch (e) {
      console.error('geo-insights error:', e);
      setAiInsight(`❌ Errore: ${e instanceof Error ? e.message : 'Sconosciuto'}`);
    } finally {
      setAiLoading(false);
    }
  }, [countryData, totalNetSales, productConcentration]);

  // ── Seasonality heatmap data ──
  const heatmapData = useMemo(() => {
    const top = countryData.slice(0, 8);
    return MONTHS_IT.map((month, mIdx) => {
      const row: any = { month };
      top.forEach(c => {
        const totalC = c.monthly.reduce((s, m) => s + m.netSales, 0);
        row[c.country] = totalC > 0 ? ((c.monthly[mIdx]?.netSales ?? 0) / totalC * 100) : 0;
      });
      return row;
    });
  }, [countryData]);

  const topCountries = countryData.slice(0, 8);
  const COLORS = [
    'hsl(var(--chart-1))', 'hsl(var(--chart-2))', 'hsl(var(--chart-3))',
    'hsl(var(--chart-4))', 'hsl(var(--chart-5))', 'hsl(var(--b2c))',
    'hsl(var(--b2b))', 'hsl(var(--success))',
  ];

  // Active country product detail
  const activeCountryProducts = selectedCountry
    ? productConcentration.find(c => c.country === selectedCountry)
    : null;

  return (
    <div className="min-h-screen bg-background p-3 sm:p-4 md:p-6">
      <div className="max-w-[1520px] mx-auto space-y-3 sm:space-y-5">

        {/* Header */}
        <DashboardHeader onRefresh={() => refetch()} isLoading={isFetching} />

        {/* Nav */}
        <DraggableNav />

        {/* Page title + Date range */}
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-primary/10 border border-primary/20">
              <Globe className="w-5 h-5 text-primary" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-foreground">{t('geo.title')}</h2>
              <p className="text-xs text-muted-foreground">{t('geo.subtitle')}</p>
            </div>
          </div>

          {/* ── Date Range Selector ── */}
          <div className="flex flex-wrap items-center gap-2">
            {/* Quick presets */}
            <div className="flex rounded-md bg-muted p-0.5">
              {presets.map(p => (
                <button
                  key={p.label}
                  onClick={() => setDateRange(p.fn())}
                  className="px-2.5 py-1.5 text-xs text-muted-foreground hover:text-foreground rounded transition-colors"
                >
                  {p.label}
                </button>
              ))}
            </div>

            {/* Calendar picker */}
            <Popover open={calendarOpen} onOpenChange={setCalendarOpen}>
              <PopoverTrigger asChild>
                <Button variant="ghost" size="sm" className="text-xs text-muted-foreground hover:text-foreground gap-1.5">
                  <CalendarIcon className="w-3.5 h-3.5" />
                  {format(dateRange.start, 'dd MMM', { locale: enUS })} – {format(dateRange.end, 'dd MMM yy', { locale: enUS })}
                  <ChevronDown className="w-3 h-3" />
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0 bg-popover border-border" align="end">
                <div className="flex">
                  <div className="border-r border-border">
                    <Calendar
                      mode="single"
                      selected={dateRange.start}
                      onSelect={date => date && setDateRange(prev => ({ ...prev, start: date }))}
                      locale={enUS}
                      className="p-3 pointer-events-auto"
                    />
                  </div>
                  <Calendar
                    mode="single"
                    selected={dateRange.end}
                    onSelect={date => date && setDateRange(prev => ({ ...prev, end: date }))}
                    locale={enUS}
                    className="p-3 pointer-events-auto"
                  />
                </div>
              </PopoverContent>
            </Popover>
          </div>
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="w-6 h-6 animate-spin text-primary" />
          </div>
        ) : (
          <>
            {/* ── KPI row ── */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div className="glass-card p-4">
                <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1">Net Sales B2C</p>
                <p className="text-xl font-bold text-foreground">{fmt(totalNetSales)}</p>
              </div>
              <div className="glass-card p-4">
                <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1">{t('geo.kpi.countries')}</p>
                <p className="text-xl font-bold text-foreground">{countryData.length}</p>
              </div>
              <div className="glass-card p-4">
                <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1">{t('geo.kpi.top_country')}</p>
                <p className="text-xl font-bold text-foreground">{countryData[0]?.country ?? '—'}</p>
                <p className="text-[10px] text-muted-foreground">{countryData[0] ? `${countryData[0].pct.toFixed(1)}%` : ''}</p>
              </div>
              <div className="glass-card p-4">
                <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1">{t('geo.kpi.products')}</p>
                <p className="text-xl font-bold text-foreground">{productData.length}</p>
              </div>
            </div>

            {/* ── Bar chart: Net Sales by Country ── */}
            <div className="glass-card p-4">
              <h3 className="text-sm font-semibold mb-3 flex items-center gap-2">
                <TrendingUp className="w-4 h-4 text-primary" />
                {t('geo.section.by_country')}
              </h3>
              <div className="h-[300px]">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={countryData.slice(0, 12)} layout="vertical" margin={{ left: 80, right: 20 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                    <XAxis type="number" tickFormatter={(v) => `€${(v / 1000).toFixed(0)}k`} tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 10 }} />
                    <YAxis dataKey="country" type="category" tick={{ fill: 'hsl(var(--foreground))', fontSize: 11 }} width={75} />
                    <Tooltip formatter={(v: number) => fmt(v)} contentStyle={{ background: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: 8, fontSize: 12 }} />
                    <Bar dataKey="netSales" radius={[0, 4, 4, 0]} cursor="pointer" onClick={(d) => setSelectedCountry(d.country)}>
                      {countryData.slice(0, 12).map((_, i) => (
                        <Cell key={i} fill={i < COLORS.length ? COLORS[i] : 'hsl(var(--muted-foreground))'} opacity={selectedCountry && countryData[i]?.country !== selectedCountry ? 0.3 : 1} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
              {selectedCountry && (
                <button onClick={() => setSelectedCountry(null)} className="mt-2 text-xs text-primary hover:underline">
                  ✕ Deseleziona {selectedCountry}
                </button>
              )}
            </div>

            {/* ── Seasonal Heatmap ── */}
            <div className="glass-card p-4">
              <h3 className="text-sm font-semibold mb-3 flex items-center gap-2">
                <CalendarIcon className="w-4 h-4 text-accent" />
                {t('geo.section.heatmap')}
              </h3>
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="border-b border-border/30">
                      <th className="py-2 px-2 text-left text-muted-foreground font-medium">Paese</th>
                      {MONTHS_IT.map(m => (
                        <th key={m} className="py-2 px-1 text-center text-muted-foreground font-medium w-12">{m}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {topCountries.map(c => {
                      const s = SEASON_DATA[c.country] || DEFAULT_SEASON;
                      const totalC = c.monthly.reduce((sum, m) => sum + m.netSales, 0);
                      return (
                        <tr key={c.country} className="border-b border-border/10 hover:bg-muted/20 cursor-pointer" onClick={() => setSelectedCountry(c.country)}>
                          <td className="py-2 px-2 font-medium text-foreground whitespace-nowrap">
                            {c.country}
                            <span className="text-muted-foreground ml-1">({fmt(c.netSales)})</span>
                          </td>
                          {c.monthly.map((m, mIdx) => {
                            const pct = totalC > 0 ? (m.netSales / totalC) * 100 : 0;
                            const isNav = s.nav.includes(mIdx + 1);
                            const isBuy = s.buy.includes(mIdx + 1);
                            const intensity = Math.min(pct / 25, 1);
                            return (
                              <td key={mIdx} className="py-1 px-0.5 text-center relative">
                                <div
                                  className="rounded-md mx-auto w-10 h-8 flex flex-col items-center justify-center text-[10px] font-mono relative"
                                  style={{ backgroundColor: `hsl(var(--primary) / ${0.05 + intensity * 0.6})` }}
                                >
                                  <span className={`font-semibold ${pct > 15 ? 'text-primary-foreground' : 'text-foreground'}`}>
                                    {pct > 0 ? `${pct.toFixed(0)}%` : '–'}
                                  </span>
                                </div>
                                <div className="flex gap-0.5 justify-center mt-0.5">
                                  {isNav && <span className="w-1.5 h-1.5 rounded-full bg-blue-400" title="Navigazione" />}
                                  {isBuy && <span className="w-1.5 h-1.5 rounded-full bg-amber-400" title="Rimessaggio/Acquisto" />}
                                </div>
                              </td>
                            );
                          })}
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
                <div className="flex items-center gap-4 mt-3 text-[10px] text-muted-foreground">
                  <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-blue-400 inline-block" /> Stagione navigazione</span>
                  <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-amber-400 inline-block" /> Finestra acquisto (pre/post stagione)</span>
                </div>
              </div>
            </div>

            {/* ── Country detail: monthly trend ── */}
            {activeCountry && (
              <div className="glass-card p-4">
                <h3 className="text-sm font-semibold mb-3 flex items-center gap-2">
                  <Ship className="w-4 h-4 text-b2c" />
                  {activeCountry.country} — Trend mensile vs Stagione Nautica
                </h3>
                <div className="h-[250px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={activeCountry.monthly}>
                      <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                      <XAxis dataKey="month" tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 10 }} />
                      <YAxis tickFormatter={(v) => `€${v}`} tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 10 }} />
                      <Tooltip formatter={(v: number) => fmt(v)} contentStyle={{ background: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: 8, fontSize: 12 }} />
                      <Bar dataKey="netSales" name="Net Sales" radius={[4, 4, 0, 0]}>
                        {activeCountry.monthly.map((m, i) => {
                          const isNav = season.nav.includes(m.monthNum);
                          const isBuy = season.buy.includes(m.monthNum);
                          const color = isNav ? 'hsl(210, 80%, 55%)' : isBuy ? 'hsl(38, 90%, 50%)' : 'hsl(var(--muted-foreground) / 0.3)';
                          return <Cell key={i} fill={color} />;
                        })}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
                <div className="flex items-center gap-4 mt-2 text-[10px] text-muted-foreground">
                  <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded" style={{ background: 'hsl(210,80%,55%)' }} /> Mesi di navigazione</span>
                  <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded" style={{ background: 'hsl(38,90%,50%)' }} /> Finestra acquisto</span>
                  <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded" style={{ background: 'hsl(var(--muted-foreground) / 0.3)' }} /> Bassa stagione</span>
                </div>
              </div>
            )}

            {/* ── Country detail: product breakdown ── */}
            {activeCountryProducts && (
              <div className="glass-card p-4">
                <h3 className="text-sm font-semibold mb-3 flex items-center gap-2">
                  <Package className="w-4 h-4 text-primary" />
                  {selectedCountry} — Prodotti più venduti
                </h3>
                <div className="overflow-x-auto">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="border-b border-border/30">
                        <th className="py-2 px-2 text-left text-muted-foreground font-medium">Prodotto</th>
                        <th className="py-2 px-2 text-right text-muted-foreground font-medium">Qtà</th>
                        <th className="py-2 px-2 text-right text-muted-foreground font-medium">Net Sales</th>
                        <th className="py-2 px-2 text-right text-muted-foreground font-medium">% Paese</th>
                        <th className="py-2 px-2 text-right text-muted-foreground font-medium">Indice</th>
                      </tr>
                    </thead>
                    <tbody>
                      {activeCountryProducts.products.slice(0, 20).map((p, i) => (
                        <tr key={i} className="border-b border-border/10 hover:bg-muted/20">
                          <td className="py-2 px-2 text-foreground font-medium max-w-[300px] truncate" title={p.product}>{p.product}</td>
                          <td className="py-2 px-2 text-right text-muted-foreground">{p.qty}</td>
                          <td className="py-2 px-2 text-right font-mono text-foreground">{fmt(p.netSales)}</td>
                          <td className="py-2 px-2 text-right text-muted-foreground">{p.countryShare.toFixed(1)}%</td>
                          <td className="py-2 px-2 text-right">
                            <span className={`font-semibold ${p.indexScore > 1.3 ? 'text-green-400' : p.indexScore < 0.7 ? 'text-red-400' : 'text-muted-foreground'}`}>
                              {p.indexScore.toFixed(2)}x
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  <p className="text-[10px] text-muted-foreground mt-2">
                    <strong>Indice</strong>: rapporto tra la quota di vendita del prodotto in questo paese e la quota media del paese sul totale B2C.
                    <span className="text-green-400 ml-1">&gt;1.3x = sovra-rappresentato</span>,
                    <span className="text-red-400 ml-1">&lt;0.7x = sotto-rappresentato</span>
                  </p>
                </div>
              </div>
            )}

            {/* ── Product × Country Matrix (top products across top countries) ── */}
            <div className="glass-card p-4">
              <h3 className="text-sm font-semibold mb-3 flex items-center gap-2">
                <Package className="w-4 h-4 text-accent" />
                {t('geo.section.matrix')}
              </h3>
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="border-b border-border/30">
                      <th className="py-2 px-2 text-left text-muted-foreground font-medium min-w-[180px]">Prodotto</th>
                      <th className="py-2 px-2 text-right text-muted-foreground font-medium">Totale</th>
                      {topCountriesForProducts.map(c => (
                        <th key={c} className="py-2 px-2 text-center text-muted-foreground font-medium min-w-[70px]">{c}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {productData.slice(0, 15).map((p, pi) => {
                      const maxCountrySales = Math.max(...topCountriesForProducts.map(c => p.countries[c]?.netSales ?? 0), 1);
                      return (
                        <tr key={pi} className="border-b border-border/10 hover:bg-muted/20">
                          <td className="py-2 px-2 text-foreground font-medium max-w-[250px] truncate" title={p.product}>{p.product}</td>
                          <td className="py-2 px-2 text-right font-mono text-foreground">{fmt(p.totalNetSales)}</td>
                          {topCountriesForProducts.map(c => {
                            const val = p.countries[c]?.netSales ?? 0;
                            const intensity = maxCountrySales > 0 ? Math.min(val / maxCountrySales, 1) : 0;
                            return (
                              <td key={c} className="py-1 px-1 text-center">
                                <div
                                  className="rounded mx-auto w-full h-7 flex items-center justify-center text-[10px] font-mono"
                                  style={{ backgroundColor: val > 0 ? `hsl(var(--primary) / ${0.08 + intensity * 0.55})` : 'transparent' }}
                                >
                                  <span className={val > 0 ? (intensity > 0.5 ? 'text-primary-foreground font-semibold' : 'text-foreground') : 'text-muted-foreground/30'}>
                                    {val > 0 ? `€${(val / 1000).toFixed(val >= 1000 ? 1 : 2)}k` : '–'}
                                  </span>
                                </div>
                              </td>
                            );
                          })}
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>

            {/* ── Multi-country monthly trend ── */}
            <div className="glass-card p-4">
              <h3 className="text-sm font-semibold mb-3 flex items-center gap-2">
                <Anchor className="w-4 h-4 text-muted-foreground" />
                {t('geo.section.seasonal')}
              </h3>
              <div className="h-[300px]">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={heatmapData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                    <XAxis dataKey="month" tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 10 }} />
                    <YAxis tickFormatter={(v) => `${v}%`} tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 10 }} />
                    <Tooltip contentStyle={{ background: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: 8, fontSize: 11 }} formatter={(v: number) => `${v.toFixed(1)}%`} />
                    <Legend wrapperStyle={{ fontSize: 10 }} />
                    {topCountries.slice(0, 6).map((c, i) => (
                      <Line key={c.country} type="monotone" dataKey={c.country} stroke={COLORS[i]} strokeWidth={2} dot={{ r: 3 }} />
                    ))}
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* ── AI Insight ── */}
            <div className="glass-card p-4">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-sm font-semibold flex items-center gap-2">
                  <Sparkles className="w-4 h-4 text-accent" />
                  {t('geo.section.ai')}
                </h3>
                <button
                  onClick={generateInsights}
                  disabled={aiLoading || countryData.length === 0}
                  className="px-4 py-1.5 rounded-lg text-xs font-semibold bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-50 transition-colors flex items-center gap-1.5"
                >
                  {aiLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5" />}
                  {aiLoading ? t('geo.btn.generating') : t('geo.btn.generate')}
                </button>
              </div>

              {aiInsight ? (
                <div className="prose prose-sm prose-invert max-w-none text-sm leading-relaxed">
                  <ReactMarkdown>{aiInsight}</ReactMarkdown>
                </div>
              ) : (
                <div className="text-center py-10 text-muted-foreground text-xs">
                  <Sparkles className="w-8 h-8 mx-auto mb-3 opacity-30" />
                  <p>Clicca "Genera Analisi" per ottenere insight AI sulla stagionalità di vendita,</p>
                  <p>analisi prodotti per paese e raccomandazioni strategiche.</p>
                </div>
              )}
            </div>

            {/* ── Country table ── */}
            <div className="glass-card p-4">
              <h3 className="text-sm font-semibold mb-3">{t('geo.section.detail')}</h3>
              <div className="overflow-x-auto">
                <table className="data-table w-full">
                  <thead>
                    <tr>
                      <th className="text-left">Paese</th>
                      <th className="text-right">Net Sales</th>
                      <th className="text-right">Ordini</th>
                      <th className="text-right">% Tot</th>
                      <th className="text-right">Avg Ordine</th>
                      <th className="text-left">Stagione Nav.</th>
                    </tr>
                  </thead>
                  <tbody>
                    {countryData.map(c => {
                      const s = SEASON_DATA[c.country] || DEFAULT_SEASON;
                      const navLabel = s.nav.length > 0 ? `${MONTHS_IT[s.nav[0] - 1]}–${MONTHS_IT[s.nav[s.nav.length - 1] - 1]}` : '—';
                      return (
                        <tr key={c.country} className="cursor-pointer hover:bg-muted/20" onClick={() => setSelectedCountry(c.country)}>
                          <td className="font-medium">{c.country}</td>
                          <td className="text-right font-mono">{fmt(c.netSales)}</td>
                          <td className="text-right text-muted-foreground">{c.orders}</td>
                          <td className="text-right text-muted-foreground">{c.pct.toFixed(1)}%</td>
                          <td className="text-right font-mono">{fmt(c.orders > 0 ? c.netSales / c.orders : 0)}</td>
                          <td className="text-muted-foreground text-xs">{navLabel}</td>
                        </tr>
                      );
                    })}
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
