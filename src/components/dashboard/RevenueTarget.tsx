import { useState, useEffect } from 'react';
import { Target, Pencil, Check, X } from 'lucide-react';
import { format } from 'date-fns';
import { it } from 'date-fns/locale';
import { Progress } from '@/components/ui/progress';

interface RevenueTargetProps {
  currentRevenue: number;
}

const STORAGE_KEY = 'dashboard-revenue-target';
const DEFAULT_TARGET = 1200000;

export function RevenueTarget({ currentRevenue }: RevenueTargetProps) {
  const [target, setTarget] = useState(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    return saved ? parseFloat(saved) : DEFAULT_TARGET;
  });
  const [editing, setEditing] = useState(false);
  const [inputValue, setInputValue] = useState('');

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, String(target));
  }, [target]);

  const pct = target > 0 ? Math.min((currentRevenue / target) * 100, 100) : 0;

  const fmt = (v: number) =>
    new Intl.NumberFormat('it-IT', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(v);

  const startEdit = () => {
    setInputValue(String(target));
    setEditing(true);
  };

  const confirmEdit = () => {
    const parsed = parseFloat(inputValue.replace(/[^\d.,]/g, '').replace(',', '.'));
    if (!isNaN(parsed) && parsed > 0) setTarget(parsed);
    setEditing(false);
  };

  const cancelEdit = () => setEditing(false);

  const barColor =
    pct >= 100 ? 'hsl(var(--chart-2))' :
    pct >= 75 ? 'hsl(168,70%,42%)' :
    pct >= 50 ? 'hsl(42,96%,48%)' :
    'hsl(var(--primary))';

  return (
    <div className="w-full rounded-xl border border-border/60 bg-card/80 backdrop-blur-sm px-5 py-3.5 mb-1">
      <div className="flex flex-col sm:flex-row sm:items-center gap-3">
        {/* Left: label + target */}
        <div className="flex items-center gap-2.5 shrink-0">
          <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: barColor, opacity: 0.15 }}>
            <Target className="w-4 h-4" style={{ color: barColor }} />
          </div>
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground leading-none">
              Obiettivo Fatturato Annuo
            </p>
            <div className="flex items-center gap-1.5 mt-1">
              {editing ? (
                <div className="flex items-center gap-1">
                  <span className="text-xs text-muted-foreground">€</span>
                  <input
                    autoFocus
                    type="text"
                    value={inputValue}
                    onChange={(e) => setInputValue(e.target.value)}
                    onKeyDown={(e) => { if (e.key === 'Enter') confirmEdit(); if (e.key === 'Escape') cancelEdit(); }}
                    className="w-28 h-6 px-1.5 text-sm font-bold font-mono bg-muted border border-border rounded text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                  />
                  <button onClick={confirmEdit} className="p-0.5 rounded hover:bg-muted text-primary"><Check className="w-3.5 h-3.5" /></button>
                  <button onClick={cancelEdit} className="p-0.5 rounded hover:bg-muted text-muted-foreground"><X className="w-3.5 h-3.5" /></button>
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

        {/* Center: progress bar */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between mb-1">
            <span className="text-xs font-medium text-muted-foreground">
              Consuntivo: <span className="text-foreground font-bold font-mono">{fmt(currentRevenue)}</span>
            </span>
            <span className="text-xs font-bold font-mono" style={{ color: barColor }}>
              {pct.toFixed(1)}%
            </span>
          </div>
          <div className="relative h-3 w-full overflow-hidden rounded-full bg-muted/60">
            <div
              className="h-full rounded-full transition-all duration-700 ease-out"
              style={{ width: `${pct}%`, background: barColor }}
            />
          </div>
        </div>

        {/* Right: remaining */}
        <div className="shrink-0 text-right hidden sm:block">
          <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Mancante</p>
          <p className="text-sm font-bold font-mono text-foreground">
            {currentRevenue >= target ? '🎯 Raggiunto!' : fmt(target - currentRevenue)}
          </p>
        </div>
      </div>
    </div>
  );
}
