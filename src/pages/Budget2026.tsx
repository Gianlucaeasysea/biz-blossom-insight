import { useMemo, useState } from 'react';
import {
  ComposedChart, Bar, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  Legend, ResponsiveContainer, ReferenceLine, LineChart,
} from 'recharts';
import { NavLink } from '@/components/NavLink';
import { useShopifyOrders } from '@/hooks/useShopifyOrders';
import { getSkuCollection } from '@/lib/mock-data';
import { Loader2, Target, TrendingUp, Calendar as CalIcon, Zap } from 'lucide-react';

// ─── Static budget data ──────────────────────────────────────────────────────

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const BUDGET_YEAR = 2026;

const RAW = {
  products: [
    { name: 'FLIPPER',       sales: [3627,9425,8610,20679,11117,14764,14089,16285,7548,5752,15785,5672],  target: 200320, notes: '',                              mer: 2.3 },
    { name: 'OLLI BLOCK',    sales: [12177,4647,2669,9479,12177,7642,5770,7795,3601,4409,15241,3573],    target: 120190, notes: '',                              mer: 2.5 },
    { name: 'OLLI RING',     sales: [474,2295,2059,4002,5180,4416,2350,3389,1136,1052,3064,1104],        target: 32050,  notes: '',                              mer: 2.0 },
    { name: 'JAKE',          sales: [0,0,0,0,0,0,0,0,0,0,0,16788],                                      target: 99180,  notes: 'from March',    startMonth: 2,  mer: 2.5 },
    { name: 'WAY2',          sales: [0,0,0,0,0,0,0,0,0,22175,7959,2707],                                target: 112200, notes: 'from February',  startMonth: 1,  mer: 2.5 },
    { name: 'SIDE PRODUCTS', sales: [131,0,657,2281,2315,3406,2063,3182,2247,1514,4773,261],             target: 31030,  notes: '',                              mer: 2.5 },
    { name: 'EA ELEMENTS',   sales: [0,0,0,0,0,0,0,0,0,0,0,0],                                         target: 30000,  notes: 'new collection from May', startMonth: 4, mer: 2.5 },
  ],
  mer:      [1.73,2.92,3.75,2.4,3.14,2.41,2.4,2.74,2.41,2.43,3.01,2.11],
  calendar: [
    { initiative: 'Jake Launch',          weight: 1.0 },
    { initiative: 'Way2 Drop 2',          weight: 1.0 },
    { initiative: 'Jake Drop 2',          weight: 1.0 },
    { initiative: 'Promo Marketing',      weight: 0.7 },
    { initiative: 'Easyweek',             weight: 1.6 },
    { initiative: 'Elements Launch',      weight: 1.4 },
    { initiative: 'Promo Marketing',      weight: 1.0 },
    { initiative: 'Summer Sale',          weight: 1.4 },
    { initiative: 'Promo Marketing',      weight: 1.0 },
    { initiative: 'eFlipper Launch',      weight: 1.0 },
    { initiative: 'Black Friday 26',      weight: 1.8 },
    { initiative: '—',                    weight: 1.0 },
  ],
  spendTarget: 238000,
  advTotals: [6833,6230,8623,15654,18115,11973,16541,12650,7417,20154,17849,14279],
};

const PRODUCT_COLORS: Record<string, string> = {
  'FLIPPER':       'hsl(168,70%,42%)',
  'OLLI BLOCK':    'hsl(42,96%,48%)',
  'OLLI RING':     'hsl(215,85%,55%)',
  'JAKE':          'hsl(270,60%,60%)',
  'WAY2':          'hsl(190,90%,45%)',
  'SIDE PRODUCTS': 'hsl(30,80%,55%)',
  'EA ELEMENTS':   'hsl(340,70%,55%)',
};

// Shopify collection → budget product
const COLLECTION_MAP: Record<string, string> = {
  'Winch Handle':              'FLIPPER',
  'Blocks':                    'OLLI BLOCK',
  'Low Friction & Solid Rings':'OLLI RING',
  'JAKE':                      'JAKE',
  'Inflatable':                'WAY2',
  'Side products':             'SIDE PRODUCTS',
};

