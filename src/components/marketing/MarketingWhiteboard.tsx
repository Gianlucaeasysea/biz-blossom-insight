import { useMemo, useState } from 'react';
import { Ship, Package, Users, Sparkles, Target, RotateCcw, Search, Calendar, Mail, X, Save, Lightbulb, Zap } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Slider } from '@/components/ui/slider';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { format } from 'date-fns';
import {
  useCustomerSegmentation, liftRecommendations, propensityScore,
  type CustomerLite, type SegmentKey,
} from '@/hooks/useCustomerSegmentation';
import { useSaveCampaign } from '@/hooks/useSavedCampaigns';
import { toast } from 'sonner';

interface OrderLite {
  id?: string;
  date: Date | string;
  netAmount?: number;
  totalAmount: number;
  products: { name: string; quantity?: number; price?: number }[];
}
interface CustomerNode extends CustomerLite {
  name: string;
  email: string | null;
  country: string;
  orders: OrderLite[];
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
  activeSegment?: SegmentKey | null;
  segmentIds?: Set<string>;
}

type Objective = 'cross-sell' | 'win-back' | 'upsell' | 'new-launch';

export function MarketingWhiteboard({ customers, insightMap, fmt, activeSegment, segmentIds }: Props) {
  const [search, setSearch] = useState('');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [campaignSet, setCampaignSet] = useState<Set<string>>(new Set());
  const [discount, setDiscount] = useState([10]);
  const [objective, setObjective] = useState<Objective>('cross-sell');
  const [campaignName, setCampaignName] = useState('');

  const seg = useCustomerSegmentation(customers);
  const saveMutation = useSaveCampaign();

  // Filtered list
  const list = useMemo(() => {
    const q = search.toLowerCase().trim();
    return customers
      .filter(c => {
        if (segmentIds && segmentIds.size > 0 && !segmentIds.has(c.id)) return false;
        if (q && !c.name.toLowerCase().includes(q) && !(c.email ?? '').toLowerCase().includes(q)) return false;
        return true;
      })
      .sort((a, b) => b.totalSpent - a.totalSpent);
  }, [customers, search, segmentIds]);

  const visible = list.slice(0, 150);
  const selected = selectedId ? customers.find(c => c.id === selectedId) ?? null : null;
  const selIns = selected ? insightMap.get(selected.id) : null;

  // Lift suggestions for selected customer
  const liftRecs = useMemo(
    () => (selected ? liftRecommendations(selected, seg.basketRules, 6) : []),
    [selected, seg.basketRules],
  );

  // Lookalikes ordered by propensity
  const lookalikes = useMemo(() => {
    if (!selected) return [] as { c: CustomerNode; propensity: number }[];
    const targetSeg = selIns?.boat_type ? `${selIns.boat_type}-${selIns.boat_size_range ?? ''}` : null;
    const campArr = Array.from(campaignSet);
    return customers
      .filter(c => {
        if (c.id === selected.id) return false;
        if (targetSeg) {
          const ins = insightMap.get(c.id);
          if (!ins?.boat_type) return false;
          if (`${ins.boat_type}-${ins.boat_size_range ?? ''}` !== targetSeg) return false;
        } else {
          // fallback: customers sharing at least one product
          if (!c.productNames.some(p => selected.productNames.includes(p))) return false;
        }
        return true;
      })
      .map(c => ({
        c,
        propensity: campArr.length ? propensityScore(c, campArr, seg.basketRules, seg.rfm.get(c.id)) : 0,
      }))
      .sort((a, b) => b.propensity - a.propensity)
      .slice(0, 60);
  }, [selected, selIns, customers, insightMap, campaignSet, seg.basketRules, seg.rfm]);

  // Simulation metrics with min/max range
  const sim = useMemo(() => {
    if (!selected || campaignSet.size === 0) return null;
    const camp = Array.from(campaignSet);
    const newReachList = lookalikes.filter(({ c }) => !camp.some(p => c.productNames.includes(p)));
    const directReach = lookalikes.length - newReachList.length;
    let priceSum = 0, priceN = 0;
    customers.forEach(c => c.orders.forEach(o => o.products.forEach(p => {
      if (camp.includes(p.name) && p.price) { priceSum += p.price; priceN++; }
    })));
    const avgPrice = priceN ? priceSum / priceN : 0;
    const boost = discount[0] / 100;
    // Weighted conversion by propensity score (avg of newReach propensity / 100)
    const avgProp = newReachList.length
      ? newReachList.reduce((s, x) => s + x.propensity, 0) / newReachList.length / 100
      : 0;
    const baseConv = 0.04 + avgProp * 0.12 + boost * 0.4; // conservative
    const estConvMin = Math.max(0.01, baseConv * 0.6);
    const estConvMax = Math.min(0.45, baseConv * 1.5);
    const revMin = newReachList.length * estConvMin * avgPrice * (1 - boost);
    const revMax = newReachList.length * estConvMax * avgPrice * camp.length * (1 - boost);
    return { directReach, newReach: newReachList.length, avgPrice, estConvMin, estConvMax, revMin, revMax };
  }, [selected, campaignSet, lookalikes, customers, discount]);

  const toggleCampaign = (p: string) => {
    setCampaignSet(prev => {
      const next = new Set(prev);
      next.has(p) ? next.delete(p) : next.add(p);
      return next;
    });
  };

  const addAllLiftRecs = () => {
    setCampaignSet(prev => {
      const next = new Set(prev);
      liftRecs.forEach(r => next.add(r.product));
      return next;
    });
  };

  const handleSaveCampaign = async () => {
    if (!selected || campaignSet.size === 0) return;
    const name = campaignName.trim() || `${objective} · ${selected.name} · ${format(new Date(), 'dd/MM HH:mm')}`;
    try {
      await saveMutation.mutateAsync({
        name,
        objective,
        segment: activeSegment ?? null,
        boat_type: selIns?.boat_type ?? null,
        product_names: Array.from(campaignSet),
        audience_ids: lookalikes.map(l => l.c.id),
        audience_size: lookalikes.length,
        discount_pct: discount[0],
        est_revenue_min: Math.round(sim?.revMin ?? 0),
        est_revenue_max: Math.round(sim?.revMax ?? 0),
        notes: null,
        status: 'draft',
        created_by: null as any,
      });
      toast.success('Campagna salvata');
      setCampaignName('');
    } catch (e: any) {
      toast.error(e.message || 'Errore salvataggio');
    }
  };

  // ─── Render selected customer board (radial) ───
  const renderBoard = () => {
    if (!selected) {
      return (
        <div className="flex flex-col items-center justify-center h-full text-center p-8 text-muted-foreground">
          <Users className="w-12 h-12 mb-3 opacity-30" />
          <p className="text-sm font-semibold">Seleziona un cliente</p>
          <p className="text-xs mt-1 opacity-70">Scegli un cliente dalla lista per visualizzare prodotti, lookalike ordinati per propensity e simulare campagne.</p>
        </div>
      );
    }
    const products = selected.productNames;
    const cx = 380, cy = 280, rProd = 170, rLook = 260;
    const productList = [...products, ...liftRecs.map(r => r.product).filter(p => !products.includes(p))];

    return (
      <svg viewBox="0 0 760 560" className="w-full h-full">
        {productList.map((p, i) => {
          const angle = (i / Math.max(productList.length, 1)) * Math.PI * 2 - Math.PI / 2;
          const px = cx + Math.cos(angle) * rProd;
          const py = cy + Math.sin(angle) * rProd;
          const active = campaignSet.has(p);
          const isSuggested = !products.includes(p);
          return (
            <line key={`l-${p}`} x1={cx} y1={cy} x2={px} y2={py}
              stroke={active ? 'hsl(var(--primary))' : isSuggested ? 'hsl(var(--accent))' : 'hsl(var(--border))'}
              strokeWidth={active ? 2 : 1}
              strokeDasharray={isSuggested ? '3,3' : '0'}
              opacity={active ? 0.9 : 0.4} />
          );
        })}

        {/* lookalikes — color encodes propensity */}
        {lookalikes.map(({ c, propensity }, i) => {
          const angle = (i / Math.max(lookalikes.length, 1)) * Math.PI * 2 - Math.PI / 2;
          const lx = cx + Math.cos(angle) * rLook;
          const ly = cy + Math.sin(angle) * rLook;
          const intensity = Math.max(0.25, propensity / 100);
          return (
            <g key={`lk-${c.id}`}>
              <circle cx={lx} cy={ly} r={5 + propensity / 25}
                fill={`hsl(var(--primary) / ${intensity})`}
                stroke="hsl(var(--background))" strokeWidth={1.5}>
                <title>{c.name} — propensity {propensity} — {fmt(c.totalSpent)}</title>
              </circle>
            </g>
          );
        })}

        {productList.map((p, i) => {
          const angle = (i / Math.max(productList.length, 1)) * Math.PI * 2 - Math.PI / 2;
          const px = cx + Math.cos(angle) * rProd;
          const py = cy + Math.sin(angle) * rProd;
          const active = campaignSet.has(p);
          const isSuggested = !products.includes(p);
          const popularity = seg.ownerOfProduct.get(p)?.size ?? 1;
          const radius = Math.min(22, 9 + Math.log2(popularity + 1) * 2);
          return (
            <g key={`p-${p}`} className="cursor-pointer" onClick={() => toggleCampaign(p)}>
              <circle cx={px} cy={py} r={radius}
                fill={active ? 'hsl(var(--primary))' : isSuggested ? 'hsl(var(--accent) / 0.2)' : 'hsl(var(--card))'}
                stroke={active ? 'hsl(var(--primary))' : isSuggested ? 'hsl(var(--accent))' : 'hsl(var(--border))'}
                strokeWidth={2} strokeDasharray={isSuggested && !active ? '2,2' : '0'}
                className="transition-all hover:stroke-primary" />
              {isSuggested && (
                <text x={px} y={py + 3} textAnchor="middle" className="fill-foreground pointer-events-none" style={{ fontSize: '11px' }}>★</text>
              )}
              <text x={px} y={py + radius + 12} textAnchor="middle"
                className="fill-foreground pointer-events-none" style={{ fontSize: '10px', fontWeight: 500 }}>
                {p.length > 22 ? p.slice(0, 22) + '…' : p}
              </text>
              <title>{p}{isSuggested ? ' — SUGGERITO da lift analysis' : ''} — clicca per aggiungere alla campagna</title>
            </g>
          );
        })}

        {/* center customer */}
        <circle cx={cx} cy={cy} r={38} fill="hsl(var(--primary) / 0.15)" stroke="hsl(var(--primary))" strokeWidth={2} />
        <text x={cx} y={cy - 3} textAnchor="middle" className="fill-foreground" style={{ fontSize: '11px', fontWeight: 700 }}>
          {selected.name.length > 16 ? selected.name.slice(0, 16) + '…' : selected.name}
        </text>
        <text x={cx} y={cy + 12} textAnchor="middle" className="fill-muted-foreground" style={{ fontSize: '9px' }}>
          {fmt(selected.totalSpent)} • {selected.orderCount} ord
        </text>

        {/* legend */}
        <g transform="translate(16, 16)">
          <rect width={220} height={72} rx={6} fill="hsl(var(--card))" stroke="hsl(var(--border))" />
          <circle cx={12} cy={16} r={4} fill="hsl(var(--primary))" />
          <text x={22} y={19} className="fill-foreground" style={{ fontSize: '9px' }}>Prodotto nella campagna</text>
          <circle cx={12} cy={32} r={4} fill="hsl(var(--accent) / 0.5)" stroke="hsl(var(--accent))" />
          <text x={22} y={35} className="fill-foreground" style={{ fontSize: '9px' }}>★ Suggerito (lift analysis)</text>
          <circle cx={12} cy={48} r={4} fill="hsl(var(--primary) / 0.8)" />
          <text x={22} y={51} className="fill-foreground" style={{ fontSize: '9px' }}>Lookalike (colore = propensity)</text>
          <text x={12} y={66} className="fill-muted-foreground" style={{ fontSize: '8px' }}>Clicca un prodotto per aggiungerlo</text>
        </g>
      </svg>
    );
  };

  return (
    <div className="glass-card p-0 overflow-hidden">
      <div className="grid grid-cols-12 min-h-[680px]">
        {/* ─── Left: customer list ─── */}
        <aside className="col-span-12 md:col-span-4 border-r border-border/40 flex flex-col max-h-[680px]">
          <div className="p-3 border-b border-border/40 sticky top-0 bg-background/80 backdrop-blur z-10">
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
              <Input value={search} onChange={e => setSearch(e.target.value)}
                placeholder="Cerca cliente…" className="pl-8 h-8 text-xs" />
            </div>
            <p className="text-[10px] text-muted-foreground mt-2">
              {list.length} clienti{list.length > 150 && ' • mostrati primi 150'}
              {activeSegment && <span className="ml-1 text-primary">• filtro segmento attivo</span>}
            </p>
          </div>
          <div className="overflow-y-auto flex-1">
            {visible.map(c => {
              const ins = insightMap.get(c.id);
              const rfm = seg.rfm.get(c.id);
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
                  <div className="flex items-center gap-2 text-[10px] text-muted-foreground flex-wrap">
                    <span className="flex items-center gap-1"><Package className="w-2.5 h-2.5" />{c.orderCount}</span>
                    <span className="flex items-center gap-1"><Calendar className="w-2.5 h-2.5" />{format(last, 'dd/MM/yy')}</span>
                    {ins?.boat_type && (
                      <span className="flex items-center gap-1 text-primary/80"><Ship className="w-2.5 h-2.5" />{ins.boat_type}</span>
                    )}
                    {rfm && (
                      <span className="font-mono text-[9px] px-1 py-0.5 rounded bg-muted/60" title="R-F-M score 1-5">
                        R{rfm.r}F{rfm.f}M{rfm.m}
                      </span>
                    )}
                  </div>
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
                {liftRecs.length > 0 && (
                  <Button size="sm" variant="outline" className="h-7 text-[11px] gap-1" onClick={addAllLiftRecs}>
                    <Lightbulb className="w-3 h-3" /> Aggiungi top {liftRecs.length} suggeriti
                  </Button>
                )}
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

          {/* Lift recommendations strip */}
          {selected && liftRecs.length > 0 && (
            <div className="px-3 py-2 border-b border-border/40 bg-accent/5 flex items-start gap-2 flex-wrap">
              <span className="text-[10px] font-bold uppercase text-accent flex items-center gap-1 shrink-0 mt-1">
                <Zap className="w-3 h-3" /> Prossimi acquisti più probabili
              </span>
              <div className="flex flex-wrap gap-1.5">
                {liftRecs.map(r => (
                  <button key={r.product} onClick={() => toggleCampaign(r.product)}
                    className={`text-[10px] px-2 py-1 rounded-full border transition-colors ${
                      campaignSet.has(r.product)
                        ? 'bg-primary text-primary-foreground border-primary'
                        : 'bg-card border-accent/40 hover:bg-accent/10'
                    }`}
                    title={`lift ${r.score.toFixed(1)} — da: ${r.sources.slice(0, 2).join(', ')}`}>
                    {r.product.length > 26 ? r.product.slice(0, 26) + '…' : r.product}
                    <span className="ml-1 font-mono opacity-70">×{r.score.toFixed(1)}</span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Board */}
          <div className="flex-1 min-h-[380px] bg-muted/10">
            {renderBoard()}
          </div>

          {/* Simulator */}
          {selected && (
            <div className="border-t border-border/40 p-3 space-y-3 bg-card/50">
              <div className="flex items-center justify-between gap-2 flex-wrap">
                <div className="flex items-center gap-2">
                  <Target className="w-3.5 h-3.5 text-primary" />
                  <h4 className="text-[11px] font-bold uppercase tracking-wider">Simulazione campagna</h4>
                </div>
                <div className="flex items-center gap-2">
                  <Select value={objective} onValueChange={(v: Objective) => setObjective(v)}>
                    <SelectTrigger className="h-7 text-[11px] w-[130px]"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="cross-sell">Cross-sell</SelectItem>
                      <SelectItem value="upsell">Upsell</SelectItem>
                      <SelectItem value="win-back">Win-back</SelectItem>
                      <SelectItem value="new-launch">Lancio prodotto</SelectItem>
                    </SelectContent>
                  </Select>
                  <span className="text-[10px] text-muted-foreground">
                    Segmento: {selIns?.boat_type ?? '—'} {selIns?.boat_size_range ?? ''}
                  </span>
                </div>
              </div>

              {/* Campaign chips */}
              <div className="flex flex-wrap gap-1.5 min-h-[28px]">
                {campaignSet.size === 0 ? (
                  <p className="text-[10px] text-muted-foreground italic">
                    Clicca i prodotti nel grafico o le pillole suggerite per costruire la campagna.
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
                  <p className="text-[9px] text-muted-foreground uppercase">Audience</p>
                  <p className="text-sm font-bold font-mono">{lookalikes.length}</p>
                </div>
                <div className="bg-background/60 rounded p-2">
                  <p className="text-[9px] text-muted-foreground uppercase">Reach nuovo</p>
                  <p className="text-sm font-bold font-mono text-primary">{sim?.newReach ?? 0}</p>
                </div>
                <div className="bg-background/60 rounded p-2">
                  <p className="text-[9px] text-muted-foreground uppercase">Conv. stimata</p>
                  <p className="text-sm font-bold font-mono">{sim ? `${(sim.estConvMin * 100).toFixed(1)}–${(sim.estConvMax * 100).toFixed(1)}%` : '—'}</p>
                </div>
                <div className="bg-background/60 rounded p-2">
                  <p className="text-[9px] text-muted-foreground uppercase">Revenue stimato</p>
                  <p className="text-sm font-bold font-mono text-primary">{sim ? `${fmt(sim.revMin)} – ${fmt(sim.revMax)}` : '—'}</p>
                </div>
              </div>

              {/* Save campaign */}
              <div className="flex items-center gap-2 pt-1">
                <Input value={campaignName} onChange={e => setCampaignName(e.target.value)}
                  placeholder="Nome campagna (opzionale)" className="h-8 text-xs flex-1" />
                <Button size="sm" className="h-8 gap-1.5"
                  disabled={campaignSet.size === 0 || saveMutation.isPending}
                  onClick={handleSaveCampaign}>
                  <Save className="w-3.5 h-3.5" />
                  {saveMutation.isPending ? 'Salvataggio...' : 'Salva campagna'}
                </Button>
              </div>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
