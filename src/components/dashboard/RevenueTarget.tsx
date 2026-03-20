import { useState, useEffect } from 'react';
import { Target, Pencil, Check, X } from 'lucide-react';
import { format, getDaysInMonth } from 'date-fns';
import { it as itLocale, enUS, de as deLocale } from 'date-fns/locale';
import { BUDGET_ANNUAL_TARGET, BUDGET_MONTHLY_TARGETS } from '@/lib/budget-targets';
import { useLanguage } from '@/contexts/LanguageContext';

interface RevenueTargetProps {
  currentRevenue: number;
  monthlyRevenues?: number[];
}

const STORAGE_KEY = 'dashboard-revenue-target';

const fmt  = (v: number) =>
  new Intl.NumberFormat('it-IT', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(v);
const fmtK = (v: number) =>
  v >= 1000 ? `€${(v / 1000).toFixed(0)}k` : `€${Math.round(v)}`;

export function RevenueTarget({ currentRevenue, monthlyRevenues }: RevenueTargetProps) {
  const { t, lang, months } = useLanguage();
  const dateLocale = lang === 'de' ? deLocale : lang === 'en' ? enUS : itLocale;
  const [target, setTarget] = useState(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    return saved ? parseFloat(saved) : BUDGET_ANNUAL_TARGET;
  });
  const [editing, setEditing]   = useState(false);
  const [inputValue, setInputValue] = useState('');

  useEffect(() => { localStorage.setItem(STORAGE_KEY, String(target)); }, [target]);

  const now          = new Date();
  const currentMo    = now.getMonth();
  const daysInMonth  = getDaysInMonth(now);
  const monthPct     = now.getDate() / daysInMonth;
  const pctTotal     = target > 0 ? Math.min((currentRevenue / target) * 100, 100) : 0;

  // Use Budget 2026 monthly distribution (scaled to current target if user changed it)
  const budgetScale  = target / BUDGET_ANNUAL_TARGET;
  const monthlyTgts  = BUDGET_MONTHLY_TARGETS.map(v => Math.round(v * budgetScale));
  const totalBudget  = monthlyTgts.reduce((s, v) => s + v, 0);

  // YTD: budget and actual up to (and including) current month
  const ytdTarget = monthlyTgts.slice(0, currentMo + 1).reduce((s, v) => s + v, 0);
  const ytdPct    = ytdTarget > 0 ? (currentRevenue / ytdTarget) * 100 : 0;

  const startEdit   = () => { setInputValue(String(target)); setEditing(true); };
  const confirmEdit = () => {
    const p = parseFloat(inputValue.replace(/[^\d.,]/g, '').replace(',', '.'));
    if (!isNaN(p) && p > 0) setTarget(p);
    setEditing(false);
  };
  const cancelEdit = () => setEditing(false);

  const globalColor =
    pctTotal >= 100 ? 'hsl(168,70%,42%)' :
    pctTotal >= 50  ? 'hsl(42,96%,48%)'  :
    'hsl(var(--primary))';

  // Per-month fill color
  const fillColor = (mo: number, actual: number) => {
    const moTgt = monthlyTgts[mo];
    if (mo === currentMo) return 'hsl(215,85%,55%)';
    const pct = moTgt > 0 ? actual / moTgt : 0;
    if (pct >= 1.0) return 'hsl(168,70%,42%)';
    if (pct >= 0.7) return 'hsl(42,96%,58%)';
    return 'hsl(0,65%,52%)';
  };

  // Dot color for past months
  const dotColor = (mo: number, actual: number) => fillColor(mo, actual);

  // Fill width 0-100 (%)
  const fillPct = (mo: number, actual: number) => {
    const moTgt = monthlyTgts[mo];
    if (mo > currentMo)  return 0;
    if (mo === currentMo) return monthPct * 100;
    return Math.min(100, moTgt > 0 ? (actual / moTgt) * 100 : 0);
  };

  return (
    <div className="w-full rounded-xl border border-border/60 bg-card/80 backdrop-blur-sm px-3 sm:px-5 py-3 sm:py-4 mb-1">

      {/* ── Top row ─────────────────────────────────────────────── */}
      <div className="flex flex-wrap items-center justify-between gap-x-6 gap-y-1 mb-4">

        {/* Target label + editable value */}
        <div className="flex items-center gap-3 shrink-0">
          <div className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0"
            style={{ background: globalColor + '22' }}>
            <Target className="w-4 h-4" style={{ color: globalColor }} />
          </div>
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground leading-none">
              {t('target.title')}
              <span className="ml-1.5 normal-case tracking-normal font-normal opacity-60">
                {t('target.from')} – {format(now, 'd MMM yyyy', { locale: dateLocale })}
              </span>
            </p>
            <div className="mt-0.5">
              {editing ? (
                <div className="flex items-center gap-1">
                  <span className="text-xs text-muted-foreground">€</span>
                  <input autoFocus type="text" value={inputValue}
                    onChange={e => setInputValue(e.target.value)}
                    onKeyDown={e => { if (e.key==='Enter') confirmEdit(); if (e.key==='Escape') cancelEdit(); }}
                    className="w-28 h-6 px-2 text-sm font-bold font-mono bg-muted border border-border rounded text-foreground focus:outline-none focus:ring-1 focus:ring-primary" />
                  <button onClick={confirmEdit} className="p-0.5 rounded hover:bg-muted text-primary"><Check className="w-3.5 h-3.5" /></button>
                  <button onClick={cancelEdit}  className="p-0.5 rounded hover:bg-muted text-muted-foreground"><X className="w-3.5 h-3.5" /></button>
                </div>
              ) : (
                <button onClick={startEdit} className="group flex items-center gap-1.5 hover:opacity-80 transition-opacity">
                  <span className="text-base font-bold font-mono text-foreground">{fmt(target)}</span>
                  <Pencil className="w-3 h-3 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Consuntivo + % annuale + % YTD */}
        <div className="flex items-baseline gap-2">
          <span className="text-xs text-muted-foreground">{t('target.actual')}</span>
          <span className="text-base font-bold font-mono text-foreground">{fmt(currentRevenue)}</span>
          <span className="text-sm font-bold font-mono" style={{ color: globalColor }}>{pctTotal.toFixed(1)}%</span>
          <span className="text-[10px] text-muted-foreground ml-1">{t('target.annual')}</span>
          <span className="mx-1 text-muted-foreground/40">|</span>
          <span className="text-sm font-bold font-mono" style={{ color: ytdPct >= 100 ? 'hsl(168,70%,42%)' : ytdPct >= 80 ? 'hsl(42,96%,48%)' : 'hsl(0,65%,52%)' }}>
            {ytdPct.toFixed(1)}%
          </span>
          <span className="text-[10px] text-muted-foreground">{t('target.ytd')} ({fmtK(ytdTarget)})</span>
        </div>

        {/* Mancante */}
        <div className="hidden sm:block text-right shrink-0">
          <p className="text-[10px] text-muted-foreground uppercase tracking-widest leading-none">{t('target.remaining')}</p>
          <p className="text-base font-bold font-mono text-foreground mt-0.5">
            {currentRevenue >= target ? t('target.achieved') : fmt(target - currentRevenue)}
          </p>
        </div>
      </div>

      {/* ── 12-month segmented bar (variable width by budget) ────── */}
      <div className="flex gap-0.5">
        {months.map((label, i) => {
          const actual   = monthlyRevenues?.[i] ?? 0;
          const moTgt    = monthlyTgts[i];
          const fp       = fillPct(i, actual);
          const fc       = fillColor(i, actual);
          const isPast   = i < currentMo;
          const isCurr   = i === currentMo;
          const isFuture = i > currentMo;

          // Width proportional to budget share; minimum 3% to stay visible
          const budgetShare = totalBudget > 0 ? (moTgt / totalBudget) * 100 : 100 / 12;
          const widthPct    = Math.max(budgetShare, 3);

          return (
            <div
              key={label}
              className="flex flex-col gap-1.5 min-w-0 overflow-hidden"
              style={{ width: `${widthPct}%`, flexShrink: 0 }}
            >
              {/* "ORA" badge */}
              <div className="h-5 flex items-end justify-center">
                {isCurr && (
                  <span className="text-[9px] font-bold tracking-widest text-primary bg-primary/15 rounded px-1.5 py-0.5 leading-none whitespace-nowrap">
                    {t('target.now')}
                  </span>
                )}
              </div>

              {/* Bar segment */}
              <div
                className="relative h-8 rounded overflow-hidden"
                style={{ background: isFuture ? 'hsl(220,15%,16%)' : 'hsl(220,15%,20%)' }}
              >
                {fp > 0 && (
                  <div
                    className="absolute inset-y-0 left-0 rounded transition-all duration-700"
                    style={{ width: `${fp}%`, background: fc, opacity: 0.88 }}
                  />
                )}
                {isCurr && (
                  <div className="absolute right-1.5 top-1/2 -translate-y-1/2 w-1.5 h-1.5 rounded-full bg-primary/90 animate-pulse" />
                )}
              </div>

              {/* Month name */}
              <p className={`text-center text-[11px] font-semibold leading-none ${
                isCurr   ? 'text-primary' :
                isFuture ? 'text-muted-foreground/35' :
                           'text-muted-foreground/70'
              }`}>
                {label}
              </p>

              {/* Budget target for this month */}
              <p className="text-center text-[9px] font-mono text-muted-foreground/50 leading-none truncate">
                {fmtK(moTgt)}
              </p>

              {/* Amount + performance dot for past/current months */}
              <div className="flex flex-col items-center gap-0.5 min-h-[20px]">
                {(isPast || isCurr) && actual > 0 && (
                  <>
                    <p className="text-[10px] font-mono font-semibold text-foreground/80 leading-none truncate">
                      {fmtK(actual)}
                    </p>
                    {isPast && (
                      <div className="w-1 h-1 rounded-full" style={{ background: dotColor(i, actual) }} />
                    )}
                  </>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
