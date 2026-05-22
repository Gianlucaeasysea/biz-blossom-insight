import { useMemo, useState } from 'react';
import { Ship, Package, Users, Sparkles, Target, RotateCcw, Search, Calendar, Mail, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Slider } from '@/components/ui/slider';
import { format } from 'date-fns';

interface OrderLite {
  id?: string;
  date: Date | string;
  netAmount?: number;
  totalAmount: number;
  products: { name: string; quantity?: number; price?: number }[];
}
interface CustomerNode {
  id: string;
  name: string;
  email: string | null;
  country: string;
  orders: OrderLite[];
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
}

interface Props {
  customers: CustomerNode[];
  insightMap: Map<string, Insight>;
  fmt: (v: number) => string;
}

export function MarketingWhiteboard({ customers, insightMap, fmt }: Props) {
  const [search, setSearch] = useState('');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [campaignSet, setCampaignSet] = useState<Set<string>>(new Set());
  const [discount, setDiscount] = useState([10]);

  // Sort/filter list — render at most 150 rows for perf
  const list = useMemo(() => {
    const q = search.toLowerCase().trim();
    const arr = customers
      .filter(c => !q || c.name.toLowerCase().includes(q) || (c.email ?? '').toLowerCase().includes(q))
      .sort((a, b) => b.totalSpent - a.totalSpent);
    return arr;
  }, [customers, search]);

  const visible = list.slice(0, 150);
  const selected = selectedId ? customers.find(c => c.id === selectedId) ?? null : null;
  const selIns = selected ? insightMap.get(selected.id) : null;

  // Build product → customers index lazily, only when something is selected
  const productIndex = useMemo(() => {
    if (!selected) return new Map<string, Set<string>>();
    const idx = new Map<string, Set<string>>();
    customers.forEach(c => {
      c.productNames.forEach(p => {
        if (!idx.has(p)) idx.set(p, new Set());
        idx.get(p)!.add(c.id);
      });
    });
    return idx;
  }, [customers, selected]);

  // Lookalikes: same boat segment, not the selected customer, hasn't bought all the selected products
  const lookalikes = useMemo(() => {
    if (!selected || !selIns?.boat_type) return [];
    const targetSeg = `${selIns.boat_type}-${selIns.boat_size_range ?? ''}`;
    return customers.filter(c => {
      if (c.id === selected.id) return false;
      const ins = insightMap.get(c.id);
      if (!ins?.boat_type) return false;
      return `${ins.boat_type}-${ins.boat_size_range ?? ''}` === targetSeg;
    }).slice(0, 40);
  }, [selected, selIns, customers, insightMap]);

  // Simulation metrics
  const sim = useMemo(() => {
    if (!selected || campaignSet.size === 0) return null;
    const camp = Array.from(campaignSet);
    // direct reach within lookalikes who already own at least one
    const directReach = lookalikes.filter(c => camp.some(p => c.productNames.includes(p))).length;
    // lookalikes who don't own any of these products
    const newReach = lookalikes.filter(c => !camp.some(p => c.productNames.includes(p))).length;
    // average price across all orders of those products
    let priceSum = 0, priceN = 0;
    customers.forEach(c => c.orders.forEach(o => o.products.forEach(p => {
      if (camp.includes(p.name) && p.price) { priceSum += p.price; priceN++; }
    })));
    const avgPrice = priceN ? priceSum / priceN : 0;
    const convBase = 0.05;
    const boost = discount[0] / 100;
    const estConv = Math.min(0.4, convBase + boost * 0.5);
    const estRevenue = newReach * estConv * avgPrice * camp.length * (1 - boost);
    return { directReach, newReach, avgPrice, estConv, estRevenue };
  }, [selected, campaignSet, lookalikes, customers, discount]);

  const toggleCampaign = (p: string) => {
    setCampaignSet(prev => {
      const next = new Set(prev);
      next.has(p) ? next.delete(p) : next.add(p);
      return next;
    });
  };

  // ─── Render selected customer board (radial) ───
  const renderBoard = () => {
    if (!selected) {
      return (
        <div className="flex flex-col items-center justify-center h-full text-center p-8 text-muted-foreground">
          <Users className="w-12 h-12 mb-3 opacity-30" />
          <p className="text-sm font-semibold">Seleziona un cliente</p>
          <p className="text-xs mt-1 opacity-70">Scegli un cliente dalla lista a sinistra per vedere il dettaglio interattivo e simulare campagne.</p>
        </div>
      );
    }
    const products = selected.productNames;
    const cx = 380, cy = 280, rProd = 170, rLook = 260;

    return (
      <svg viewBox="0 0 760 560" className="w-full h-full">
        {/* connections customer → products */}
        {products.map((p, i) => {
          const angle = (i / Math.max(products.length, 1)) * Math.PI * 2 - Math.PI / 2;
          const px = cx + Math.cos(angle) * rProd;
          const py = cy + Math.sin(angle) * rProd;
          const active = campaignSet.has(p);
          return (
            <line key={`l-${p}`} x1={cx} y1={cy} x2={px} y2={py}
              stroke={active ? 'hsl(var(--primary))' : 'hsl(var(--border))'}
              strokeWidth={active ? 2 : 1} opacity={active ? 0.9 : 0.4} />
          );
        })}

        {/* lookalike ring */}
        {lookalikes.map((c, i) => {
          const angle = (i / Math.max(lookalikes.length, 1)) * Math.PI * 2 - Math.PI / 2;
          const lx = cx + Math.cos(angle) * rLook;
          const ly = cy + Math.sin(angle) * rLook;
          const owns = Array.from(campaignSet).some(p => c.productNames.includes(p));
          return (
            <g key={`lk-${c.id}`}>
              <circle cx={lx} cy={ly} r={6}
                fill={owns ? 'hsl(var(--primary) / 0.7)' : 'hsl(var(--muted-foreground) / 0.4)'}
                stroke="hsl(var(--background))" strokeWidth={1.5}>
                <title>{c.name} — {fmt(c.totalSpent)}</title>
              </circle>
            </g>
          );
        })}

        {/* product nodes */}
        {products.map((p, i) => {
          const angle = (i / Math.max(products.length, 1)) * Math.PI * 2 - Math.PI / 2;
          const px = cx + Math.cos(angle) * rProd;
          const py = cy + Math.sin(angle) * rProd;
          const active = campaignSet.has(p);
          const popularity = productIndex.get(p)?.size ?? 1;
          const radius = Math.min(22, 10 + Math.log2(popularity + 1) * 2);
          return (
            <g key={`p-${p}`} className="cursor-pointer" onClick={() => toggleCampaign(p)}>
              <circle cx={px} cy={py} r={radius}
                fill={active ? 'hsl(var(--primary))' : 'hsl(var(--card))'}
                stroke={active ? 'hsl(var(--primary))' : 'hsl(var(--border))'}
                strokeWidth={2} className="transition-all hover:stroke-primary" />
              <text x={px} y={py + radius + 12} textAnchor="middle"
                className="fill-foreground text-[10px] font-medium pointer-events-none"
                style={{ fontSize: '10px' }}>
                {p.length > 22 ? p.slice(0, 22) + '…' : p}
              </text>
              <title>{p} — clicca per aggiungere alla campagna</title>
            </g>
          );
        })}

        {/* center customer */}
        <circle cx={cx} cy={cy} r={38} fill="hsl(var(--primary) / 0.15)" stroke="hsl(var(--primary))" strokeWidth={2} />
        <text x={cx} y={cy - 3} textAnchor="middle" className="fill-foreground text-[11px] font-bold" style={{ fontSize: '11px' }}>
          {selected.name.length > 16 ? selected.name.slice(0, 16) + '…' : selected.name}
        </text>
        <text x={cx} y={cy + 12} textAnchor="middle" className="fill-muted-foreground text-[9px]" style={{ fontSize: '9px' }}>
          {fmt(selected.totalSpent)} • {selected.orderCount} ord
        </text>

        {/* legend */}
        <g transform="translate(16, 16)">
          <rect width={180} height={56} rx={6} fill="hsl(var(--card))" stroke="hsl(var(--border))" />
          <circle cx={12} cy={16} r={4} fill="hsl(var(--primary))" />
          <text x={22} y={19} className="fill-foreground text-[9px]" style={{ fontSize: '9px' }}>Cliente / prodotto attivo</text>
          <circle cx={12} cy={32} r={4} fill="hsl(var(--muted-foreground) / 0.4)" />
          <text x={22} y={35} className="fill-foreground text-[9px]" style={{ fontSize: '9px' }}>Lookalike (stesso segmento)</text>
          <text x={12} y={50} className="fill-muted-foreground text-[8px]" style={{ fontSize: '8px' }}>Clicca un prodotto per simulare</text>
        </g>
      </svg>
    );
  };

  return (
    <div className="glass-card p-0 overflow-hidden">
      <div className="grid grid-cols-12 min-h-[640px]">
        {/* ─── Left: customer list with invoice preview ─── */}
        <aside className="col-span-12 md:col-span-4 border-r border-border/40 flex flex-col max-h-[640px]">
          <div className="p-3 border-b border-border/40 sticky top-0 bg-background/80 backdrop-blur z-10">
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
              <Input value={search} onChange={e => setSearch(e.target.value)}
                placeholder="Cerca cliente…" className="pl-8 h-8 text-xs" />
            </div>
            <p className="text-[10px] text-muted-foreground mt-2">
              {list.length} clienti{list.length > 150 && ' • mostrati primi 150'}
            </p>
          </div>
          <div className="overflow-y-auto flex-1">
            {visible.map(c => {
              const ins = insightMap.get(c.id);
              const isSel = c.id === selectedId;
              const last = c.lastOrder instanceof Date ? c.lastOrder : new Date(c.lastOrder);
              return (
                <button key={c.id}
                  onClick={() => { setSelectedId(c.id); setCampaignSet(new Set()); }}
                  className={`w-full text-left p-3 border-b border-border/30 transition-colors ${
                    isSel ? 'bg-primary/10 border-l-2 border-l-primary' : 'hover:bg-muted/40'
                  }`}>
                  <div className="flex items-start justify-between gap-2 mb-1">
                    <p className="text-xs font-semibold truncate">{c.name}</p>
                    <span className="text-[10px] font-mono font-bold text-primary shrink-0">{fmt(c.totalSpent)}</span>
                  </div>
                  {c.email && (
                    <p className="text-[10px] text-muted-foreground truncate flex items-center gap-1 mb-1">
                      <Mail className="w-2.5 h-2.5" /> {c.email}
                    </p>
                  )}
                  <div className="flex items-center gap-2 text-[10px] text-muted-foreground">
                    <span className="flex items-center gap-1"><Package className="w-2.5 h-2.5" />{c.orderCount}</span>
                    <span className="flex items-center gap-1"><Calendar className="w-2.5 h-2.5" />{format(last, 'dd/MM/yy')}</span>
                    {ins?.boat_type && (
                      <span className="flex items-center gap-1 text-primary/80"><Ship className="w-2.5 h-2.5" />{ins.boat_type}</span>
                    )}
                  </div>
                  {c.productNames.length > 0 && (
                    <p className="text-[10px] text-muted-foreground/80 mt-1 line-clamp-1">
                      {c.productNames.slice(0, 3).join(' • ')}
                      {c.productNames.length > 3 && ` +${c.productNames.length - 3}`}
                    </p>
                  )}
                </button>
              );
            })}
          </div>
        </aside>

        {/* ─── Right: board + simulator ─── */}
        <section className="col-span-12 md:col-span-8 flex flex-col">
          {/* Header */}
          <div className="p-3 border-b border-border/40 flex items-center justify-between gap-2 flex-wrap">
            <div className="flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-primary" />
              <h3 className="text-xs font-bold uppercase tracking-wider">
                {selected ? `Lavagna — ${selected.name}` : 'Lavagna interattiva'}
              </h3>
            </div>
            {selected && (
              <div className="flex items-center gap-2">
                {campaignSet.size > 0 && (
                  <Button size="sm" variant="ghost" className="h-7 text-[11px] gap-1" onClick={() => setCampaignSet(new Set())}>
                    <RotateCcw className="w-3 h-3" /> Reset
                  </Button>
                )}
                <Button size="sm" variant="ghost" className="h-7 text-[11px] gap-1" onClick={() => setSelectedId(null)}>
                  <X className="w-3 h-3" /> Chiudi
                </Button>
              </div>
            )}
          </div>

          {/* Board */}
          <div className="flex-1 min-h-[420px] bg-muted/10">
            {renderBoard()}
          </div>

          {/* Simulator panel */}
          {selected && (
            <div className="border-t border-border/40 p-3 space-y-3 bg-card/50">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Target className="w-3.5 h-3.5 text-primary" />
                  <h4 className="text-[11px] font-bold uppercase tracking-wider">Simulazione campagna</h4>
                </div>
                <span className="text-[10px] text-muted-foreground">
                  Segmento: {selIns?.boat_type ?? '—'} {selIns?.boat_size_range ?? ''}
                </span>
              </div>

              {/* Campaign products chips */}
              <div className="flex flex-wrap gap-1.5 min-h-[28px]">
                {campaignSet.size === 0 ? (
                  <p className="text-[10px] text-muted-foreground italic">
                    Clicca i prodotti nel grafico per aggiungerli alla campagna →
                  </p>
                ) : (
                  Array.from(campaignSet).map(p => (
                    <button key={p} onClick={() => toggleCampaign(p)}
                      className="text-[10px] bg-primary/15 text-primary px-2 py-1 rounded-full hover:bg-primary/25 flex items-center gap-1">
                      {p.length > 28 ? p.slice(0, 28) + '…' : p} <X className="w-2.5 h-2.5" />
                    </button>
                  ))
                )}
              </div>

              {/* Discount slider */}
              <div className="space-y-1">
                <div className="flex justify-between text-[10px] text-muted-foreground">
                  <span>Sconto promo</span>
                  <span className="font-mono font-bold text-foreground">{discount[0]}%</span>
                </div>
                <Slider value={discount} onValueChange={setDiscount} min={0} max={40} step={5} />
              </div>

              {/* Metrics */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                <div className="bg-background/60 rounded p-2">
                  <p className="text-[9px] text-muted-foreground uppercase">Lookalike</p>
                  <p className="text-sm font-bold font-mono">{lookalikes.length}</p>
                </div>
                <div className="bg-background/60 rounded p-2">
                  <p className="text-[9px] text-muted-foreground uppercase">Già acquistato</p>
                  <p className="text-sm font-bold font-mono">{sim?.directReach ?? 0}</p>
                </div>
                <div className="bg-background/60 rounded p-2">
                  <p className="text-[9px] text-muted-foreground uppercase">Reach nuovo</p>
                  <p className="text-sm font-bold font-mono text-primary">{sim?.newReach ?? 0}</p>
                </div>
                <div className="bg-background/60 rounded p-2">
                  <p className="text-[9px] text-muted-foreground uppercase">Revenue stimato</p>
                  <p className="text-sm font-bold font-mono text-primary">{sim ? fmt(sim.estRevenue) : '—'}</p>
                </div>
              </div>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
