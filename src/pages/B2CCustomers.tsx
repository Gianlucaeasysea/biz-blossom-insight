import { useState, useMemo, useCallback } from 'react';
import { subDays, format, differenceInDays } from 'date-fns';
import { enUS } from 'date-fns/locale';
import { DashboardHeader } from '@/components/dashboard/DashboardHeader';
import { NavLink } from '@/components/NavLink';
import { useShopifyOrders } from '@/hooks/useShopifyOrders';
import { useLanguage } from '@/contexts/LanguageContext';
import { Order } from '@/types/analytics';
import { downloadCsv } from '@/lib/csv-export';
import { AiAssistant } from '@/components/dashboard/AiAssistant';
import {
  Users, UserPlus, UserCheck, Repeat, TrendingUp, Globe, ShoppingBag,
  ArrowUpDown, Download, Search, Megaphone, DollarSign, BarChart3,
  Loader2, AlertCircle, Calendar, ChevronDown,
} from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar as CalendarComponent } from '@/components/ui/calendar';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell,
  PieChart, Pie,
} from 'recharts';

const fmt = (v: number) => new Intl.NumberFormat('it-IT', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(v);
const fmtDec = (v: number) => new Intl.NumberFormat('it-IT', { style: 'currency', currency: 'EUR' }).format(v);

// ─── Normalize acquisition source ─────────────────────────────────────────
function normalizeSource(src: string): string {
  const lower = src.toLowerCase().replace(/[\s_-]+/g, '');
  if (lower === 'metaads' || lower === 'meta' || lower === 'facebook' || lower === 'fb' || lower === 'instagram' || lower === 'ig') return 'Meta Ads';
  if (lower === 'google' || lower === 'googleads') return 'Google';
  if (lower === 'direct' || lower === '') return 'Direct';
  return src;
}

// ─── Derived customer record ──────────────────────────────────────────────
interface CustomerRecord {
  id: string;
  name: string;
  orders: number;
  totalSpent: number;
  avgOrderValue: number;
  firstOrder: Date;
  lastOrder: Date;
  daysSinceLast: number;
  country: string;
  city: string;
  source: string;
  products: string[];
  skus: string[];
}

function buildCustomers(orders: Order[], dateRange: { start: Date; end: Date }): CustomerRecord[] {
  const startTime = dateRange.start.getTime();
  const endOfDay = new Date(dateRange.end);
  endOfDay.setHours(23, 59, 59, 999);
  const endTime = endOfDay.getTime();

  const b2c = orders.filter(o => {
    if (o.customerType !== 'B2C') return false;
    const d = o.date instanceof Date ? o.date : new Date(o.date);
    const t = d.getTime();
    return t >= startTime && t <= endTime;
  });

  const map: Record<string, {
    name: string; orders: number; totalSpent: number;
    firstOrder: Date; lastOrder: Date; country: string; city: string;
    sources: Record<string, number>; products: Set<string>; skus: Set<string>;
  }> = {};

  b2c.forEach(o => {
    const cid = o.customerId;
    const d = o.date instanceof Date ? o.date : new Date(o.date);
    if (!map[cid]) {
      map[cid] = {
        name: o.customerName, orders: 0, totalSpent: 0,
        firstOrder: d, lastOrder: d,
        country: o.destinationCountry || o.country || '',
        city: o.destinationCity || '',
        sources: {}, products: new Set(), skus: new Set(),
      };
    }
    const c = map[cid];
    c.orders++;
    c.totalSpent += o.netAmount ?? o.totalAmount;
    if (d < c.firstOrder) c.firstOrder = d;
    if (d > c.lastOrder) { c.lastOrder = d; c.country = o.destinationCountry || o.country || c.country; c.city = o.destinationCity || c.city; }

    const rawSrc = o.utm?.utm_source || (o.referringSite ? (() => { try { return new URL(o.referringSite!).hostname.replace('www.', ''); } catch { return o.referringSite!; } })() : 'Direct');
    const src = normalizeSource(rawSrc);
    c.sources[src] = (c.sources[src] || 0) + 1;

    o.products.forEach(p => { c.products.add(p.name); c.skus.add(p.sku); });
  });

  const now = new Date();
  return Object.entries(map).map(([id, c]) => {
    const topSource = Object.entries(c.sources).sort((a, b) => b[1] - a[1])[0]?.[0] || 'Unknown';
    return {
      id, name: c.name, orders: c.orders,
      totalSpent: Math.round(c.totalSpent * 100) / 100,
      avgOrderValue: c.orders > 0 ? Math.round((c.totalSpent / c.orders) * 100) / 100 : 0,
      firstOrder: c.firstOrder, lastOrder: c.lastOrder,
      daysSinceLast: differenceInDays(now, c.lastOrder),
      country: c.country, city: c.city,
      source: topSource,
      products: Array.from(c.products), skus: Array.from(c.skus),
    };
  });
}

// ─── RFM Segment ──────────────────────────────────────────────────────────
type RFMSegment = 'Champions' | 'Loyal' | 'Promising' | 'At Risk' | 'Lost' | 'New';
function getRFMSegment(c: CustomerRecord): RFMSegment {
  if (c.orders >= 3 && c.daysSinceLast <= 30) return 'Champions';
  if (c.orders >= 2 && c.daysSinceLast <= 60) return 'Loyal';
  if (c.orders === 1 && c.daysSinceLast <= 30) return 'New';
  if (c.orders >= 2 && c.daysSinceLast <= 120) return 'Promising';
  if (c.daysSinceLast <= 180) return 'At Risk';
  return 'Lost';
}

const SEGMENT_COLORS: Record<RFMSegment, string> = {
  Champions: 'hsl(168,70%,42%)',
  Loyal: 'hsl(210,80%,55%)',
  New: 'hsl(280,60%,55%)',
  Promising: 'hsl(42,96%,48%)',
  'At Risk': 'hsl(25,90%,55%)',
  Lost: 'hsl(0,65%,52%)',
};

// ─── KPI Card ─────────────────────────────────────────────────────────────
function KPI({ icon: Icon, label, value, sub, color }: {
  icon: React.ElementType; label: string; value: string; sub?: string; color?: string;
}) {
  return (
    <div className="kpi-card relative overflow-hidden" style={{ borderLeft: `3px solid ${color || 'hsl(var(--primary))'}` }}>
      <div className="absolute top-0 left-0 right-0 h-px opacity-50" style={{ background: `linear-gradient(90deg, ${color || 'hsl(var(--primary))'}, transparent)` }} />
      <div className="flex items-center gap-1.5 mb-1">
        <Icon className="w-3.5 h-3.5" style={{ color: color || 'hsl(var(--primary))' }} />
        <p className="text-[10px] text-muted-foreground font-semibold uppercase tracking-[0.12em]">{label}</p>
      </div>
      <p className="text-lg font-bold font-mono text-foreground">{value}</p>
      {sub && <p className="text-[10px] text-muted-foreground mt-0.5">{sub}</p>}
    </div>
  );
}

// ─── Section Header ───────────────────────────────────────────────────────
const SectionHeader = ({ label }: { label: string }) => (
  <div className="flex items-center gap-2 mb-3">
    <p className="section-label mb-0">{label}</p>
    <div className="flex-1 h-px bg-border/30" />
  </div>
);

// ─── Date range presets ───────────────────────────────────────────────────
const DATE_PRESETS = [
  { label: '30g', days: 30 },
  { label: '90g', days: 90 },
  { label: '6m', days: 180 },
  { label: '1a', days: 365 },
  { label: 'Tutto', days: null },
];

export default function B2CCustomers() {
  const { t } = useLanguage();

  // Fetch ALL orders from 2023
  const [shopifyMinDate] = useState(() => new Date('2023-01-01T00:00:00Z'));
  const { data: shopifyOrders = [], isLoading, isError, error, refetch, isFetching } = useShopifyOrders({
    limit: 250, status: 'any', createdAtMin: shopifyMinDate, enabled: true,
  });

  // Date range filter (default: all time from 2023)
  const [dateRange, setDateRange] = useState<{ start: Date; end: Date }>({
    start: new Date('2023-01-01'),
    end: new Date(),
  });
  const [calendarOpen, setCalendarOpen] = useState(false);

  const [search, setSearch] = useState('');
  const [sortField, setSortField] = useState<'totalSpent' | 'orders' | 'name' | 'daysSinceLast' | 'avgOrderValue'>('totalSpent');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');

  const customers = useMemo(() => buildCustomers(shopifyOrders, dateRange), [shopifyOrders, dateRange]);

  // ── KPIs ──────────────────────────────────────────────────────────────
  const kpis = useMemo(() => {
    const total = customers.length;
    const repeat = customers.filter(c => c.orders > 1);
    const repeatRate = total > 0 ? (repeat.length / total) * 100 : 0;
    const totalRevenue = customers.reduce((s, c) => s + c.totalSpent, 0);
    const avgLTV = total > 0 ? totalRevenue / total : 0;
    const avgAOV = total > 0 ? customers.reduce((s, c) => s + c.avgOrderValue, 0) / total : 0;
    const newLast30 = customers.filter(c => c.orders === 1 && c.daysSinceLast <= 30).length;
    const avgOrders = total > 0 ? customers.reduce((s, c) => s + c.orders, 0) / total : 0;
    return { total, repeatCount: repeat.length, repeatRate, totalRevenue, avgLTV, avgAOV, newLast30, avgOrders };
  }, [customers]);

  // ── RFM Segments ──────────────────────────────────────────────────────
  const rfmData = useMemo(() => {
    const segments: Record<RFMSegment, { count: number; revenue: number }> = {
      Champions: { count: 0, revenue: 0 }, Loyal: { count: 0, revenue: 0 },
      New: { count: 0, revenue: 0 }, Promising: { count: 0, revenue: 0 },
      'At Risk': { count: 0, revenue: 0 }, Lost: { count: 0, revenue: 0 },
    };
    customers.forEach(c => {
      const seg = getRFMSegment(c);
      segments[seg].count++;
      segments[seg].revenue += c.totalSpent;
    });
    return Object.entries(segments)
      .filter(([, d]) => d.count > 0)
      .map(([name, d]) => ({ name, count: d.count, revenue: Math.round(d.revenue), fill: SEGMENT_COLORS[name as RFMSegment] }))
      .sort((a, b) => b.revenue - a.revenue);
  }, [customers]);

  // ── Top Countries ─────────────────────────────────────────────────────
  const countryData = useMemo(() => {
    const map: Record<string, { count: number; revenue: number }> = {};
    customers.forEach(c => {
      const country = c.country || 'Unknown';
      if (!map[country]) map[country] = { count: 0, revenue: 0 };
      map[country].count++;
      map[country].revenue += c.totalSpent;
    });
    return Object.entries(map)
      .map(([country, d]) => ({ country, ...d }))
      .sort((a, b) => b.revenue - a.revenue)
      .slice(0, 10);
  }, [customers]);

  // ── Acquisition Sources ───────────────────────────────────────────────
  const sourceData = useMemo(() => {
    const map: Record<string, { count: number; revenue: number }> = {};
    customers.forEach(c => {
      const src = c.source || 'Direct';
      if (!map[src]) map[src] = { count: 0, revenue: 0 };
      map[src].count++;
      map[src].revenue += c.totalSpent;
    });
    return Object.entries(map)
      .map(([source, d]) => ({ source, ...d }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 8);
  }, [customers]);

  // ── Order frequency distribution ──────────────────────────────────────
  const freqData = useMemo(() => {
    const buckets: Record<string, number> = { '1 ordine': 0, '2 ordini': 0, '3 ordini': 0, '4+ ordini': 0 };
    customers.forEach(c => {
      if (c.orders === 1) buckets['1 ordine']++;
      else if (c.orders === 2) buckets['2 ordini']++;
      else if (c.orders === 3) buckets['3 ordini']++;
      else buckets['4+ ordini']++;
    });
    return Object.entries(buckets).map(([name, value]) => ({ name, value }));
  }, [customers]);

  // ── Filtered & sorted customer table ──────────────────────────────────
  const filteredCustomers = useMemo(() => {
    let result = [...customers];
    if (search) {
      const s = search.toLowerCase();
      result = result.filter(c => c.name.toLowerCase().includes(s) || c.country.toLowerCase().includes(s) || c.city.toLowerCase().includes(s));
    }
    result.sort((a, b) => {
      const av = a[sortField], bv = b[sortField];
      const cmp = typeof av === 'string' ? (av as string).localeCompare(bv as string) : (av as number) - (bv as number);
      return sortDir === 'asc' ? cmp : -cmp;
    });
    return result;
  }, [customers, search, sortField, sortDir]);

  const handleSort = (f: typeof sortField) => {
    if (sortField === f) setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    else { setSortField(f); setSortDir('desc'); }
  };

  const SortBtn = ({ field, children }: { field: typeof sortField; children: React.ReactNode }) => (
    <button onClick={() => handleSort(field)} className="flex items-center gap-1 hover:text-foreground transition-colors">
      {children}<ArrowUpDown className={`w-3 h-3 ${sortField === field ? 'text-primary' : ''}`} />
    </button>
  );

  const handleExport = () => {
    downloadCsv('b2c-customers', ['Name', 'Orders', 'Total Spent', 'AOV', 'First Order', 'Last Order', 'Days Since Last', 'Country', 'City', 'Source', 'Segment'],
      filteredCustomers.map(c => [c.name, c.orders, c.totalSpent.toFixed(2), c.avgOrderValue.toFixed(2), format(c.firstOrder, 'yyyy-MM-dd'), format(c.lastOrder, 'yyyy-MM-dd'), c.daysSinceLast, c.country, c.city, c.source, getRFMSegment(c)]));
  };

  // ── AI context builder ────────────────────────────────────────────────
  const aiContext = useMemo(() => {
    const segSummary = rfmData.map(d => `${d.name}: ${d.count} clienti, Revenue €${d.revenue}`).join('\n');
    const topCountries = countryData.slice(0, 5).map(c => `${c.country}: ${c.count} clienti, €${Math.round(c.revenue)}`).join('\n');
    const topSources = sourceData.slice(0, 5).map(s => `${s.source}: ${s.count} clienti, €${Math.round(s.revenue)}`).join('\n');
    return `ANALISI CLIENTI B2C (${format(dateRange.start, 'dd/MM/yyyy')} - ${format(dateRange.end, 'dd/MM/yyyy')})

KPI:
- Clienti Totali: ${kpis.total}
- Nuovi (30gg): ${kpis.newLast30}
- Repeat Rate: ${kpis.repeatRate.toFixed(1)}%
- Clienti Repeat: ${kpis.repeatCount}
- Revenue Totale: €${Math.round(kpis.totalRevenue)}
- LTV Medio: €${Math.round(kpis.avgLTV)}
- AOV Medio: €${Math.round(kpis.avgAOV)}
- Ordini/Cliente: ${kpis.avgOrders.toFixed(1)}

SEGMENTAZIONE RFM:
${segSummary}

TOP PAESI:
${topCountries}

CANALI DI ACQUISIZIONE:
${topSources}

DISTRIBUZIONE FREQUENZA:
${freqData.map(f => `${f.name}: ${f.value}`).join('\n')}`;
  }, [kpis, rfmData, countryData, sourceData, freqData, dateRange]);

  const PALETTE = ['hsl(168,70%,42%)', 'hsl(210,80%,55%)', 'hsl(42,96%,48%)', 'hsl(280,60%,55%)', 'hsl(25,90%,55%)', 'hsl(0,65%,52%)', 'hsl(190,70%,50%)', 'hsl(330,60%,55%)'];

  return (
    <div className="min-h-screen bg-background p-4 sm:p-6">
      <div className="max-w-[1520px] mx-auto space-y-5">

        <DashboardHeader onRefresh={() => refetch()} isLoading={isFetching} />

        {/* Nav */}
        <div className="flex flex-wrap items-center gap-1.5">
          <NavLink to="/" className="px-3.5 py-1.5 rounded-lg text-xs font-semibold bg-muted text-muted-foreground hover:text-foreground transition-colors" activeClassName="bg-primary text-primary-foreground">{t('nav.sales')}</NavLink>
          <NavLink to="/meta-ads" className="px-3.5 py-1.5 rounded-lg text-xs font-semibold bg-muted text-muted-foreground hover:text-foreground transition-colors" activeClassName="bg-primary text-primary-foreground">{t('nav.meta')}</NavLink>
          <NavLink to="/budget-2026" className="px-3.5 py-1.5 rounded-lg text-xs font-semibold bg-muted text-muted-foreground hover:text-foreground transition-colors" activeClassName="bg-primary text-primary-foreground">{t('nav.budget')}</NavLink>
          <NavLink to="/geo-insights" className="px-3.5 py-1.5 rounded-lg text-xs font-semibold bg-muted text-muted-foreground hover:text-foreground transition-colors" activeClassName="bg-primary text-primary-foreground">{t('nav.geo')}</NavLink>
          <NavLink to="/product-analysis" className="px-3.5 py-1.5 rounded-lg text-xs font-semibold bg-muted text-muted-foreground hover:text-foreground transition-colors" activeClassName="bg-primary text-primary-foreground">{t('nav.products')}</NavLink>
          <NavLink to="/b2c-customers" className="px-3.5 py-1.5 rounded-lg text-xs font-semibold bg-muted text-muted-foreground hover:text-foreground transition-colors" activeClassName="bg-primary text-primary-foreground">Clienti B2C</NavLink>
        </div>

        {/* ═══ DATE RANGE FILTER ═══ */}
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex rounded-md bg-muted p-0.5">
            {DATE_PRESETS.map(p => (
              <button
                key={p.label}
                onClick={() => setDateRange({
                  start: p.days ? subDays(new Date(), p.days) : new Date('2023-01-01'),
                  end: new Date(),
                })}
                className="px-2.5 py-1.5 text-xs text-muted-foreground hover:text-foreground rounded transition-colors"
              >
                {p.label}
              </button>
            ))}
          </div>
          <Popover open={calendarOpen} onOpenChange={setCalendarOpen}>
            <PopoverTrigger asChild>
              <Button variant="ghost" size="sm" className="text-xs text-muted-foreground hover:text-foreground gap-1.5">
                <Calendar className="w-3.5 h-3.5" />
                {format(dateRange.start, 'dd MMM yyyy', { locale: enUS })} – {format(dateRange.end, 'dd MMM yyyy', { locale: enUS })}
                <ChevronDown className="w-3 h-3" />
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0 bg-popover border-border" align="start">
              <div className="flex">
                <div className="border-r border-border">
                  <CalendarComponent
                    mode="single"
                    selected={dateRange.start}
                    onSelect={date => date && setDateRange(prev => ({ ...prev, start: date }))}
                    locale={enUS}
                    className="p-3 pointer-events-auto"
                  />
                </div>
                <CalendarComponent
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

        {isError && (
          <div className="p-3 rounded-lg bg-destructive/10 border border-destructive/20 flex items-center gap-2 text-xs text-destructive">
            <AlertCircle className="w-4 h-4 shrink-0" />
            {error instanceof Error ? error.message : 'Error'}
          </div>
        )}
        {isLoading && (
          <div className="flex items-center justify-center gap-2 py-16">
            <Loader2 className="w-5 h-5 animate-spin text-primary" />
            <p className="text-sm text-muted-foreground">{t('common.loading')}</p>
          </div>
        )}

        {!isLoading && (
          <>
            {/* ═══ KPI ROW ═══ */}
            <SectionHeader label="Overview Clienti B2C" />
            <div className="grid grid-cols-2 sm:grid-cols-4 xl:grid-cols-8 gap-3">
              <KPI icon={Users} label="Clienti Totali" value={kpis.total.toString()} color="hsl(210,80%,55%)" />
              <KPI icon={UserPlus} label="Nuovi (30gg)" value={kpis.newLast30.toString()} color="hsl(280,60%,55%)" />
              <KPI icon={Repeat} label="Repeat Rate" value={`${kpis.repeatRate.toFixed(1)}%`} sub={`${kpis.repeatCount} repeat`} color="hsl(168,70%,42%)" />
              <KPI icon={ShoppingBag} label="Ordini / Cliente" value={kpis.avgOrders.toFixed(1)} color="hsl(42,96%,48%)" />
              <KPI icon={DollarSign} label="Revenue Totale" value={fmt(kpis.totalRevenue)} color="hsl(168,70%,42%)" />
              <KPI icon={TrendingUp} label="LTV Medio" value={fmt(kpis.avgLTV)} color="hsl(210,80%,55%)" />
              <KPI icon={BarChart3} label="AOV Medio" value={fmtDec(kpis.avgAOV)} color="hsl(42,96%,48%)" />
              <KPI icon={UserCheck} label="Clienti Repeat" value={kpis.repeatCount.toString()} color="hsl(168,70%,42%)" />
            </div>

            {/* ═══ CHARTS ROW ═══ */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">

              {/* RFM Segmentation */}
              <div className="chart-container">
                <div className="flex items-center gap-2 mb-3">
                  <Users className="w-4 h-4 text-muted-foreground" />
                  <h3 className="text-sm font-semibold">Segmentazione RFM</h3>
                </div>
                <div className="flex items-center gap-4">
                  <div className="w-32 h-32 shrink-0">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie data={rfmData} dataKey="count" cx="50%" cy="50%" innerRadius={28} outerRadius={55} strokeWidth={1} stroke="hsl(var(--background))">
                          {rfmData.map((d, i) => <Cell key={i} fill={d.fill} />)}
                        </Pie>
                        <Tooltip formatter={(v: number, name: string) => [v, name]} contentStyle={{ background: 'hsl(220,25%,12%)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8, fontSize: 11 }} />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                  <div className="space-y-1.5 flex-1 min-w-0">
                    {rfmData.map(d => (
                      <div key={d.name} className="flex items-center gap-2">
                        <div className="w-2.5 h-2.5 rounded-sm shrink-0" style={{ background: d.fill }} />
                        <span className="text-[11px] font-medium truncate flex-1">{d.name}</span>
                        <span className="text-[11px] font-mono text-muted-foreground">{d.count}</span>
                        <span className="text-[10px] font-mono text-muted-foreground/60">{fmt(d.revenue)}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {/* Order Frequency */}
              <div className="chart-container">
                <div className="flex items-center gap-2 mb-3">
                  <ShoppingBag className="w-4 h-4 text-muted-foreground" />
                  <h3 className="text-sm font-semibold">Distribuzione Frequenza Ordini</h3>
                </div>
                <ResponsiveContainer width="100%" height={160}>
                  <BarChart data={freqData} barSize={32}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(220,15%,20%)" />
                    <XAxis dataKey="name" tick={{ fontSize: 11, fill: 'hsl(220,15%,60%)' }} />
                    <YAxis tick={{ fontSize: 11, fill: 'hsl(220,15%,60%)' }} />
                    <Tooltip contentStyle={{ background: 'hsl(220,25%,12%)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8, fontSize: 11 }} />
                    <Bar dataKey="value" radius={[4, 4, 0, 0]}>
                      {freqData.map((_, i) => <Cell key={i} fill={PALETTE[i % PALETTE.length]} />)}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>

              {/* Acquisition Source */}
              <div className="chart-container">
                <div className="flex items-center gap-2 mb-3">
                  <Megaphone className="w-4 h-4 text-muted-foreground" />
                  <h3 className="text-sm font-semibold">Canale di Acquisizione</h3>
                </div>
                <div className="space-y-2">
                  {sourceData.map((s, i) => {
                    const max = sourceData[0]?.count ?? 1;
                    return (
                      <div key={s.source}>
                        <div className="flex items-center justify-between text-[11px] mb-0.5">
                          <span className="truncate max-w-[140px] font-medium">{s.source}</span>
                          <span className="font-mono text-muted-foreground">{s.count} clienti · {fmt(s.revenue)}</span>
                        </div>
                        <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                          <div className="h-full rounded-full" style={{ width: `${(s.count / max) * 100}%`, background: PALETTE[i % PALETTE.length] }} />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* ═══ TOP COUNTRIES ═══ */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              <div className="chart-container">
                <div className="flex items-center gap-2 mb-3">
                  <Globe className="w-4 h-4 text-muted-foreground" />
                  <h3 className="text-sm font-semibold">Top Paesi per Revenue</h3>
                </div>
                <ResponsiveContainer width="100%" height={220}>
                  <BarChart data={countryData} layout="vertical" barSize={16}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(220,15%,20%)" />
                    <XAxis type="number" tick={{ fontSize: 10, fill: 'hsl(220,15%,60%)' }} tickFormatter={v => `€${(v / 1000).toFixed(0)}k`} />
                    <YAxis type="category" dataKey="country" tick={{ fontSize: 11, fill: 'hsl(220,15%,60%)' }} width={80} />
                    <Tooltip formatter={(v: number) => [fmt(v), 'Revenue']} contentStyle={{ background: 'hsl(220,25%,12%)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8, fontSize: 11 }} />
                    <Bar dataKey="revenue" radius={[0, 4, 4, 0]}>
                      {countryData.map((_, i) => <Cell key={i} fill={PALETTE[i % PALETTE.length]} />)}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>

              {/* Top Countries Table */}
              <div className="chart-container">
                <div className="flex items-center gap-2 mb-3">
                  <Globe className="w-4 h-4 text-muted-foreground" />
                  <h3 className="text-sm font-semibold">Dettaglio Paesi</h3>
                </div>
                <div className="overflow-x-auto scrollbar-custom">
                  <table className="data-table">
                    <thead><tr><th>Paese</th><th className="text-right">Clienti</th><th className="text-right">Revenue</th><th className="text-right">Rev/Cliente</th></tr></thead>
                    <tbody>
                      {countryData.map(c => (
                        <tr key={c.country}>
                          <td className="text-xs font-medium">{c.country}</td>
                          <td className="text-right font-mono text-xs">{c.count}</td>
                          <td className="text-right font-mono text-xs">{fmt(c.revenue)}</td>
                          <td className="text-right font-mono text-xs">{fmt(c.count > 0 ? c.revenue / c.count : 0)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>

            {/* ═══ CUSTOMER TABLE ═══ */}
            <SectionHeader label="Tutti i Clienti B2C" />
            <div className="chart-container">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-3">
                <p className="text-xs text-muted-foreground">{filteredCustomers.length} clienti</p>
                <div className="flex items-center gap-2">
                  <div className="relative w-full sm:w-56">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
                    <Input placeholder="Cerca nome, paese..." value={search} onChange={e => setSearch(e.target.value)} className="pl-9 h-8 text-xs bg-muted/50 border-border/50" />
                  </div>
                  <button onClick={handleExport} className="p-2 rounded-md hover:bg-muted/50 text-muted-foreground hover:text-foreground transition-colors" title="Export CSV">
                    <Download className="w-4 h-4" />
                  </button>
                </div>
              </div>
              <div className="table-scroll overflow-x-auto max-h-[500px] overflow-y-auto scrollbar-custom">
                <table className="data-table">
                  <thead className="sticky top-0 bg-card z-10"><tr>
                    <th><SortBtn field="name">Cliente</SortBtn></th>
                    <th className="text-center"><SortBtn field="orders">Ordini</SortBtn></th>
                    <th className="text-right"><SortBtn field="totalSpent">Spesa Totale</SortBtn></th>
                    <th className="text-right"><SortBtn field="avgOrderValue">AOV</SortBtn></th>
                    <th className="text-right"><SortBtn field="daysSinceLast">Ultimo Ordine</SortBtn></th>
                    <th>Paese</th>
                    <th>Fonte</th>
                    <th>Segmento</th>
                  </tr></thead>
                  <tbody>
                    {filteredCustomers.slice(0, 100).map(c => {
                      const seg = getRFMSegment(c);
                      return (
                        <tr key={c.id}>
                          <td className="text-xs font-medium max-w-[160px] truncate">{c.name}</td>
                          <td className="text-center font-mono text-xs">{c.orders}</td>
                          <td className="text-right font-mono text-xs">{fmtDec(c.totalSpent)}</td>
                          <td className="text-right font-mono text-xs">{fmtDec(c.avgOrderValue)}</td>
                          <td className="text-right text-xs text-muted-foreground">{c.daysSinceLast}gg fa</td>
                          <td className="text-xs truncate max-w-[100px]">{c.country}</td>
                          <td className="text-xs truncate max-w-[100px] text-muted-foreground">{c.source}</td>
                          <td>
                            <span className="text-[10px] font-bold px-1.5 py-0.5 rounded" style={{ background: SEGMENT_COLORS[seg] + '22', color: SEGMENT_COLORS[seg] }}>
                              {seg}
                            </span>
                          </td>
                        </tr>
                      );
                    })}
                    {!filteredCustomers.length && <tr><td colSpan={8} className="text-center text-muted-foreground py-6 text-xs">Nessun dato</td></tr>}
                  </tbody>
                </table>
              </div>
              {filteredCustomers.length > 100 && (
                <p className="text-[10px] text-muted-foreground mt-2 text-center">Mostra i primi 100 di {filteredCustomers.length} clienti. Usa la ricerca per filtrare.</p>
              )}
            </div>
          </>
        )}
      </div>

      {/* AI Marketing Assistant */}
      <AiAssistant dashboardContext={aiContext} />
    </div>
  );
}
