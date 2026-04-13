import { useState, useMemo, useCallback } from 'react';
import { DraggableNav } from '@/components/DraggableNav';
import { DashboardHeader } from '@/components/dashboard/DashboardHeader';
import { useShopifyOrders } from '@/hooks/useShopifyOrders';
import { useGoogleSheetsOrders } from '@/hooks/useGoogleSheetsOrders';
import { useShopifySalesSummary } from '@/hooks/useShopifySalesSummary';
import { useMetaAds } from '@/hooks/useMetaAds';
import { getSkuCollection } from '@/lib/mock-data';
import { BUDGET_B2B_MONTHLY_TARGETS, BUDGET_MONTHLY_TARGETS } from '@/lib/budget-targets';
import { useLanguage } from '@/contexts/LanguageContext';
import { Loader2, Pencil, Check, X, Info, Eye } from 'lucide-react';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';

// ─── Product mapping ──────────────────────────────────────────────────────────
const COLLECTION_TO_PRODUCT: Record<string, string> = {
  'Winch Handle': 'Flipper',
  Blocks: 'Olli Block',
  'Low Friction & Solid Rings': 'Olli Ring',
  JAKE: 'Jake',
  Inflatable: 'Way2',
  'Side products': 'Side Products',
};
const PRODUCTS = ['Flipper', 'Olli Block', 'Olli Ring', 'Jake', 'Way2', 'Side Products'] as const;
type Product = (typeof PRODUCTS)[number];

// ─── Formatters ───────────────────────────────────────────────────────────────
const fmt = (v: number) =>
  v === 0 ? '—' : new Intl.NumberFormat('it-IT', { maximumFractionDigits: 0 }).format(Math.round(v));