// ─── Helpers ─────────────────────────────────────────────────────────────────

/** Distribute annual 2026 target across 12 months using 2025 seasonality (or flat from startMonth) */
function monthlyTargets(p: typeof RAW.products[0]): number[] {
  const sm = p.startMonth ?? 0;
  const nonZero = p.sales.filter(v => v > 0).length;
  if (nonZero < 6) {
    const active = 12 - sm;
    return MONTHS.map((_, i) => i >= sm ? Math.round(p.target / active) : 0);
  }
  const tot = p.sales.reduce((s, v) => s + v, 0);
  return p.sales.map(v => tot > 0 ? Math.round((v / tot) * p.target) : 0);
}

const fmtEur = (v: number) =>
  new Intl.NumberFormat('it-IT', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(v);

const fmtK = (v: number) =>
  v >= 1000 ? `€${(v / 1000).toFixed(0)}k` : `€${Math.round(v)}`;

// ─── Component ───────────────────────────────────────────────────────────────

export default function Budget2026() {
  const [yearStart] = useState(() => new Date(`${BUDGET_YEAR}-01-01T00:00:00Z`));

  const { data: shopifyOrders = [], isLoading } = useShopifyOrders({
    limit: 250,
    status: 'any',
    createdAtMin: yearStart,
    enabled: true,
  });

  // Per-month, per-product actuals from Shopify B2C (current year)
  const actuals = useMemo<Record<string, number[]>>(() => {
    const res: Record<string, number[]> = {};
    RAW.products.forEach(p => { res[p.name] = new Array(12).fill(0); });

    shopifyOrders
      .filter(o => o.customerType === 'B2C')
      .forEach(order => {
        const d = order.date instanceof Date ? order.date : new Date(order.date);
        if (d.getFullYear() !== BUDGET_YEAR) return;
        const mo = d.getMonth();
        const orderNet = order.netAmount ?? order.totalAmount;
        const itemsGross = order.products.reduce((s, p) => s + p.totalPrice, 0);
        order.products.forEach(item => {
          const col = getSkuCollection(item.sku);
          const prod = COLLECTION_MAP[col];
          if (!prod || !res[prod]) return;
          const net = itemsGross > 0 ? orderNet * (item.totalPrice / itemsGross) : 0;
          res[prod][mo] += net;
        });
      });

    Object.keys(res).forEach(k => { res[k] = res[k].map(v => Math.round(v * 100) / 100); });
    return res;
  }, [shopifyOrders]);

  const targets = useMemo(
    () => Object.fromEntries(RAW.products.map(p => [p.name, monthlyTargets(p)])),
    [],
  );

  // ── Derived KPIs ────────────────────────────────────────────────────────────
  const totalTarget = RAW.products.reduce((s, p) => s + p.target, 0);
  const total2025   = RAW.products.reduce((s, p) => s + p.sales.reduce((a, v) => a + v, 0), 0);
  const ytdActual   = Object.values(actuals).reduce((s, arr) => s + arr.reduce((a, v) => a + v, 0), 0);
  const pctDone     = totalTarget > 0 ? (ytdActual / totalTarget) * 100 : 0;

  // ── Monthly chart data ───────────────────────────────────────────────────────
  const now = new Date();
  const currentMonth = now.getFullYear() === BUDGET_YEAR ? now.getMonth() : -1;

  const monthlyChart = useMemo(() => MONTHS.map((month, i) => {
    const isPast = i <= currentMonth;
    const row: Record<string, number | string> = {
      month,
      ref2025: RAW.products.reduce((s, p) => s + p.sales[i], 0),
      targetLine: RAW.products.reduce((s, p) => s + (targets[p.name]?.[i] ?? 0), 0),
    };
    RAW.products.forEach(p => {
      row[`${p.name}_actual`]  = isPast  ? Math.round(actuals[p.name]?.[i] ?? 0)    : 0;
      row[`${p.name}_budget`]  = !isPast ? (targets[p.name]?.[i] ?? 0)               : 0;
    });
    return row;
  }), [actuals, targets, currentMonth]);

  // ── Ad Spend monthly budget ──────────────────────────────────────────────────
  const advTot2025 = RAW.advTotals.reduce((s, v) => s + v, 0);
  const advBudget  = RAW.advTotals.map(v => Math.round((v / advTot2025) * RAW.spendTarget));
  const advChart   = MONTHS.map((month, i) => ({
    month,
    '2025 Actual': RAW.advTotals[i],
    '2026 Budget': advBudget[i],
  }));

  // ── MER chart ───────────────────────────────────────────────────────────────
  const merChart = MONTHS.map((month, i) => ({
    month,
    '2025 MER': RAW.mer[i],
  }));

  // ── Tooltip formatters ───────────────────────────────────────────────────────
  const currencyTooltip = ({ active, payload, label }: any) => {
    if (!active || !payload?.length) return null;
    return (
      <div className="rounded-lg border border-border/50 bg-[hsl(220,25%,10%)] p-3 text-xs shadow-xl min-w-[160px]">
        <p className="font-semibold text-foreground mb-2">{label}</p>
        {payload.map((e: any) => (
          <div key={e.dataKey} className="flex justify-between gap-4">
            <span style={{ color: e.color }} className="truncate max-w-[110px]">{e.name}</span>
            <span className="font-mono font-semibold">{fmtK(e.value)}</span>
          </div>
        ))}
      </div>
    );
  };

  // ── Nav classes ──────────────────────────────────────────────────────────────
  const navCls = 'px-3.5 py-1.5 rounded-lg text-xs font-semibold bg-muted text-muted-foreground hover:text-foreground transition-colors';
  const navActive = 'bg-primary text-primary-foreground';

  return (
    <div className="min-h-screen bg-background p-4 sm:p-6">
      <div className="max-w-[1520px] mx-auto space-y-5">

        {/* ── Header ──────────────────────────────────────────────────────── */}
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-lg font-bold text-foreground tracking-tight">Budget {BUDGET_YEAR}</h1>
            <p className="text-[11px] text-muted-foreground mt-0.5">Revenue targets & YTD performance — Easysea</p>
          </div>
          {isLoading && <Loader2 className="w-4 h-4 animate-spin text-primary" />}
        </div>

        {/* ── Nav ─────────────────────────────────────────────────────────── */}
        <div className="flex gap-1.5">
          <NavLink to="/"           className={navCls} activeClassName={navActive}>Sales Dashboard</NavLink>
          <NavLink to="/meta-ads"   className={navCls} activeClassName={navActive}>Meta Ads</NavLink>
          <NavLink to="/budget-2026" className={navCls} activeClassName={navActive}>Budget 2026</NavLink>
        </div>

        {/* ── KPI cards ───────────────────────────────────────────────────── */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[
            { label: '2026 Total Target',  value: fmtEur(totalTarget), icon: <Target className="w-3.5 h-3.5" />,     color: 'hsl(168,70%,42%)' },
            { label: '2026 YTD Actual',    value: fmtEur(ytdActual),   icon: <TrendingUp className="w-3.5 h-3.5" />, color: 'hsl(215,85%,55%)' },
            { label: '% Achieved',         value: `${pctDone.toFixed(1)}%`, icon: <Zap className="w-3.5 h-3.5" />,   color: pctDone >= 100 ? 'hsl(168,70%,42%)' : 'hsl(42,96%,48%)' },
            { label: '2025 Reference',     value: fmtEur(total2025),   icon: <CalIcon className="w-3.5 h-3.5" />,   color: 'hsl(220,15%,55%)' },
          ].map(k => (
            <div key={k.label} className="kpi-card" style={{ borderLeft: `3px solid ${k.color}` }}>
              <div className="flex items-center gap-1.5 mb-1.5">
                <span style={{ color: k.color }}>{k.icon}</span>
                <p className="text-[10px] text-muted-foreground font-semibold uppercase tracking-[0.12em]">{k.label}</p>
              </div>
              <p className="text-lg font-bold font-mono text-foreground">{k.value}</p>
            </div>
          ))}
        </div>

        {/* ── Monthly revenue chart ────────────────────────────────────────── */}
        <div className="chart-container">
          <p className="section-label mb-3">Monthly Revenue — Actuals vs Budget 2026</p>
          <div className="text-[10px] text-muted-foreground mb-3 flex flex-wrap gap-4">
            <span className="flex items-center gap-1.5"><span className="inline-block w-3 h-3 rounded-sm bg-white/20" />Solid = 2026 YTD Actual</span>
            <span className="flex items-center gap-1.5"><span className="inline-block w-3 h-3 rounded-sm bg-white/10 border border-white/20" />Faded = 2026 Budget</span>
            <span className="flex items-center gap-1.5"><span className="inline-block w-8 border-t-2 border-dashed border-muted-foreground/50" />2025 Reference</span>
          </div>
          <ResponsiveContainer width="100%" height={320}>
            <ComposedChart data={monthlyChart} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
              <XAxis dataKey="month" tick={{ fill: 'hsl(220,15%,55%)', fontSize: 11 }} axisLine={false} tickLine={false} />
              <YAxis tickFormatter={fmtK} tick={{ fill: 'hsl(220,15%,55%)', fontSize: 10 }} axisLine={false} tickLine={false} width={52} />
              <Tooltip content={currencyTooltip} />
              <Legend wrapperStyle={{ fontSize: 10, paddingTop: 8 }} />

              {/* Actual bars (solid) */}
              {RAW.products.map(p => (
                <Bar key={`${p.name}_actual`} dataKey={`${p.name}_actual`} name={p.name} stackId="actual"
                  fill={PRODUCT_COLORS[p.name]} fillOpacity={0.9} radius={0} />
              ))}

              {/* Budget bars (faded, different stack) */}
              {RAW.products.map(p => (
                <Bar key={`${p.name}_budget`} dataKey={`${p.name}_budget`} name={`${p.name} (budget)`}
                  stackId="budget" fill={PRODUCT_COLORS[p.name]} fillOpacity={0.25}
                  stroke={PRODUCT_COLORS[p.name]} strokeWidth={1} strokeOpacity={0.6} radius={0}
                  legendType="none" />
              ))}

              {/* 2025 reference line */}
              <Line dataKey="ref2025" name="2025 Reference" type="monotone"
                stroke="hsl(220,15%,55%)" strokeWidth={1.5} strokeDasharray="4 3"
                dot={false} legendType="plainline" />

              {/* Budget total line */}
              <Line dataKey="targetLine" name="2026 Target" type="monotone"
                stroke="hsl(42,96%,70%)" strokeWidth={2} dot={false} legendType="plainline" />
            </ComposedChart>
          </ResponsiveContainer>
        </div>

        {/* ── Product table ────────────────────────────────────────────────── */}
        <div className="chart-container overflow-x-auto">
          <p className="section-label mb-3">Per-Product Detail — B2C Net Sales</p>
          <table className="data-table w-full">
            <thead>
              <tr>
                <th className="text-left">Product</th>
                <th className="text-right">2025 Total</th>
                <th className="text-right">2026 Target</th>
                <th className="text-right">2026 YTD</th>
                <th className="text-right">Remaining</th>
                <th className="text-center">Progress</th>
                <th className="text-center">MER Target</th>
                <th className="text-left">Notes</th>
                {MONTHS.map(m => <th key={m} className="text-right text-[9px]">{m}</th>)}
              </tr>
            </thead>
            <tbody>
              {RAW.products.map(p => {
                const ytd  = (actuals[p.name] ?? []).reduce((s, v) => s + v, 0);
                const tot25 = p.sales.reduce((s, v) => s + v, 0);
                const rem  = Math.max(0, p.target - ytd);
                const pct  = p.target > 0 ? Math.min(100, (ytd / p.target) * 100) : 0;
                return (
                  <tr key={p.name}>
                    <td>
                      <span className="flex items-center gap-2">
                        <span className="w-2.5 h-2.5 rounded-sm shrink-0" style={{ background: PRODUCT_COLORS[p.name] }} />
                        <span className="font-semibold text-xs">{p.name}</span>
                      </span>
                    </td>
                    <td className="text-right font-mono text-xs text-muted-foreground">{fmtEur(tot25)}</td>
                    <td className="text-right font-mono text-xs font-semibold">{fmtEur(p.target)}</td>
                    <td className="text-right font-mono text-xs" style={{ color: PRODUCT_COLORS[p.name] }}>{fmtEur(ytd)}</td>
                    <td className="text-right font-mono text-xs text-muted-foreground">{fmtEur(rem)}</td>
                    <td className="text-center min-w-[80px]">
                      <div className="flex items-center gap-1.5">
                        <div className="flex-1 h-1.5 rounded-full bg-muted/50">
                          <div className="h-1.5 rounded-full transition-all" style={{ width: `${pct}%`, background: PRODUCT_COLORS[p.name] }} />
                        </div>
                        <span className="text-[10px] font-mono w-8 text-right">{pct.toFixed(0)}%</span>
                      </div>
                    </td>
                    <td className="text-center text-xs font-mono">{p.mer}x</td>
                    <td className="text-xs text-muted-foreground">{p.notes || '—'}</td>
                    {MONTHS.map((_, i) => {
                      const a = actuals[p.name]?.[i] ?? 0;
                      const t = targets[p.name]?.[i] ?? 0;
                      const isPast = i <= currentMonth;
                      return (
                        <td key={i} className="text-right font-mono text-[10px] min-w-[52px]">
                          {isPast
                            ? <span className={a > 0 ? '' : 'text-muted-foreground/40'}>{a > 0 ? fmtK(a) : '—'}</span>
                            : <span className="text-muted-foreground/50">{t > 0 ? fmtK(t) : '—'}</span>
                          }
                        </td>
                      );
                    })}
                  </tr>
                );
              })}
            </tbody>
            <tfoot>
              <tr className="border-t-2 border-border font-semibold text-xs">
                <td>Total</td>
                <td className="text-right font-mono">{fmtEur(total2025)}</td>
                <td className="text-right font-mono">{fmtEur(totalTarget)}</td>
                <td className="text-right font-mono" style={{ color: 'hsl(168,70%,42%)' }}>{fmtEur(ytdActual)}</td>
                <td className="text-right font-mono">{fmtEur(Math.max(0, totalTarget - ytdActual))}</td>
                <td className="text-center">
                  <div className="flex items-center gap-1.5">
                    <div className="flex-1 h-1.5 rounded-full bg-muted/50">
                      <div className="h-1.5 rounded-full bg-primary transition-all" style={{ width: `${pctDone}%` }} />
                    </div>
                    <span className="text-[10px] font-mono w-8 text-right">{pctDone.toFixed(0)}%</span>
                  </div>
                </td>
                <td />
                <td />
                {MONTHS.map((_, i) => {
                  const a = RAW.products.reduce((s, p) => s + (actuals[p.name]?.[i] ?? 0), 0);
                  const t = RAW.products.reduce((s, p) => s + (targets[p.name]?.[i] ?? 0), 0);
                  const isPast = i <= currentMonth;
                  return (
                    <td key={i} className="text-right font-mono text-[10px]">
                      {isPast ? fmtK(a) : <span className="text-muted-foreground/50">{fmtK(t)}</span>}
                    </td>
                  );
                })}
              </tr>
            </tfoot>
          </table>
        </div>

        {/* ── Ad Spend + MER ───────────────────────────────────────────────── */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">

          {/* Ad Spend */}
          <div className="chart-container">
            <p className="section-label mb-3">Ad Spend — 2025 Actual vs 2026 Budget</p>
            <div className="flex gap-4 mb-2 text-[10px] text-muted-foreground">
              <span>2025 total: {fmtEur(RAW.advTotals.reduce((s, v) => s + v, 0))}</span>
              <span className="text-foreground font-semibold">2026 budget: {fmtEur(RAW.spendTarget)}</span>
            </div>
            <ResponsiveContainer width="100%" height={220}>
              <ComposedChart data={advChart} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                <XAxis dataKey="month" tick={{ fill: 'hsl(220,15%,55%)', fontSize: 10 }} axisLine={false} tickLine={false} />
                <YAxis tickFormatter={fmtK} tick={{ fill: 'hsl(220,15%,55%)', fontSize: 10 }} axisLine={false} tickLine={false} width={48} />
                <Tooltip content={currencyTooltip} />
                <Legend wrapperStyle={{ fontSize: 10 }} />
                <Bar dataKey="2025 Actual" fill="hsl(220,20%,35%)" radius={[2,2,0,0]} />
                <Line dataKey="2026 Budget" type="monotone" stroke="hsl(42,96%,55%)" strokeWidth={2} dot={false} />
              </ComposedChart>
            </ResponsiveContainer>
          </div>

          {/* MER */}
          <div className="chart-container">
            <p className="section-label mb-3">MER — 2025 Actual</p>
            <div className="flex flex-wrap gap-3 mb-2 text-[10px] text-muted-foreground">
              {RAW.products.map(p => (
                <span key={p.name} className="flex items-center gap-1">
                  <span className="w-2 h-2 rounded-sm" style={{ background: PRODUCT_COLORS[p.name] }} />
                  {p.name}: <strong className="text-foreground">{p.mer}x</strong>
                </span>
              ))}
            </div>
            <ResponsiveContainer width="100%" height={220}>
              <LineChart data={merChart} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                <XAxis dataKey="month" tick={{ fill: 'hsl(220,15%,55%)', fontSize: 10 }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fill: 'hsl(220,15%,55%)', fontSize: 10 }} axisLine={false} tickLine={false} width={28} domain={[0, 5]} />
                <Tooltip contentStyle={{ background: 'hsl(220,25%,10%)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8, fontSize: 11 }} />
                <ReferenceLine y={2.5} stroke="hsl(42,96%,48%)" strokeDasharray="4 3" strokeWidth={1.5} label={{ value: 'target 2.5x', fill: 'hsl(42,96%,48%)', fontSize: 9, position: 'right' }} />
                <Line dataKey="2025 MER" type="monotone" stroke="hsl(168,70%,42%)" strokeWidth={2} dot={{ r: 3, fill: 'hsl(168,70%,42%)' }} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* ── Marketing calendar ───────────────────────────────────────────── */}
        <div className="chart-container overflow-x-auto">
          <p className="section-label mb-3">Marketing Calendar 2026</p>
          <table className="data-table w-full">
            <thead>
              <tr>
                {MONTHS.map(m => <th key={m} className="text-center">{m}</th>)}
              </tr>
            </thead>
            <tbody>
              <tr>
                {RAW.calendar.map((c, i) => (
                  <td key={i} className="text-center text-xs">
                    {c.initiative && (
                      <div className="flex flex-col items-center gap-1">
                        <span className="text-[10px] leading-tight">{c.initiative}</span>
                        <span className={`inline-block px-1.5 py-0.5 rounded text-[9px] font-bold ${
                          c.weight >= 1.5 ? 'bg-destructive/20 text-destructive' :
                          c.weight >= 1.2 ? 'bg-warning/20 text-warning' :
                          c.weight < 1    ? 'bg-muted/60 text-muted-foreground' :
                          'bg-primary/15 text-primary'
                        }`}>
                          ×{c.weight}
                        </span>
                      </div>
                    )}
                  </td>
                ))}
              </tr>
            </tbody>
          </table>
        </div>

      </div>
    </div>
  );
}
