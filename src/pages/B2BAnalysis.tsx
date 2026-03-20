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
  ChevronRight,
} from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar as CalendarComponent } from '@/components/ui/calendar';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell,
  PieChart, Pie, Legend,
} from 'recharts';

const fmt = (v: number) => new Intl.NumberFormat('it-IT', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(v);
const fmtDec = (v: number) => new Intl.NumberFormat('it-IT', { style: 'currency', currency: 'EUR' }).format(v);
const fmtPct = (v: number) => `${v.toFixed(1)}%`;

const toDate = (d: Date | string | null | undefined): Date | null => {
  if (!d) return null;
  const r = d instanceof Date ? d : new Date(d);
  return isNaN(r.getTime()) ? null : r;
};

// ─── Build B2B customer records ──────────────────────────────────────────
interface B2BCustomer {
  id: string;
  name: string;
  orders: number;
  totalOrdered: number;
  totalDelivered: number;
  totalPaid: number;
  avgOrderValue: number;
  firstOrder: Date;
  lastOrder: Date;
  daysSinceLast: number;
  country: string;
  agent: string;
  products: string[];
  skus: string[];
  collections: string[];
  pendingAmount: number;
  unpaidAmount: number;
}

// ─── Build B2B Order row (one per unique order code, aggregating products) ─
interface B2BOrderRow {
  id: string;
  orderNumber: string;
  customerName: string;
  country: string;
  agent: string;
  orderDate: Date;
  deliveryDate: Date | null;
  payedDate: Date | null;
  status: string;
  products: { name: string; sku: string; qty: number; unitPrice: number; totalPrice: number }[];
  totalPrice: number;
}

function buildB2BOrders(orders: Order[]): B2BOrderRow[] {
  const map: Record<string, B2BOrderRow> = {};
  orders.forEach(o => {
    if (o.customerType !== 'B2B') return;
    if (o.orderType?.toLowerCase() === 'custom') return;
    const key = o.orderNumber;
    if (!map[key]) {
      const od = toDate(o.date) || new Date();
      map[key] = {
        id: o.id,
        orderNumber: o.orderNumber,
        customerName: o.customerName,
        country: o.country || '',
        agent: o.agent || '',
        orderDate: od,
        deliveryDate: toDate(o.deliveryDate),
        payedDate: toDate(o.payedDate),
        status: o.status,
        products: [],
        totalPrice: 0,
      };
    }
    const row = map[key];
    o.products.forEach(p => {
      row.products.push({
        name: p.name,
        sku: p.sku,
        qty: p.quantity,
        unitPrice: p.quantity > 0 ? p.totalPrice / p.quantity : p.unitPrice,
        totalPrice: p.totalPrice,
      });
      row.totalPrice += p.totalPrice;
    });
    // Update dates if this row has more info
    if (!row.deliveryDate && o.deliveryDate) row.deliveryDate = toDate(o.deliveryDate);
    if (!row.payedDate && o.payedDate) row.payedDate = toDate(o.payedDate);
  });
  return Object.values(map).sort((a, b) => b.orderDate.getTime() - a.orderDate.getTime());
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
    const d = toDate(o.date) || new Date();
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
  sku: string; name: string; collection: string; qty: number;
  totalOrdered: number; totalDelivered: number; avgPrice: number;
  customers: number; countries: number;
}

function buildB2BProducts(orders: Order[]): B2BProduct[] {
  const map: Record<string, { name: string; collection: string; qty: number; totalOrdered: number; totalDelivered: number; prices: number[]; customers: Set<string>; countries: Set<string> }> = {};
  orders.forEach(o => {
    if (o.customerType !== 'B2B' || o.orderType?.toLowerCase() === 'custom') return;
    o.products.forEach(p => {
      const key = p.sku || p.name;
      if (!map[key]) map[key] = { name: p.name, collection: getSkuCollection(p.sku), qty: 0, totalOrdered: 0, totalDelivered: 0, prices: [], customers: new Set(), countries: new Set() };
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
    customers: m.customers.size, countries: m.countries.size,
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
  const [activeTab, setActiveTab] = useState<'customers' | 'products' | 'orders' | 'countries'>('customers');
  const [expandedOrders, setExpandedOrders] = useState<Set<string>>(new Set());

  const toggleOrder = (id: string) => {
    setExpandedOrders(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  // All B2B orders (no custom) — unfiltered by date, used for date-specific KPIs
  const allB2B = useMemo(() => gsOrders.filter(o => o.customerType === 'B2B' && (!o.orderType || o.orderType.toLowerCase() !== 'custom')), [gsOrders]);

  const endOfDay = useMemo(() => { const d = new Date(dateRange.end); d.setHours(23, 59, 59, 999); return d; }, [dateRange.end]);

  // ── ORDINI RACCOLTI: filter by ORDER DATE ───────────────────────────────
  const orderedInRange = useMemo(() => allB2B.filter(o => {
    const d = toDate(o.date);
    return d && d >= dateRange.start && d <= endOfDay;
  }), [allB2B, dateRange.start, endOfDay]);

  const totalOrdered = useMemo(() => orderedInRange.reduce((s, o) => s + o.products.reduce((ps, p) => ps + p.totalPrice, 0), 0), [orderedInRange]);

  // ── ORDINI CONSEGNATI: filter by DELIVERY DATE ──────────────────────────
  const deliveredInRange = useMemo(() => allB2B.filter(o => {
    const d = toDate(o.deliveryDate);
    return d && d >= dateRange.start && d <= endOfDay;
  }), [allB2B, dateRange.start, endOfDay]);

  const totalDelivered = useMemo(() => deliveredInRange.reduce((s, o) => s + o.products.reduce((ps, p) => ps + p.totalPrice, 0), 0), [deliveredInRange]);

  // ── ORDINI PAGATI: filter by PAYED DATE ─────────────────────────────────
  const paidInRange = useMemo(() => allB2B.filter(o => {
    const d = toDate(o.payedDate);
    return d && d >= dateRange.start && d <= endOfDay;
  }), [allB2B, dateRange.start, endOfDay]);

  const totalPaid = useMemo(() => paidInRange.reduce((s, o) => s + o.products.reduce((ps, p) => ps + p.totalPrice, 0), 0), [paidInRange]);

  // For customer/product/country breakdowns, use orderedInRange (by order date)
  const filteredOrders = orderedInRange;

  const customers = useMemo(() => buildB2BCustomers(filteredOrders), [filteredOrders]);
  const products = useMemo(() => buildB2BProducts(filteredOrders), [filteredOrders]);
  const orderRows = useMemo(() => buildB2BOrders(filteredOrders), [filteredOrders]);

  // ── Aggregate KPIs ──────────────────────────────────────────────────────
  const kpis = useMemo(() => {
    const totalClients = customers.length;
    const totalOrderCount = customers.reduce((s, c) => s + c.orders, 0);
    const avgOrderVal = totalOrderCount > 0 ? totalOrdered / totalOrderCount : 0;
    const pendingDelivery = totalOrdered - totalDelivered;
    const unpaid = totalDelivered - totalPaid;
    const repeatClients = customers.filter(c => c.orders > 1).length;
    const repeatRate = totalClients > 0 ? (repeatClients / totalClients) * 100 : 0;
    const avgLTV = totalClients > 0 ? totalOrdered / totalClients : 0;

    // Counts
    const orderedCount = new Set(orderedInRange.map(o => o.orderNumber)).size;
    const deliveredCount = new Set(deliveredInRange.map(o => o.orderNumber)).size;
    const paidCount = new Set(paidInRange.map(o => o.orderNumber)).size;

    return { totalClients, totalOrderCount, totalOrdered, totalDelivered, totalPaid, avgOrderVal, pendingDelivery, unpaid, repeatClients, repeatRate, avgLTV, orderedCount, deliveredCount, paidCount };
  }, [customers, totalOrdered, totalDelivered, totalPaid, orderedInRange, deliveredInRange, paidInRange]);

  // ── Country breakdown ───────────────────────────────────────────────────
  const countryData = useMemo(() => {
    const map: Record<string, { orders: number; revenue: number; clients: Set<string>; delivered: number }> = {};
    filteredOrders.forEach(o => {
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
    // Ordered by order date
    orderedInRange.forEach(o => {
      const d = toDate(o.date);
      if (!d) return;
      const key = format(d, 'yyyy-MM');
      if (!map[key]) map[key] = { ordered: 0, delivered: 0, paid: 0 };
      map[key].ordered += o.products.reduce((s, p) => s + p.totalPrice, 0);
    });
    // Delivered by delivery date
    deliveredInRange.forEach(o => {
      const d = toDate(o.deliveryDate);
      if (!d) return;
      const key = format(d, 'yyyy-MM');
      if (!map[key]) map[key] = { ordered: 0, delivered: 0, paid: 0 };
      map[key].delivered += o.products.reduce((s, p) => s + p.totalPrice, 0);
    });
    // Paid by payed date
    paidInRange.forEach(o => {
      const d = toDate(o.payedDate);
      if (!d) return;
      const key = format(d, 'yyyy-MM');
      if (!map[key]) map[key] = { ordered: 0, delivered: 0, paid: 0 };
      map[key].paid += o.products.reduce((s, p) => s + p.totalPrice, 0);
    });
    return Object.entries(map).sort((a, b) => a[0].localeCompare(b[0])).map(([month, d]) => ({
      month: format(new Date(month + '-01'), 'MMM yy'),
      ordered: Math.round(d.ordered),
      delivered: Math.round(d.delivered),
      paid: Math.round(d.paid),
    }));
  }, [orderedInRange, deliveredInRange, paidInRange]);

  // ── Collection breakdown ────────────────────────────────────────────────
  const collectionData = useMemo(() => {
    const map: Record<string, { qty: number; revenue: number }> = {};
    filteredOrders.forEach(o => {
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

  // ── Price analysis ──────────────────────────────────────────────────────
  const priceAnalysis = useMemo(() => {
    const map: Record<string, { prices: number[]; name: string }> = {};
    filteredOrders.forEach(o => {
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
        const min = sorted[0]; const max = sorted[sorted.length - 1];
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

  // ── Filter orders for orders tab ────────────────────────────────────────
  const filteredOrderRows = useMemo(() => {
    if (!search) return orderRows;
    const q = search.toLowerCase();
    return orderRows.filter(o => o.customerName.toLowerCase().includes(q) || o.orderNumber.toLowerCase().includes(q) || o.country.toLowerCase().includes(q));
  }, [orderRows, search]);

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

  const exportOrdersCsv = () => {
    const rows: (string | number)[][] = [];
    filteredOrderRows.forEach(o => {
      o.products.forEach(p => {
        rows.push([o.orderNumber, o.customerName, o.country, o.agent, format(o.orderDate, 'dd/MM/yyyy'), o.deliveryDate ? format(o.deliveryDate, 'dd/MM/yyyy') : '', o.payedDate ? format(o.payedDate, 'dd/MM/yyyy') : '', p.sku, p.name, p.qty, p.unitPrice, p.totalPrice]);
      });
    });
    downloadCsv('b2b-orders', ['Ordine', 'Cliente', 'Paese', 'Agente', 'Data Ordine', 'Data Consegna', 'Data Pagamento', 'SKU', 'Prodotto', 'Qty', 'Prezzo Unit.', 'Totale'], rows);
  };

  // ── AI context ──────────────────────────────────────────────────────────
  const aiContext = useMemo(() => {
    const lines: string[] = [];
    lines.push(`=== ANALISI B2B ===`);
    lines.push(`Periodo: ${format(dateRange.start, 'dd/MM/yyyy')} - ${format(dateRange.end, 'dd/MM/yyyy')}`);
    lines.push(`ORDINI RACCOLTI (per order date): ${kpis.orderedCount} ordini, €${totalOrdered.toLocaleString('it-IT')}`);
    lines.push(`ORDINI CONSEGNATI (per delivery date): ${kpis.deliveredCount} ordini, €${totalDelivered.toLocaleString('it-IT')}`);
    lines.push(`ORDINI PAGATI (per payed date): ${kpis.paidCount} ordini, €${totalPaid.toLocaleString('it-IT')}`);
    lines.push(`Clienti: ${kpis.totalClients} | Repeat: ${kpis.repeatRate.toFixed(1)}% | AOV: €${kpis.avgOrderVal.toLocaleString('it-IT')} | LTV: €${kpis.avgLTV.toLocaleString('it-IT')}`);
    lines.push('\n--- TOP CLIENTI ---');
    customers.slice(0, 15).forEach(c => lines.push(`${c.name}: ${c.orders} ordini, €${c.totalOrdered.toLocaleString('it-IT')} ordinato, €${c.totalDelivered.toLocaleString('it-IT')} consegnato, ${c.country}, giorni inattivo: ${c.daysSinceLast}`));
    lines.push('\n--- PRODOTTI ---');
    products.slice(0, 15).forEach(p => lines.push(`${p.sku} ${p.name}: ${p.qty} pz, €${p.totalOrdered.toLocaleString('it-IT')}, prezzo medio €${p.avgPrice}, ${p.customers} clienti`));
    lines.push('\n--- PAESI ---');
    countryData.forEach(c => lines.push(`${c.name}: ${c.orders} ordini, €${c.revenue.toLocaleString('it-IT')}, ${c.clients} clienti`));
    lines.push('\n--- ANALISI PREZZI (varianza >10%) ---');
    priceAnalysis.filter(p => p.variance > 10).forEach(p => lines.push(`${p.sku}: min €${p.min}, max €${p.max}, avg €${p.avg}, varianza ${p.variance}%`));
    lines.push('\n--- TREND MENSILE ---');
    monthlyTrend.forEach(m => lines.push(`${m.month}: ordinato €${m.ordered.toLocaleString('it-IT')}, consegnato €${m.delivered.toLocaleString('it-IT')}, pagato €${m.paid.toLocaleString('it-IT')}`));
    return lines.join('\n');
  }, [dateRange, kpis, totalOrdered, totalDelivered, totalPaid, customers, products, countryData, priceAnalysis, monthlyTrend]);

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
            <NavLink to="/b2c-analysis" className={navLinkClass} activeClassName={activeClass}>Analisi B2C</NavLink>
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
                  numberOfMonths={2} className="p-3 pointer-events-auto" />
              </PopoverContent>
            </Popover>
          </div>
        </div>

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
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
              <KPI icon={Users} label="Clienti" value={String(kpis.totalClients)} sub={`${kpis.repeatClients} repeat (${fmtPct(kpis.repeatRate)})`} color="hsl(42,96%,48%)" />
              <KPI icon={Target} label="Ordini Raccolti" value={fmt(totalOrdered)} sub={`${kpis.orderedCount} ordini (by order date)`} color="hsl(168,70%,42%)" />
              <KPI icon={Truck} label="Consegnato" value={fmt(totalDelivered)} sub={`${kpis.deliveredCount} ordini (by delivery date)`} color="hsl(280,60%,55%)" />
              <KPI icon={CreditCard} label="Pagato" value={fmt(totalPaid)} sub={`${kpis.paidCount} ordini (by payed date)`} color="hsl(210,80%,55%)" />
              <KPI icon={Clock} label="In attesa consegna" value={fmt(kpis.pendingDelivery)} color="hsl(40,80%,50%)" />
              <KPI icon={DollarSign} label="Non pagato" value={fmt(kpis.unpaid)} sub={kpis.unpaid > 0 ? '⚠️ Da incassare' : '✓'} color={kpis.unpaid > 0 ? 'hsl(0,65%,52%)' : 'hsl(168,70%,42%)'} />
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <KPI icon={ShoppingBag} label="AOV" value={fmt(kpis.avgOrderVal)} color="hsl(25,90%,55%)" />
              <KPI icon={TrendingUp} label="LTV Medio" value={fmt(kpis.avgLTV)} color="hsl(190,70%,45%)" />
              <KPI icon={Repeat} label="Tasso Repeat" value={fmtPct(kpis.repeatRate)} sub={`${kpis.repeatClients} su ${kpis.totalClients}`} color="hsl(320,60%,50%)" />
              <KPI icon={Package} label="SKU Attivi" value={String(products.length)} color="hsl(42,70%,50%)" />
            </div>

            {/* ── Trend + Collections ──────────────────────────── */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
              <div className="lg:col-span-2 dashboard-card p-4">
                <SectionHeader label="Trend Mensile (per data rispettiva)" />
                <ResponsiveContainer width="100%" height={260}>
                  <BarChart data={monthlyTrend}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" opacity={0.3} />
                    <XAxis dataKey="month" tick={{ fontSize: 10 }} stroke="hsl(var(--muted-foreground))" />
                    <YAxis tick={{ fontSize: 10 }} stroke="hsl(var(--muted-foreground))" tickFormatter={v => `€${(v / 1000).toFixed(0)}k`} />
                    <Tooltip formatter={(v: number) => fmtDec(v)} />
                    <Legend wrapperStyle={{ fontSize: 10 }} />
                    <Bar dataKey="ordered" name="Raccolto (order date)" fill="hsl(42,96%,48%)" radius={[3, 3, 0, 0]} />
                    <Bar dataKey="delivered" name="Consegnato (delivery date)" fill="hsl(168,70%,42%)" radius={[3, 3, 0, 0]} />
                    <Bar dataKey="paid" name="Pagato (payed date)" fill="hsl(210,80%,55%)" radius={[3, 3, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>

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
              {(['customers', 'orders', 'products', 'countries'] as const).map(tab => (
                <button key={tab} onClick={() => setActiveTab(tab)}
                  className={`px-3 py-1.5 text-xs font-semibold rounded-t-lg transition-colors ${activeTab === tab ? 'bg-card text-foreground border border-b-0 border-border/30' : 'text-muted-foreground hover:text-foreground'}`}>
                  {tab === 'customers' ? '👥 Clienti' : tab === 'orders' ? '📋 Ordini' : tab === 'products' ? '📦 Prodotti' : '🌍 Paesi'}
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
                        <th className="py-2 px-2 text-right cursor-pointer" onClick={() => handleSort('totalOrdered')}>Raccolto {sortField === 'totalOrdered' && <ArrowUpDown className="w-2.5 h-2.5 inline" />}</th>
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

            {/* ── Orders tab ────────────────────────────────────── */}
            {activeTab === 'orders' && (
              <div className="dashboard-card p-4 space-y-3">
                <div className="flex items-center justify-between gap-2">
                  <div className="relative flex-1 max-w-xs">
                    <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
                    <Input value={search} onChange={e => setSearch(e.target.value)} placeholder="Cerca ordine, cliente, paese..." className="h-7 text-xs pl-7" />
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] text-muted-foreground">{filteredOrderRows.length} ordini</span>
                    <Button variant="outline" size="sm" className="h-7 text-[10px] gap-1" onClick={exportOrdersCsv}>
                      <Download className="w-3 h-3" /> CSV
                    </Button>
                  </div>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="border-b border-border/30 text-left text-[10px] text-muted-foreground uppercase tracking-wider">
                        <th className="py-2 px-1 w-6" />
                        <th className="py-2 px-2">Ordine</th>
                        <th className="py-2 px-2">Cliente</th>
                        <th className="py-2 px-2">Paese</th>
                        <th className="py-2 px-2 text-center">Order Date</th>
                        <th className="py-2 px-2 text-center">Delivery Date</th>
                        <th className="py-2 px-2 text-center">Payed Date</th>
                        <th className="py-2 px-2 text-right">Valore (Σ price)</th>
                        <th className="py-2 px-2 text-right">Prodotti</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredOrderRows.slice(0, 100).map(o => {
                        const isExpanded = expandedOrders.has(o.id);
                        return (
                          <> 
                            <tr key={o.id} className="border-b border-border/10 hover:bg-muted/30 transition-colors cursor-pointer" onClick={() => toggleOrder(o.id)}>
                              <td className="py-1.5 px-1">
                                <ChevronRight className={`w-3.5 h-3.5 text-muted-foreground transition-transform ${isExpanded ? 'rotate-90' : ''}`} />
                              </td>
                              <td className="py-1.5 px-2 font-mono text-[10px] font-semibold">{o.orderNumber}</td>
                              <td className="py-1.5 px-2 font-medium">{o.customerName}</td>
                              <td className="py-1.5 px-2 text-muted-foreground">{o.country || '—'}</td>
                              <td className="py-1.5 px-2 text-center">{format(o.orderDate, 'dd/MM/yy')}</td>
                              <td className="py-1.5 px-2 text-center">
                                {o.deliveryDate ? (
                                  <span className="text-foreground">{format(o.deliveryDate, 'dd/MM/yy')}</span>
                                ) : (
                                  <span className="text-muted-foreground/50">—</span>
                                )}
                              </td>
                              <td className="py-1.5 px-2 text-center">
                                {o.payedDate ? (
                                  <span className="text-foreground">{format(o.payedDate, 'dd/MM/yy')}</span>
                                ) : (
                                  <span className="text-muted-foreground/50">—</span>
                                )}
                              </td>
                              <td className="py-1.5 px-2 text-right font-mono font-semibold">{fmtDec(o.totalPrice)}</td>
                              <td className="py-1.5 px-2 text-right text-muted-foreground">{o.products.length} SKU</td>
                            </tr>
                            {isExpanded && (
                              <tr key={`${o.id}-detail`}>
                                <td colSpan={9} className="p-0">
                                  <div className="bg-muted/20 border-l-2 border-primary/30 ml-6 mr-2 my-1 rounded">
                                    <table className="w-full text-[11px]">
                                      <thead>
                                        <tr className="text-[9px] text-muted-foreground uppercase tracking-wider">
                                          <th className="py-1.5 px-3 text-left">SKU</th>
                                          <th className="py-1.5 px-3 text-left">Prodotto</th>
                                          <th className="py-1.5 px-3 text-right">Qty</th>
                                          <th className="py-1.5 px-3 text-right">Prezzo Unit.</th>
                                          <th className="py-1.5 px-3 text-right">Totale</th>
                                        </tr>
                                      </thead>
                                      <tbody>
                                        {o.products.map((p, pi) => (
                                          <tr key={pi} className="border-t border-border/10">
                                            <td className="py-1 px-3 font-mono text-[10px]">{p.sku}</td>
                                            <td className="py-1 px-3">{p.name}</td>
                                            <td className="py-1 px-3 text-right font-mono">{p.qty}</td>
                                            <td className="py-1 px-3 text-right font-mono">{fmtDec(p.unitPrice)}</td>
                                            <td className="py-1 px-3 text-right font-mono font-semibold">{fmtDec(p.totalPrice)}</td>
                                          </tr>
                                        ))}
                                        <tr className="border-t border-border/30">
                                          <td colSpan={4} className="py-1.5 px-3 text-right text-[10px] text-muted-foreground font-semibold uppercase">Totale Ordine</td>
                                          <td className="py-1.5 px-3 text-right font-mono font-bold">{fmtDec(o.totalPrice)}</td>
                                        </tr>
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
                  {filteredOrderRows.length > 100 && <p className="text-[10px] text-muted-foreground mt-2 text-center">Mostrati 100 di {filteredOrderRows.length} ordini</p>}
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
                          <th className="py-2 px-2 text-right">Raccolto</th>
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
                      <Bar dataKey="revenue" name="Raccolto" fill="hsl(210,80%,55%)" radius={[0, 3, 3, 0]} />
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
                          <th className="py-2 px-2 text-right">Raccolto</th>
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