const fmtEur = (v: number) =>
  v === 0 ? '—' : new Intl.NumberFormat('it-IT', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(Math.round(v));

const pctStr = (curr: number, prev: number): string => {
  if (prev === 0) return curr > 0 ? '+∞' : '—';
  const p = ((curr - prev) / Math.abs(prev)) * 100;
  return (p >= 0 ? '+' : '') + Math.round(p) + '%';
};

const pctCls = (curr: number, prev: number): string => {
  if (prev === 0) return 'text-muted-foreground';
  const p = (curr - prev) / Math.abs(prev);
  return p >= 0.02 ? 'text-emerald-600 dark:text-emerald-400 font-semibold'
    : p <= -0.02 ? 'text-red-500 dark:text-red-400 font-semibold'
    : 'text-muted-foreground';
};

const sumArr = (arr: number[]) => arr.reduce((a, b) => a + b, 0);

const MONTHS = ['Gen', 'Feb', 'Mar', 'Apr', 'Mag', 'Giu', 'Lug', 'Ago', 'Set', 'Ott', 'Nov', 'Dic'];

// ─── Types ────────────────────────────────────────────────────────────────────
interface MonthSlot { raccolti: number; evasi: number; products: Record<Product, number>; }
interface B2BMonthSlot { raccolti: number; consegnati: number; products: Record<Product, number>; }

interface TableRow {
  id: string;
  label: string;
  sub?: string;
  tooltip?: string;
  currMonthly: number[];
  prevMonthly: number[];
  isHeader?: boolean;
  dimmed?: boolean;
  isProduct?: boolean;
  isDerived?: boolean; // computed row, not directly editable
  isBudget?: boolean;  // budget target row — special styling
}

// ─── Editable Cell ────────────────────────────────────────────────────────────
function EditableCell({
  value,
  onSave,
  isHeader,
  accentCls,
  isCurrent,
  prevValue,
}: {
  value: number;
  onSave: (v: number) => void;
  isHeader?: boolean;
  accentCls: string;
  isCurrent?: boolean;
  prevValue: number;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState('');

  const startEdit = () => {
    setDraft(String(Math.round(value)));
    setEditing(true);
  };

  const save = () => {
    const parsed = parseFloat(draft.replace(/[^\d.-]/g, ''));
    if (!isNaN(parsed)) onSave(parsed);
    setEditing(false);
  };

  const cancel = () => setEditing(false);

  if (editing) {
    return (
      <td className={`px-1 py-1 border-l border-border/10 ${isCurrent ? 'bg-primary/5' : ''}`}>
        <div className="flex items-center gap-0.5">
          <input
            type="text"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') save(); if (e.key === 'Escape') cancel(); }}
            autoFocus
            className="w-full text-[11px] px-1 py-0.5 rounded border border-primary bg-background text-right tabular-nums focus:outline-none"
          />
          <button onClick={save} className="p-0.5 text-emerald-600 hover:bg-emerald-500/10 rounded"><Check className="w-3 h-3" /></button>
          <button onClick={cancel} className="p-0.5 text-red-500 hover:bg-red-500/10 rounded"><X className="w-3 h-3" /></button>
        </div>
      </td>
    );
  }

  return (
    <td
      className={`px-2 py-2 text-right tabular-nums border-l border-border/10 group/cell cursor-pointer hover:bg-primary/5 transition-colors ${isCurrent ? 'bg-primary/8' : ''}`}
      onDoubleClick={startEdit}
      title="Doppio click per modificare"
    >
      <div className="relative">
        <div className={`text-[11px] leading-tight ${isHeader ? `font-bold ${accentCls}` : 'text-foreground/90'}`}>
          {fmt(value)}
        </div>
        <div className="text-[10px] text-muted-foreground leading-tight">{fmt(prevValue)}</div>
        {(value > 0 || prevValue > 0) && (
          <div className={`text-[9px] leading-tight ${pctCls(value, prevValue)}`}>
            {pctStr(value, prevValue)}
          </div>
        )}
        <Pencil className="w-2.5 h-2.5 text-muted-foreground/40 absolute top-0 right-0 opacity-0 group-hover/cell:opacity-100 transition-opacity" />
      </div>
    </td>
  );
}

// ─── Summary Card ─────────────────────────────────────────────────────────────
function SummaryCard({ label, value, prevValue, color, tooltip }: {
  label: string; value: number; prevValue: number; color: 'blue' | 'orange'; tooltip?: string;
}) {
  const accent = color === 'blue' ? 'text-blue-600 dark:text-blue-400' : 'text-orange-600 dark:text-orange-400';
  const bg = color === 'blue' ? 'bg-blue-500/5 border-blue-500/20' : 'bg-orange-500/5 border-orange-500/20';
  return (
    <div className={`rounded-xl border ${bg} px-4 py-3 flex-1 min-w-[140px]`}>
      <div className="flex items-center gap-1.5 mb-1">
        <span className="text-[11px] text-muted-foreground font-medium">{label}</span>
        {tooltip && (
          <TooltipProvider><Tooltip><TooltipTrigger><Info className="w-3 h-3 text-muted-foreground/50" /></TooltipTrigger>
            <TooltipContent side="top" className="max-w-[220px] text-xs">{tooltip}</TooltipContent></Tooltip></TooltipProvider>
        )}
      </div>
      <div className={`text-lg font-bold tabular-nums ${accent}`}>{fmtEur(value)}</div>
      <div className="flex items-center gap-2 mt-0.5">
        <span className="text-[10px] text-muted-foreground tabular-nums">{fmtEur(prevValue)} YTD anno prec.</span>
        {(value > 0 || prevValue > 0) && (
          <span className={`text-[10px] tabular-nums ${pctCls(value, prevValue)}`}>{pctStr(value, prevValue)}</span>
        )}
      </div>
    </div>
  );
}

// ─── SalesTable sub-component ─────────────────────────────────────────────────
function SalesTable({
  title,
  subtitle,
  color,
  selectedYear,
  prevYear,
  rows,
  onCellEdit,
  realPortfolioValue,
}: {
  title: string;
  subtitle: string;
  color: 'blue' | 'orange';
  selectedYear: number;
  prevYear: number;
  rows: TableRow[];
  onCellEdit: (rowId: string, monthIndex: number, value: number) => void;
  realPortfolioValue?: number;
}) {
  const borderCls = color === 'blue' ? 'border-blue-500/20' : 'border-orange-500/20';
  const accentCls = color === 'blue' ? 'text-blue-600 dark:text-blue-400' : 'text-orange-600 dark:text-orange-400';
  const headerBg = color === 'blue' ? 'bg-blue-500/5' : 'bg-orange-500/5';
  const titleBg = color === 'blue' ? 'bg-gradient-to-r from-blue-600/10 to-blue-500/5' : 'bg-gradient-to-r from-orange-600/10 to-orange-500/5';

  const nowMonth = new Date().getMonth();
  const nowYear = new Date().getFullYear();
  // For YTD comparison: only sum months 0..currentMonth when viewing current year
  const ytdLimit = nowYear === selectedYear ? nowMonth : 11;
  const productRows = rows.filter((r) => r.isProduct);

  // YTD sums (only up to ytdLimit for fair comparison)
  const sumYtd = (arr: number[]) => arr.slice(0, ytdLimit + 1).reduce((a, b) => a + b, 0);

  // Summary cards data
  const headerRow = rows.find(r => r.isHeader);
  const revenueRow = rows.find(r => r.label.includes('fatturato'));
  const portfolioRow = rows.find(r => r.id === 'portafoglio');

  return (
    <div className={`rounded-2xl border ${borderCls} overflow-hidden shadow-sm`}>
      {/* Title bar */}
      <div className={`px-5 py-4 border-b border-border/20 ${titleBg}`}>
        <div className="flex items-center gap-3">
          <div className={`w-3 h-3 rounded-full ${color === 'blue' ? 'bg-blue-500' : 'bg-orange-500'}`} />
          <span className={`text-lg font-bold ${accentCls}`}>{title}</span>
          <span className="text-xs text-muted-foreground bg-background/50 px-2 py-0.5 rounded-full">{subtitle}</span>
        </div>
      </div>

      {/* Summary cards */}
      <div className="flex flex-wrap gap-3 px-5 py-4 border-b border-border/15 bg-card/50">
        {headerRow && (
          <SummaryCard
            label={`Ordini Raccolti (YTD ${MONTHS[ytdLimit]})`}
            value={sumYtd(headerRow.currMonthly)}
            prevValue={sumYtd(headerRow.prevMonthly)}
            color={color}
            tooltip={color === 'blue' ? 'Net Sales totale per data ordine (YTD)' : 'Somma prezzo prodotti per data ordine (YTD)'}
          />
        )}
        {revenueRow && (
          <SummaryCard
            label={`Fatturato (YTD ${MONTHS[ytdLimit]})`}
            value={sumYtd(revenueRow.currMonthly)}
            prevValue={sumYtd(revenueRow.prevMonthly)}
            color={color}
            tooltip={color === 'blue' ? 'Net Sales solo ordini evasi (YTD)' : 'Somma prezzo ordini consegnati (YTD)'}
          />
        )}
        {portfolioRow && (
          <SummaryCard
            label={realPortfolioValue !== undefined ? 'Portafoglio Clienti (attuale)' : `Portafoglio Ordini (YTD ${MONTHS[ytdLimit]})`}
            value={realPortfolioValue !== undefined ? realPortfolioValue : sumYtd(portfolioRow.currMonthly)}
            prevValue={realPortfolioValue !== undefined ? 0 : sumYtd(portfolioRow.prevMonthly)}
            color={color}
            tooltip={realPortfolioValue !== undefined
              ? 'Valore reale degli ordini pending ancora da evadere — si aggiorna quando la merce viene spedita'
              : 'Differenza tra raccolti e fatturato (YTD)'}
          />
        )}
      </div>

      {/* Edit hint */}
      <div className="px-5 py-1.5 bg-muted/20 border-b border-border/10 flex items-center gap-2 text-[10px] text-muted-foreground">
        <Pencil className="w-3 h-3" />
        <span>Doppio click su una cella per modificare il valore manualmente</span>
      </div>

      {/* Table */}
      <div className="overflow-x-auto">
        <table className="w-full text-xs border-collapse">
          <thead>
            <tr className={`${headerBg} border-b border-border/20`}>
              <th className="sticky left-0 z-20 bg-card text-left px-4 py-2.5 min-w-[200px] font-semibold text-foreground border-r border-border/20">
                Voce
              </th>
              <th className={`px-3 py-2.5 text-right font-bold ${accentCls} border-r border-border/20 min-w-[90px]`}>
                YTD {selectedYear}
              </th>
              <th className="px-3 py-2.5 text-right font-medium text-muted-foreground border-r border-border/20 min-w-[80px]">
                YTD {prevYear}
              </th>
              <th className="px-3 py-2.5 text-center font-medium text-muted-foreground border-r border-border/30 min-w-[55px]">
                YoY
              </th>
              {MONTHS.map((m, i) => (
                <th
                  key={i}
                  className={`px-2 py-2.5 text-center font-semibold min-w-[85px] border-l border-border/10
                    ${i === nowMonth && nowYear === selectedYear ? `${accentCls} underline decoration-dotted` : 'text-foreground/70'}`}
                >
                  {m}
                </th>
              ))}
            </tr>
          </thead>

          <tbody>
            {rows.map((row, ri) => {
              const currTot = sumYtd(row.currMonthly);
              const prevTot = sumYtd(row.prevMonthly);
              const canEdit = !row.isDerived;

              return (
                <tr
                  key={ri}
                  className={`border-b border-border/10 transition-colors hover:bg-muted/15
                    ${row.isHeader ? `font-semibold ${headerBg}` : ''}
                    ${row.dimmed ? 'opacity-50' : ''}
                  `}
                >
                  <td className={`sticky left-0 z-10 bg-card/97 backdrop-blur-sm px-4 py-2 border-r border-border/20 ${row.isProduct ? 'pl-7' : ''}`}>
                    <div className="flex items-center gap-1.5">
                      {row.isProduct && <span className="text-muted-foreground/50">↳</span>}
                      <div>
                        <div className={`font-medium leading-tight ${row.isHeader ? accentCls : 'text-foreground'}`}>
                          {row.label}
                        </div>
                        {row.sub && <div className="text-[10px] text-muted-foreground mt-0.5">{row.sub}</div>}
                      </div>
                      {row.tooltip && (
                        <TooltipProvider><Tooltip><TooltipTrigger><Info className="w-3 h-3 text-muted-foreground/40" /></TooltipTrigger>
                          <TooltipContent side="right" className="max-w-[200px] text-xs">{row.tooltip}</TooltipContent></Tooltip></TooltipProvider>
                      )}
                    </div>
                  </td>
                  <td className={`px-3 py-2 text-right border-r border-border/20 tabular-nums ${row.isHeader ? `font-bold ${accentCls}` : 'font-medium text-foreground'}`}>
                    {fmt(currTot)}
                  </td>
                  <td className="px-3 py-2 text-right border-r border-border/20 tabular-nums text-muted-foreground">
                    {fmt(prevTot)}
                  </td>
                  <td className={`px-3 py-2 text-center border-r border-border/30 tabular-nums ${pctCls(currTot, prevTot)}`}>
                    {pctStr(currTot, prevTot)}
                  </td>
                  {canEdit ? (
                    row.currMonthly.map((cv, mi) => (
                      <EditableCell
                        key={mi}
                        value={cv}
                        prevValue={row.prevMonthly[mi]}
                        onSave={(v) => onCellEdit(row.id, mi, v)}
                        isHeader={row.isHeader}
                        accentCls={accentCls}
                        isCurrent={mi === nowMonth && nowYear === selectedYear}
                      />
                    ))
                  ) : (
                    row.currMonthly.map((cv, mi) => {
                      const pv = row.prevMonthly[mi];
                      const isCurr = mi === nowMonth && nowYear === selectedYear;
                      return (
                        <td key={mi} className={`px-2 py-2 text-right tabular-nums border-l border-border/10 ${isCurr ? 'bg-primary/5' : ''}`}>
                          <div className={`text-[11px] leading-tight ${row.isHeader ? `font-bold ${accentCls}` : 'text-foreground/90 italic'}`}>
                            {fmt(cv)}
                          </div>
                          <div className="text-[10px] text-muted-foreground leading-tight">{fmt(pv)}</div>
                          {(cv > 0 || pv > 0) && (
                            <div className={`text-[9px] leading-tight ${pctCls(cv, pv)}`}>{pctStr(cv, pv)}</div>
                          )}
                        </td>
                      );
                    })
                  )}
                </tr>
              );
            })}
          </tbody>

          {productRows.length > 0 && (
            <tfoot>
              <tr className={`border-t-2 border-border/25 font-semibold ${headerBg}`}>
                <td className={`sticky left-0 z-10 bg-card/97 px-4 py-2.5 border-r border-border/20 ${accentCls}`}>
                  Σ Categorie prodotto
                  <div className="text-[10px] font-normal text-muted-foreground">somma ordini raccolti</div>
                </td>
                {(() => {
                  const cTot = productRows.reduce((s, r) => s + sumYtd(r.currMonthly), 0);
                  const pTot = productRows.reduce((s, r) => s + sumYtd(r.prevMonthly), 0);
                  return (
                    <>
                      <td className={`px-3 py-2.5 text-right border-r border-border/20 tabular-nums font-bold ${accentCls}`}>{fmt(cTot)}</td>
                      <td className="px-3 py-2.5 text-right border-r border-border/20 tabular-nums text-muted-foreground">{fmt(pTot)}</td>
                      <td className={`px-3 py-2.5 text-center border-r border-border/30 tabular-nums ${pctCls(cTot, pTot)}`}>{pctStr(cTot, pTot)}</td>
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

  // Manual overrides: key = `${channel}-${rowId}-${monthIndex}`, value = number
  const [overrides, setOverrides] = useState<Record<string, number>>({});

  const { data: shopifyOrders = [], isLoading: isLoadingShopify, isFetching: isFetchingShopify, refetch: refetchShopify } = useShopifyOrders({
    limit: 250, status: 'any', createdAtMin: new Date('2025-01-01T00:00:00Z'), enabled: true,
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

  // Meta Ads data for the selected year (full year range)
  const metaDateRange = useMemo(() => ({
    start: new Date(`${selectedYear}-01-01`),
    end: new Date().getFullYear() === selectedYear ? new Date() : new Date(`${selectedYear}-12-31`),
  }), [selectedYear]);
  const { data: metaData } = useMetaAds(metaDateRange);

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
        raccolti: 0, evasi: 0,
        products: Object.fromEntries(PRODUCTS.map((p) => [p, 0])) as Record<Product, number>,
      }));

    const data: Record<number, MonthSlot[]> = { [selectedYear]: makeSlots(), [prevYear]: makeSlots() };

    allOrders.filter((o) => o.customerType === 'B2C').forEach((order) => {
      const d = order.date instanceof Date ? order.date : new Date(order.date);
      const year = d.getFullYear();
      const mo = d.getMonth();

      // Raccolti: only if order date is in selected or prev year
      if (year === selectedYear || year === prevYear) {
        const scale = year === selectedYear ? currScaleFactor : prevScaleFactor;
        const net = (order.netAmount ?? order.totalAmount) * scale;
        data[year][mo].raccolti += net;

        const grossSum = order.products.reduce((s, p) => s + p.totalPrice, 0);
        order.products.forEach((prod) => {
          const col = getSkuCollection(prod.sku);
          const product = COLLECTION_TO_PRODUCT[col] as Product | undefined;
          if (!product) return;
          const share = grossSum > 0 ? prod.totalPrice / grossSum : 0;
          data[year][mo].products[product] += net * share;
        });
      }

      // FATTURATO B2C = solo ordini evasi, posizionati nel mese di fulfillment
      if (order.status === 'completed' && order.fulfilledAt) {
        const fd = order.fulfilledAt instanceof Date ? order.fulfilledAt : new Date(order.fulfilledAt);
        const fYear = fd.getFullYear();
        const fMo = fd.getMonth();
        if ((fYear === selectedYear || fYear === prevYear) && data[fYear]) {
          const fScale = fYear === selectedYear ? currScaleFactor : prevScaleFactor;
          const fNet = (order.netAmount ?? order.totalAmount) * fScale;
          data[fYear][fMo].evasi += fNet;
        }
      }
    });

    return data;
  }, [allOrders, selectedYear, prevYear, currScaleFactor, prevScaleFactor]);

  // ── B2B monthly aggregation ─────────────────────────────────────────────────
  const b2bData = useMemo(() => {
    const makeSlots = (): B2BMonthSlot[] =>
      Array.from({ length: 12 }, () => ({
        raccolti: 0, consegnati: 0,
        products: Object.fromEntries(PRODUCTS.map((p) => [p, 0])) as Record<Product, number>,
      }));

    const data: Record<number, B2BMonthSlot[]> = { [selectedYear]: makeSlots(), [prevYear]: makeSlots() };

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

  // ── Apply overrides helper ──────────────────────────────────────────────────
  const applyOverrides = useCallback((channel: string, rowId: string, monthly: number[]): number[] => {
    return monthly.map((v, mi) => {
      const key = `${channel}-${rowId}-${mi}`;
      return overrides[key] !== undefined ? overrides[key] : v;
    });
  }, [overrides]);

  const handleB2CCellEdit = useCallback((rowId: string, monthIndex: number, value: number) => {
    setOverrides(prev => ({ ...prev, [`b2c-${rowId}-${monthIndex}`]: value }));
  }, []);

  const handleB2BCellEdit = useCallback((rowId: string, monthIndex: number, value: number) => {
    setOverrides(prev => ({ ...prev, [`b2b-${rowId}-${monthIndex}`]: value }));
  }, []);

  // ── Build table rows ────────────────────────────────────────────────────────
  // ── B2C Portfolio: ALL pending orders across ALL years ──────────────────────
  const b2cUnfulfilledOrders = useMemo(() => {
    return allOrders
      .filter(o => o.customerType === 'B2C' && o.status === 'pending')
      .map(o => {
        const d = o.date instanceof Date ? o.date : new Date(o.date);
        const year = d.getFullYear();
        // Use correct scale factor based on order year
        const scale = year === selectedYear ? currScaleFactor : year === prevYear ? prevScaleFactor : currScaleFactor;
        return {
          orderNumber: o.orderNumber,
          customerName: o.customerName,
          date: d,
          status: o.status,
          netValue: (o.netAmount ?? o.totalAmount) * scale,
          productsLabel: o.products.map(p => p.name).join(', '),
          rawProducts: o.products,
        };
      })
      .sort((a, b) => b.date.getTime() - a.date.getTime());
  }, [allOrders, currScaleFactor, prevScaleFactor, selectedYear, prevYear]);

  const b2cPortfolio = useMemo(() => {
    return b2cUnfulfilledOrders.reduce((acc, o) => acc + o.netValue, 0);
  }, [b2cUnfulfilledOrders]);

  // ── SKU breakdown of unfulfilled orders ─────────────────────────────────────
  const unfulfilledSkuBreakdown = useMemo(() => {
    const map = new Map<string, { name: string; sku: string; qty: number; value: number }>();
    for (const order of b2cUnfulfilledOrders) {
      const grossSum = order.rawProducts.reduce((s, p) => s + p.totalPrice, 0);
      for (const p of order.rawProducts) {
        const share = grossSum > 0 ? p.totalPrice / grossSum : 0;
        const allocated = order.netValue * share;
        const key = p.sku || p.name;
        const existing = map.get(key);
        if (existing) {
          existing.qty += p.quantity;
          existing.value += allocated;
        } else {
          map.set(key, { name: p.name, sku: p.sku || '—', qty: p.quantity, value: allocated });
        }
      }
    }
    return Array.from(map.values()).sort((a, b) => b.value - a.value);
  }, [b2cUnfulfilledOrders]);

  // ── Meta Ads monthly spending ───────────────────────────────────────────────
  const monthlyMetaSpend = useMemo(() => {
    const monthly = Array(12).fill(0);
    if (!metaData?.daily) return monthly;
    for (const day of metaData.daily) {
      const d = new Date(day.date_start);
      if (d.getFullYear() === selectedYear) {
        monthly[d.getMonth()] += parseFloat(day.spend || '0');
      }
    }
    return monthly;
  }, [metaData, selectedYear]);

  const b2cRows: TableRow[] = useMemo(() => {
    const curr = b2cData[selectedYear] ?? [];
    const prev = b2cData[prevYear] ?? [];

    const raccoltiCurr = applyOverrides('b2c', 'raccolti', curr.map(m => m.raccolti));
    const raccoltiPrev = prev.map(m => m.raccolti);
    const evasiCurr = applyOverrides('b2c', 'evasi', curr.map(m => m.evasi));
    const evasiPrev = prev.map(m => m.evasi);

    const rows: TableRow[] = [
      {
        id: 'raccolti',
        label: 'Ordini raccolti',
        sub: 'NET SALES — per data ordine',
        tooltip: 'Vendite nette totali (gross - sconti - resi) di tutti gli ordini Shopify',
        currMonthly: raccoltiCurr,
        prevMonthly: raccoltiPrev,
        isHeader: true,
      },
      {
        id: 'evasi',
        label: 'di cui fatturato',
        sub: 'solo ordini evasi (fulfilled)',
        tooltip: 'Net Sales dei soli ordini con status "fulfilled/completed" — la merce effettivamente spedita',
        currMonthly: evasiCurr,
        prevMonthly: evasiPrev,
      },
      {
        id: 'portafoglio',
        label: 'delta mensile',
        sub: 'raccolti − fatturato (per mese)',
        tooltip: 'Differenza mensile tra ordini raccolti e merce evasa. Può essere negativo quando si evade merce di mesi precedenti.',
        currMonthly: raccoltiCurr.map((v, i) => v - evasiCurr[i]),
        prevMonthly: raccoltiPrev.map((v, i) => v - evasiPrev[i]),
        dimmed: true,
        isDerived: true,
      },
      {
        id: 'budget-b2c',
        label: '🎯 Budget B2C 2026',
        sub: 'target mensile (tutti i prodotti)',
        tooltip: 'Budget B2C 2026 totale mensile da BDG MKT_V2',
        currMonthly: [...BUDGET_MONTHLY_TARGETS],
        prevMonthly: new Array(12).fill(0),
        isDerived: true,
        isBudget: true,
      },
      {
        id: 'meta-spend',
        label: '💰 Spending Meta Ads',
        sub: 'spesa pubblicitaria mensile',
        tooltip: 'Spesa Meta Ads aggregata per mese — utile per confrontare costi ads vs vendite',
        currMonthly: monthlyMetaSpend,
        prevMonthly: Array(12).fill(0),
        isDerived: true,
      },
      ...PRODUCTS.map((product) => ({
        id: `prod-${product}`,
        label: product,
        sub: 'valore ordini raccolti per categoria',
        currMonthly: applyOverrides('b2c', `prod-${product}`, curr.map(m => m.products[product] ?? 0)),
        prevMonthly: prev.map(m => m.products[product] ?? 0),
        isProduct: true,
      })),
    ];
    return rows;
  }, [b2cData, selectedYear, prevYear, applyOverrides, monthlyMetaSpend]);

  const b2bRows: TableRow[] = useMemo(() => {
    const curr = b2bData[selectedYear] ?? [];
    const prev = b2bData[prevYear] ?? [];

    const raccoltiCurr = applyOverrides('b2b', 'raccolti', curr.map(m => m.raccolti));
    const raccoltiPrev = prev.map(m => m.raccolti);
    const consegnatiCurr = applyOverrides('b2b', 'consegnati', curr.map(m => m.consegnati));
    const consegnatiPrev = prev.map(m => m.consegnati);

    return [
      {
        id: 'raccolti',
        label: 'Ordini raccolti',
        sub: 'SUM PRICE — per order date',
        tooltip: 'Somma del prezzo dei prodotti per data ordine (esclusi ordini custom)',
        currMonthly: raccoltiCurr,
        prevMonthly: raccoltiPrev,
        isHeader: true,
      },
      {
        id: 'consegnati',
        label: 'di cui fatturato (consegnati)',
        sub: 'SUM PRICE — per delivery date',
        tooltip: 'Somma del prezzo dei prodotti filtrata per data di consegna (delivery date)',
        currMonthly: consegnatiCurr,
        prevMonthly: consegnatiPrev,
      },
      {
        id: 'portafoglio',
        label: 'delta mensile',
        sub: 'raccolti − consegnati (per mese)',
        tooltip: 'Differenza mensile tra ordini raccolti e merce consegnata.',
        currMonthly: raccoltiCurr.map((v, i) => v - consegnatiCurr[i]),
        prevMonthly: raccoltiPrev.map((v, i) => v - consegnatiPrev[i]),
        dimmed: true,
        isDerived: true,
      },
      ...PRODUCTS.map((product) => ({
        id: `prod-${product}`,
        label: product,
        sub: 'valore ordini raccolti per categoria',
        currMonthly: applyOverrides('b2b', `prod-${product}`, curr.map(m => m.products[product] ?? 0)),
        prevMonthly: prev.map(m => m.products[product] ?? 0),
        isProduct: true,
      })),
      {
        id: 'budget-b2b',
        label: 'Budget B2B 2026',
        sub: 'target mensile (Distributor + Reseller)',
        tooltip: 'Budget B2B 2026 totale mensile da BDG MKT_V2',
        currMonthly: [...BUDGET_B2B_MONTHLY_TARGETS],
        prevMonthly: new Array(12).fill(0),
        isDerived: true,
        dimmed: true,
      },
    ];
  }, [b2bData, selectedYear, prevYear, applyOverrides]);

  return (
    <div className="min-h-screen bg-background p-3 sm:p-4 md:p-6">
      <DashboardHeader onRefresh={handleRefresh} isLoading={isLoading || isFetching} />

      <div className="mb-7">
        <DraggableNav />
      </div>

      {/* Page title + year selector */}
      <div className="flex flex-wrap items-start justify-between gap-4 mb-6">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">{t('salesCallAnalysis')}</h2>
          <p className="text-sm text-muted-foreground mt-1">
            Ordini raccolti vs fatturati — B2C (Net Sales) & B2B (Price) — mensilizzato con confronto YoY
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
      <div className="flex flex-wrap items-center gap-3 sm:gap-4 mb-5 text-[11px] text-muted-foreground bg-muted/30 rounded-lg px-4 py-2.5">
        <span className="font-semibold text-foreground">Legenda:</span>
        <span><span className="font-mono bg-blue-500/10 text-blue-600 dark:text-blue-400 px-1.5 py-0.5 rounded">{String(selectedYear).slice(2)}R</span> = anno corrente</span>
        <span><span className="font-mono bg-muted px-1.5 py-0.5 rounded">{String(prevYear).slice(2)}R</span> = anno precedente</span>
        <span><span className="font-mono bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 px-1.5 py-0.5 rounded">+%</span> = variazione YoY</span>
        <span className="sm:ml-auto italic">Doppio click = modifica manuale</span>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center h-64 gap-3">
          <Loader2 className="w-7 h-7 animate-spin text-muted-foreground" />
          <span className="text-muted-foreground">Caricamento dati…</span>
        </div>
      ) : (
        <div className="space-y-8">
          {/* B2C Unfulfilled Orders Detail Dialog */}
          <div className="flex items-center gap-3 mb-2">
            <Dialog>
              <DialogTrigger asChild>
                <button className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium bg-blue-500/10 text-blue-600 dark:text-blue-400 hover:bg-blue-500/20 transition-colors">
                  <Eye className="w-3.5 h-3.5" />
                  📦 Vedi {b2cUnfulfilledOrders.length} ordini pending — {fmtEur(b2cPortfolio)}
                </button>
              </DialogTrigger>
              <DialogContent className="max-w-3xl max-h-[80vh] overflow-hidden flex flex-col">
                <DialogHeader>
                  <DialogTitle className="text-blue-600 dark:text-blue-400">
                    📦 Ordini B2C Pending — {fmtEur(b2cPortfolio)}
                  </DialogTitle>
                  <p className="text-xs text-muted-foreground">
                    {b2cUnfulfilledOrders.length} ordini pending (esclusi cancelled/refunded) · Net Sales scalato
                  </p>
                </DialogHeader>
                <div className="overflow-auto flex-1 -mx-6 px-6 space-y-6">
                  <table className="w-full text-xs border-collapse">
                    <thead className="sticky top-0 bg-card z-10">
                      <tr className="border-b border-border/30">
                        <th className="text-left px-2 py-2 font-semibold">Ordine</th>
                        <th className="text-left px-2 py-2 font-semibold">Cliente</th>
                        <th className="text-left px-2 py-2 font-semibold">Data</th>
                        <th className="text-right px-2 py-2 font-semibold">Net Sales</th>
                        <th className="text-left px-2 py-2 font-semibold">Prodotti</th>
                      </tr>
                    </thead>
                    <tbody>
                      {b2cUnfulfilledOrders.map((o, i) => (
                        <tr key={i} className="border-b border-border/10 hover:bg-muted/10">
                          <td className="px-2 py-1.5 font-mono text-foreground">#{o.orderNumber}</td>
                          <td className="px-2 py-1.5 text-foreground/80 max-w-[120px] truncate">{o.customerName}</td>
                          <td className="px-2 py-1.5 text-muted-foreground tabular-nums">{o.date.toLocaleDateString('it-IT')}</td>
                          <td className="px-2 py-1.5 text-right tabular-nums font-medium text-foreground">{fmtEur(o.netValue)}</td>
                          <td className="px-2 py-1.5 text-muted-foreground max-w-[200px] truncate">{o.productsLabel}</td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot>
                      <tr className="border-t-2 border-border/30 font-semibold">
                        <td colSpan={3} className="px-2 py-2 text-blue-600 dark:text-blue-400">TOTALE ({b2cUnfulfilledOrders.length} ordini)</td>
                        <td className="px-2 py-2 text-right tabular-nums text-blue-600 dark:text-blue-400">{fmtEur(b2cPortfolio)}</td>
                        <td></td>
                      </tr>
                    </tfoot>
                  </table>
                  <div>
                    <h4 className="text-sm font-semibold text-foreground mb-2">📋 Spaccato per Prodotto / SKU</h4>
                    <table className="w-full text-xs border-collapse">
                      <thead>
                        <tr className="border-b border-border/30 bg-muted/20">
                          <th className="text-left px-2 py-2 font-semibold">Prodotto</th>
                          <th className="text-left px-2 py-2 font-semibold">SKU</th>
                          <th className="text-right px-2 py-2 font-semibold">Qtà</th>
                          <th className="text-right px-2 py-2 font-semibold">Valore</th>
                          <th className="text-right px-2 py-2 font-semibold">%</th>
                        </tr>
                      </thead>
                      <tbody>
                        {unfulfilledSkuBreakdown.map((item, i) => (
                          <tr key={i} className="border-b border-border/10 hover:bg-muted/10">
                            <td className="px-2 py-1.5 text-foreground max-w-[200px] truncate">{item.name}</td>
                            <td className="px-2 py-1.5 font-mono text-muted-foreground text-[10px]">{item.sku}</td>
                            <td className="px-2 py-1.5 text-right tabular-nums text-foreground">{item.qty}</td>
                            <td className="px-2 py-1.5 text-right tabular-nums font-medium text-foreground">{fmtEur(item.value)}</td>
                            <td className="px-2 py-1.5 text-right tabular-nums text-muted-foreground">
                              {b2cPortfolio > 0 ? ((item.value / b2cPortfolio) * 100).toFixed(1) + '%' : '—'}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                      <tfoot>
                        <tr className="border-t-2 border-border/30 font-semibold">
                          <td colSpan={2} className="px-2 py-2 text-blue-600 dark:text-blue-400">TOTALE</td>
                          <td className="px-2 py-2 text-right tabular-nums text-blue-600 dark:text-blue-400">
                            {unfulfilledSkuBreakdown.reduce((s, i) => s + i.qty, 0)}
                          </td>
                          <td className="px-2 py-2 text-right tabular-nums text-blue-600 dark:text-blue-400">{fmtEur(b2cPortfolio)}</td>
                          <td className="px-2 py-2 text-right tabular-nums text-blue-600 dark:text-blue-400">100%</td>
                        </tr>
                      </tfoot>
                    </table>
                  </div>
                </div>
              </DialogContent>
            </Dialog>
          </div>

          <SalesTable
            title="B2C — Shopify"
            subtitle={`Net Sales · ${selectedYear} vs ${prevYear}`}
            color="blue"
            selectedYear={selectedYear}
            prevYear={prevYear}
            rows={b2cRows}
            onCellEdit={handleB2CCellEdit}
            realPortfolioValue={b2cPortfolio}
          />
          <SalesTable
            title="B2B — Google Sheets"
            subtitle={`Price · ${selectedYear} vs ${prevYear}`}
            color="orange"
            selectedYear={selectedYear}
            prevYear={prevYear}
            rows={b2bRows}
            onCellEdit={handleB2BCellEdit}
          />
        </div>
      )}

      {Object.keys(overrides).length > 0 && (
        <div className="mt-4 flex items-center justify-end gap-3">
          <span className="text-xs text-muted-foreground italic">
            {Object.keys(overrides).length} celle modificate manualmente
          </span>
          <button
            onClick={() => setOverrides({})}
            className="text-xs px-3 py-1.5 rounded-lg bg-destructive/10 text-destructive hover:bg-destructive/20 transition-colors font-medium"
          >
            Ripristina tutti i valori originali
          </button>
        </div>
      )}
    </div>
  );
}
