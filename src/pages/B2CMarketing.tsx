import { useState, useMemo, useCallback } from 'react';
import { format, subDays, subMonths, startOfYear, startOfMonth } from 'date-fns';
import { DashboardHeader } from '@/components/dashboard/DashboardHeader';
import { DraggableNav } from '@/components/DraggableNav';
import { useShopifyOrders } from '@/hooks/useShopifyOrders';
import { Order } from '@/types/analytics';
import { downloadCsv } from '@/lib/csv-export';
import { supabase } from '@/integrations/supabase/client';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import {
  Users, ChevronRight, Sparkles, Download, Search, Loader2, Megaphone,
  Ship, Lightbulb, Bot, Calendar, Mail, Copy, X, Network, List, Archive, Clock, Activity,
} from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar as CalendarComponent } from '@/components/ui/calendar';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import ReactMarkdown from 'react-markdown';
import { MarketingWhiteboard } from '@/components/marketing/MarketingWhiteboard';
import { SegmentChips } from '@/components/marketing/SegmentChips';
import { CampaignHistory } from '@/components/marketing/CampaignHistory';
import { useCustomerSegmentation, type SegmentKey } from '@/hooks/useCustomerSegmentation';
import { useSavedCampaigns } from '@/hooks/useSavedCampaigns';


