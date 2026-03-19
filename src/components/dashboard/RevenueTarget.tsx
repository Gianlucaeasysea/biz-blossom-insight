import { useState, useEffect, useMemo } from 'react';
import { Target, Pencil, Check, X } from 'lucide-react';
import { format, getDaysInMonth } from 'date-fns';
import { it } from 'date-fns/locale';

interface RevenueTargetProps {
  currentRevenue: number;
  monthlyRevenues?: number[]; // 12 valori Jan→Dec
}

const STORAGE_KEY = 'dashboard-revenue-target';
const DEFAULT_TARGET = 1200000;
const MONTHS_IT = ['Gen','Feb','Mar','Apr','Mag','Giu','Lug','Ago','Set','Ott','Nov','Dic'];

const fmt = (v: number) =>
  new Intl.NumberFormat('it-IT', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(v);

const fmtK = (v: number) =>
  v >= 1000 ? `€${(v / 1000).toFixed(0)}k` : `€${Math.round(v)}`;

export function RevenueTarget({ currentRevenue, monthlyRevenues }: RevenueTargetProps) {
  const [target, setTarget] = useState(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    return saved ? parseFloat(saved) : DEFAULT_TARGET;
  });
  const [editing, setEditing] = useState(false);
  const [inputValue, setInputValue] = useState('');

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, String(target));
  }, [target]);

  const now         = new Date();
  const currentMo   = now.getMonth();           // 0-11
  const currentYear = now.getFullYear();
  const daysInMonth = getDaysInMonth(now);
  const dayOfMonth  = now.getDate();
  const monthPct    = dayOfMonth / daysInMonth;  // 0-1 fraction of current month elapsed

  const monthlyTarget = target / 12;
  const pctTotal = target > 0 ? Math.min((currentRevenue / target) * 100, 100) : 0;

  const startEdit   = () => { setInputValue(String(target)); setEditing(true); };
  const confirmEdit = () => {
    const parsed = parseFloat(inputValue.replace(/[^\d.,]/g, '').replace(',', '.'));
    if (!isNaN(parsed) && parsed > 0) setTarget(parsed);
    setEditing(false);
  };
  const cancelEdit  = () => setEditing(false);

  // Color for overall bar / pct badge
  const globalColor =
    pctTotal >= 100 ? 'hsl(168,70%,42%)' :
    pctTotal >= 75  ? 'hsl(168,70%,42%)' :
    pctTotal >= 50  ? 'hsl(42,96%,48%)'  :
    'hsl(var(--primary))';

  // Per-segment color based on performance vs monthly target
  const segColor = (mo: number, actual: number): string => {
    if (mo > currentMo)  return 'transparent';
    if (mo === currentMo) return 'hsl(var(--primary))';
    const pct = monthlyTarget > 0 ? actual / monthlyTarget : 0;
    if (pct >= 1.0) return 'hsl(168,70%,42%)';
    if (pct >= 0.7) return 'hsl(42,96%,48%)';
    return 'hsl(0,60%,50%)';
  };

  // Fill width per segment (0-1)
  const segFill = (mo: number, actual: number): number => {
    if (mo > currentMo)  return 0;
    if (mo === currentMo) return monthPct;          // fraction of month elapsed
    // Past month: filled proportionally to actual vs target (cap at 100%)
    return Math.min(1, monthlyTarget > 0 ? actual / monthlyTarget : 0);
  };

  return (
    <div className="w-full rounded-xl border border-border/60 bg-card/80 backdrop-blur-sm px-5 pt-3.5 pb-3 mb-1">

      {/* ── Top row ──────────────────────────────────────────────────── */}
      <div className="flex flex-wrap items-start justify-between gap-x-6 gap-y-1 mb-3">

        {/* Left: icon + label + target editable */}
        <div className="flex items-center gap-2.5 shrink-0">
          <div className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0"
            style={{ background: globalColor + '26' }}>
            <Target className="w-4 h-4" style={{ color: globalColor }} />
          </div>
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground leading-none">
              Obiettivo Fatturato Annuo
              <span className="ml-1.5 normal-case tracking-normal opacity-60">
                (1 Gen – {format(now, 'd MMM yyyy', { locale: it })})
              </span>
            </p>
            <div className="flex items-center gap-1.5 mt-0.5">
              {editing ? (
                <div className="flex items-center gap-1">
                  <span className="text-xs text-muted-foreground">€</span>
                  <input autoFocus type="text" value={inputValue}
                    onChange={e => setInputValue(e.target.value)}
                    onKeyDown={e => { if (e.key === 'Enter') confirmEdit(); if (e.key === 'Escape') cancelEdit(); }}
                    className="w-28 h-6 px-1.5 text-sm font-bold font-mono bg-muted border border-border rounded text-foreground focus:outline-none focus:ring-1 focus:ring-primary" />
                  <button onClick={confirmEdit} className="p-0.5 rounded hover:bg-muted text-primary"><Check className="w-3.5 h-3.5" /></button>
                  <button onClick={cancelEdit}  className="p-0.5 rounded hover:bg-muted text-muted-foreground"><X className="w-3.5 h-3.5" /></button>
                </div>
              ) : (
                <button onClick={startEdit} className="group flex items-center gap-1 hover:opacity-80 transition-opacity">
                  <span className="text-sm font-bold font-mono text-foreground">{fmt(target)}</span>
                  <Pencil className="w-3 h-3 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Center: consuntivo */}
        <div className="flex items-baseline gap-1.5">
          <span className="text-[11px] text-muted-foreground">Consuntivo</span>
          <span className="text-sm font-bold font-mono text-foreground">{fmt(currentRevenue)}</span>
          <span className="text-xs font-bold font-mono ml-1" style={{ color: globalColor }}>
            {pctTotal.toFixed(1)}%
          </span>
        </div>

        {/* Right: mancante */}
        <div className="text-right shrink-0 hidden sm:block">
          <p className="text-[10px] text-muted-foreground uppercase tracking-wider leading-none">Mancante</p>
          <p className="text-sm font-bold font-mono text-foreground mt-0.5">
            {currentRevenue >= target ? '🎯 Raggiunto!' : fmt(target - currentRevenue)}
          </p>
        </div>
      </div>

      {/* ── 12-month segmented bar ──────────────────────────────────── */}
      <div className="relative">

        {/* "Ora" indicator above current month */}
        <div
          className="absolute -top-1 flex flex-col items-center pointer-events-none"
          style={{ left: `calc(${(currentMo / 12) * 100}% + ${(monthPct / 12) * 100}%)`, transform: 'translateX(-50%)' }}
        >
          <span className="text-[9px] font-bold text-primary/90 uppercase tracking-widest leading-none mb-0.5">ora</span>
          <div className="w-px h-2 bg-primary/70" />
        </div>

        {/* Segments */}
        <div className="flex gap-[2px]">
          {MONTHS_IT.map((mo, i) => {
            const actual   = monthlyRevenues?.[i] ?? 0;
            const fill     = segFill(i, actual);
            const color    = segColor(i, actual);
            const isPast   = i < currentMo;
            const isCurr   = i === currentMo;
            const isFuture = i > currentMo;

            return (
              <div key={mo} className="flex-1 flex flex-col gap-1 min-w-0">
                {/* Bar segment */}
                <div
                  className="relative h-6 rounded-sm overflow-hidden"
                  style={{ background: isFuture ? 'hsl(220,15%,18%)' : 'hsl(220,15%,22%)' }}
                >
                  {/* Fill */}
                  {fill > 0 && (
                    <div
                      className="absolute inset-y-0 left-0 rounded-sm transition-all duration-700"
                      style={{ width: `${fill * 100}%`, background: color, opacity: isCurr ? 0.7 : 0.85 }}
                    />
                  )}
                  {/* Current month pulse dot */}
                  {isCurr && (
                    <div className="absolute right-1 top-1/2 -translate-y-1/2 w-1.5 h-1.5 rounded-full bg-primary animate-pulse" />
                  )}
                </div>

                {/* Label + amount */}
                <div className="text-center">
                  <p className={`text-[9px] font-semibold leading-none ${isCurr ? 'text-primary' : isFuture ? 'text-muted-foreground/40' : 'text-muted-foreground/70'}`}>
                    {mo}
                  </p>
                  {(isPast || isCurr) && (monthlyRevenues?.[i] ?? 0) > 0 && (
                    <p className="text-[8px] font-mono leading-none mt-0.5"
                      style={{ color: isCurr ? 'hsl(var(--primary))' : color }}>
                      {fmtK(actual)}
                    </p>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
