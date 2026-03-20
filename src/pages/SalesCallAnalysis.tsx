import { useState, useMemo } from 'react';
import { DraggableNav } from '@/components/DraggableNav';
import { DashboardHeader } from '@/components/dashboard/DashboardHeader';
import { NavLink } from '@/components/NavLink';
import { useShopifyOrders } from '@/hooks/useShopifyOrders';
import { useGoogleSheetsOrders } from '@/hooks/useGoogleSheetsOrders';
import { useShopifySalesSummary } from '@/hooks/useShopifySalesSummary';
import { getSkuCollection } from '@/lib/mock-data';
import { useLanguage } from '@/contexts/LanguageContext';
import { Loader2 } from 'lucide-react';

const NAV_CLS =
  'px-3.5 py-1.5 rounded-lg text-xs font-semibold bg-muted text-muted-foreground hover:text-foreground transition-colors';
const NAV_ACTIVE = 'bg-primary text-primary-foreground';

// ─── Product mapping ──────────────────────────────────────────────────────────
const COLLECTION_TO_PRODUCT: Record<string, string> = {
  'Winch Handle': 'Flipper',
  Blocks: 'Olli Block',
  'Low Friction & Solid Rings': 'Olli Ring',
  JAKE: 'Jake',
  Inflatable: 'Way2',
  'Side products': 'Side Products',
};
const PRODUCTS = [
  'Flipper',
  'Olli Block',
  'Olli Ring',
  'Jake',
  'Way2',
  'Side Products',
] as const;
type Product = (typeof PRODUCTS)[number];

// ─── Formatters ───────────────────────────────────────────────────────────────
const fmt = (v: number) =>
  v === 0
    ? '—'
    : new Intl.NumberFormat('it-IT', { maximumFractionDigits: 0 }).format(Math.round(v));

const pctStr = (curr: number, prev: number): string => {
  if (prev === 0) return curr > 0 ? '+∞' : '—';
  const p = ((curr - prev) / Math.abs(prev)) * 100;
  return (p >= 0 ? '+' : '') + Math.round(p) + '%';
};

const pctCls = (curr: number, prev: number): string => {
  if (prev === 0) return 'text-muted-foreground';
  const p = (curr - prev) / Math.abs(prev);
  return p >= 0.02
    ? 'text-green-600 dark:text-green-400 font-semibold'
    : p <= -0.02
    ? 'text-red-500 dark:text-red-400 font-semibold'
    : 'text-muted-foreground';
};

const sumArr = (arr: number[]) => arr.reduce((a, b) => a + b, 0);

const MONTHS = [
  'Gen', 'Feb', 'Mar', 'Apr', 'Mag', 'Giu',
  'Lug', 'Ago', 'Set', 'Ott', 'Nov', 'Dic',
];

// ─── Types ────────────────────────────────────────────────────────────────────
interface MonthSlot {
  raccolti: number;
  evasi: number;
  products: Record<Product, number>;
}

interface B2BMonthSlot {
  raccolti: number;
  consegnati: number;
  products: Record<Product, number>;
}

interface TableRow {
  label: string;
  sub?: string;
  currMonthly: number[];
  prevMonthly: number[];
  isHeader?: boolean;
  dimmed?: boolean;
  isProduct?: boolean;
}