const fmt = (v: number) => new Intl.NumberFormat('it-IT', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(v);

// ─── Types ────────────────────────────────────────────────────────────────
interface CustomerNode {
  id: string;
  name: string;
  email: string | null;
  country: string;
  orders: Order[];
  orderCount: number;
  totalSpent: number;
  productNames: string[];
  firstOrder: Date;
  lastOrder: Date;
}

interface Insight {
  customer_id: string;
  boat_type: string | null;
  boat_size_range: string | null;
  owner_profile: string | null;
  confidence: number | null;
  cross_sell_suggestions: Array<{ product: string; reason: string; suggestedDiscountPct: number }>;
  last_order_count: number;
  generated_at: string;
}

// ─── Build customers tree ────────────────────────────────────────────────
function buildCustomers(orders: Order[], dateRange: { start: Date; end: Date }): CustomerNode[] {
  const s = dateRange.start.getTime();
  const e = new Date(dateRange.end); e.setHours(23, 59, 59, 999);
  const eT = e.getTime();
  const filtered = orders.filter(o => {
    if (o.customerType !== 'B2C') return false;
    const d = o.date instanceof Date ? o.date : new Date(o.date);
    return d.getTime() >= s && d.getTime() <= eT;
  });
  const map = new Map<string, CustomerNode>();
  filtered.forEach(o => {
    const d = o.date instanceof Date ? o.date : new Date(o.date);
    let c = map.get(o.customerId);
    if (!c) {
      c = {
        id: o.customerId,
        name: o.customerName || 'N/D',
        email: o.customerEmail || null,
        country: o.destinationCountry || o.country || '',
        orders: [], orderCount: 0, totalSpent: 0,
        productNames: [], firstOrder: d, lastOrder: d,
      };
      map.set(o.customerId, c);
    }
    c.orders.push(o);
    c.orderCount++;
    c.totalSpent += o.netAmount ?? o.totalAmount;
    if (d < c.firstOrder) c.firstOrder = d;
    if (d > c.lastOrder) c.lastOrder = d;
    if (!c.email && o.customerEmail) c.email = o.customerEmail;
    o.products.forEach(p => {
      if (!c!.productNames.includes(p.name)) c!.productNames.push(p.name);
    });
  });
  return Array.from(map.values()).filter(c => c.id !== 'guest');
}

// ─── Market basket: co-purchase counts ───────────────────────────────────
function buildCoPurchase(customers: CustomerNode[]): Map<string, Map<string, number>> {
  const co = new Map<string, Map<string, number>>();
  customers.forEach(c => {
    const list = c.productNames;
    for (let i = 0; i < list.length; i++) {
      for (let j = 0; j < list.length; j++) {
        if (i === j) continue;
        if (!co.has(list[i])) co.set(list[i], new Map());
        const m = co.get(list[i])!;
        m.set(list[j], (m.get(list[j]) || 0) + 1);
      }
    }
  });
  return co;
}

function recommendFor(customer: CustomerNode, co: Map<string, Map<string, number>>) {
  const owned = new Set(customer.productNames);
  const score = new Map<string, number>();
  customer.productNames.forEach(p => {
    const others = co.get(p);
    if (!others) return;
    others.forEach((cnt, other) => {
      if (owned.has(other)) return;
      score.set(other, (score.get(other) || 0) + cnt);
    });
  });
  return Array.from(score.entries()).sort((a, b) => b[1] - a[1]).slice(0, 5);
}

export default function B2CMarketing() {
  const qc = useQueryClient();
  const [shopifyMinDate] = useState(() => new Date('2023-01-01T00:00:00Z'));
  const { data: orders = [], isLoading } = useShopifyOrders({
    limit: 250, status: 'any', createdAtMin: shopifyMinDate, enabled: true,
  });

  const [dateRange, setDateRange] = useState<{ start: Date; end: Date }>({
    start: new Date('2023-01-01'), end: new Date(),
  });
  const [calOpen, setCalOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [segFilter, setSegFilter] = useState<string>('all');
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [loadingInsight, setLoadingInsight] = useState<string | null>(null);
  const [campaignOpen, setCampaignOpen] = useState(false);
  const [campaignSegment, setCampaignSegment] = useState<string>('');
  const [campaignLoading, setCampaignLoading] = useState(false);
  const [campaignData, setCampaignData] = useState<any>(null);
  const [view, setView] = useState<'list' | 'board' | 'history'>('list');
  const [activeSegment, setActiveSegment] = useState<SegmentKey | null>(null);

  const datePresets = [
    { label: '30g', range: () => ({ start: subDays(new Date(), 30), end: new Date() }) },
    { label: '90g', range: () => ({ start: subDays(new Date(), 90), end: new Date() }) },
    { label: '6m', range: () => ({ start: subMonths(new Date(), 6), end: new Date() }) },
    { label: 'YTD', range: () => ({ start: startOfYear(new Date()), end: new Date() }) },
    { label: '1a', range: () => ({ start: subDays(new Date(), 365), end: new Date() }) },
    { label: 'Tutto', range: () => ({ start: new Date('2023-01-01'), end: new Date() }) },
  ];


  const customers = useMemo(() => buildCustomers(orders, dateRange), [orders, dateRange]);
  const coPurchase = useMemo(() => buildCoPurchase(customers), [customers]);
  const segmentation = useCustomerSegmentation(customers);
  const { data: savedCampaigns = [], isLoading: campaignsLoading } = useSavedCampaigns();

  // Load insights from DB
  const { data: insights = [] } = useQuery({
    queryKey: ['b2c-customer-insights'],
    queryFn: async () => {
      const { data, error } = await supabase.from('b2c_customer_insights').select('*');
      if (error) throw error;
      return (data || []) as unknown as Insight[];
    },
  });
  const insightMap = useMemo(() => {
    const m = new Map<string, Insight>();
    insights.forEach(i => m.set(i.customer_id, i));
    return m;
  }, [insights]);

  const segments = useMemo(() => {
    const s = new Set<string>();
    insights.forEach(i => { if (i.boat_type) s.add(i.boat_type); });
    return Array.from(s).sort();
  }, [insights]);

  // Active segment ids from behavioral segmentation
  const activeSegmentIds = activeSegment ? segmentation.segments[activeSegment].ids : null;

  const filtered = useMemo(() => {
    const q = search.toLowerCase().trim();
    return customers
      .filter(c => {
        if (activeSegmentIds && !activeSegmentIds.has(c.id)) return false;
        if (q && !c.name.toLowerCase().includes(q) && !(c.email || '').toLowerCase().includes(q)) return false;
        if (segFilter !== 'all') {
          const ins = insightMap.get(c.id);
          if (!ins || ins.boat_type !== segFilter) return false;
        }
        return true;
      })
      .sort((a, b) => b.totalSpent - a.totalSpent);
  }, [customers, search, segFilter, insightMap, activeSegmentIds]);

  const kpis = useMemo(() => {
    const total = filtered.length;
    const repeat = filtered.filter(c => c.orderCount > 1).length;
    const repeatRate = total ? (repeat / total) * 100 : 0;
    const ltv = total > 0 ? filtered.reduce((s, c) => s + c.totalSpent, 0) / total : 0;
    const analyzed = filtered.filter(c => insightMap.has(c.id)).length;
    const dormantRate = total ? (segmentation.segments.dormant.ids.size / total) * 100 : 0;
    return {
      total, repeat, repeatRate, ltv, analyzed,
      segments: segments.length,
      avgCadence: Math.round(segmentation.globalAvgDaysBetween),
      dormantRate,
    };
  }, [filtered, insightMap, segments]);

  const toggle = (id: string) => {
    setExpanded(prev => {
      const n = new Set(prev);
      if (n.has(id)) n.delete(id); else n.add(id);
      return n;
    });
  };

  const analyzeCustomer = async (c: CustomerNode) => {
    setLoadingInsight(c.id);
    try {
      const products = c.orders.flatMap(o => o.products.map(p => ({
        name: p.name, quantity: p.quantity, totalPrice: p.totalPrice,
      })));
      const { data, error } = await supabase.functions.invoke('b2c-customer-insight', {
        body: {
          customer: {
            name: c.name, country: c.country, orders: c.orderCount,
            totalSpent: c.totalSpent, products,
          },
        },
      });
      if (error) throw error;
      if (!data?.success) throw new Error(data?.error || 'Errore AI');
      const ins = data.insight;
      await supabase.from('b2c_customer_insights').upsert({
        customer_id: c.id,
        customer_name: c.name,
        customer_email: c.email,
        boat_type: ins.boatType,
        boat_size_range: ins.boatSizeRange,
        owner_profile: ins.ownerProfile,
        confidence: ins.confidence,
        cross_sell_suggestions: ins.crossSellSuggestions,
        last_order_count: c.orderCount,
        generated_at: new Date().toISOString(),
      });
      await qc.invalidateQueries({ queryKey: ['b2c-customer-insights'] });
      toast.success('Profilo AI generato');
    } catch (e: any) {
      toast.error(e.message || 'Errore generazione insight');
    } finally {
      setLoadingInsight(null);
    }
  };

  const exportSegment = (seg: string) => {
    const rows: (string | number)[][] = [];
    filtered.forEach(c => {
      const ins = insightMap.get(c.id);
      if (seg !== 'all' && ins?.boat_type !== seg) return;
      rows.push([
        c.email || '', c.name, c.country, c.orderCount,
        Math.round(c.totalSpent), c.productNames.slice(0, 5).join(' | '),
        ins?.boat_type || '', ins?.boat_size_range || '', ins?.owner_profile || '',
      ]);
    });
    downloadCsv(`segmento-${seg}-${format(new Date(), 'yyyyMMdd')}`,
      ['Email', 'Nome', 'Paese', 'N° ordini', 'LTV €', 'Prodotti', 'Tipo barca', 'Lunghezza', 'Profilo'],
      rows);
  };

  const generateCampaign = async (seg: string) => {
    setCampaignSegment(seg);
    setCampaignOpen(true);
    setCampaignLoading(true);
    setCampaignData(null);
    try {
      const segCustomers = filtered.filter(c => insightMap.get(c.id)?.boat_type === seg);
      const allProducts: Record<string, number> = {};
      segCustomers.forEach(c => c.productNames.forEach(p => { allProducts[p] = (allProducts[p] || 0) + 1; }));
      const topProducts = Object.entries(allProducts).sort((a, b) => b[1] - a[1]).slice(0, 5).map(([n]) => n);
      const avgLTV = segCustomers.length ? segCustomers.reduce((s, c) => s + c.totalSpent, 0) / segCustomers.length : 0;
      const sample = segCustomers.map(c => insightMap.get(c.id)).find(Boolean);
      const { data, error } = await supabase.functions.invoke('b2c-campaign-copy', {
        body: {
          segment: {
            boatType: seg,
            boatSizeRange: sample?.boat_size_range,
            ownerProfile: sample?.owner_profile,
            crossSellSuggestions: sample?.cross_sell_suggestions,
          },
          customerCount: segCustomers.length,
          topProducts,
          avgLTV,
        },
      });
      if (error) throw error;
      if (!data?.success) throw new Error(data?.error || 'Errore AI');
      setCampaignData(data.campaign);
    } catch (e: any) {
      toast.error(e.message || 'Errore generazione campagna');
      setCampaignOpen(false);
    } finally {
      setCampaignLoading(false);
    }
  };

  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    toast.success(`${label} copiato`);
  };

  return (
    <div className="min-h-screen bg-background">
      <DashboardHeader />
      <div className="container mx-auto px-3 sm:px-4 pt-3">
        <DraggableNav />
      </div>

      <main className="container mx-auto px-3 sm:px-4 py-4 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <Megaphone className="w-6 h-6 text-primary" />
              Marketing B2C — Customer Tree & Cross-Sell
            </h1>
            <p className="text-xs text-muted-foreground mt-1">
              Profilo barca AI, suggerimenti cross-sell e generazione campagne per segmento.
            </p>
          </div>

          <div className="flex flex-wrap gap-2 items-center">
            {/* View toggle */}
            <div className="flex rounded-lg bg-muted/60 p-0.5 gap-0.5">
              <button
                onClick={() => setView('list')}
                className={`px-2.5 py-1.5 text-[11px] font-semibold rounded-md transition-all flex items-center gap-1.5 ${view === 'list' ? 'bg-primary text-primary-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'}`}
              >
                <List className="w-3.5 h-3.5" /> Lista
              </button>
              <button
                onClick={() => setView('board')}
                className={`px-2.5 py-1.5 text-[11px] font-semibold rounded-md transition-all flex items-center gap-1.5 ${view === 'board' ? 'bg-primary text-primary-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'}`}
              >
                <Network className="w-3.5 h-3.5" /> Lavagna
              </button>
              <button
                onClick={() => setView('history')}
                className={`px-2.5 py-1.5 text-[11px] font-semibold rounded-md transition-all flex items-center gap-1.5 ${view === 'history' ? 'bg-primary text-primary-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'}`}
              >
                <Archive className="w-3.5 h-3.5" /> Campagne {savedCampaigns.length > 0 && <span className="bg-primary/20 text-primary px-1 rounded text-[9px]">{savedCampaigns.length}</span>}
              </button>
            </div>

            {/* Date presets */}
            <div className="flex rounded-md bg-muted p-0.5">
              {datePresets.map(p => (
                <button key={p.label} onClick={() => setDateRange(p.range())}
                  className="px-2 py-1.5 text-[11px] text-muted-foreground hover:text-foreground rounded transition-colors">
                  {p.label}
                </button>
              ))}
            </div>

            {/* Date range picker */}
            <Popover open={calOpen} onOpenChange={setCalOpen}>
              <PopoverTrigger asChild>
                <Button variant="outline" size="sm" className="gap-2 h-8 text-[11px]">
                  <Calendar className="w-3.5 h-3.5" />
                  {format(dateRange.start, 'dd MMM yy')} → {format(dateRange.end, 'dd MMM yy')}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="end">
                <CalendarComponent
                  mode="range"
                  defaultMonth={dateRange.start}
                  selected={{ from: dateRange.start, to: dateRange.end }}
                  onSelect={(r) => {
                    if (r?.from && r?.to) setDateRange({ start: r.from, end: r.to });
                  }}
                  numberOfMonths={2}
                  className="pointer-events-auto"
                />
              </PopoverContent>
            </Popover>
          </div>
        </div>


        {/* KPIs */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
          <div className="kpi-card"><div className="flex items-center gap-1.5 mb-1"><Users className="w-3.5 h-3.5 text-primary" /><p className="text-[10px] text-muted-foreground font-semibold uppercase">Clienti</p></div><p className="text-lg font-bold font-mono">{kpis.total}</p></div>
          <div className="kpi-card"><div className="flex items-center gap-1.5 mb-1"><Users className="w-3.5 h-3.5 text-primary" /><p className="text-[10px] text-muted-foreground font-semibold uppercase">Repeat</p></div><p className="text-lg font-bold font-mono">{kpis.repeat}</p></div>
          <div className="kpi-card"><div className="flex items-center gap-1.5 mb-1"><Sparkles className="w-3.5 h-3.5 text-primary" /><p className="text-[10px] text-muted-foreground font-semibold uppercase">LTV medio</p></div><p className="text-lg font-bold font-mono">{fmt(kpis.ltv)}</p></div>
        {/* KPIs */}
        <div className="grid grid-cols-2 md:grid-cols-6 gap-3">
          <div className="kpi-card"><div className="flex items-center gap-1.5 mb-1"><Users className="w-3.5 h-3.5 text-primary" /><p className="text-[10px] text-muted-foreground font-semibold uppercase">Clienti</p></div><p className="text-lg font-bold font-mono">{kpis.total}</p></div>
          <div className="kpi-card"><div className="flex items-center gap-1.5 mb-1"><Activity className="w-3.5 h-3.5 text-primary" /><p className="text-[10px] text-muted-foreground font-semibold uppercase">Repeat rate</p></div><p className="text-lg font-bold font-mono">{kpis.repeatRate.toFixed(1)}%</p></div>
          <div className="kpi-card"><div className="flex items-center gap-1.5 mb-1"><Sparkles className="w-3.5 h-3.5 text-primary" /><p className="text-[10px] text-muted-foreground font-semibold uppercase">LTV medio</p></div><p className="text-lg font-bold font-mono">{fmt(kpis.ltv)}</p></div>
          <div className="kpi-card"><div className="flex items-center gap-1.5 mb-1"><Clock className="w-3.5 h-3.5 text-primary" /><p className="text-[10px] text-muted-foreground font-semibold uppercase">Cadenza media</p></div><p className="text-lg font-bold font-mono">{kpis.avgCadence}g</p></div>
          <div className="kpi-card"><div className="flex items-center gap-1.5 mb-1"><Bot className="w-3.5 h-3.5 text-primary" /><p className="text-[10px] text-muted-foreground font-semibold uppercase">Analizzati AI</p></div><p className="text-lg font-bold font-mono">{kpis.analyzed}</p></div>
          <div className="kpi-card"><div className="flex items-center gap-1.5 mb-1"><Ship className="w-3.5 h-3.5 text-primary" /><p className="text-[10px] text-muted-foreground font-semibold uppercase">% Dormienti</p></div><p className="text-lg font-bold font-mono">{kpis.dormantRate.toFixed(1)}%</p></div>
        </div>

        {/* Behavioral segments */}
        {view !== 'history' && (
          <SegmentChips segments={segmentation.segmentList} active={activeSegment} onChange={setActiveSegment} fmt={fmt} />
        )}

        {view === 'history' ? (
          <CampaignHistory
            campaigns={savedCampaigns}
            customers={customers.map(c => ({ id: c.id, name: c.name, email: c.email, country: c.country, totalSpent: c.totalSpent }))}
            fmt={fmt}
            isLoading={campaignsLoading}
          />
        ) : view === 'board' ? (
          isLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
            </div>
          ) : (
            <MarketingWhiteboard
              customers={customers}
              insightMap={insightMap}
              fmt={fmt}
              activeSegment={activeSegment}
              segmentIds={activeSegmentIds ?? undefined}
            />
          )
        ) : (
        <>
        {/* Filters */}
        <div className="glass-card p-3 flex flex-wrap items-center gap-2">
          <div className="relative flex-1 min-w-[200px]">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
            <Input
              value={search} onChange={e => setSearch(e.target.value)}
              placeholder="Cerca per nome o email..."
              className="pl-8 h-9 text-sm"
            />
          </div>
          <Select value={segFilter} onValueChange={setSegFilter}>
            <SelectTrigger className="w-[180px] h-9 text-sm"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Tutti i segmenti</SelectItem>
              {segments.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
            </SelectContent>
          </Select>
          <Button size="sm" variant="outline" className="gap-1.5" onClick={() => exportSegment(segFilter)}>
            <Download className="w-3.5 h-3.5" /> Export CSV
          </Button>
          {segFilter !== 'all' && (
            <Button size="sm" className="gap-1.5" onClick={() => generateCampaign(segFilter)}>
              <Sparkles className="w-3.5 h-3.5" /> Genera campagna AI
            </Button>
          )}
        </div>

        {/* Customer list */}
        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
          </div>
        ) : (

          <div className="space-y-2">
            {filtered.slice(0, 200).map(c => {
              const ins = insightMap.get(c.id);
              const isOpen = expanded.has(c.id);
              const recs = recommendFor(c, coPurchase);
              return (
                <div key={c.id} className="glass-card overflow-hidden">
                  <button
                    onClick={() => toggle(c.id)}
                    className="w-full flex items-center gap-3 px-3 py-2.5 hover:bg-muted/30 transition-colors text-left"
                  >
                    <ChevronRight className={`w-4 h-4 text-muted-foreground transition-transform ${isOpen ? 'rotate-90' : ''}`} />
                    <div className="flex-1 min-w-0 grid grid-cols-12 gap-2 items-center text-xs">
                      <div className="col-span-12 sm:col-span-4 font-semibold truncate">{c.name}<div className="text-[10px] text-muted-foreground font-normal truncate">{c.email || '—'}</div></div>
                      <div className="col-span-3 sm:col-span-2 text-muted-foreground">{c.country || '—'}</div>
                      <div className="col-span-3 sm:col-span-1 font-mono">{c.orderCount} ord.</div>
                      <div className="col-span-3 sm:col-span-2 font-mono font-semibold">{fmt(c.totalSpent)}</div>
                      <div className="col-span-3 sm:col-span-3 text-right">
                        {ins ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-primary/15 text-primary text-[10px] font-semibold">
                            <Ship className="w-3 h-3" /> {ins.boat_type} · {ins.boat_size_range}
                          </span>
                        ) : (
                          <span className="text-[10px] text-muted-foreground">non analizzato</span>
                        )}
                      </div>
                    </div>
                  </button>
                  {isOpen && (
                    <div className="border-t border-border/40 p-3 space-y-3 bg-muted/10">
                      {/* AI Insight panel */}
                      <div className="grid md:grid-cols-2 gap-3">
                        <div className="rounded-lg border border-border/40 p-3">
                          <div className="flex items-center justify-between mb-2">
                            <h4 className="text-xs font-bold flex items-center gap-1.5"><Ship className="w-3.5 h-3.5 text-primary" /> Profilo barca AI</h4>
                            <Button size="sm" variant="outline" className="h-7 text-[11px] gap-1.5"
                              onClick={() => analyzeCustomer(c)} disabled={loadingInsight === c.id}>
                              {loadingInsight === c.id ? <Loader2 className="w-3 h-3 animate-spin" /> : <Sparkles className="w-3 h-3" />}
                              {ins ? 'Rigenera' : 'Analizza con AI'}
                            </Button>
                          </div>
                          {ins ? (
                            <div className="space-y-1.5 text-xs">
                              <div><span className="text-muted-foreground">Tipo:</span> <span className="font-semibold">{ins.boat_type}</span></div>
                              <div><span className="text-muted-foreground">Lunghezza:</span> <span className="font-semibold">{ins.boat_size_range}</span></div>
                              <div><span className="text-muted-foreground">Profilo:</span> {ins.owner_profile}</div>
                              <div><span className="text-muted-foreground">Confidenza:</span> {Math.round((ins.confidence || 0) * 100)}%</div>
                            </div>
                          ) : (
                            <p className="text-xs text-muted-foreground">Click su "Analizza con AI" per inferire tipologia barca e suggerimenti personalizzati.</p>
                          )}
                        </div>

                        <div className="rounded-lg border border-border/40 p-3">
                          <h4 className="text-xs font-bold flex items-center gap-1.5 mb-2"><Bot className="w-3.5 h-3.5 text-primary" /> Cross-sell AI</h4>
                          {ins?.cross_sell_suggestions?.length ? (
                            <ul className="space-y-1.5 text-xs">
                              {ins.cross_sell_suggestions.map((s, i) => (
                                <li key={i} className="border-l-2 border-primary/40 pl-2">
                                  <div className="font-semibold">{s.product} <span className="text-primary">-{s.suggestedDiscountPct}%</span></div>
                                  <div className="text-muted-foreground text-[11px]">{s.reason}</div>
                                </li>
                              ))}
                            </ul>
                          ) : <p className="text-xs text-muted-foreground">Disponibili dopo l'analisi AI.</p>}
                        </div>
                      </div>

                      {/* Statistical cross-sell */}
                      <div className="rounded-lg border border-border/40 p-3">
                        <h4 className="text-xs font-bold flex items-center gap-1.5 mb-2"><Lightbulb className="w-3.5 h-3.5 text-primary" /> Cross-sell statistico (chi compra X compra anche Y)</h4>
                        {recs.length ? (
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5 text-xs">
                            {recs.map(([p, n]) => (
                              <div key={p} className="flex justify-between bg-muted/30 px-2 py-1 rounded">
                                <span className="truncate">{p}</span>
                                <span className="font-mono text-muted-foreground shrink-0 ml-2">{n} co-acq.</span>
                              </div>
                            ))}
                          </div>
                        ) : <p className="text-xs text-muted-foreground">Nessun pattern co-acquisto disponibile.</p>}
                      </div>

                      {/* Orders timeline */}
                      <div className="rounded-lg border border-border/40 p-3">
                        <h4 className="text-xs font-bold flex items-center gap-1.5 mb-2"><Calendar className="w-3.5 h-3.5 text-primary" /> Timeline ordini ({c.orderCount})</h4>
                        <div className="space-y-1.5 max-h-64 overflow-auto">
                          {c.orders.sort((a, b) => +b.date - +a.date).map(o => (
                            <details key={o.id} className="text-xs border border-border/30 rounded p-1.5">
                              <summary className="cursor-pointer flex items-center gap-2 font-mono">
                                <span className="font-semibold">{o.orderNumber}</span>
                                <span className="text-muted-foreground">{format(o.date instanceof Date ? o.date : new Date(o.date), 'dd/MM/yyyy')}</span>
                                <span className="ml-auto font-semibold">{fmt(o.netAmount ?? o.totalAmount)}</span>
                              </summary>
                              <ul className="mt-1.5 pl-4 space-y-0.5 text-[11px] text-muted-foreground">
                                {o.products.map(p => (
                                  <li key={p.id} className="flex justify-between">
                                    <span className="truncate">{p.name} ×{p.quantity}</span>
                                    <span className="font-mono shrink-0 ml-2">{fmt(p.totalPrice)}</span>
                                  </li>
                                ))}
                              </ul>
                            </details>
                          ))}
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
            {filtered.length > 200 && (
              <p className="text-xs text-center text-muted-foreground py-2">
                Mostrati primi 200 di {filtered.length} clienti — affina la ricerca.
              </p>
            )}
          </div>
        )}
        </>
        )}
      </main>


      {/* Campaign dialog */}
      <Dialog open={campaignOpen} onOpenChange={setCampaignOpen}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-primary" /> Campagna AI — segmento "{campaignSegment}"
            </DialogTitle>
          </DialogHeader>
          {campaignLoading ? (
            <div className="flex flex-col items-center py-12 gap-3">
              <Loader2 className="w-8 h-8 animate-spin text-primary" />
              <p className="text-sm text-muted-foreground">Generazione copy in corso...</p>
            </div>
          ) : campaignData && (
            <div className="space-y-4">
              <div>
                <div className="flex items-center justify-between mb-1">
                  <h4 className="text-xs font-bold uppercase text-muted-foreground flex items-center gap-1.5"><Mail className="w-3.5 h-3.5" /> Email — Subject</h4>
                  <Button size="sm" variant="ghost" className="h-7" onClick={() => copyToClipboard(campaignData.emailSubject, 'Subject')}><Copy className="w-3 h-3" /></Button>
                </div>
                <div className="rounded border border-border/40 p-2 text-sm bg-muted/30">{campaignData.emailSubject}</div>
              </div>
              <div>
                <div className="flex items-center justify-between mb-1">
                  <h4 className="text-xs font-bold uppercase text-muted-foreground">Email — Body</h4>
                  <Button size="sm" variant="ghost" className="h-7" onClick={() => copyToClipboard(campaignData.emailBody, 'Body')}><Copy className="w-3 h-3" /></Button>
                </div>
                <div className="prose prose-sm max-w-none rounded border border-border/40 p-3 bg-muted/30 text-foreground">
                  <ReactMarkdown>{campaignData.emailBody}</ReactMarkdown>
                </div>
              </div>
              <div className="grid md:grid-cols-2 gap-3">
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <h4 className="text-xs font-bold uppercase text-muted-foreground">Meta — Headline</h4>
                    <Button size="sm" variant="ghost" className="h-7" onClick={() => copyToClipboard(campaignData.metaHeadline, 'Headline')}><Copy className="w-3 h-3" /></Button>
                  </div>
                  <div className="rounded border border-border/40 p-2 text-sm bg-muted/30">{campaignData.metaHeadline}</div>
                </div>
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <h4 className="text-xs font-bold uppercase text-muted-foreground">Meta — Primary Text</h4>
                    <Button size="sm" variant="ghost" className="h-7" onClick={() => copyToClipboard(campaignData.metaPrimaryText, 'Primary text')}><Copy className="w-3 h-3" /></Button>
                  </div>
                  <div className="rounded border border-border/40 p-2 text-sm bg-muted/30 whitespace-pre-wrap">{campaignData.metaPrimaryText}</div>
                </div>
              </div>
              {campaignData.suggestedDiscount && (
                <div className="text-xs text-muted-foreground">💡 Sconto consigliato: <span className="font-semibold text-foreground">{campaignData.suggestedDiscount}</span></div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
