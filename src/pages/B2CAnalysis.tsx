import { useState, useMemo, useCallback } from 'react';
import { subDays, format, differenceInDays, eachMonthOfInterval, startOfMonth, getDaysInMonth } from 'date-fns';
import { BUDGET_PRODUCTS } from '@/lib/budget-targets';
import { DashboardHeader } from '@/components/dashboard/DashboardHeader';
import { NavLink } from '@/components/NavLink';
import { DraggableNav } from '@/components/DraggableNav';
import { useShopifyOrders } from '@/hooks/useShopifyOrders';
import { useShopifySalesSummary } from '@/hooks/useShopifySalesSummary';
import { useLanguage } from '@/contexts/LanguageContext';
import { Order } from '@/types/analytics';
import { downloadCsv } from '@/lib/csv-export';
import { AiAssistant } from '@/components/dashboard/AiAssistant';
import { getSkuCollection } from '@/lib/mock-data';
import {
  Users, TrendingUp, Globe, Package, DollarSign, BarChart3,
  ArrowUpDown, Download, Search, Calendar, ChevronDown, ChevronRight,
  Loader2, AlertCircle, Repeat, ShoppingBag, Target, Clock,
  UserPlus, UserCheck, Megaphone, MapPin,
} from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar as CalendarComponent } from '@/components/ui/calendar';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell,
  PieChart, Pie, Legend, LineChart, Line, AreaChart, Area,
} from 'recharts';

