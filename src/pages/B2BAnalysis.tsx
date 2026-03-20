import { useState, useMemo, useCallback } from 'react';
import { subDays, format, differenceInDays } from 'date-fns';
import { DashboardHeader } from '@/components/dashboard/DashboardHeader';
import { NavLink } from '@/components/NavLink';
import { useGoogleSheetsOrders } from '@/hooks/useGoogleSheetsOrders';
import { useLanguage } from '@/contexts/LanguageContext';
import { Order } from '@/types/analytics';
import { downloadCsv } from '@/lib/csv-export';
import { AiAssistant } from '@/components/dashboard/AiAssistant';
import { getSkuCollection } from '@/lib/mock-data';
import {
  Users, TrendingUp, Globe, Package, Truck, DollarSign, BarChart3,
  ArrowUpDown, Download, Search, Calendar, ChevronDown, CreditCard,
  Loader2, AlertCircle, UserCheck, Repeat, ShoppingBag, Target, Clock,
} from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar as CalendarComponent } from '@/components/ui/calendar';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell,
  PieChart, Pie, LineChart, Line, Legend,
} from 'recharts';

const fmt = (v: number) => new Intl.NumberFormat('it-IT', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(v);
const fmtDec = (v: number) => new Intl.NumberFormat('it-IT', { style: 'currency', currency: 'EUR' }).format(v);
const fmtPct = (v: number) => `${v.toFixed(1)}%`;

// ─── Build B2B customer records ──────────────────────────────────────────
interface B2BCustomer {
  id: string;
  name: string;
  orders: number;
  totalOrdered: number;        // sum price by order date
  totalDelivered: number;      // sum price by delivery date
  totalPaid: number;           // sum price by paid date
  avgOrderValue: number;
  firstOrder: Date;
  lastOrder: Date;
  daysSinceLast: number;
  country: string;
  agent: string;
  products: string[];
  skus: string[];
  collections: string[];
  pendingAmount: number;       // ordered but not delivered
  unpaidAmount: number;        // delivered but not paid
}

function buildB2BCustomers(orders: Order[]): B2BCustomer[] {
  const map: Record<string, {
    name: string; orders: Set<string>; totalOrdered: number; totalDelivered: number; totalPaid: number;
    firstOrder: Date; lastOrder: Date; country: string; agent: string;
    products: Set<string>; skus: Set<string>; collections: Set<string>;
  }> = {};

  orders.forEach(o => {
    if (o.customerType !== 'B2B') return;
    if (o.orderType?.toLowerCase() === 'custom') return;
    const cid = o.customerId;
    const d = o.date instanceof Date ? o.date : new Date(o.date);
    const price = o.products.reduce((s, p) => s + p.totalPrice, 0);

    if (!map[cid]) {
      map[cid] = {
        name: o.customerName, orders: new Set(), totalOrdered: 0, totalDelivered: 0, totalPaid: 0,
        firstOrder: d, lastOrder: d, country: o.country || '', agent: o.agent || '',
        products: new Set(), skus: new Set(), collections: new Set(),
      };
    }
    const c = map[cid];
    c.orders.add(o.orderNumber);
    c.totalOrdered += price;
    if (o.deliveryDate) c.totalDelivered += price;
    if (o.payedDate) c.totalPaid += price;
    if (d < c.firstOrder) c.firstOrder = d;
    if (d > c.lastOrder) { c.lastOrder = d; c.country = o.country || c.country; c.agent = o.agent || c.agent; }
    o.products.forEach(p => { c.products.add(p.name); c.skus.add(p.sku); c.collections.add(getSkuCollection(p.sku)); });
  });

  const now = new Date();
  return Object.entries(map).map(([id, c]) => ({
    id, name: c.name,
    orders: c.orders.size,
    totalOrdered: Math.round(c.totalOrdered * 100) / 100,
    totalDelivered: Math.round(c.totalDelivered * 100) / 100,
    totalPaid: Math.round(c.totalPaid * 100) / 100,
    avgOrderValue: c.orders.size > 0 ? Math.round((c.totalOrdered / c.orders.size) * 100) / 100 : 0,
    firstOrder: c.firstOrder, lastOrder: c.lastOrder,
    daysSinceLast: differenceInDays(now, c.lastOrder),
    country: c.country, agent: c.agent,
    products: Array.from(c.products), skus: Array.from(c.skus), collections: Array.from(c.collections),
    pendingAmount: Math.round((c.totalOrdered - c.totalDelivered) * 100) / 100,
    unpaidAmount: Math.round((c.totalDelivered - c.totalPaid) * 100) / 100,
  })).sort((a, b) => b.totalOrdered - a.totalOrdered);
}

// ─── B2B product breakdown ───────────────────────────────────────────────
interface B2BProduct {
  sku: string;
  name: string;
  collection: string;
  qty: number;
  totalOrdered: number;
  totalDelivered: number;
  avgPrice: number;
  customers: number;
  countries: number;
}

function buildB2BProducts(orders: Order[]): B2BProduct[] {
  const map: Record<string, { name: string; collection: string; qty: number; totalOrdered: number; totalDelivered: number; prices: number[]; customers: Set<string>; countries: Set<string> }> = {};

  orders.forEach(o => {
    if (o.customerType !== 'B2B' || o.orderType?.toLowerCase() === 'custom') return;
    o.products.forEach(p => {
      const key = p.sku || p.name;
      if (!map[key]) {
        map[key] = { name: p.name, collection: getSkuCollection(p.sku), qty: 0, totalOrdered: 0, totalDelivered: 0, prices: [], customers: new Set(), countries: new Set() };
      }
      const m = map[key];
      m.qty += p.quantity;
      m.totalOrdered += p.totalPrice;
      if (o.deliveryDate) m.totalDelivered += p.totalPrice;
      m.prices.push(p.unitPrice || (p.totalPrice / p.quantity));
      m.customers.add(o.customerId);
      if (o.country) m.countries.add(o.country);
    });
  });

  return Object.entries(map).map(([sku, m]) => ({
    sku, name: m.name, collection: m.collection, qty: m.qty,
    totalOrdered: Math.round(m.totalOrdered * 100) / 100,
    totalDelivered: Math.round(m.totalDelivered * 100) / 100,
    avgPrice: m.prices.length > 0 ? Math.round((m.prices.reduce((s, v) => s + v, 0) / m.prices.length) * 100) / 100 : 0,
    customers: m.customers.size,
    countries: m.countries.size,
  })).sort((a, b) => b.totalOrdered - a.totalOrdered);
}

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

const CHART_COLORS = [
  'hsl(42,96%,48%)', 'hsl(210,80%,55%)', 'hsl(168,70%,42%)', 'hsl(280,60%,55%)',
  'hsl(25,90%,55%)', 'hsl(0,65%,52%)', 'hsl(190,70%,45%)', 'hsl(320,60%,50%)',
];

export default function B2BAnalysis() {
  const { t } = useLanguage();
  const { data: gsOrders = [], isLoading, isError, error, refetch, isFetching } = useGoogleSheetsOrders(true);

  const [dateRange, setDateRange] = useState<{ start: Date; end: Date }>({
    start: new Date('2024-01-01'),
    end: new Date(),
  });
  const [calendarOpen, setCalendarOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [sortField, setSortField] = useState<'totalOrdered' | 'orders' | 'name' | 'totalDelivered' | 'avgOrderValue' | 'pendingAmount'>('totalOrdered');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');
  const [activeTab, setActiveTab] = useState<'customers' | 'products' | 'agents' | 'countries'>('customers');

  // Filter orders by date range (order date)
  const filteredOrders = useMemo(() => {
    const endOfDay = new Date(dateRange.end);
    endOfDay.setHours(23, 59, 59, 999);
    return gsOrders.filter(o => {
      if (o.customerType !== 'B2B') return false;
      const d = o.date instanceof Date ? o.date : new Date(o.date);
      return d >= dateRange.start && d <= endOfDay;
    });
  }, [gsOrders, dateRange]);

  const customers = useMemo(() => buildB2BCustomers(filteredOrders), [filteredOrders]);
  const products = useMemo(() => buildB2BProducts(filteredOrders), [filteredOrders]);

  // ── Aggregate KPIs ──────────────────────────────────────────────────────
  const kpis = useMemo(() => {
    const totalClients = customers.length;
    const totalOrders = customers.reduce((s, c) => s + c.orders, 0);
    const totalOrdered = customers.reduce((s, c) => s + c.totalOrdered, 0);
    const totalDelivered = customers.reduce((s, c) => s + c.totalDelivered, 0);
    const totalPaid = customers.reduce((s, c) => s + c.totalPaid, 0);
    const avgOrderVal = totalOrders > 0 ? totalOrdered / totalOrders : 0;
    const pendingDelivery = totalOrdered - totalDelivered;
    const unpaid = totalDelivered - totalPaid;
    const repeatClients = customers.filter(c => c.orders > 1).length;
    const repeatRate = totalClients > 0 ? (repeatClients / totalClients) * 100 : 0;
    const avgLTV = totalClients > 0 ? totalOrdered / totalClients : 0;
    return { totalClients, totalOrders, totalOrdered, totalDelivered, totalPaid, avgOrderVal, pendingDelivery, unpaid, repeatClients, repeatRate, avgLTV };
  }, [customers]);

  // ── Agent breakdown ─────────────────────────────────────────────────────
  const agentData = useMemo(() => {
    const map: Record<string, { orders: number; revenue: number; clients: Set<string>; delivered: number }> = {};
    filteredOrders.forEach(o => {
      if (o.orderType?.toLowerCase() === 'custom') return;
      const agent = o.agent || 'N/A';
      if (!map[agent]) map[agent] = { orders: 0, revenue: 0, clients: new Set(), delivered: 0 };
      map[agent].orders++;
      const price = o.products.reduce((s, p) => s + p.totalPrice, 0);
      map[agent].revenue += price;
      map[agent].clients.add(o.customerId);
      if (o.deliveryDate) map[agent].delivered += price;
    });
    return Object.entries(map)
      .map(([name, d]) => ({ name, orders: d.orders, revenue: Math.round(d.revenue), clients: d.clients.size, delivered: Math.round(d.delivered) }))
      .sort((a, b) => b.revenue - a.revenue);
  }, [filteredOrders]);

  // ── Country breakdown ───────────────────────────────────────────────────
  const countryData = useMemo(() => {
    const map: Record<string, { orders: number; revenue: number; clients: Set<string>; delivered: number }> = {};
    filteredOrders.forEach(o => {
      if (o.orderType?.toLowerCase() === 'custom') return;
      const country = o.country || 'N/A';
      if (!map[country]) map[country] = { orders: 0, revenue: 0, clients: new Set(), delivered: 0 };
      map[country].orders++;
      const price = o.products.reduce((s, p) => s + p.totalPrice, 0);
      map[country].revenue += price;
      map[country].clients.add(o.customerId);
      if (o.deliveryDate) map[country].delivered += price;
    });
    return Object.entries(map)
      .map(([name, d]) => ({ name, orders: d.orders, revenue: Math.round(d.revenue), clients: d.clients.size, delivered: Math.round(d.delivered) }))
      .sort((a, b) => b.revenue - a.revenue);
  }, [filteredOrders]);

  // ── Monthly trend ───────────────────────────────────────────────────────
  const monthlyTrend = useMemo(() => {
    const map: Record<string, { ordered: number; delivered: number; paid: number }> = {};
    filteredOrders.forEach(o => {
      if (o.orderType?.toLowerCase() === 'custom') return;
      const d = o.date instanceof Date ? o.date : new Date(o.date);
      const key = format(d, 'yyyy-MM');
      if (!map[key]) map[key] = { ordered: 0, delivered: 0, paid: 0 };
      const price = o.products.reduce((s, p) => s + p.totalPrice, 0);
      map[key].ordered += price;
      if (o.deliveryDate) map[key].delivered += price;
      if (o.payedDate) map[key].paid += price;
    });
    return Object.entries(map).sort((a, b) => a[0].localeCompare(b[0])).map(([month, d]) => ({
      month: format(new Date(month + '-01'), 'MMM yy'),
      ordered: Math.round(d.ordered),
      delivered: Math.round(d.delivered),
      paid: Math.round(d.paid),
    }));
  }, [filteredOrders]);

  // ── Collection breakdown ────────────────────────────────────────────────
  const collectionData = useMemo(() => {
    const map: Record<string, { qty: number; revenue: number }> = {};
    filteredOrders.forEach(o => {
      if (o.orderType?.toLowerCase() === 'custom') return;
      o.products.forEach(p => {
        const coll = getSkuCollection(p.sku);
        if (!map[coll]) map[coll] = { qty: 0, revenue: 0 };
        map[coll].qty += p.quantity;
        map[coll].revenue += p.totalPrice;
      });
    });
    return Object.entries(map)
      .map(([name, d]) => ({ name, qty: d.qty, revenue: Math.round(d.revenue) }))
      .sort((a, b) => b.revenue - a.revenue);
  }, [filteredOrders]);

  // ── Price analysis by product ───────────────────────────────────────────
  const priceAnalysis = useMemo(() => {
    const map: Record<string, { prices: number[]; name: string }> = {};
    filteredOrders.forEach(o => {
      if (o.orderType?.toLowerCase() === 'custom') return;
      o.products.forEach(p => {
        const key = p.sku || p.name;
        if (!map[key]) map[key] = { prices: [], name: p.name };
        const unitP = p.unitPrice || (p.totalPrice / p.quantity);
        if (unitP > 0) map[key].prices.push(unitP);
      });
    });
    return Object.entries(map)
      .filter(([, d]) => d.prices.length >= 2)
      .map(([sku, d]) => {
        const sorted = [...d.prices].sort((a, b) => a - b);
        const min = sorted[0];
        const max = sorted[sorted.length - 1];
        const avg = d.prices.reduce((s, v) => s + v, 0) / d.prices.length;
        const variance = max > 0 ? ((max - min) / avg) * 100 : 0;
        return { sku, name: d.name, min: Math.round(min * 100) / 100, max: Math.round(max * 100) / 100, avg: Math.round(avg * 100) / 100, variance: Math.round(variance * 10) / 10, count: d.prices.length };
      })
      .sort((a, b) => b.variance - a.variance);
  }, [filteredOrders]);

  // ── Sort & filter customers ─────────────────────────────────────────────
  const sortedCustomers = useMemo(() => {
    let list = customers;
    if (search) {
      const q = search.toLowerCase();
      list = list.filter(c => c.name.toLowerCase().includes(q) || c.country.toLowerCase().includes(q) || c.agent.toLowerCase().includes(q));
    }
    return [...list].sort((a, b) => {
      const av = a[sortField], bv = b[sortField];
      if (typeof av === 'string') return sortDir === 'asc' ? av.localeCompare(bv as string) : (bv as string).localeCompare(av);
      return sortDir === 'asc' ? (av as number) - (bv as number) : (bv as number) - (av as number);
    });
  }, [customers, search, sortField, sortDir]);

  const handleSort = useCallback((field: typeof sortField) => {
    if (sortField === field) setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    else { setSortField(field); setSortDir('desc'); }
  }, [sortField]);

  const exportCustomersCsv = () => {
    downloadCsv('b2b-customers', ['Nome', 'Paese', 'Agente', 'Ordini', 'Totale Ordinato', 'Consegnato', 'Pagato', 'In Attesa', 'Non Pagato', 'AOV', 'Primo Ordine', 'Ultimo Ordine', 'Giorni Inattivo', 'Prodotti'],
      sortedCustomers.map(c => [c.name, c.country, c.agent, c.orders, c.totalOrdered, c.totalDelivered, c.totalPaid, c.pendingAmount, c.unpaidAmount, c.avgOrderValue, format(c.firstOrder, 'dd/MM/yyyy'), format(c.lastOrder, 'dd/MM/yyyy'), c.daysSinceLast, c.products.join('; ')])
    );
  };

  const exportProductsCsv = () => {
    downloadCsv('b2b-products', ['SKU', 'Prodotto', 'Collezione', 'Qty', 'Ordinato', 'Consegnato', 'Prezzo Medio', 'Clienti', 'Paesi'],
      products.map(p => [p.sku, p.name, p.collection, p.qty, p.totalOrdered, p.totalDelivered, p.avgPrice, p.customers, p.countries])
    );
  };

  // ── AI context ──────────────────────────────────────────────────────────
  const aiContext = useMemo(() => {
    const lines: string[] = [];
    lines.push(`=== ANALISI B2B ===`);
    lines.push(`Periodo: ${format(dateRange.start, 'dd/MM/yyyy')} - ${format(dateRange.end, 'dd/MM/yyyy')}`);
    lines.push(`Clienti totali: ${kpis.totalClients} | Ordini: ${kpis.totalOrders}`);
    lines.push(`Totale Ordinato: €${kpis.totalOrdered.toLocaleString('it-IT')} | Consegnato: €${kpis.totalDelivered.toLocaleString('it-IT')} | Pagato: €${kpis.totalPaid.toLocaleString('it-IT')}`);
    lines.push(`In attesa consegna: €${kpis.pendingDelivery.toLocaleString('it-IT')} | Non pagato: €${kpis.unpaid.toLocaleString('it-IT')}`);
    lines.push(`Tasso repeat: ${kpis.repeatRate.toFixed(1)}% | AOV medio: €${kpis.avgOrderVal.toLocaleString('it-IT')} | LTV medio: €${kpis.avgLTV.toLocaleString('it-IT')}`);
    lines.push('\n--- TOP CLIENTI ---');
    customers.slice(0, 15).forEach(c => lines.push(`${c.name}: ${c.orders} ordini, €${c.totalOrdered.toLocaleString('it-IT')} ordinato, €${c.totalDelivered.toLocaleString('it-IT')} consegnato, ${c.country}, agente: ${c.agent}, giorni inattivo: ${c.daysSinceLast}`));
    lines.push('\n--- PRODOTTI ---');
    products.slice(0, 15).forEach(p => lines.push(`${p.sku} ${p.name}: ${p.qty} pz, €${p.totalOrdered.toLocaleString('it-IT')}, prezzo medio €${p.avgPrice}, ${p.customers} clienti, ${p.countries} paesi`));
    lines.push('\n--- AGENTI ---');
    agentData.forEach(a => lines.push(`${a.name}: ${a.orders} ordini, €${a.revenue.toLocaleString('it-IT')}, ${a.clients} clienti`));
    lines.push('\n--- PAESI ---');
    countryData.forEach(c => lines.push(`${c.name}: ${c.orders} ordini, €${c.revenue.toLocaleString('it-IT')}, ${c.clients} clienti`));
    lines.push('\n--- ANALISI PREZZI (varianza >10%) ---');
    priceAnalysis.filter(p => p.variance > 10).forEach(p => lines.push(`${p.sku}: min €${p.min}, max €${p.max}, avg €${p.avg}, varianza ${p.variance}%`));
    lines.push('\n--- TREND MENSILE ---');
    monthlyTrend.forEach(m => lines.push(`${m.month}: ordinato €${m.ordered.toLocaleString('it-IT')}, consegnato €${m.delivered.toLocaleString('it-IT')}`));
    return lines.join('\n');
  }, [dateRange, kpis, customers, products, agentData, countryData, priceAnalysis, monthlyTrend]);

  // ── Nav links (same across all pages) ───────────────────────────────────
  const navLinkClass = "px-3.5 py-1.5 rounded-lg text-xs font-semibold bg-muted text-muted-foreground hover:text-foreground transition-colors";
  const activeClass = "bg-primary text-primary-foreground";

  return (
    <div className="min-h-screen bg-background p-4 sm:p-6">
      <div className="max-w-[1520px] mx-auto space-y-5">

        <DashboardHeader onRefresh={() => refetch()} isLoading={isFetching} />

        {/* Nav */}
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex gap-1.5 flex-wrap">
            <NavLink to="/" className={navLinkClass} activeClassName={activeClass}>{t('nav.sales')}</NavLink>
            <NavLink to="/meta-ads" className={navLinkClass} activeClassName={activeClass}>{t('nav.meta')}</NavLink>
            <NavLink to="/budget-2026" className={navLinkClass} activeClassName={activeClass}>{t('nav.budget')}</NavLink>
            <NavLink to="/geo-insights" className={navLinkClass} activeClassName={activeClass}>{t('nav.geo')}</NavLink>
            <NavLink to="/product-analysis" className={navLinkClass} activeClassName={activeClass}>{t('nav.products')}</NavLink>
            <NavLink to="/b2c-customers" className={navLinkClass} activeClassName={activeClass}>Clienti B2C</NavLink>
            <NavLink to="/b2b-analysis" className={navLinkClass} activeClassName={activeClass}>Analisi B2B</NavLink>
          </div>

          {/* Date range */}
          <div className="flex items-center gap-2">
            {DATE_PRESETS.map(p => (
              <button key={p.label} onClick={() => setDateRange({ start: p.days ? subDays(new Date(), p.days) : new Date('2024-01-01'), end: new Date() })}
                className={`px-2 py-1 text-[10px] font-bold rounded transition-colors ${!p.days && dateRange.start <= new Date('2024-01-02') ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground hover:text-foreground'}`}>
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
                  numberOfMonths={2} />
              </PopoverContent>
            </Popover>
          </div>
        </div>

        {/* Errors */}
        {isError && (
          <div className="p-3 rounded-lg bg-destructive/10 border border-destructive/20 flex items-center gap-2 text-xs text-destructive">
            <AlertCircle className="w-4 h-4 shrink-0" />
            Google Sheets: {error instanceof Error ? error.message : 'Errore'}
          </div>
        )}

        {isLoading ? (
          <div className="flex items-center justify-center h-64 gap-2 text-muted-foreground">
            <Loader2 className="w-5 h-5 animate-spin" /> Caricamento dati B2B...
          </div>
        ) : (
          <>
            {/* ── KPIs ──────────────────────────────────────────── */}
            <SectionHeader label="KPI B2B Sales" />
            <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-5 gap-3">
              <KPI icon={Users} label="Clienti" value={String(kpis.totalClients)} sub={`${kpis.repeatClients} repeat (${fmtPct(kpis.repeatRate)})`} color="hsl(42,96%,48%)" />
              <KPI icon={ShoppingBag} label="Ordini" value={String(kpis.totalOrders)} sub={`AOV: ${fmt(kpis.avgOrderVal)}`} color="hsl(210,80%,55%)" />
              <KPI icon={Target} label="Totale Ordinato" value={fmt(kpis.totalOrdered)} color="hsl(168,70%,42%)" />
              <KPI icon={Truck} label="Consegnato (Revenue)" value={fmt(kpis.totalDelivered)} sub={`${fmtPct(kpis.totalOrdered > 0 ? (kpis.totalDelivered / kpis.totalOrdered) * 100 : 0)} del totale`} color="hsl(280,60%,55%)" />
              <KPI icon={CreditCard} label="Pagato" value={fmt(kpis.totalPaid)} sub={`${fmtPct(kpis.totalDelivered > 0 ? (kpis.totalPaid / kpis.totalDelivered) * 100 : 0)} del consegnato`} color="hsl(25,90%,55%)" />
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <KPI icon={Clock} label="In attesa consegna" value={fmt(kpis.pendingDelivery)} color="hsl(40,80%,50%)" />
              <KPI icon={DollarSign} label="Non pagato" value={fmt(kpis.unpaid)} sub={kpis.unpaid > 0 ? '⚠️ Da incassare' : '✓'} color={kpis.unpaid > 0 ? 'hsl(0,65%,52%)' : 'hsl(168,70%,42%)'} />
              <KPI icon={TrendingUp} label="LTV Medio" value={fmt(kpis.avgLTV)} color="hsl(190,70%,45%)" />
              <KPI icon={Repeat} label="Tasso Repeat" value={fmtPct(kpis.repeatRate)} sub={`${kpis.repeatClients} su ${kpis.totalClients}`} color="hsl(320,60%,50%)" />
            </div>

            {/* ── Trend + Collections ──────────────────────────── */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
              {/* Monthly trend */}
              <div className="lg:col-span-2 dashboard-card p-4">
                <SectionHeader label="Trend Mensile" />
                <ResponsiveContainer width="100%" height={260}>
                  <BarChart data={monthlyTrend}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" opacity={0.3} />
                    <XAxis dataKey="month" tick={{ fontSize: 10 }} stroke="hsl(var(--muted-foreground))" />
                    <YAxis tick={{ fontSize: 10 }} stroke="hsl(var(--muted-foreground))" tickFormatter={v => `€${(v / 1000).toFixed(0)}k`} />
                    <Tooltip formatter={(v: number) => fmtDec(v)} />
                    <Legend wrapperStyle={{ fontSize: 10 }} />
                    <Bar dataKey="ordered" name="Ordinato" fill="hsl(42,96%,48%)" radius={[3, 3, 0, 0]} />
                    <Bar dataKey="delivered" name="Consegnato" fill="hsl(168,70%,42%)" radius={[3, 3, 0, 0]} />
                    <Bar dataKey="paid" name="Pagato" fill="hsl(210,80%,55%)" radius={[3, 3, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>

              {/* Collection pie */}
              <div className="dashboard-card p-4">
                <SectionHeader label="Collezioni" />
                <ResponsiveContainer width="100%" height={200}>
                  <PieChart>
                    <Pie data={collectionData} dataKey="revenue" nameKey="name" cx="50%" cy="50%" innerRadius={40} outerRadius={75} paddingAngle={2}>
                      {collectionData.map((_, i) => <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />)}
                    </Pie>
                    <Tooltip formatter={(v: number) => fmt(v)} />
                  </PieChart>
                </ResponsiveContainer>
                <div className="space-y-1 mt-2">
                  {collectionData.map((c, i) => (
                    <div key={c.name} className="flex items-center justify-between text-[10px]">
                      <div className="flex items-center gap-1.5">
                        <div className="w-2 h-2 rounded-full" style={{ background: CHART_COLORS[i % CHART_COLORS.length] }} />
                        <span className="text-muted-foreground">{c.name}</span>
                      </div>
                      <span className="font-mono font-semibold">{fmt(c.revenue)} ({c.qty} pz)</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* ── Tab navigation ───────────────────────────────── */}
            <div className="flex gap-1 border-b border-border/30 pb-0">
              {(['customers', 'products', 'agents', 'countries'] as const).map(tab => (
                <button key={tab} onClick={() => setActiveTab(tab)}
                  className={`px-3 py-1.5 text-xs font-semibold rounded-t-lg transition-colors ${activeTab === tab ? 'bg-card text-foreground border border-b-0 border-border/30' : 'text-muted-foreground hover:text-foreground'}`}>
                  {tab === 'customers' ? '👥 Clienti' : tab === 'products' ? '📦 Prodotti' : tab === 'agents' ? '🤝 Agenti' : '🌍 Paesi'}
                </button>
              ))}
            </div>

            {/* ── Customers tab ─────────────────────────────────── */}
            {activeTab === 'customers' && (
              <div className="dashboard-card p-4 space-y-3">
                <div className="flex items-center justify-between gap-2">
                  <div className="relative flex-1 max-w-xs">
                    <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
                    <Input value={search} onChange={e => setSearch(e.target.value)} placeholder="Cerca cliente, paese, agente..." className="h-7 text-xs pl-7" />
                  </div>
                  <Button variant="outline" size="sm" className="h-7 text-[10px] gap-1" onClick={exportCustomersCsv}>
                    <Download className="w-3 h-3" /> CSV
                  </Button>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="border-b border-border/30 text-left text-[10px] text-muted-foreground uppercase tracking-wider">
                        <th className="py-2 px-2 cursor-pointer" onClick={() => handleSort('name')}>Cliente {sortField === 'name' && <ArrowUpDown className="w-2.5 h-2.5 inline" />}</th>
                        <th className="py-2 px-2">Paese</th>
                        <th className="py-2 px-2">Agente</th>
                        <th className="py-2 px-2 text-right cursor-pointer" onClick={() => handleSort('orders')}>Ordini {sortField === 'orders' && <ArrowUpDown className="w-2.5 h-2.5 inline" />}</th>
                        <th className="py-2 px-2 text-right cursor-pointer" onClick={() => handleSort('totalOrdered')}>Ordinato {sortField === 'totalOrdered' && <ArrowUpDown className="w-2.5 h-2.5 inline" />}</th>
                        <th className="py-2 px-2 text-right cursor-pointer" onClick={() => handleSort('totalDelivered')}>Consegnato {sortField === 'totalDelivered' && <ArrowUpDown className="w-2.5 h-2.5 inline" />}</th>
                        <th className="py-2 px-2 text-right cursor-pointer" onClick={() => handleSort('pendingAmount')}>In Attesa {sortField === 'pendingAmount' && <ArrowUpDown className="w-2.5 h-2.5 inline" />}</th>
                        <th className="py-2 px-2 text-right cursor-pointer" onClick={() => handleSort('avgOrderValue')}>AOV {sortField === 'avgOrderValue' && <ArrowUpDown className="w-2.5 h-2.5 inline" />}</th>
                        <th className="py-2 px-2 text-right">Ultimo Ordine</th>
                        <th className="py-2 px-2">Prodotti</th>
                      </tr>
                    </thead>
                    <tbody>
                      {sortedCustomers.slice(0, 50).map(c => (
                        <tr key={c.id} className="border-b border-border/10 hover:bg-muted/30 transition-colors">
                          <td className="py-1.5 px-2 font-medium">{c.name}</td>
                          <td className="py-1.5 px-2 text-muted-foreground">{c.country || '—'}</td>
                          <td className="py-1.5 px-2 text-muted-foreground">{c.agent || '—'}</td>
                          <td className="py-1.5 px-2 text-right font-mono">{c.orders}</td>
                          <td className="py-1.5 px-2 text-right font-mono">{fmtDec(c.totalOrdered)}</td>
                          <td className="py-1.5 px-2 text-right font-mono">{fmtDec(c.totalDelivered)}</td>
                          <td className="py-1.5 px-2 text-right font-mono" style={{ color: c.pendingAmount > 0 ? 'hsl(40,80%,50%)' : undefined }}>{c.pendingAmount > 0 ? fmtDec(c.pendingAmount) : '—'}</td>
                          <td className="py-1.5 px-2 text-right font-mono">{fmtDec(c.avgOrderValue)}</td>
                          <td className="py-1.5 px-2 text-right text-muted-foreground">{format(c.lastOrder, 'dd/MM/yy')} <span className="text-[9px]">({c.daysSinceLast}g)</span></td>
                          <td className="py-1.5 px-2 text-muted-foreground max-w-[180px] truncate" title={c.products.join(', ')}>{c.products.slice(0, 3).join(', ')}{c.products.length > 3 && ` +${c.products.length - 3}`}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  {sortedCustomers.length > 50 && <p className="text-[10px] text-muted-foreground mt-2 text-center">Mostrati 50 di {sortedCustomers.length} clienti</p>}
                </div>
              </div>
            )}

            {/* ── Products tab ──────────────────────────────────── */}
            {activeTab === 'products' && (
              <div className="space-y-4">
                <div className="dashboard-card p-4">
                  <div className="flex items-center justify-between mb-3">
                    <SectionHeader label="Prodotti B2B" />
                    <Button variant="outline" size="sm" className="h-7 text-[10px] gap-1" onClick={exportProductsCsv}>
                      <Download className="w-3 h-3" /> CSV
                    </Button>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full text-xs">
                      <thead>
                        <tr className="border-b border-border/30 text-left text-[10px] text-muted-foreground uppercase tracking-wider">
                          <th className="py-2 px-2">SKU</th>
                          <th className="py-2 px-2">Prodotto</th>
                          <th className="py-2 px-2">Collezione</th>
                          <th className="py-2 px-2 text-right">Qty</th>
                          <th className="py-2 px-2 text-right">Ordinato</th>
                          <th className="py-2 px-2 text-right">Consegnato</th>
                          <th className="py-2 px-2 text-right">Prezzo Medio</th>
                          <th className="py-2 px-2 text-right">Clienti</th>
                          <th className="py-2 px-2 text-right">Paesi</th>
                        </tr>
                      </thead>
                      <tbody>
                        {products.map(p => (
                          <tr key={p.sku} className="border-b border-border/10 hover:bg-muted/30 transition-colors">
                            <td className="py-1.5 px-2 font-mono text-[10px]">{p.sku}</td>
                            <td className="py-1.5 px-2 font-medium max-w-[200px] truncate">{p.name}</td>
                            <td className="py-1.5 px-2"><span className="px-1.5 py-0.5 rounded text-[9px] bg-muted">{p.collection}</span></td>
                            <td className="py-1.5 px-2 text-right font-mono">{p.qty}</td>
                            <td className="py-1.5 px-2 text-right font-mono">{fmtDec(p.totalOrdered)}</td>
                            <td className="py-1.5 px-2 text-right font-mono">{fmtDec(p.totalDelivered)}</td>
                            <td className="py-1.5 px-2 text-right font-mono">{fmtDec(p.avgPrice)}</td>
                            <td className="py-1.5 px-2 text-right">{p.customers}</td>
                            <td className="py-1.5 px-2 text-right">{p.countries}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* Price variance analysis */}
                {priceAnalysis.length > 0 && (
                  <div className="dashboard-card p-4">
                    <SectionHeader label="Analisi Varianza Prezzi" />
                    <p className="text-[10px] text-muted-foreground mb-3">Prodotti con differenze di prezzo significative tra ordini — utile per verificare sconti e politica prezzi B2B.</p>
                    <div className="overflow-x-auto">
                      <table className="w-full text-xs">
                        <thead>
                          <tr className="border-b border-border/30 text-left text-[10px] text-muted-foreground uppercase tracking-wider">
                            <th className="py-2 px-2">SKU</th>
                            <th className="py-2 px-2">Prodotto</th>
                            <th className="py-2 px-2 text-right">Min</th>
                            <th className="py-2 px-2 text-right">Max</th>
                            <th className="py-2 px-2 text-right">Media</th>
                            <th className="py-2 px-2 text-right">Varianza</th>
                            <th className="py-2 px-2 text-right">Transazioni</th>
                          </tr>
                        </thead>
                        <tbody>
                          {priceAnalysis.map(p => (
                            <tr key={p.sku} className="border-b border-border/10 hover:bg-muted/30 transition-colors">
                              <td className="py-1.5 px-2 font-mono text-[10px]">{p.sku}</td>
                              <td className="py-1.5 px-2 font-medium max-w-[200px] truncate">{p.name}</td>
                              <td className="py-1.5 px-2 text-right font-mono">{fmtDec(p.min)}</td>
                              <td className="py-1.5 px-2 text-right font-mono">{fmtDec(p.max)}</td>
                              <td className="py-1.5 px-2 text-right font-mono">{fmtDec(p.avg)}</td>
                              <td className="py-1.5 px-2 text-right font-mono" style={{ color: p.variance > 30 ? 'hsl(0,65%,52%)' : p.variance > 15 ? 'hsl(40,80%,50%)' : undefined }}>{p.variance}%</td>
                              <td className="py-1.5 px-2 text-right">{p.count}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* ── Agents tab ────────────────────────────────────── */}
            {activeTab === 'agents' && (
              <div className="space-y-4">
                <div className="dashboard-card p-4">
                  <SectionHeader label="Performance Agenti" />
                  <ResponsiveContainer width="100%" height={Math.max(200, agentData.length * 40)}>
                    <BarChart data={agentData} layout="vertical" margin={{ left: 80 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" opacity={0.3} />
                      <XAxis type="number" tick={{ fontSize: 10 }} tickFormatter={v => `€${(v / 1000).toFixed(0)}k`} />
                      <YAxis type="category" dataKey="name" tick={{ fontSize: 10 }} width={80} />
                      <Tooltip formatter={(v: number) => fmt(v)} />
                      <Legend wrapperStyle={{ fontSize: 10 }} />
                      <Bar dataKey="revenue" name="Ordinato" fill="hsl(42,96%,48%)" radius={[0, 3, 3, 0]} />
                      <Bar dataKey="delivered" name="Consegnato" fill="hsl(168,70%,42%)" radius={[0, 3, 3, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
                <div className="dashboard-card p-4">
                  <div className="overflow-x-auto">
                    <table className="w-full text-xs">
                      <thead>
                        <tr className="border-b border-border/30 text-left text-[10px] text-muted-foreground uppercase tracking-wider">
                          <th className="py-2 px-2">Agente</th>
                          <th className="py-2 px-2 text-right">Ordini</th>
                          <th className="py-2 px-2 text-right">Clienti</th>
                          <th className="py-2 px-2 text-right">Ordinato</th>
                          <th className="py-2 px-2 text-right">Consegnato</th>
                          <th className="py-2 px-2 text-right">Tasso Consegna</th>
                        </tr>
                      </thead>
                      <tbody>
                        {agentData.map(a => (
                          <tr key={a.name} className="border-b border-border/10 hover:bg-muted/30 transition-colors">
                            <td className="py-1.5 px-2 font-medium">{a.name}</td>
                            <td className="py-1.5 px-2 text-right font-mono">{a.orders}</td>
                            <td className="py-1.5 px-2 text-right">{a.clients}</td>
                            <td className="py-1.5 px-2 text-right font-mono">{fmt(a.revenue)}</td>
                            <td className="py-1.5 px-2 text-right font-mono">{fmt(a.delivered)}</td>
                            <td className="py-1.5 px-2 text-right font-mono">{a.revenue > 0 ? fmtPct((a.delivered / a.revenue) * 100) : '—'}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            )}

            {/* ── Countries tab ─────────────────────────────────── */}
            {activeTab === 'countries' && (
              <div className="space-y-4">
                <div className="dashboard-card p-4">
                  <SectionHeader label="Breakdown per Paese" />
                  <ResponsiveContainer width="100%" height={Math.max(200, countryData.length * 40)}>
                    <BarChart data={countryData} layout="vertical" margin={{ left: 80 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" opacity={0.3} />
                      <XAxis type="number" tick={{ fontSize: 10 }} tickFormatter={v => `€${(v / 1000).toFixed(0)}k`} />
                      <YAxis type="category" dataKey="name" tick={{ fontSize: 10 }} width={80} />
                      <Tooltip formatter={(v: number) => fmt(v)} />
                      <Legend wrapperStyle={{ fontSize: 10 }} />
                      <Bar dataKey="revenue" name="Ordinato" fill="hsl(210,80%,55%)" radius={[0, 3, 3, 0]} />
                      <Bar dataKey="delivered" name="Consegnato" fill="hsl(280,60%,55%)" radius={[0, 3, 3, 0]} />
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
                          <th className="py-2 px-2 text-right">Ordinato</th>
                          <th className="py-2 px-2 text-right">Consegnato</th>
                          <th className="py-2 px-2 text-right">AOV</th>
                        </tr>
                      </thead>
                      <tbody>
                        {countryData.map(c => (
                          <tr key={c.name} className="border-b border-border/10 hover:bg-muted/30 transition-colors">
                            <td className="py-1.5 px-2 font-medium">{c.name}</td>
                            <td className="py-1.5 px-2 text-right font-mono">{c.orders}</td>
                            <td className="py-1.5 px-2 text-right">{c.clients}</td>
                            <td className="py-1.5 px-2 text-right font-mono">{fmt(c.revenue)}</td>
                            <td className="py-1.5 px-2 text-right font-mono">{fmt(c.delivered)}</td>
                            <td className="py-1.5 px-2 text-right font-mono">{c.orders > 0 ? fmt(c.revenue / c.orders) : '—'}</td>
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
