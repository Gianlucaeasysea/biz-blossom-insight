import { useMemo, useState, useRef } from 'react';
import { Ship, Package, Users, Sparkles, Filter, Target, RotateCcw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Slider } from '@/components/ui/slider';

interface CustomerNode {
  id: string;
  name: string;
  email: string | null;
  country: string;
  orderCount: number;
  totalSpent: number;
  productNames: string[];
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

type NodeKind = 'customer' | 'product';
interface GNode {
  id: string;
  kind: NodeKind;
  label: string;
  x: number;
  y: number;
  size: number;
  meta?: any;
}

export function MarketingWhiteboard({ customers, insightMap, fmt }: Props) {
  // ─── Build graph data ────────────────────────────────────────────
  const { products, productCustomers, customerProducts } = useMemo(() => {
    const productCustomers = new Map<string, Set<string>>();
    const customerProducts = new Map<string, Set<string>>();
    customers.forEach(c => {
      const set = new Set<string>();
      customerProducts.set(c.id, set);
      c.productNames.forEach(p => {
        set.add(p);
        if (!productCustomers.has(p)) productCustomers.set(p, new Set());
        productCustomers.get(p)!.add(c.id);
      });
    });
    const products = Array.from(productCustomers.entries())
      .map(([name, set]) => ({ name, customers: set.size }))
      .sort((a, b) => b.customers - a.customers);
    return { products, productCustomers, customerProducts };
  }, [customers]);

  // ─── UI state ────────────────────────────────────────────────────
  const [minOrders, setMinOrders] = useState(1);
  const [segFilter, setSegFilter] = useState<string>('all');
  const [search, setSearch] = useState('');
  const [topProducts, setTopProducts] = useState(40);
  const [selectedProduct, setSelectedProduct] = useState<string | null>(null);
  const [selectedCustomer, setSelectedCustomer] = useState<string | null>(null);
  const [simProducts, setSimProducts] = useState<Set<string>>(new Set());
  const [simDiscount, setSimDiscount] = useState(10);
  const [hover, setHover] = useState<{ id: string; kind: NodeKind; x: number; y: number } | null>(null);

  const segments = useMemo(() => {
    const s = new Set<string>();
    insightMap.forEach(i => { if (i.boat_type) s.add(i.boat_type); });
    return Array.from(s).sort();
  }, [insightMap]);

  // Apply filters to visible customers
  const visibleCustomers = useMemo(() => {
    const q = search.toLowerCase().trim();
    return customers.filter(c => {
      if (c.orderCount < minOrders) return false;
      if (segFilter !== 'all') {
        const ins = insightMap.get(c.id);
        if (!ins || ins.boat_type !== segFilter) return false;
      }
      if (q && !c.name.toLowerCase().includes(q) && !(c.email || '').toLowerCase().includes(q)) return false;
      return true;
    });
  }, [customers, minOrders, segFilter, search, insightMap]);

  const visibleProducts = useMemo(() => {
    const visIds = new Set(visibleCustomers.map(c => c.id));
    return products
      .map(p => ({
        ...p,
        customers: Array.from(productCustomers.get(p.name) || []).filter(id => visIds.has(id)).length,
      }))
      .filter(p => p.customers > 0)
      .sort((a, b) => b.customers - a.customers)
      .slice(0, topProducts);
  }, [products, productCustomers, visibleCustomers, topProducts]);

  // ─── Layout: products inner ring, customers outer ring ──────────
  const W = 1100;
  const H = 700;
  const cx = W / 2;
  const cy = H / 2;
  const innerR = 180;
  const outerR = 310;

  const productNodes: GNode[] = useMemo(() => {
    const n = visibleProducts.length;
    return visibleProducts.map((p, i) => {
      const angle = (i / Math.max(n, 1)) * Math.PI * 2 - Math.PI / 2;
      return {
        id: `p:${p.name}`,
        kind: 'product' as const,
        label: p.name,
        x: cx + Math.cos(angle) * innerR,
        y: cy + Math.sin(angle) * innerR,
        size: 6 + Math.min(14, p.customers * 0.6),
        meta: p,
      };
    });
  }, [visibleProducts]);

  const customerNodes: GNode[] = useMemo(() => {
    // Sort customers around the ring near their main product cluster
    const sorted = [...visibleCustomers].sort((a, b) => {
      const aIdx = productNodes.findIndex(pn => pn.label === a.productNames[0]);
      const bIdx = productNodes.findIndex(pn => pn.label === b.productNames[0]);
      return aIdx - bIdx;
    });
    const n = sorted.length;
    return sorted.map((c, i) => {
      const angle = (i / Math.max(n, 1)) * Math.PI * 2 - Math.PI / 2;
      return {
        id: `c:${c.id}`,
        kind: 'customer' as const,
        label: c.name,
        x: cx + Math.cos(angle) * outerR,
        y: cy + Math.sin(angle) * outerR,
        size: 3 + Math.min(8, c.orderCount * 1.2),
        meta: c,
      };
    });
  }, [visibleCustomers, productNodes]);

  const productPosMap = useMemo(() => {
    const m = new Map<string, GNode>();
    productNodes.forEach(n => m.set(n.label, n));
    return m;
  }, [productNodes]);

  // ─── Simulation: customers reached by selected product set ──────
  const simulation = useMemo(() => {
    if (simProducts.size === 0) return null;
    // Reach: customers who already bought at least one of these
    const reached = new Set<string>();
    visibleCustomers.forEach(c => {
      for (const p of c.productNames) if (simProducts.has(p)) { reached.add(c.id); break; }
    });
    // Lookalike: customers in same boat segment as reached but who haven't bought any
    const reachedSegs = new Set<string>();
    reached.forEach(id => {
      const ins = insightMap.get(id);
      if (ins?.boat_type) reachedSegs.add(ins.boat_type);
    });
    const lookalike = new Set<string>();
    visibleCustomers.forEach(c => {
      if (reached.has(c.id)) return;
      const ins = insightMap.get(c.id);
      if (ins?.boat_type && reachedSegs.has(ins.boat_type)) lookalike.add(c.id);
    });
    // Estimated uplift = lookalike * avg price of selected products * conv rate(5%) * (1 - discount)
    const avgPrice = (() => {
      let total = 0, count = 0;
      visibleCustomers.forEach(c => {
        if (c.productNames.some(p => simProducts.has(p))) {
          total += c.totalSpent / Math.max(c.orderCount, 1);
          count++;
        }
      });
      return count ? total / count : 0;
    })();
    const conv = 0.05;
    const estRevenue = lookalike.size * avgPrice * conv * (1 - simDiscount / 100);
    return { reached, lookalike, avgPrice, estRevenue };
  }, [simProducts, visibleCustomers, insightMap, simDiscount]);

  // ─── Edges to render ────────────────────────────────────────────
  // Show edges only on hover/selection to keep clean
  const activeEdges = useMemo(() => {
    const edges: Array<{ x1: number; y1: number; x2: number; y2: number; strong: boolean }> = [];
    const focusProduct =
      hover?.kind === 'product' ? hover.id.slice(2) :
      selectedProduct;
    const focusCustomer =
      hover?.kind === 'customer' ? hover.id.slice(2) :
      selectedCustomer;

    if (focusProduct) {
      const pn = productPosMap.get(focusProduct);
      const ids = productCustomers.get(focusProduct);
      if (pn && ids) {
        customerNodes.forEach(cn => {
          if (ids.has(cn.meta.id)) {
            edges.push({ x1: pn.x, y1: pn.y, x2: cn.x, y2: cn.y, strong: true });
          }
        });
      }
    }
    if (focusCustomer) {
      const cn = customerNodes.find(n => n.meta.id === focusCustomer);
      const prods = customerProducts.get(focusCustomer);
      if (cn && prods) {
        prods.forEach(name => {
          const pn = productPosMap.get(name);
          if (pn) edges.push({ x1: cn.x, y1: cn.y, x2: pn.x, y2: pn.y, strong: true });
        });
      }
    }
    // Simulation edges - light
    if (simulation && simProducts.size > 0) {
      simProducts.forEach(name => {
        const pn = productPosMap.get(name);
        if (!pn) return;
        customerNodes.forEach(cn => {
          if (simulation.reached.has(cn.meta.id)) {
            edges.push({ x1: pn.x, y1: pn.y, x2: cn.x, y2: cn.y, strong: false });
          }
        });
      });
    }
    return edges;
  }, [hover, selectedProduct, selectedCustomer, customerNodes, productPosMap, productCustomers, customerProducts, simulation, simProducts]);

  // ─── Pan/zoom ────────────────────────────────────────────────────
  const svgRef = useRef<SVGSVGElement>(null);
  const [view, setView] = useState({ x: 0, y: 0, k: 1 });
  const drag = useRef<{ x: number; y: number } | null>(null);

  const onWheel = (e: React.WheelEvent) => {
    e.preventDefault();
    const delta = -e.deltaY * 0.001;
    setView(v => ({ ...v, k: Math.max(0.4, Math.min(3, v.k * (1 + delta))) }));
  };
  const onMouseDown = (e: React.MouseEvent) => { drag.current = { x: e.clientX - view.x, y: e.clientY - view.y }; };
  const onMouseMove = (e: React.MouseEvent) => {
    if (!drag.current) return;
    setView(v => ({ ...v, x: e.clientX - drag.current!.x, y: e.clientY - drag.current!.y }));
  };
  const onMouseUp = () => { drag.current = null; };

  const toggleSimProduct = (name: string) => {
    setSimProducts(prev => {
      const n = new Set(prev);
      if (n.has(name)) n.delete(name); else n.add(name);
      return n;
    });
  };

  const resetView = () => setView({ x: 0, y: 0, k: 1 });

  return (
    <div className="space-y-3">
      {/* Toolbar */}
      <div className="glass-card p-3 flex flex-wrap items-center gap-2">
        <Filter className="w-4 h-4 text-muted-foreground" />
        <Input
          placeholder="Cerca cliente..." value={search} onChange={e => setSearch(e.target.value)}
          className="h-8 text-xs w-[180px]"
        />
        <Select value={segFilter} onValueChange={setSegFilter}>
          <SelectTrigger className="w-[160px] h-8 text-xs"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Tutti i segmenti</SelectItem>
            {segments.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
          </SelectContent>
        </Select>
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <span>Min ordini:</span>
          <div className="w-24"><Slider value={[minOrders]} min={1} max={10} step={1} onValueChange={v => setMinOrders(v[0])} /></div>
          <span className="font-mono">{minOrders}</span>
        </div>
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <span>Top prodotti:</span>
          <div className="w-24"><Slider value={[topProducts]} min={10} max={100} step={5} onValueChange={v => setTopProducts(v[0])} /></div>
          <span className="font-mono">{topProducts}</span>
        </div>
        <div className="ml-auto flex items-center gap-2">
          <Button size="sm" variant="outline" className="h-8 gap-1.5" onClick={resetView}>
            <RotateCcw className="w-3.5 h-3.5" /> Reset vista
          </Button>
          <span className="text-[10px] text-muted-foreground">{visibleCustomers.length} clienti · {visibleProducts.length} prodotti</span>
        </div>
      </div>

      <div className="grid lg:grid-cols-[1fr_300px] gap-3">
        {/* Canvas */}
        <div className="glass-card p-0 overflow-hidden relative" style={{ height: 720 }}>
          <svg
            ref={svgRef}
            viewBox={`0 0 ${W} ${H}`}
            className="w-full h-full cursor-grab active:cursor-grabbing select-none"
            onWheel={onWheel}
            onMouseDown={onMouseDown}
            onMouseMove={onMouseMove}
            onMouseUp={onMouseUp}
            onMouseLeave={onMouseUp}
          >
            <defs>
              <radialGradient id="bgGrad" cx="50%" cy="50%" r="50%">
                <stop offset="0%" stopColor="hsl(var(--primary) / 0.06)" />
                <stop offset="100%" stopColor="transparent" />
              </radialGradient>
            </defs>
            <rect width={W} height={H} fill="url(#bgGrad)" />
            <g transform={`translate(${view.x},${view.y}) scale(${view.k})`}>
              {/* Concentric rings hint */}
              <circle cx={cx} cy={cy} r={innerR} fill="none" stroke="hsl(var(--border))" strokeDasharray="2 4" opacity="0.4" />
              <circle cx={cx} cy={cy} r={outerR} fill="none" stroke="hsl(var(--border))" strokeDasharray="2 4" opacity="0.3" />
              <text x={cx} y={cy - innerR - 8} textAnchor="middle" className="fill-muted-foreground" fontSize="10">PRODOTTI</text>
              <text x={cx} y={cy - outerR - 8} textAnchor="middle" className="fill-muted-foreground" fontSize="10">CLIENTI</text>

              {/* Edges */}
              {activeEdges.map((e, i) => (
                <line key={i} x1={e.x1} y1={e.y1} x2={e.x2} y2={e.y2}
                  stroke={e.strong ? 'hsl(var(--primary))' : 'hsl(var(--primary) / 0.25)'}
                  strokeWidth={e.strong ? 1.2 : 0.4}
                />
              ))}

              {/* Customer nodes */}
              {customerNodes.map(n => {
                const ins = insightMap.get(n.meta.id);
                const inReached = simulation?.reached.has(n.meta.id);
                const inLookalike = simulation?.lookalike.has(n.meta.id);
                const isSel = selectedCustomer === n.meta.id;
                let fill = 'hsl(var(--muted-foreground) / 0.5)';
                if (ins?.boat_type) fill = 'hsl(168 38% 54%)';
                if (inLookalike) fill = 'hsl(38 85% 60%)';
                if (inReached) fill = 'hsl(var(--primary))';
                if (isSel) fill = 'hsl(0 80% 60%)';
                return (
                  <circle key={n.id} cx={n.x} cy={n.y} r={n.size} fill={fill}
                    stroke={isSel ? 'hsl(0 80% 60%)' : 'transparent'} strokeWidth={isSel ? 2 : 0}
                    className="cursor-pointer"
                    opacity={hover && hover.id !== n.id ? 0.5 : 1}
                    onMouseEnter={() => setHover({ id: n.id, kind: 'customer', x: n.x, y: n.y })}
                    onMouseLeave={() => setHover(null)}
                    onClick={(e) => { e.stopPropagation(); setSelectedCustomer(s => s === n.meta.id ? null : n.meta.id); setSelectedProduct(null); }}
                  />
                );
              })}

              {/* Product nodes */}
              {productNodes.map(n => {
                const isSel = selectedProduct === n.label;
                const inSim = simProducts.has(n.label);
                let fill = 'hsl(var(--primary))';
                if (inSim) fill = 'hsl(38 85% 60%)';
                if (isSel) fill = 'hsl(0 80% 60%)';
                return (
                  <g key={n.id}>
                    <circle cx={n.x} cy={n.y} r={n.size} fill={fill}
                      stroke="hsl(var(--background))" strokeWidth={2}
                      className="cursor-pointer"
                      onMouseEnter={() => setHover({ id: n.id, kind: 'product', x: n.x, y: n.y })}
                      onMouseLeave={() => setHover(null)}
                      onClick={(e) => { e.stopPropagation(); setSelectedProduct(s => s === n.label ? null : n.label); setSelectedCustomer(null); }}
                      onDoubleClick={(e) => { e.stopPropagation(); toggleSimProduct(n.label); }}
                    />
                  </g>
                );
              })}

              {/* Hover tooltip */}
              {hover && (() => {
                const node = hover.kind === 'product'
                  ? productNodes.find(p => p.id === hover.id)
                  : customerNodes.find(c => c.id === hover.id);
                if (!node) return null;
                const text = hover.kind === 'product'
                  ? `${node.label} · ${node.meta.customers} clienti`
                  : `${node.meta.name} · ${node.meta.orderCount} ord. · ${fmt(node.meta.totalSpent)}`;
                return (
                  <g transform={`translate(${node.x + 12},${node.y - 12})`}>
                    <rect x={0} y={-14} rx={4} width={Math.min(text.length * 6.2, 320)} height={20}
                      fill="hsl(var(--popover))" stroke="hsl(var(--border))" />
                    <text x={6} y={0} fontSize="11" className="fill-foreground">{text.slice(0, 55)}</text>
                  </g>
                );
              })()}
            </g>
          </svg>
          <div className="absolute bottom-2 left-2 text-[10px] text-muted-foreground bg-background/80 backdrop-blur px-2 py-1 rounded border border-border/40">
            Trascina per spostare · Rotella per zoom · Click su prodotto = vedi clienti · Doppio click su prodotto = aggiungi a simulazione
          </div>
        </div>

        {/* Side panel: simulation */}
        <div className="glass-card p-3 space-y-3 max-h-[720px] overflow-auto">
          <div className="flex items-center gap-2">
            <Target className="w-4 h-4 text-primary" />
            <h3 className="text-sm font-bold">Simulazione campagna</h3>
          </div>
          <p className="text-[11px] text-muted-foreground">
            Doppio-click sui prodotti nella lavagna (o nella lista qui sotto) per costruire un'offerta. Mostra chi l'ha già comprato (reach) e lookalike per segmento barca.
          </p>

          <div>
            <label className="text-[11px] text-muted-foreground">Sconto offerto: <span className="font-semibold text-foreground">{simDiscount}%</span></label>
            <Slider value={[simDiscount]} min={0} max={50} step={5} onValueChange={v => setSimDiscount(v[0])} />
          </div>

          {simProducts.size === 0 ? (
            <p className="text-xs text-muted-foreground italic">Nessun prodotto in simulazione.</p>
          ) : (
            <>
              <div className="space-y-1">
                <p className="text-[10px] uppercase font-semibold text-muted-foreground">Prodotti selezionati</p>
                {Array.from(simProducts).map(p => (
                  <div key={p} className="flex items-center gap-1.5 text-xs bg-primary/10 px-2 py-1 rounded">
                    <Package className="w-3 h-3 text-primary shrink-0" />
                    <span className="flex-1 truncate">{p}</span>
                    <button onClick={() => toggleSimProduct(p)} className="text-muted-foreground hover:text-foreground">✕</button>
                  </div>
                ))}
              </div>
              {simulation && (
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div className="rounded border border-primary/40 bg-primary/5 p-2">
                    <div className="text-[10px] uppercase text-muted-foreground">Reach diretto</div>
                    <div className="text-lg font-bold font-mono text-primary">{simulation.reached.size}</div>
                    <div className="text-[10px] text-muted-foreground">clienti che l'hanno già</div>
                  </div>
                  <div className="rounded border p-2" style={{ borderColor: 'hsl(38 85% 60% / 0.5)', background: 'hsl(38 85% 60% / 0.08)' }}>
                    <div className="text-[10px] uppercase text-muted-foreground">Lookalike</div>
                    <div className="text-lg font-bold font-mono" style={{ color: 'hsl(38 85% 60%)' }}>{simulation.lookalike.size}</div>
                    <div className="text-[10px] text-muted-foreground">stesso segmento barca</div>
                  </div>
                  <div className="col-span-2 rounded border border-border p-2">
                    <div className="text-[10px] uppercase text-muted-foreground">Revenue stimato lookalike</div>
                    <div className="text-base font-bold font-mono">{fmt(simulation.estRevenue)}</div>
                    <div className="text-[10px] text-muted-foreground">
                      basato su prezzo medio {fmt(simulation.avgPrice)} · conv 5% · sconto {simDiscount}%
                    </div>
                  </div>
                </div>
              )}
              <Button size="sm" variant="outline" className="w-full gap-1.5" onClick={() => setSimProducts(new Set())}>
                Svuota simulazione
              </Button>
            </>
          )}

          {/* Selected entity detail */}
          {selectedProduct && (() => {
            const p = visibleProducts.find(x => x.name === selectedProduct);
            if (!p) return null;
            return (
              <div className="border-t border-border/40 pt-3">
                <div className="flex items-center gap-1.5 mb-1">
                  <Package className="w-3.5 h-3.5 text-primary" />
                  <span className="text-xs font-bold truncate">{p.name}</span>
                </div>
                <div className="text-[11px] text-muted-foreground">{p.customers} clienti hanno comprato questo prodotto.</div>
                <Button size="sm" className="mt-2 w-full gap-1.5 h-7 text-[11px]" onClick={() => toggleSimProduct(p.name)}>
                  <Sparkles className="w-3 h-3" /> {simProducts.has(p.name) ? 'Rimuovi da simulazione' : 'Aggiungi a simulazione'}
                </Button>
              </div>
            );
          })()}
          {selectedCustomer && (() => {
            const c = visibleCustomers.find(x => x.id === selectedCustomer);
            if (!c) return null;
            const ins = insightMap.get(c.id);
            return (
              <div className="border-t border-border/40 pt-3">
                <div className="flex items-center gap-1.5 mb-1">
                  <Ship className="w-3.5 h-3.5 text-primary" />
                  <span className="text-xs font-bold truncate">{c.name}</span>
                </div>
                <div className="text-[11px] text-muted-foreground">{c.email || '—'}</div>
                <div className="text-[11px] mt-1"><span className="text-muted-foreground">Ordini:</span> <span className="font-mono">{c.orderCount}</span> · <span className="text-muted-foreground">LTV:</span> <span className="font-mono">{fmt(c.totalSpent)}</span></div>
                {ins?.boat_type && (
                  <div className="text-[11px] mt-0.5"><span className="text-muted-foreground">Segmento:</span> {ins.boat_type} · {ins.boat_size_range}</div>
                )}
                <div className="mt-2">
                  <p className="text-[10px] uppercase text-muted-foreground mb-1">Prodotti ({c.productNames.length})</p>
                  <div className="space-y-0.5 max-h-32 overflow-auto">
                    {c.productNames.map(p => (
                      <div key={p} className="text-[11px] truncate">• {p}</div>
                    ))}
                  </div>
                </div>
              </div>
            );
          })()}

          {/* Quick product picker */}
          <div className="border-t border-border/40 pt-3">
            <p className="text-[10px] uppercase font-semibold text-muted-foreground mb-1.5 flex items-center gap-1.5">
              <Users className="w-3 h-3" /> Prodotti top
            </p>
            <div className="space-y-0.5 max-h-48 overflow-auto">
              {visibleProducts.slice(0, 30).map(p => (
                <button key={p.name}
                  onClick={() => toggleSimProduct(p.name)}
                  className={`w-full flex items-center justify-between gap-2 px-1.5 py-1 rounded text-[11px] hover:bg-muted/50 ${simProducts.has(p.name) ? 'bg-primary/10' : ''}`}>
                  <span className="truncate text-left">{p.name}</span>
                  <span className="font-mono text-muted-foreground shrink-0">{p.customers}</span>
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