const fmt = (v: number) => new Intl.NumberFormat('it-IT', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(v);
const fmtDec = (v: number) => new Intl.NumberFormat('it-IT', { style: 'currency', currency: 'EUR' }).format(v);
const fmtPct = (v: number) => `${v.toFixed(1)}%`;

function normalizeSource(src: string): string {
  const lower = src.toLowerCase().replace(/[\s_-]+/g, '');
  if (['metaads', 'meta', 'facebook', 'fb', 'instagram', 'ig'].includes(lower)) return 'Meta Ads';
  if (['google', 'googleads'].includes(lower)) return 'Google';
  if (lower === 'direct' || lower === '') return 'Direct';
  return src;
}

// ── KPI Card ──────────────────────────────────────────────────────────────
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

const SectionHeader = ({ label }: { label: string }) => (
  <div className="flex items-center gap-2 mb-3">
    <p className="section-label mb-0">{label}</p>
    <div className="flex-1 h-px bg-border/30" />
  </div>
);

const DATE_PRESETS = [
  { label: '30g', days: 30 },
  { label: '90g', days: 90 },
  { label: '6m', days: 180 },
  { label: '1a', days: 365 },
  { label: 'Tutto', days: null },
];

const COLORS = [
  'hsl(168,70%,42%)', 'hsl(210,80%,55%)', 'hsl(42,96%,48%)', 'hsl(280,60%,55%)',
  'hsl(25,90%,55%)', 'hsl(0,65%,52%)', 'hsl(190,70%,45%)', 'hsl(320,60%,50%)',
  'hsl(140,50%,45%)', 'hsl(350,70%,55%)',
];

// ── Types ─────────────────────────────────────────────────────────────────
interface ProductRow {
  sku: string; name: string; collection: string; qty: number;
  grossSales: number; netSales: number; orders: number;
  avgPrice: number; countries: number; returnRate: number;
}

interface CustomerRow {
  id: string; name: string; orders: number; totalSpent: number;
  avgOrderValue: number; firstOrder: Date; lastOrder: Date;
  daysSinceLast: number; country: string; city: string;
  source: string; products: string[];
}

type RFMSegment = 'Champions' | 'Loyal' | 'Promising' | 'At Risk' | 'Lost' | 'New';
function getRFMSegment(c: CustomerRow): RFMSegment {
  if (c.orders >= 3 && c.daysSinceLast <= 30) return 'Champions';
  if (c.orders >= 2 && c.daysSinceLast <= 60) return 'Loyal';
  if (c.orders === 1 && c.daysSinceLast <= 30) return 'New';
  if (c.orders >= 2 && c.daysSinceLast <= 120) return 'Promising';
  if (c.daysSinceLast <= 180) return 'At Risk';
  return 'Lost';
}

const SEGMENT_COLORS: Record<RFMSegment, string> = {
  Champions: 'hsl(168,70%,42%)', Loyal: 'hsl(210,80%,55%)',
  New: 'hsl(280,60%,55%)', Promising: 'hsl(42,96%,48%)',
  'At Risk': 'hsl(25,90%,55%)', Lost: 'hsl(0,65%,52%)',
};

export default function B2CAnalysis() {
  const { t } = useLanguage();
  const [shopifyMinDate] = useState(() => new Date('2023-01-01T00:00:00Z'));
  const { data: shopifyOrders = [], isLoading, isError, error, refetch, isFetching } = useShopifyOrders({
    limit: 250, status: 'any', createdAtMin: shopifyMinDate, enabled: true,
  });

  const [dateRange, setDateRange] = useState<{ start: Date; end: Date }>({
    start: new Date('2025-01-01'),
    end: new Date(),
  });
  const [calendarOpen, setCalendarOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<'overview' | 'products' | 'customers' | 'countries' | 'orders'>('overview');
  const [search, setSearch] = useState('');
  const [sortField, setSortField] = useState<'totalSpent' | 'orders' | 'name' | 'daysSinceLast' | 'avgOrderValue'>('totalSpent');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');
  const [expandedOrders, setExpandedOrders] = useState<Set<string>>(new Set());
  const [budgetViewMode, setBudgetViewMode] = useState<'MTD' | 'YTD'>('MTD');

  const toggleOrder = (id: string) => {
    setExpandedOrders(prev => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n; });
  };

  const { data: salesSummary } = useShopifySalesSummary({ start: dateRange.start, end: dateRange.end, enabled: true });

  const endOfDay = useMemo(() => { const d = new Date(dateRange.end); d.setHours(23, 59, 59, 999); return d; }, [dateRange.end]);

  const filtered = useMemo(() => shopifyOrders.filter(o => {
    if (o.customerType !== 'B2C') return false;
    const d = o.date instanceof Date ? o.date : new Date(o.date);
    return d >= dateRange.start && d <= endOfDay;
  }), [shopifyOrders, dateRange, endOfDay]);

  // ── Products ────────────────────────────────────────────────────────────
  const productRows = useMemo((): ProductRow[] => {
    const map: Record<string, { name: string; collection: string; qty: number; gross: number; net: number; orderIds: Set<string>; countries: Set<string>; refunds: number }> = {};
    filtered.forEach(o => {
      const orderNet = o.netAmount ?? o.totalAmount;
      const orderGross = o.grossSales ?? o.totalAmount;
      const totalProductGross = o.products.reduce((s, p) => s + p.totalPrice, 0);
      o.products.forEach(p => {
        const key = p.sku || p.name;
        if (!map[key]) map[key] = { name: p.name, collection: getSkuCollection(p.sku), qty: 0, gross: 0, net: 0, orderIds: new Set(), countries: new Set(), refunds: 0 };
        const m = map[key];
        m.qty += p.quantity;
        m.gross += p.totalPrice;
        // Proportional net
        const weight = totalProductGross > 0 ? p.totalPrice / totalProductGross : 0;
        m.net += orderNet * weight;
        m.orderIds.add(o.id);
        const country = o.destinationCountry || o.country;
        if (country) m.countries.add(country);
        if (o.totalRefunds && o.totalRefunds > 0) m.refunds += (o.totalRefunds ?? 0) * weight;
      });
    });
    return Object.entries(map).map(([sku, m]) => ({
      sku, name: m.name, collection: m.collection, qty: m.qty,
      grossSales: Math.round(m.gross * 100) / 100,
      netSales: Math.round(m.net * 100) / 100,
      orders: m.orderIds.size,
      avgPrice: m.qty > 0 ? Math.round((m.gross / m.qty) * 100) / 100 : 0,
      countries: m.countries.size,
      returnRate: m.gross > 0 ? Math.round((m.refunds / m.gross) * 1000) / 10 : 0,
    })).sort((a, b) => b.netSales - a.netSales);
  }, [filtered]);

  // ── Customers ───────────────────────────────────────────────────────────
  const customerRows = useMemo((): CustomerRow[] => {
    const map: Record<string, {
      name: string; orders: number; totalSpent: number; firstOrder: Date; lastOrder: Date;
      country: string; city: string; sources: Record<string, number>; products: Set<string>;
    }> = {};
    filtered.forEach(o => {
      const cid = o.customerId;
      const d = o.date instanceof Date ? o.date : new Date(o.date);
      if (!map[cid]) map[cid] = { name: o.customerName, orders: 0, totalSpent: 0, firstOrder: d, lastOrder: d, country: o.destinationCountry || o.country || '', city: o.destinationCity || '', sources: {}, products: new Set() };
      const c = map[cid];
      c.orders++;
      c.totalSpent += o.netAmount ?? o.totalAmount;
      if (d < c.firstOrder) c.firstOrder = d;
      if (d > c.lastOrder) { c.lastOrder = d; c.country = o.destinationCountry || o.country || c.country; c.city = o.destinationCity || c.city; }
      const rawSrc = o.utm?.utm_source || (o.referringSite ? (() => { try { return new URL(o.referringSite!).hostname.replace('www.', ''); } catch { return o.referringSite!; } })() : 'Direct');
      const src = normalizeSource(rawSrc);
      c.sources[src] = (c.sources[src] || 0) + 1;
      o.products.forEach(p => c.products.add(p.name));
    });
    const now = new Date();
    return Object.entries(map).map(([id, c]) => {
      const topSource = Object.entries(c.sources).sort((a, b) => b[1] - a[1])[0]?.[0] || 'Direct';
      return {
        id, name: c.name, orders: c.orders,
        totalSpent: Math.round(c.totalSpent * 100) / 100,
        avgOrderValue: c.orders > 0 ? Math.round((c.totalSpent / c.orders) * 100) / 100 : 0,
        firstOrder: c.firstOrder, lastOrder: c.lastOrder,
        daysSinceLast: differenceInDays(now, c.lastOrder),
        country: c.country, city: c.city, source: topSource,
        products: Array.from(c.products),
      };
    }).sort((a, b) => b.totalSpent - a.totalSpent);
  }, [filtered]);

  // ── Aggregate KPIs ──────────────────────────────────────────────────────
  const kpis = useMemo(() => {
    const totalOrders = filtered.length;
    const netSales = salesSummary?.netSales ?? filtered.reduce((s, o) => s + (o.netAmount ?? o.totalAmount), 0);
    const grossSales = salesSummary?.grossSales ?? filtered.reduce((s, o) => s + (o.grossSales ?? o.totalAmount), 0);
    const discounts = salesSummary?.discounts ?? filtered.reduce((s, o) => s + (o.totalDiscounts ?? 0), 0);
    const returns = salesSummary?.returns ?? filtered.reduce((s, o) => s + (o.totalRefunds ?? 0), 0);
    const aov = totalOrders > 0 ? netSales / totalOrders : 0;
    const totalCustomers = customerRows.length;
    const repeatCustomers = customerRows.filter(c => c.orders > 1).length;
    const repeatRate = totalCustomers > 0 ? (repeatCustomers / totalCustomers) * 100 : 0;
    const avgLTV = totalCustomers > 0 ? netSales / totalCustomers : 0;
    const newLast30 = customerRows.filter(c => c.orders === 1 && c.daysSinceLast <= 30).length;
    const totalQty = filtered.reduce((s, o) => s + o.products.reduce((ps, p) => ps + p.quantity, 0), 0);
    return { totalOrders, netSales, grossSales, discounts, returns, aov, totalCustomers, repeatCustomers, repeatRate, avgLTV, newLast30, totalQty };
  }, [filtered, salesSummary, customerRows]);

  // ── Country breakdown ───────────────────────────────────────────────────
  const countryData = useMemo(() => {
    const map: Record<string, { orders: number; revenue: number; customers: Set<string>; qty: number }> = {};
    filtered.forEach(o => {
      const c = o.destinationCountry || o.country || 'Unknown';
      if (!map[c]) map[c] = { orders: 0, revenue: 0, customers: new Set(), qty: 0 };
      map[c].orders++;
      map[c].revenue += o.netAmount ?? o.totalAmount;
      map[c].customers.add(o.customerId);
      map[c].qty += o.products.reduce((s, p) => s + p.quantity, 0);
    });
    return Object.entries(map)
      .map(([name, d]) => ({ name, orders: d.orders, revenue: Math.round(d.revenue), customers: d.customers.size, qty: d.qty, aov: d.orders > 0 ? Math.round(d.revenue / d.orders) : 0 }))
      .sort((a, b) => b.revenue - a.revenue);
  }, [filtered]);

  // ── Monthly trend ───────────────────────────────────────────────────────
  const monthlyTrend = useMemo(() => {
    const map: Record<string, { orders: number; revenue: number; customers: Set<string> }> = {};
    filtered.forEach(o => {
      const d = o.date instanceof Date ? o.date : new Date(o.date);
      const key = format(d, 'yyyy-MM');
      if (!map[key]) map[key] = { orders: 0, revenue: 0, customers: new Set() };
      map[key].orders++;
      map[key].revenue += o.netAmount ?? o.totalAmount;
      map[key].customers.add(o.customerId);
    });
    return Object.entries(map).sort((a, b) => a[0].localeCompare(b[0])).map(([month, d]) => ({
      month: format(new Date(month + '-01'), 'MMM yy'),
      orders: d.orders,
      revenue: Math.round(d.revenue),
      customers: d.customers.size,
      aov: d.orders > 0 ? Math.round(d.revenue / d.orders) : 0,
    }));
  }, [filtered]);

  // ── Collection breakdown ────────────────────────────────────────────────
  const collectionData = useMemo(() => {
    const map: Record<string, { qty: number; revenue: number }> = {};
    productRows.forEach(p => {
      if (!map[p.collection]) map[p.collection] = { qty: 0, revenue: 0 };
      map[p.collection].qty += p.qty;
      map[p.collection].revenue += p.netSales;
    });
    return Object.entries(map)
      .map(([name, d]) => ({ name, qty: d.qty, revenue: Math.round(d.revenue) }))
      .sort((a, b) => b.revenue - a.revenue);
  }, [productRows]);

  // ── Budget vs Actual per collection (current month) ──────────────────────
  const COLLECTION_TO_BUDGET: Record<string, string> = {
    'Winch Handle': 'FLIPPER',
    'Blocks': 'OLLI BLOCK',
    'Low Friction & Solid Rings': 'OLLI RING',
    'JAKE': 'JAKE',
    'Inflatable': 'WAY2',
    'Side products': 'SIDE PRODUCTS',
  };

  const budgetVsActual = useMemo(() => {
    const now = new Date();
    const currentMonth = now.getMonth();
    const dayOfMonth = now.getDate();
    const daysInMonth = getDaysInMonth(now);

    // Actual: filter orders for current month only, group by collection
    const currentMonthOrders = shopifyOrders.filter(o => {
      if (o.customerType !== 'B2C') return false;
      const d = o.date instanceof Date ? o.date : new Date(o.date);
      return d.getMonth() === currentMonth && d.getFullYear() === now.getFullYear();
    });

    const actualByCollection: Record<string, number> = {};
    currentMonthOrders.forEach(o => {
      const orderNet = o.netAmount ?? o.totalAmount;
      const totalProductGross = o.products.reduce((s, p) => s + p.totalPrice, 0);
      o.products.forEach(p => {
        const collection = getSkuCollection(p.sku);
        const weight = totalProductGross > 0 ? p.totalPrice / totalProductGross : 0;
        actualByCollection[collection] = (actualByCollection[collection] || 0) + orderNet * weight;
      });
    });

    return BUDGET_PRODUCTS.map(bp => {
      const collectionName = Object.entries(COLLECTION_TO_BUDGET).find(([, v]) => v === bp.name)?.[0] || bp.name;
      const budgetMonth = bp.monthlyTargets[currentMonth];
      const budgetToday = Math.round((budgetMonth / daysInMonth) * dayOfMonth);
      const actual = Math.round(actualByCollection[collectionName] || 0);
      return {
        product: bp.name,
        budgetMonth,
        budgetToday,
        actual,
        pctVsBudgetToday: budgetToday > 0 ? (actual / budgetToday) * 100 : 0,
      };
    });
  }, [shopifyOrders]);


  const rfmData = useMemo(() => {
    const segments: Record<RFMSegment, { count: number; revenue: number }> = {
      Champions: { count: 0, revenue: 0 }, Loyal: { count: 0, revenue: 0 },
      New: { count: 0, revenue: 0 }, Promising: { count: 0, revenue: 0 },
      'At Risk': { count: 0, revenue: 0 }, Lost: { count: 0, revenue: 0 },
    };
    customerRows.forEach(c => { const seg = getRFMSegment(c); segments[seg].count++; segments[seg].revenue += c.totalSpent; });
    return Object.entries(segments)
      .filter(([, d]) => d.count > 0)
      .map(([name, d]) => ({ name, count: d.count, revenue: Math.round(d.revenue), fill: SEGMENT_COLORS[name as RFMSegment] }))
      .sort((a, b) => b.revenue - a.revenue);
  }, [customerRows]);

  // ── Acquisition sources ─────────────────────────────────────────────────
  const sourceData = useMemo(() => {
    const map: Record<string, { count: number; revenue: number }> = {};
    customerRows.forEach(c => {
      if (!map[c.source]) map[c.source] = { count: 0, revenue: 0 };
      map[c.source].count++;
      map[c.source].revenue += c.totalSpent;
    });
    return Object.entries(map)
      .map(([source, d]) => ({ source, ...d }))
      .sort((a, b) => b.revenue - a.revenue)
      .slice(0, 8);
  }, [customerRows]);

  // ── Day of week analysis ────────────────────────────────────────────────
  const dowData = useMemo(() => {
    const days = ['Dom', 'Lun', 'Mar', 'Mer', 'Gio', 'Ven', 'Sab'];
    const map = days.map(d => ({ day: d, orders: 0, revenue: 0 }));
    filtered.forEach(o => {
      const d = o.date instanceof Date ? o.date : new Date(o.date);
      const idx = d.getDay();
      map[idx].orders++;
      map[idx].revenue += o.netAmount ?? o.totalAmount;
    });
    return map;
  }, [filtered]);

  // ── Order list ──────────────────────────────────────────────────────────
  const orderList = useMemo(() => {
    let list = [...filtered].sort((a, b) => {
      const da = a.date instanceof Date ? a.date : new Date(a.date);
      const db = b.date instanceof Date ? b.date : new Date(b.date);
      return db.getTime() - da.getTime();
    });
    if (search && activeTab === 'orders') {
      const q = search.toLowerCase();
      list = list.filter(o => o.customerName.toLowerCase().includes(q) || o.orderNumber.toLowerCase().includes(q) || (o.destinationCountry || '').toLowerCase().includes(q));
    }
    return list;
  }, [filtered, search, activeTab]);

  // ── Sort customers ──────────────────────────────────────────────────────
  const sortedCustomers = useMemo(() => {
    let list = [...customerRows];
    if (search && activeTab === 'customers') {
      const q = search.toLowerCase();
      list = list.filter(c => c.name.toLowerCase().includes(q) || c.country.toLowerCase().includes(q) || c.city.toLowerCase().includes(q));
    }
    return list.sort((a, b) => {
      const av = a[sortField], bv = b[sortField];
      if (typeof av === 'string') return sortDir === 'asc' ? av.localeCompare(bv as string) : (bv as string).localeCompare(av);
      return sortDir === 'asc' ? (av as number) - (bv as number) : (bv as number) - (av as number);
    });
  }, [customerRows, search, sortField, sortDir, activeTab]);

  const handleSort = useCallback((f: typeof sortField) => {
    if (sortField === f) setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    else { setSortField(f); setSortDir('desc'); }
  }, [sortField]);

  // ── AI context ──────────────────────────────────────────────────────────
  const aiContext = useMemo(() => {
    const l: string[] = [];
    l.push(`=== ANALISI B2C ECOMMERCE ===`);
    l.push(`Periodo: ${format(dateRange.start, 'dd/MM/yyyy')} - ${format(dateRange.end, 'dd/MM/yyyy')}`);
    l.push(`Ordini: ${kpis.totalOrders} | Net Sales: €${kpis.netSales.toLocaleString('it-IT')} | Gross Sales: €${kpis.grossSales.toLocaleString('it-IT')}`);
    l.push(`Sconti: €${kpis.discounts.toLocaleString('it-IT')} | Resi: €${kpis.returns.toLocaleString('it-IT')}`);
    l.push(`AOV: €${kpis.aov.toLocaleString('it-IT')} | Clienti: ${kpis.totalCustomers} | Repeat: ${fmtPct(kpis.repeatRate)} | LTV: €${kpis.avgLTV.toLocaleString('it-IT')}`);
    l.push(`Nuovi ultimi 30g: ${kpis.newLast30} | Qty totale: ${kpis.totalQty}`);
    l.push('\n--- RFM SEGMENTI ---');
    rfmData.forEach(s => l.push(`${s.name}: ${s.count} clienti, €${s.revenue.toLocaleString('it-IT')}`));
    l.push('\n--- TOP PRODOTTI ---');
    productRows.slice(0, 15).forEach(p => l.push(`${p.sku} ${p.name}: ${p.qty} pz, net €${p.netSales.toLocaleString('it-IT')}, ${p.orders} ordini, prezzo medio €${p.avgPrice}, return rate ${p.returnRate}%`));
    l.push('\n--- COLLEZIONI ---');
    collectionData.forEach(c => l.push(`${c.name}: ${c.qty} pz, €${c.revenue.toLocaleString('it-IT')}`));
    l.push('\n--- TOP PAESI ---');
    countryData.slice(0, 10).forEach(c => l.push(`${c.name}: ${c.orders} ordini, €${c.revenue.toLocaleString('it-IT')}, ${c.customers} clienti, AOV €${c.aov}`));
    l.push('\n--- CANALI ACQUISIZIONE ---');
    sourceData.forEach(s => l.push(`${s.source}: ${s.count} clienti, €${s.revenue.toLocaleString('it-IT')}`));
    l.push('\n--- TREND MENSILE ---');
    monthlyTrend.forEach(m => l.push(`${m.month}: ${m.orders} ordini, €${m.revenue.toLocaleString('it-IT')}, ${m.customers} clienti, AOV €${m.aov}`));
    l.push('\n--- GIORNI DELLA SETTIMANA ---');
    dowData.forEach(d => l.push(`${d.day}: ${d.orders} ordini, €${Math.round(d.revenue).toLocaleString('it-IT')}`));
    l.push('\n--- TOP CLIENTI ---');
    customerRows.slice(0, 10).forEach(c => l.push(`${c.name}: ${c.orders} ordini, €${c.totalSpent.toLocaleString('it-IT')}, ${c.country}, ultimo ${c.daysSinceLast}g fa, fonte: ${c.source}`));
    return l.join('\n');
  }, [dateRange, kpis, rfmData, productRows, collectionData, countryData, sourceData, monthlyTrend, dowData, customerRows]);

  const navLinkClass = "px-3.5 py-1.5 rounded-lg text-xs font-semibold bg-muted text-muted-foreground hover:text-foreground transition-colors";
  const activeClass = "bg-primary text-primary-foreground";

  return (
    <div className="min-h-screen bg-background p-3 sm:p-4 md:p-6">
      <div className="max-w-[1520px] mx-auto space-y-3 sm:space-y-5">
        <DashboardHeader onRefresh={() => refetch()} isLoading={isFetching} />

        <div className="flex flex-wrap items-center justify-between gap-3">
          <DraggableNav />

          <div className="flex items-center gap-2">
            {DATE_PRESETS.map(p => (
              <button key={p.label} onClick={() => setDateRange({ start: p.days ? subDays(new Date(), p.days) : new Date('2023-01-01'), end: new Date() })}
                className="px-2 py-1 text-[10px] font-bold rounded transition-colors bg-muted text-muted-foreground hover:text-foreground">
                {p.label}
              </button>
            ))}
            <Popover open={calendarOpen} onOpenChange={setCalendarOpen}>
              <PopoverTrigger asChild>
                <Button variant="outline" size="sm" className="h-7 text-[10px] gap-1">
                  <Calendar className="w-3 h-3" />
                  {format(dateRange.start, 'dd/MM/yy')} – {format(dateRange.end, 'dd/MM/yy')}
                  <ChevronDown className="w-3 h-3" />
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="end">
                <CalendarComponent mode="range" selected={{ from: dateRange.start, to: dateRange.end }}
                  onSelect={(range) => { if (range?.from) setDateRange({ start: range.from, end: range.to || range.from }); }}
                  numberOfMonths={2} className="p-3 pointer-events-auto" />
              </PopoverContent>
            </Popover>
          </div>
        </div>

        {isError && (
          <div className="p-3 rounded-lg bg-destructive/10 border border-destructive/20 flex items-center gap-2 text-xs text-destructive">
            <AlertCircle className="w-4 h-4 shrink-0" /> Shopify: {error instanceof Error ? error.message : 'Errore'}
          </div>
        )}

        {isLoading ? (
          <div className="flex items-center justify-center h-64 gap-2 text-muted-foreground">
            <Loader2 className="w-5 h-5 animate-spin" /> Caricamento dati Shopify...
          </div>
        ) : (
          <>
            {/* ── KPIs ──────────────────────────────────────────── */}
            <SectionHeader label="KPI eCommerce B2C" />
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
              <KPI icon={DollarSign} label="Net Sales" value={fmt(kpis.netSales)} sub={salesSummary ? '📊 Report ufficiale' : '📦 Da ordini'} color="hsl(168,70%,42%)" />
              <KPI icon={ShoppingBag} label="Ordini" value={String(kpis.totalOrders)} sub={`${kpis.totalQty} pezzi venduti`} color="hsl(210,80%,55%)" />
              <KPI icon={Target} label="AOV" value={fmt(kpis.aov)} color="hsl(42,96%,48%)" />
              <KPI icon={Users} label="Clienti" value={String(kpis.totalCustomers)} sub={`${kpis.newLast30} nuovi (30g)`} color="hsl(280,60%,55%)" />
              <KPI icon={Repeat} label="Repeat Rate" value={fmtPct(kpis.repeatRate)} sub={`${kpis.repeatCustomers} clienti`} color="hsl(25,90%,55%)" />
              <KPI icon={TrendingUp} label="LTV Medio" value={fmt(kpis.avgLTV)} color="hsl(190,70%,45%)" />
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <KPI icon={DollarSign} label="Gross Sales" value={fmt(kpis.grossSales)} color="hsl(42,70%,50%)" />
              <KPI icon={Package} label="Sconti" value={fmt(kpis.discounts)} sub={kpis.grossSales > 0 ? fmtPct((kpis.discounts / kpis.grossSales) * 100) + ' del gross' : ''} color="hsl(320,60%,50%)" />
              <KPI icon={Clock} label="Resi" value={fmt(kpis.returns)} sub={kpis.grossSales > 0 ? fmtPct((kpis.returns / kpis.grossSales) * 100) + ' del gross' : ''} color="hsl(0,65%,52%)" />
              <KPI icon={Package} label="SKU Attivi" value={String(productRows.length)} color="hsl(140,50%,45%)" />
            </div>

            {/* ── Budget vs Actual mese corrente ─────────────────── */}
            <div className="dashboard-card p-4">
              <SectionHeader label={`Budget vs Actual B2C — ${format(new Date(), 'MMMM yyyy')}`} />
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="border-b border-border/30 text-left text-[10px] text-muted-foreground uppercase tracking-wider">
                      <th className="py-2 px-2">Prodotto</th>
                      <th className="py-2 px-2 text-right">BDG Mese</th>
                      <th className="py-2 px-2 text-right">BDG a Oggi</th>
                      <th className="py-2 px-2 text-right">Actual</th>
                      <th className="py-2 px-2 text-right">% vs BDG Oggi</th>
                    </tr>
                  </thead>
                  <tbody>
                    {budgetVsActual.map(row => (
                      <tr key={row.product} className="border-b border-border/10 hover:bg-muted/30 transition-colors">
                        <td className="py-1.5 px-2 font-semibold">{row.product}</td>
                        <td className="py-1.5 px-2 text-right font-mono text-muted-foreground">{fmt(row.budgetMonth)}</td>
                        <td className="py-1.5 px-2 text-right font-mono text-muted-foreground">{fmt(row.budgetToday)}</td>
                        <td className="py-1.5 px-2 text-right font-mono font-semibold">{fmt(row.actual)}</td>
                        <td className="py-1.5 px-2 text-right font-mono font-bold" style={{
                          color: row.pctVsBudgetToday >= 100 ? 'hsl(168,70%,42%)' : row.pctVsBudgetToday >= 70 ? 'hsl(42,96%,48%)' : 'hsl(0,65%,52%)'
                        }}>
                          {row.budgetToday > 0 ? `${row.pctVsBudgetToday.toFixed(0)}%` : '—'}
                        </td>
                      </tr>
                    ))}
                    {/* Totale */}
                    {(() => {
                      const totBdg = budgetVsActual.reduce((s, r) => s + r.budgetMonth, 0);
                      const totBdgToday = budgetVsActual.reduce((s, r) => s + r.budgetToday, 0);
                      const totActual = budgetVsActual.reduce((s, r) => s + r.actual, 0);
                      const totPct = totBdgToday > 0 ? (totActual / totBdgToday) * 100 : 0;
                      return (
                        <tr className="border-t-2 border-border/40 font-bold">
                          <td className="py-2 px-2">TOTALE</td>
                          <td className="py-2 px-2 text-right font-mono">{fmt(totBdg)}</td>
                          <td className="py-2 px-2 text-right font-mono">{fmt(totBdgToday)}</td>
                          <td className="py-2 px-2 text-right font-mono">{fmt(totActual)}</td>
                          <td className="py-2 px-2 text-right font-mono" style={{
                            color: totPct >= 100 ? 'hsl(168,70%,42%)' : totPct >= 70 ? 'hsl(42,96%,48%)' : 'hsl(0,65%,52%)'
                          }}>
                            {totBdgToday > 0 ? `${totPct.toFixed(0)}%` : '—'}
                          </td>
                        </tr>
                      );
                    })()}
                  </tbody>
                </table>
              </div>
            </div>

            {/* ── Trend + Collections + DOW ─────────────────────── */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
              <div className="lg:col-span-2 dashboard-card p-4">
                <SectionHeader label="Trend Mensile" />
                <ResponsiveContainer width="100%" height={260}>
                  <AreaChart data={monthlyTrend}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" opacity={0.3} />
                    <XAxis dataKey="month" tick={{ fontSize: 10 }} stroke="hsl(var(--muted-foreground))" />
                    <YAxis yAxisId="left" tick={{ fontSize: 10 }} stroke="hsl(var(--muted-foreground))" tickFormatter={v => `€${(v / 1000).toFixed(0)}k`} />
                    <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 10 }} stroke="hsl(var(--muted-foreground))" />
                    <Tooltip formatter={(v: number, name: string) => name === 'revenue' ? fmtDec(v) : v} />
                    <Legend wrapperStyle={{ fontSize: 10 }} />
                    <Area type="monotone" dataKey="revenue" name="Net Sales" stroke="hsl(168,70%,42%)" fill="hsl(168,70%,42%)" fillOpacity={0.15} strokeWidth={2} yAxisId="left" />
                    <Area type="monotone" dataKey="orders" name="Ordini" stroke="hsl(210,80%,55%)" fill="hsl(210,80%,55%)" fillOpacity={0.1} strokeWidth={1.5} yAxisId="right" />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
              <div className="dashboard-card p-4">
                <SectionHeader label="Collezioni" />
                <ResponsiveContainer width="100%" height={180}>
                  <PieChart>
                    <Pie data={collectionData} dataKey="revenue" nameKey="name" cx="50%" cy="50%" innerRadius={35} outerRadius={70} paddingAngle={2}>
                      {collectionData.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                    </Pie>
                    <Tooltip formatter={(v: number) => fmt(v)} />
                  </PieChart>
                </ResponsiveContainer>
                <div className="space-y-1 mt-1">
                  {collectionData.map((c, i) => (
                    <div key={c.name} className="flex items-center justify-between text-[10px]">
                      <div className="flex items-center gap-1.5">
                        <div className="w-2 h-2 rounded-full" style={{ background: COLORS[i % COLORS.length] }} />
                        <span className="text-muted-foreground">{c.name}</span>
                      </div>
                      <span className="font-mono font-semibold">{fmt(c.revenue)}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* ── RFM + Sources + DOW ──────────────────────────── */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
              <div className="dashboard-card p-4">
                <SectionHeader label="Segmenti RFM" />
                <ResponsiveContainer width="100%" height={180}>
                  <PieChart>
                    <Pie data={rfmData} dataKey="count" nameKey="name" cx="50%" cy="50%" innerRadius={35} outerRadius={70} paddingAngle={2}>
                      {rfmData.map(d => <Cell key={d.name} fill={d.fill} />)}
                    </Pie>
                    <Tooltip formatter={(v: number, name: string) => [v, name]} />
                  </PieChart>
                </ResponsiveContainer>
                <div className="space-y-1 mt-1">
                  {rfmData.map(s => (
                    <div key={s.name} className="flex items-center justify-between text-[10px]">
                      <div className="flex items-center gap-1.5">
                        <div className="w-2 h-2 rounded-full" style={{ background: s.fill }} />
                        <span className="text-muted-foreground">{s.name}</span>
                      </div>
                      <span className="font-mono">{s.count} · {fmt(s.revenue)}</span>
                    </div>
                  ))}
                </div>
              </div>
              <div className="dashboard-card p-4">
                <SectionHeader label="Canali Acquisizione" />
                <ResponsiveContainer width="100%" height={Math.max(150, sourceData.length * 30)}>
                  <BarChart data={sourceData} layout="vertical" margin={{ left: 60 }}>
                    <XAxis type="number" tick={{ fontSize: 10 }} tickFormatter={v => `€${(v / 1000).toFixed(0)}k`} />
                    <YAxis type="category" dataKey="source" tick={{ fontSize: 10 }} width={60} />
                    <Tooltip formatter={(v: number) => fmt(v)} />
                    <Bar dataKey="revenue" fill="hsl(168,70%,42%)" radius={[0, 3, 3, 0]}>
                      {sourceData.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
              <div className="dashboard-card p-4">
                <SectionHeader label="Ordini per Giorno" />
                <ResponsiveContainer width="100%" height={180}>
                  <BarChart data={dowData}>
                    <XAxis dataKey="day" tick={{ fontSize: 10 }} />
                    <YAxis tick={{ fontSize: 10 }} />
                    <Tooltip formatter={(v: number, name: string) => name === 'revenue' ? fmt(v) : v} />
                    <Bar dataKey="orders" name="Ordini" fill="hsl(210,80%,55%)" radius={[3, 3, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
                <p className="text-[9px] text-muted-foreground text-center mt-1">Distribuzione ordini per giorno della settimana</p>
              </div>
            </div>

            {/* ── Tab navigation ───────────────────────────────── */}
            <div className="flex gap-1 border-b border-border/30 pb-0">
              {(['overview', 'products', 'orders', 'customers', 'countries'] as const).map(tab => (
                <button key={tab} onClick={() => setActiveTab(tab)}
                  className={`px-3 py-1.5 text-xs font-semibold rounded-t-lg transition-colors ${activeTab === tab ? 'bg-card text-foreground border border-b-0 border-border/30' : 'text-muted-foreground hover:text-foreground'}`}>
                  {tab === 'overview' ? '📊 Overview' : tab === 'products' ? '📦 Prodotti' : tab === 'orders' ? '📋 Ordini' : tab === 'customers' ? '👥 Clienti' : '🌍 Paesi'}
                </button>
              ))}
            </div>

            {/* ── Overview tab ──────────────────────────────────── */}
            {activeTab === 'overview' && (
              <div className="space-y-4">
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                  <div className="dashboard-card p-4">
                    <SectionHeader label="Top 10 Prodotti per Net Sales" />
                    <ResponsiveContainer width="100%" height={300}>
                      <BarChart data={productRows.slice(0, 10)} layout="vertical" margin={{ left: 120 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" opacity={0.3} />
                        <XAxis type="number" tick={{ fontSize: 10 }} tickFormatter={v => `€${(v / 1000).toFixed(0)}k`} />
                        <YAxis type="category" dataKey="name" tick={{ fontSize: 9 }} width={120} />
                        <Tooltip formatter={(v: number) => fmtDec(v)} />
                        <Bar dataKey="netSales" name="Net Sales" fill="hsl(168,70%,42%)" radius={[0, 3, 3, 0]}>
                          {productRows.slice(0, 10).map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                  <div className="dashboard-card p-4">
                    <SectionHeader label="Top 10 Paesi per Revenue" />
                    <ResponsiveContainer width="100%" height={300}>
                      <BarChart data={countryData.slice(0, 10)} layout="vertical" margin={{ left: 80 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" opacity={0.3} />
                        <XAxis type="number" tick={{ fontSize: 10 }} tickFormatter={v => `€${(v / 1000).toFixed(0)}k`} />
                        <YAxis type="category" dataKey="name" tick={{ fontSize: 10 }} width={80} />
                        <Tooltip formatter={(v: number) => fmt(v)} />
                        <Bar dataKey="revenue" name="Net Sales" fill="hsl(210,80%,55%)" radius={[0, 3, 3, 0]}>
                          {countryData.slice(0, 10).map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              </div>
            )}

            {/* ── Products tab ──────────────────────────────────── */}
            {activeTab === 'products' && (
              <div className="dashboard-card p-4">
                <div className="flex items-center justify-between mb-3">
                  <SectionHeader label="Prodotti B2C" />
                  <Button variant="outline" size="sm" className="h-7 text-[10px] gap-1" onClick={() => {
                    downloadCsv('b2c-products', ['SKU', 'Prodotto', 'Collezione', 'Qty', 'Gross Sales', 'Net Sales', 'Ordini', 'Prezzo Medio', 'Paesi', 'Return Rate'],
                      productRows.map(p => [p.sku, p.name, p.collection, p.qty, p.grossSales, p.netSales, p.orders, p.avgPrice, p.countries, p.returnRate + '%']));
                  }}><Download className="w-3 h-3" /> CSV</Button>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="border-b border-border/30 text-left text-[10px] text-muted-foreground uppercase tracking-wider">
                        <th className="py-2 px-2">SKU</th>
                        <th className="py-2 px-2">Prodotto</th>
                        <th className="py-2 px-2">Collezione</th>
                        <th className="py-2 px-2 text-right">Qty</th>
                        <th className="py-2 px-2 text-right">Gross Sales</th>
                        <th className="py-2 px-2 text-right">Net Sales</th>
                        <th className="py-2 px-2 text-right">Ordini</th>
                        <th className="py-2 px-2 text-right">Prezzo Medio</th>
                        <th className="py-2 px-2 text-right">Paesi</th>
                        <th className="py-2 px-2 text-right">Return %</th>
                      </tr>
                    </thead>
                    <tbody>
                      {productRows.map(p => (
                        <tr key={p.sku} className="border-b border-border/10 hover:bg-muted/30 transition-colors">
                          <td className="py-1.5 px-2 font-mono text-[10px]">{p.sku}</td>
                          <td className="py-1.5 px-2 font-medium max-w-[200px] truncate">{p.name}</td>
                          <td className="py-1.5 px-2"><span className="px-1.5 py-0.5 rounded text-[9px] bg-muted">{p.collection}</span></td>
                          <td className="py-1.5 px-2 text-right font-mono">{p.qty}</td>
                          <td className="py-1.5 px-2 text-right font-mono">{fmtDec(p.grossSales)}</td>
                          <td className="py-1.5 px-2 text-right font-mono">{fmtDec(p.netSales)}</td>
                          <td className="py-1.5 px-2 text-right">{p.orders}</td>
                          <td className="py-1.5 px-2 text-right font-mono">{fmtDec(p.avgPrice)}</td>
                          <td className="py-1.5 px-2 text-right">{p.countries}</td>
                          <td className="py-1.5 px-2 text-right font-mono" style={{ color: p.returnRate > 5 ? 'hsl(0,65%,52%)' : undefined }}>{p.returnRate}%</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* ── Orders tab ────────────────────────────────────── */}
            {activeTab === 'orders' && (
              <div className="dashboard-card p-4 space-y-3">
                <div className="flex items-center justify-between gap-2">
                  <div className="relative flex-1 max-w-xs">
                    <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
                    <Input value={search} onChange={e => setSearch(e.target.value)} placeholder="Cerca ordine, cliente, paese..." className="h-7 text-xs pl-7" />
                  </div>
                  <span className="text-[10px] text-muted-foreground">{orderList.length} ordini</span>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="border-b border-border/30 text-left text-[10px] text-muted-foreground uppercase tracking-wider">
                        <th className="py-2 px-1 w-6" />
                        <th className="py-2 px-2">Ordine</th>
                        <th className="py-2 px-2">Cliente</th>
                        <th className="py-2 px-2">Paese</th>
                        <th className="py-2 px-2 text-center">Data</th>
                        <th className="py-2 px-2 text-right">Net Sales</th>
                        <th className="py-2 px-2 text-right">Prodotti</th>
                      </tr>
                    </thead>
                    <tbody>
                      {orderList.slice(0, 100).map(o => {
                        const isExp = expandedOrders.has(o.id);
                        const d = o.date instanceof Date ? o.date : new Date(o.date);
                        return (
                          <>
                            <tr key={o.id} className="border-b border-border/10 hover:bg-muted/30 transition-colors cursor-pointer" onClick={() => toggleOrder(o.id)}>
                              <td className="py-1.5 px-1"><ChevronRight className={`w-3.5 h-3.5 text-muted-foreground transition-transform ${isExp ? 'rotate-90' : ''}`} /></td>
                              <td className="py-1.5 px-2 font-mono text-[10px] font-semibold">#{o.orderNumber}</td>
                              <td className="py-1.5 px-2 font-medium">{o.customerName}</td>
                              <td className="py-1.5 px-2 text-muted-foreground">{o.destinationCountry || o.country || '—'}</td>
                              <td className="py-1.5 px-2 text-center">{format(d, 'dd/MM/yy')}</td>
                              <td className="py-1.5 px-2 text-right font-mono font-semibold">{fmtDec(o.netAmount ?? o.totalAmount)}</td>
                              <td className="py-1.5 px-2 text-right text-muted-foreground">{o.products.length} SKU</td>
                            </tr>
                            {isExp && (
                              <tr key={`${o.id}-d`}>
                                <td colSpan={7} className="p-0">
                                  <div className="bg-muted/20 border-l-2 border-primary/30 ml-6 mr-2 my-1 rounded">
                                    <table className="w-full text-[11px]">
                                      <thead>
                                        <tr className="text-[9px] text-muted-foreground uppercase tracking-wider">
                                          <th className="py-1.5 px-3 text-left">SKU</th>
                                          <th className="py-1.5 px-3 text-left">Prodotto</th>
                                          <th className="py-1.5 px-3 text-right">Qty</th>
                                          <th className="py-1.5 px-3 text-right">Prezzo</th>
                                        </tr>
                                      </thead>
                                      <tbody>
                                        {o.products.map((p, pi) => (
                                          <tr key={pi} className="border-t border-border/10">
                                            <td className="py-1 px-3 font-mono text-[10px]">{p.sku}</td>
                                            <td className="py-1 px-3">{p.name}</td>
                                            <td className="py-1 px-3 text-right font-mono">{p.quantity}</td>
                                            <td className="py-1 px-3 text-right font-mono">{fmtDec(p.totalPrice)}</td>
                                          </tr>
                                        ))}
                                      </tbody>
                                    </table>
                                  </div>
                                </td>
                              </tr>
                            )}
                          </>
                        );
                      })}
                    </tbody>
                  </table>
                  {orderList.length > 100 && <p className="text-[10px] text-muted-foreground mt-2 text-center">Mostrati 100 di {orderList.length}</p>}
                </div>
              </div>
            )}

            {/* ── Customers tab ─────────────────────────────────── */}
            {activeTab === 'customers' && (
              <div className="dashboard-card p-4 space-y-3">
                <div className="flex items-center justify-between gap-2">
                  <div className="relative flex-1 max-w-xs">
                    <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
                    <Input value={search} onChange={e => setSearch(e.target.value)} placeholder="Cerca cliente, paese, città..." className="h-7 text-xs pl-7" />
                  </div>
                  <Button variant="outline" size="sm" className="h-7 text-[10px] gap-1" onClick={() => {
                    downloadCsv('b2c-customers', ['Nome', 'Paese', 'Città', 'Ordini', 'Speso', 'AOV', 'Fonte', 'Primo Ordine', 'Ultimo Ordine', 'Giorni Inattivo', 'Segmento'],
                      sortedCustomers.map(c => [c.name, c.country, c.city, c.orders, c.totalSpent, c.avgOrderValue, c.source, format(c.firstOrder, 'dd/MM/yyyy'), format(c.lastOrder, 'dd/MM/yyyy'), c.daysSinceLast, getRFMSegment(c)]));
                  }}><Download className="w-3 h-3" /> CSV</Button>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="border-b border-border/30 text-left text-[10px] text-muted-foreground uppercase tracking-wider">
                        <th className="py-2 px-2 cursor-pointer" onClick={() => handleSort('name')}>Cliente <ArrowUpDown className="w-2.5 h-2.5 inline" /></th>
                        <th className="py-2 px-2">Paese</th>
                        <th className="py-2 px-2">Fonte</th>
                        <th className="py-2 px-2">Segmento</th>
                        <th className="py-2 px-2 text-right cursor-pointer" onClick={() => handleSort('orders')}>Ordini <ArrowUpDown className="w-2.5 h-2.5 inline" /></th>
                        <th className="py-2 px-2 text-right cursor-pointer" onClick={() => handleSort('totalSpent')}>Speso <ArrowUpDown className="w-2.5 h-2.5 inline" /></th>
                        <th className="py-2 px-2 text-right cursor-pointer" onClick={() => handleSort('avgOrderValue')}>AOV <ArrowUpDown className="w-2.5 h-2.5 inline" /></th>
                        <th className="py-2 px-2 text-right cursor-pointer" onClick={() => handleSort('daysSinceLast')}>Ultimo <ArrowUpDown className="w-2.5 h-2.5 inline" /></th>
                        <th className="py-2 px-2">Prodotti</th>
                      </tr>
                    </thead>
                    <tbody>
                      {sortedCustomers.slice(0, 50).map(c => {
                        const seg = getRFMSegment(c);
                        return (
                          <tr key={c.id} className="border-b border-border/10 hover:bg-muted/30 transition-colors">
                            <td className="py-1.5 px-2 font-medium">{c.name}</td>
                            <td className="py-1.5 px-2 text-muted-foreground">{c.country || '—'}</td>
                            <td className="py-1.5 px-2 text-muted-foreground">{c.source}</td>
                            <td className="py-1.5 px-2"><span className="px-1.5 py-0.5 rounded text-[9px] font-semibold" style={{ background: SEGMENT_COLORS[seg] + '22', color: SEGMENT_COLORS[seg] }}>{seg}</span></td>
                            <td className="py-1.5 px-2 text-right font-mono">{c.orders}</td>
                            <td className="py-1.5 px-2 text-right font-mono">{fmtDec(c.totalSpent)}</td>
                            <td className="py-1.5 px-2 text-right font-mono">{fmtDec(c.avgOrderValue)}</td>
                            <td className="py-1.5 px-2 text-right text-muted-foreground">{format(c.lastOrder, 'dd/MM/yy')} <span className="text-[9px]">({c.daysSinceLast}g)</span></td>
                            <td className="py-1.5 px-2 text-muted-foreground max-w-[160px] truncate" title={c.products.join(', ')}>{c.products.slice(0, 3).join(', ')}{c.products.length > 3 && ` +${c.products.length - 3}`}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                  {sortedCustomers.length > 50 && <p className="text-[10px] text-muted-foreground mt-2 text-center">Mostrati 50 di {sortedCustomers.length}</p>}
                </div>
              </div>
            )}

            {/* ── Countries tab ─────────────────────────────────── */}
            {activeTab === 'countries' && (
              <div className="space-y-4">
                <div className="dashboard-card p-4">
                  <SectionHeader label="Breakdown per Paese" />
                  <ResponsiveContainer width="100%" height={Math.max(200, Math.min(countryData.length, 15) * 30)}>
                    <BarChart data={countryData.slice(0, 15)} layout="vertical" margin={{ left: 80 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" opacity={0.3} />
                      <XAxis type="number" tick={{ fontSize: 10 }} tickFormatter={v => `€${(v / 1000).toFixed(0)}k`} />
                      <YAxis type="category" dataKey="name" tick={{ fontSize: 10 }} width={80} />
                      <Tooltip formatter={(v: number) => fmt(v)} />
                      <Bar dataKey="revenue" name="Net Sales" fill="hsl(168,70%,42%)" radius={[0, 3, 3, 0]}>
                        {countryData.slice(0, 15).map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
                <div className="dashboard-card p-4">
                  <div className="overflow-x-auto">
                    <table className="w-full text-xs">
                      <thead>
                        <tr className="border-b border-border/30 text-left text-[10px] text-muted-foreground uppercase tracking-wider">
                          <th className="py-2 px-2">Paese</th>
                          <th className="py-2 px-2 text-right">Ordini</th>
                          <th className="py-2 px-2 text-right">Clienti</th>
                          <th className="py-2 px-2 text-right">Qty</th>
                          <th className="py-2 px-2 text-right">Net Sales</th>
                          <th className="py-2 px-2 text-right">AOV</th>
                          <th className="py-2 px-2 text-right">Rev/Cliente</th>
                        </tr>
                      </thead>
                      <tbody>
                        {countryData.map(c => (
                          <tr key={c.name} className="border-b border-border/10 hover:bg-muted/30 transition-colors">
                            <td className="py-1.5 px-2 font-medium">{c.name}</td>
                            <td className="py-1.5 px-2 text-right font-mono">{c.orders}</td>
                            <td className="py-1.5 px-2 text-right">{c.customers}</td>
                            <td className="py-1.5 px-2 text-right font-mono">{c.qty}</td>
                            <td className="py-1.5 px-2 text-right font-mono">{fmt(c.revenue)}</td>
                            <td className="py-1.5 px-2 text-right font-mono">{fmt(c.aov)}</td>
                            <td className="py-1.5 px-2 text-right font-mono">{c.customers > 0 ? fmt(c.revenue / c.customers) : '—'}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            )}

            {/* ── AI Assistant ──────────────────────────────────── */}
            <AiAssistant dashboardContext={aiContext} />
          </>
        )}
      </div>
    </div>
  );
}