// ─── SalesTable sub-component ─────────────────────────────────────────────────
function SalesTable({
  title,
  subtitle,
  color,
  selectedYear,
  prevYear,
  rows,
}: {
  title: string;
  subtitle: string;
  color: 'blue' | 'orange';
  selectedYear: number;
  prevYear: number;
  rows: TableRow[];
}) {
  const borderCls =
    color === 'blue'
      ? 'border-blue-500/25'
      : 'border-orange-500/25';
  const accentCls =
    color === 'blue'
      ? 'text-blue-600 dark:text-blue-400'
      : 'text-orange-600 dark:text-orange-400';
  const headerBg =
    color === 'blue' ? 'bg-blue-500/8' : 'bg-orange-500/8';

  const nowMonth = new Date().getMonth();
  const nowYear = new Date().getFullYear();
  const productRows = rows.filter((r) => r.isProduct);

  return (
    <div className={`rounded-2xl border ${borderCls} overflow-hidden shadow-sm`}>
      <div className={`px-5 py-3.5 border-b border-border/30 ${headerBg}`}>
        <div className="flex items-baseline gap-3">
          <span className={`text-base font-bold ${accentCls}`}>{title}</span>
          <span className="text-xs text-muted-foreground">{subtitle}</span>
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-xs border-collapse">
          <thead>
            <tr className={`${headerBg} border-b border-border/30`}>
              <th className="sticky left-0 z-20 bg-card text-left px-4 py-2.5 min-w-[220px] font-semibold text-foreground border-r border-border/25">
                Voce
              </th>
              <th className={`px-3 py-2.5 text-right font-bold ${accentCls} border-r border-border/25 min-w-[95px]`}>
                TOT {selectedYear}
              </th>
              <th className="px-3 py-2.5 text-right font-medium text-muted-foreground border-r border-border/25 min-w-[85px]">
                TOT {prevYear}
              </th>
              <th className="px-3 py-2.5 text-center font-medium text-muted-foreground border-r border-border/40 min-w-[60px]">
                YoY
              </th>
              {MONTHS.map((m, i) => (
                <th
                  key={i}
                  className={`px-2 py-2.5 text-center font-semibold min-w-[88px] border-l border-border/10
                    ${i === nowMonth && nowYear === selectedYear ? `${accentCls} underline decoration-dotted` : 'text-foreground/70'}`}
                >
                  {m}
                </th>
              ))}
            </tr>
            <tr className="border-b border-border/20 bg-muted/15 text-muted-foreground">
              <th className="sticky left-0 z-20 bg-card/90 px-4 py-1 border-r border-border/25" />
              <th className="px-3 py-1 border-r border-border/25" />
              <th className="px-3 py-1 border-r border-border/25" />
              <th className="px-3 py-1 border-r border-border/40" />
              {MONTHS.map((_, i) => (
                <th key={i} className="px-1 py-1 border-l border-border/10">
                  <div className="flex justify-center gap-1 text-[9px]">
                    <span className={accentCls}>{String(selectedYear).slice(2)}R</span>
                    <span className="text-border">/</span>
                    <span>{String(prevYear).slice(2)}R</span>
                    <span className="text-border">/</span>
                    <span>%</span>
                  </div>
                </th>
              ))}
            </tr>
          </thead>

          <tbody>
            {rows.map((row, ri) => {
              const currTot = sumArr(row.currMonthly);
              const prevTot = sumArr(row.prevMonthly);
              return (
                <tr
                  key={ri}
                  className={`border-b border-border/10 transition-colors hover:bg-muted/20
                    ${row.isHeader ? `font-semibold ${headerBg}` : ''}
                    ${row.dimmed ? 'opacity-60' : ''}
                  `}
                >
                  <td
                    className={`sticky left-0 z-10 bg-card/97 backdrop-blur-sm px-4 py-2 border-r border-border/25 ${row.isProduct ? 'pl-8' : ''}`}
                  >
                    <div className={`font-medium leading-tight ${row.isHeader ? accentCls : 'text-foreground'}`}>
                      {row.isProduct && <span className="text-muted-foreground mr-1.5">↳</span>}
                      {row.label}
                    </div>
                    {row.sub && (
                      <div className="text-[10px] text-muted-foreground mt-0.5">{row.sub}</div>
                    )}
                  </td>
                  <td className={`px-3 py-2 text-right border-r border-border/25 tabular-nums ${row.isHeader ? `font-bold ${accentCls}` : 'font-medium text-foreground'}`}>
                    {fmt(currTot)}
                  </td>
                  <td className="px-3 py-2 text-right border-r border-border/25 tabular-nums text-muted-foreground">
                    {fmt(prevTot)}
                  </td>
                  <td className={`px-3 py-2 text-center border-r border-border/40 tabular-nums ${pctCls(currTot, prevTot)}`}>
                    {pctStr(currTot, prevTot)}
                  </td>
                  {row.currMonthly.map((cv, mi) => {
                    const pv = row.prevMonthly[mi];
                    const isCurr = mi === nowMonth && nowYear === selectedYear;
                    return (
                      <td
                        key={mi}
                        className={`px-2 py-2 text-right tabular-nums border-l border-border/10 ${isCurr ? 'bg-primary/5' : ''}`}
                      >
                        <div className={`text-[11px] leading-tight ${row.isHeader ? `font-bold ${accentCls}` : 'text-foreground/90'}`}>
                          {fmt(cv)}
                        </div>
                        <div className="text-[10px] text-muted-foreground leading-tight">{fmt(pv)}</div>
                        {(cv > 0 || pv > 0) && (
                          <div className={`text-[9px] leading-tight ${pctCls(cv, pv)}`}>
                            {pctStr(cv, pv)}
                          </div>
                        )}
                      </td>
                    );
                  })}
                </tr>
              );
            })}
          </tbody>

          {productRows.length > 0 && (
            <tfoot>
              <tr className={`border-t-2 border-border/30 font-semibold ${headerBg}`}>
                <td className={`sticky left-0 z-10 bg-card/97 px-4 py-2.5 border-r border-border/25 ${accentCls}`}>
                  tot ordini raccolti
                  <div className="text-[10px] font-normal text-muted-foreground">somma categorie prodotto</div>
                </td>
                {(() => {
                  const cTot = sumArr(productRows.map((r) => sumArr(r.currMonthly)));
                  const pTot = sumArr(productRows.map((r) => sumArr(r.prevMonthly)));
                  return (
                    <>
                      <td className={`px-3 py-2.5 text-right border-r border-border/25 tabular-nums font-bold ${accentCls}`}>{fmt(cTot)}</td>
                      <td className="px-3 py-2.5 text-right border-r border-border/25 tabular-nums text-muted-foreground">{fmt(pTot)}</td>
                      <td className={`px-3 py-2.5 text-center border-r border-border/40 tabular-nums ${pctCls(cTot, pTot)}`}>{pctStr(cTot, pTot)}</td>
                    </>
                  );
                })()}
                {MONTHS.map((_, mi) => {
                  const cv = sumArr(productRows.map((r) => r.currMonthly[mi]));
                  const pv = sumArr(productRows.map((r) => r.prevMonthly[mi]));
                  return (
                    <td key={mi} className="px-2 py-2.5 text-right tabular-nums border-l border-border/10">
                      <div className={`text-[11px] font-bold ${accentCls}`}>{fmt(cv)}</div>
                      <div className="text-[10px] text-muted-foreground">{fmt(pv)}</div>
                      {(cv > 0 || pv > 0) && (
                        <div className={`text-[9px] ${pctCls(cv, pv)}`}>{pctStr(cv, pv)}</div>
                      )}
                    </td>
                  );
                })}
              </tr>
            </tfoot>
          )}
        </table>
      </div>
    </div>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────
export default function SalesCallAnalysis() {
  const { t } = useLanguage();
  const [selectedYear, setSelectedYear] = useState<number>(() => new Date().getFullYear());
  const prevYear = selectedYear - 1;

  const { data: shopifyOrders = [], isLoading: isLoadingShopify, isFetching: isFetchingShopify, refetch: refetchShopify } = useShopifyOrders({
    limit: 250,
    status: 'any',
    createdAtMin: new Date('2025-01-01T00:00:00Z'),
    enabled: true,
  });

  const { data: gsOrders = [], isLoading: isLoadingGS, isFetching: isFetchingGS, refetch: refetchGS } = useGoogleSheetsOrders(true);

  const currYearRange = useMemo(() => ({
    start: new Date(`${selectedYear}-01-01T00:00:00Z`),
    end: new Date().getFullYear() === selectedYear ? new Date() : new Date(`${selectedYear}-12-31T23:59:59Z`),
  }), [selectedYear]);

  const prevYearRange = useMemo(() => ({
    start: new Date(`${prevYear}-01-01T00:00:00Z`),
    end: new Date(`${prevYear}-12-31T23:59:59Z`),
  }), [prevYear]);

  const { data: currYearSummary } = useShopifySalesSummary({ start: currYearRange.start, end: currYearRange.end, enabled: true });
  const { data: prevYearSummary } = useShopifySalesSummary({ start: prevYearRange.start, end: prevYearRange.end, enabled: true });

  const allOrders = useMemo(() => [...shopifyOrders, ...gsOrders], [shopifyOrders, gsOrders]);
  const isLoading = isLoadingShopify || isLoadingGS;
  const isFetching = isFetchingShopify || isFetchingGS;
  const handleRefresh = () => { refetchShopify(); refetchGS(); };

  const makeScaleFactor = (summary: typeof currYearSummary, year: number): number => {
    if (!summary?.netSales) return 1;
    const rawNet = allOrders
      .filter((o) => {
        const d = o.date instanceof Date ? o.date : new Date(o.date);
        return o.customerType === 'B2C' && d.getFullYear() === year;
      })
      .reduce((s, o) => s + (o.netAmount ?? o.totalAmount), 0);
    return rawNet > 0 ? summary.netSales / rawNet : 1;
  };

  // eslint-disable-next-line react-hooks/exhaustive-deps
  const currScaleFactor = useMemo(() => makeScaleFactor(currYearSummary, selectedYear), [allOrders, currYearSummary, selectedYear]);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const prevScaleFactor = useMemo(() => makeScaleFactor(prevYearSummary, prevYear), [allOrders, prevYearSummary, prevYear]);

  // ── B2C monthly aggregation ─────────────────────────────────────────────────
  const b2cData = useMemo(() => {
    const makeSlots = (): MonthSlot[] =>
      Array.from({ length: 12 }, () => ({
        raccolti: 0,
        evasi: 0,
        products: Object.fromEntries(PRODUCTS.map((p) => [p, 0])) as Record<Product, number>,
      }));

    const data: Record<number, MonthSlot[]> = {
      [selectedYear]: makeSlots(),
      [prevYear]: makeSlots(),
    };

    allOrders.filter((o) => o.customerType === 'B2C').forEach((order) => {
      const d = order.date instanceof Date ? order.date : new Date(order.date);
      const year = d.getFullYear();
      if (year !== selectedYear && year !== prevYear) return;
      const mo = d.getMonth();
      const scale = year === selectedYear ? currScaleFactor : prevScaleFactor;
      const net = (order.netAmount ?? order.totalAmount) * scale;

      data[year][mo].raccolti += net;
      if (order.status === 'completed') data[year][mo].evasi += net;

      const grossSum = order.products.reduce((s, p) => s + p.totalPrice, 0);
      order.products.forEach((prod) => {
        const col = getSkuCollection(prod.sku);
        const product = COLLECTION_TO_PRODUCT[col] as Product | undefined;
        if (!product) return;
        const share = grossSum > 0 ? prod.totalPrice / grossSum : 0;
        data[year][mo].products[product] += net * share;
      });
    });

    return data;
  }, [allOrders, selectedYear, prevYear, currScaleFactor, prevScaleFactor]);

  // ── B2B monthly aggregation ─────────────────────────────────────────────────
  const b2bData = useMemo(() => {
    const makeSlots = (): B2BMonthSlot[] =>
      Array.from({ length: 12 }, () => ({
        raccolti: 0,
        consegnati: 0,
        products: Object.fromEntries(PRODUCTS.map((p) => [p, 0])) as Record<Product, number>,
      }));

    const data: Record<number, B2BMonthSlot[]> = {
      [selectedYear]: makeSlots(),
      [prevYear]: makeSlots(),
    };

    allOrders
      .filter((o) => o.customerType === 'B2B' && (!o.orderType || o.orderType.toLowerCase() !== 'custom'))
      .forEach((order) => {
        const d = order.date instanceof Date ? order.date : new Date(order.date);
        const year = d.getFullYear();
        const mo = d.getMonth();
        const amount = order.totalAmount;

        if (year === selectedYear || year === prevYear) {
          data[year][mo].raccolti += amount;

          const grossSum = order.products.reduce((s, p) => s + p.totalPrice, 0);
          order.products.forEach((prod) => {
            const col = getSkuCollection(prod.sku);
            const product = COLLECTION_TO_PRODUCT[col] as Product | undefined;
            if (!product) return;
            const share = grossSum > 0 ? prod.totalPrice / grossSum : 0;
            data[year][mo].products[product] += amount * share;
          });
        }

        if (order.deliveryDate) {
          const dd = order.deliveryDate instanceof Date ? order.deliveryDate : new Date(order.deliveryDate);
          const ddYear = dd.getFullYear();
          const ddMo = dd.getMonth();
          if (ddYear === selectedYear || ddYear === prevYear) {
            data[ddYear][ddMo].consegnati += amount;
          }
        }
      });

    return data;
  }, [allOrders, selectedYear, prevYear]);

  // ── Build table rows ────────────────────────────────────────────────────────
  const b2cRows: TableRow[] = useMemo(() => {
    const curr = b2cData[selectedYear] ?? [];
    const prev = b2cData[prevYear] ?? [];
    return [
      {
        label: 'Ordini raccolti',
        sub: 'NET SALES — per data ordine',
        currMonthly: curr.map((m) => m.raccolti),
        prevMonthly: prev.map((m) => m.raccolti),
        isHeader: true,
      },
      {
        label: 'di cui fatturato',
        sub: 'ordini con status "completato"',
        currMonthly: curr.map((m) => m.evasi),
        prevMonthly: prev.map((m) => m.evasi),
      },
      {
        label: 'portafoglio ordini',
        sub: 'raccolti − fatturato',
        currMonthly: curr.map((m) => Math.max(0, m.raccolti - m.evasi)),
        prevMonthly: prev.map((m) => Math.max(0, m.raccolti - m.evasi)),
        dimmed: true,
      },
      ...PRODUCTS.map((product) => ({
        label: product,
        sub: 'valore ordini raccolti per categoria',
        currMonthly: curr.map((m) => m.products[product] ?? 0),
        prevMonthly: prev.map((m) => m.products[product] ?? 0),
        isProduct: true,
      })),
    ];
  }, [b2cData, selectedYear, prevYear]);

  const b2bRows: TableRow[] = useMemo(() => {
    const curr = b2bData[selectedYear] ?? [];
    const prev = b2bData[prevYear] ?? [];
    return [
      {
        label: 'Ordini raccolti',
        sub: 'SUM PRICE — per data ordine (order date)',
        currMonthly: curr.map((m) => m.raccolti),
        prevMonthly: prev.map((m) => m.raccolti),
        isHeader: true,
      },
      {
        label: 'di cui fatturato (consegnati)',
        sub: 'SUM PRICE — per data consegna (delivery date)',
        currMonthly: curr.map((m) => m.consegnati),
        prevMonthly: prev.map((m) => m.consegnati),
      },
      {
        label: 'portafoglio ordini',
        sub: 'raccolti − consegnati',
        currMonthly: curr.map((m) => Math.max(0, m.raccolti - m.consegnati)),
        prevMonthly: prev.map((m) => Math.max(0, m.raccolti - m.consegnati)),
        dimmed: true,
      },
      ...PRODUCTS.map((product) => ({
        label: product,
        sub: 'valore ordini raccolti per categoria',
        currMonthly: curr.map((m) => m.products[product] ?? 0),
        prevMonthly: prev.map((m) => m.products[product] ?? 0),
        isProduct: true,
      })),
    ];
  }, [b2bData, selectedYear, prevYear]);

  return (
    <div className="min-h-screen bg-background p-6">
      <DashboardHeader onRefresh={handleRefresh} isLoading={isLoading || isFetching} />

      {/* Navigation */}
      <div className="mb-7">
        <DraggableNav />
      </div>

      {/* Page title */}
      <div className="flex flex-wrap items-start justify-between gap-4 mb-6">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Analisi Call Sales</h2>
          <p className="text-sm text-muted-foreground mt-1">
            Ordini raccolti vs fatturati — B2C (Net Sales) & B2B (Price) — per categoria prodotto — mensilizzato
          </p>
        </div>
        <div className="flex items-center gap-1.5 rounded-xl bg-muted p-0.5">
          {[2025, 2026].map((y) => (
            <button
              key={y}
              onClick={() => setSelectedYear(y)}
              className={`px-4 py-1.5 rounded-lg text-sm font-semibold transition-all ${
                selectedYear === y ? 'bg-primary text-primary-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              {y}
            </button>
          ))}
        </div>
      </div>

      {/* Legend */}
      <div className="flex flex-wrap items-center gap-4 mb-5 text-[11px] text-muted-foreground bg-muted/30 rounded-lg px-4 py-2.5">
        <span className="font-semibold text-foreground">Legenda:</span>
        <span><span className="font-mono bg-blue-500/10 text-blue-600 dark:text-blue-400 px-1.5 py-0.5 rounded">{String(selectedYear).slice(2)}R</span> = anno corrente (actual)</span>
        <span><span className="font-mono bg-muted px-1.5 py-0.5 rounded">{String(prevYear).slice(2)}R</span> = anno precedente (reference)</span>
        <span><span className="font-mono bg-green-500/10 text-green-600 dark:text-green-400 px-1.5 py-0.5 rounded">+%</span> = variazione YoY</span>
        <span className="ml-auto italic">Colonna evidenziata = mese corrente</span>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center h-64 gap-3">
          <Loader2 className="w-7 h-7 animate-spin text-muted-foreground" />
          <span className="text-muted-foreground">Caricamento dati in corso...</span>
        </div>
      ) : (
        <div className="space-y-8">
          <SalesTable
            title="B2C"
            subtitle={`Shopify — Net Sales | ${selectedYear} vs ${prevYear} | scala Shopify Analytics`}
            color="blue"
            selectedYear={selectedYear}
            prevYear={prevYear}
            rows={b2cRows}
          />
          <SalesTable
            title="B2B"
            subtitle={`Google Sheets — Price | ${selectedYear} vs ${prevYear} | raccolti per order date · consegnati per delivery date`}
            color="orange"
            selectedYear={selectedYear}
            prevYear={prevYear}
            rows={b2bRows}
          />
        </div>
      )}
    </div>
  );
}
