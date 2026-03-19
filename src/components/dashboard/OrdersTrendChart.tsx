import { useState, useMemo } from 'react';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, ReferenceLine, ReferenceArea,
} from 'recharts';
import { Download, CalendarDays, Plus, X, Pencil } from 'lucide-react';
import { Order } from '@/types/analytics';
import {
  format, eachDayOfInterval, eachWeekOfInterval, eachMonthOfInterval,
  startOfWeek, endOfWeek, startOfMonth, endOfMonth, isWithinInterval,
} from 'date-fns';
import { enUS } from 'date-fns/locale';
import { downloadCsv } from '@/lib/csv-export';

type Granularity = 'day' | 'week' | 'month';
const YEARS = [2024, 2025, 2026] as const;

interface OrdersTrendChartProps {
  orders: Order[];
  allOrders: Order[];
  dateRange: { start: Date; end: Date };
}

// ─── Event model ─────────────────────────────────────────────────────────────
export interface CalendarEvent {
  id: string;
  label: string;
  type: 'preorder' | 'launch' | 'promo' | 'other';
  startYear: number;
  startMonth: number; // 1-based
  endYear: number;
  endMonth: number;   // 1-based, inclusive (same as start = single month)
  custom?: boolean;
}

const EVENT_COLORS: Record<CalendarEvent['type'], string> = {
  preorder: 'hsl(265, 75%, 60%)',
  launch:   'hsl(160, 70%, 45%)',
  promo:    'hsl(35, 95%, 55%)',
  other:    'hsl(215, 60%, 60%)',
};

const EVENT_TYPE_LABELS: Record<CalendarEvent['type'], string> = {
  preorder: 'Pre Order',
  launch:   'Launch',
  promo:    'Promo',
  other:    'Evento',
};

// ─── Built-in events ─────────────────────────────────────────────────────────
const BUILTIN_EVENTS: CalendarEvent[] = [
  { id: 'b1', label: 'Secondo Pre Order WAY2', type: 'preorder', startYear: 2026, startMonth: 2,  endYear: 2026, endMonth: 2  },
  { id: 'b2', label: 'Terzo Pre Order WAY2',   type: 'preorder', startYear: 2026, startMonth: 3,  endYear: 2026, endMonth: 3  },
  { id: 'b3', label: 'Secondo Pre Order JAKE', type: 'preorder', startYear: 2026, startMonth: 3,  endYear: 2026, endMonth: 3  },
  { id: 'b4', label: 'EasyWeek',               type: 'launch',   startYear: 2026, startMonth: 5,  endYear: 2026, endMonth: 5  },
  { id: 'b5', label: 'Black Friday',            type: 'promo',    startYear: 2026, startMonth: 11, endYear: 2026, endMonth: 11 },
];

const CUSTOM_EVENTS_KEY = 'orders-trend-custom-events';

function loadCustomEvents(): CalendarEvent[] {
  try {
    const raw = localStorage.getItem(CUSTOM_EVENTS_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch { return []; }
}
function saveCustomEvents(evs: CalendarEvent[]) {
  localStorage.setItem(CUSTOM_EVENTS_KEY, JSON.stringify(evs));
}

// ─── Helpers ─────────────────────────────────────────────────────────────────
const fmtCurrency = (v: number) =>
  new Intl.NumberFormat('it-IT', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(v);

const MONTHS_SHORT = ['Gen','Feb','Mar','Apr','Mag','Giu','Lug','Ago','Set','Ott','Nov','Dic'];

// month label as used on the chart X axis
function monthLabel(year: number, month: number) {
  return format(new Date(year, month - 1, 1), 'MMM yy', { locale: enUS });
}

// ─── Component ───────────────────────────────────────────────────────────────
export function OrdersTrendChart({ orders, allOrders, dateRange }: OrdersTrendChartProps) {
  const [granularity, setGranularity] = useState<Granularity>('month');
  const [activeYear, setActiveYear] = useState<number | null>(null);
  const [showEvents, setShowEvents] = useState(true);
  const [showForm, setShowForm]   = useState(false);
  const [customEvents, setCustomEvents] = useState<CalendarEvent[]>(loadCustomEvents);

  // Form state
  const [form, setForm] = useState({
    label: '',
    type: 'other' as CalendarEvent['type'],
    startMonth: String(new Date().getMonth() + 1),
    startYear:  String(new Date().getFullYear()),
    endMonth:   String(new Date().getMonth() + 1),
    endYear:    String(new Date().getFullYear()),
  });

  const allEvents = useMemo(() => [...BUILTIN_EVENTS, ...customEvents], [customEvents]);

  // ── Orders / range ──────────────────────────────────────────────────────
  const effectiveOrders = useMemo(() => {
    if (!activeYear) return orders;
    return allOrders.filter(o => {
      const d = o.date instanceof Date ? o.date : new Date(o.date);
      return d.getFullYear() === activeYear;
    });
  }, [orders, allOrders, activeYear]);

  const effectiveDateRange = useMemo(() => {
    if (!activeYear) return dateRange;
    return {
      start: new Date(`${activeYear}-01-01T00:00:00`),
      end:   new Date(`${activeYear}-12-31T23:59:59`),
    };
  }, [activeYear, dateRange]);

  // ── Chart data ──────────────────────────────────────────────────────────
  const chartData = useMemo(() => {
    const { start, end } = effectiveDateRange;
    const gran = activeYear ? 'month' : granularity;
    let intervals: { start: Date; end: Date; label: string }[] = [];

    if (gran === 'day') {
      intervals = eachDayOfInterval({ start, end }).map(d => ({
        start: d, end: d, label: format(d, 'dd MMM', { locale: enUS }),
      }));
    } else if (gran === 'week') {
      intervals = eachWeekOfInterval({ start, end }, { weekStartsOn: 1 }).map(d => ({
        start: startOfWeek(d, { weekStartsOn: 1 }),
        end:   endOfWeek(d, { weekStartsOn: 1 }),
        label: format(startOfWeek(d, { weekStartsOn: 1 }), 'dd MMM', { locale: enUS }),
      }));
    } else {
      intervals = eachMonthOfInterval({ start, end }).map(d => ({
        start: startOfMonth(d), end: endOfMonth(d),
        label: format(d, 'MMM yy', { locale: enUS }),
      }));
    }

    return intervals.map(interval => {
      const inRange = effectiveOrders.filter(o => {
        const od = o.date instanceof Date ? o.date : new Date(o.date);
        return isWithinInterval(od, { start: interval.start, end: interval.end });
      });
      const b2c = inRange.filter(o => o.customerType === 'B2C')
        .reduce((s, o) => s + (o.netAmount ?? o.totalAmount), 0);
      const b2b = inRange.filter(o => o.customerType === 'B2B' && (!o.orderType || o.orderType.toLowerCase() !== 'custom'))
        .reduce((s, o) => s + o.totalAmount, 0);
      const b2bCustom = inRange.filter(o => o.customerType === 'B2B' && o.orderType?.toLowerCase() === 'custom')
        .reduce((s, o) => s + o.totalAmount, 0);
      return { date: interval.label, b2c: Math.round(b2c), b2b: Math.round(b2b), b2bCustom: Math.round(b2bCustom) };
    });
  }, [effectiveOrders, effectiveDateRange, granularity, activeYear]);

  const gran = activeYear ? 'month' : granularity;

  // Events visible in current view
  const visibleEvents = useMemo(() => {
    const { start, end } = effectiveDateRange;
    return allEvents.filter(ev => {
      const evStart = new Date(ev.startYear, ev.startMonth - 1, 1);
      const evEnd   = new Date(ev.endYear,   ev.endMonth - 1,   1);
      return evStart <= end && evEnd >= start;
    });
  }, [allEvents, effectiveDateRange]);

  // label → events map (single-month events → ReferenceLine)
  const singleEventsByLabel = useMemo(() => {
    if (gran !== 'month') return {} as Record<string, CalendarEvent[]>;
    const map: Record<string, CalendarEvent[]> = {};
    visibleEvents.filter(ev => ev.startMonth === ev.endMonth && ev.startYear === ev.endYear).forEach(ev => {
      const lbl = monthLabel(ev.startYear, ev.startMonth);
      if (!map[lbl]) map[lbl] = [];
      map[lbl].push(ev);
    });
    return map;
  }, [gran, visibleEvents]);

  // Multi-month events → ReferenceArea
  const rangeEvents = useMemo(() => {
    if (gran !== 'month') return [] as CalendarEvent[];
    return visibleEvents.filter(ev => !(ev.startMonth === ev.endMonth && ev.startYear === ev.endYear));
  }, [gran, visibleEvents]);

  // ── Event CRUD ──────────────────────────────────────────────────────────
  const addEvent = () => {
    if (!form.label.trim()) return;
    const sm = parseInt(form.startMonth), sy = parseInt(form.startYear);
    const em = parseInt(form.endMonth),   ey = parseInt(form.endYear);
    const newEv: CalendarEvent = {
      id: `c${Date.now()}`,
      label: form.label.trim(),
      type: form.type,
      startYear: sy, startMonth: sm,
      endYear: ey < sy || (ey === sy && em < sm) ? sy : ey,
      endMonth: ey < sy || (ey === sy && em < sm) ? sm : em,
      custom: true,
    };
    const updated = [...customEvents, newEv];
    setCustomEvents(updated);
    saveCustomEvents(updated);
    setForm({ label: '', type: 'other', startMonth: String(sm), startYear: String(sy), endMonth: String(sm), endYear: String(sy) });
    setShowForm(false);
  };

  const deleteEvent = (id: string) => {
    const updated = customEvents.filter(e => e.id !== id);
    setCustomEvents(updated);
    saveCustomEvents(updated);
  };

  // ── Chart helpers ───────────────────────────────────────────────────────
  const handleExport = () => {
    downloadCsv('orders-trend', ['Date', 'B2C', 'B2B', 'B2B Custom'],
      chartData.map(r => [r.date, r.b2c, r.b2b, r.b2bCustom]));
  };

  const formatYAxis = (v: number) =>
    v >= 1000 ? `€${(v / 1000).toFixed(0)}k` : `€${v}`;

  // Peak-dot with readable label (background rect + text)
  const createPeakDot = (dataKey: string, color: string) => (props: any) => {
    const { cx, cy, index } = props;
    if (cx == null || cy == null || !chartData.length) return null;
    const val  = chartData[index]?.[dataKey as keyof typeof chartData[0]] as number;
    const prev = index > 0 ? (chartData[index - 1]?.[dataKey as keyof typeof chartData[0]] as number) : -1;
    const next = index < chartData.length - 1 ? (chartData[index + 1]?.[dataKey as keyof typeof chartData[0]] as number) : -1;
    const isPeak = val > 0 && val >= prev && val >= next && (val > prev || val > next);
    if (!isPeak) return null;
    const lbl = val >= 1000 ? `€${(val / 1000).toFixed(1)}k` : `€${val}`;
    const w = lbl.length * 5.5 + 8;
    return (
      <g>
        <circle cx={cx} cy={cy} r={4} fill={color} stroke="hsl(218,35%,7%)" strokeWidth={2} />
        <rect x={cx - w / 2} y={cy - 26} width={w} height={14} rx={3}
          fill="hsl(218,30%,12%)" stroke={color} strokeWidth={0.8} opacity={0.95} />
        <text x={cx} y={cy - 16} textAnchor="middle" fill={color}
          fontSize={10} fontWeight={700} fontFamily="'JetBrains Mono',monospace">
          {lbl}
        </text>
      </g>
    );
  };

  // Tooltip
  const CustomTooltip = ({ active, payload, label: lbl }: any) => {
    if (!active || !payload?.length) return null;
    const total = payload.reduce((s: number, e: any) => s + (e.value || 0), 0);
    const evHere = [...(singleEventsByLabel[lbl] ?? []),
      ...rangeEvents.filter(ev =>
        monthLabel(ev.startYear, ev.startMonth) <= lbl &&
        monthLabel(ev.endYear,   ev.endMonth)   >= lbl
      )];
    return (
      <div className="bg-popover border border-border rounded-lg p-3 text-xs shadow-xl min-w-[170px]">
        <p className="font-semibold mb-2 text-foreground text-[13px]">{lbl}</p>
        {payload.map((entry: any, i: number) => (
          <div key={i} className="flex items-center gap-2 py-0.5">
            <div className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: entry.color }} />
            <span className="text-muted-foreground flex-1">{entry.name}</span>
            <span className="font-mono font-semibold text-foreground">{fmtCurrency(entry.value)}</span>
          </div>
        ))}
        {payload.length > 1 && (
          <div className="flex items-center gap-2 pt-1.5 mt-1 border-t border-border/50">
            <span className="text-muted-foreground flex-1">Totale</span>
            <span className="font-mono font-bold text-foreground">{fmtCurrency(total)}</span>
          </div>
        )}
        {evHere.length > 0 && (
          <div className="mt-2 pt-1.5 border-t border-border/50 space-y-1">
            {evHere.map((ev, i) => (
              <div key={i} className="flex items-center gap-1.5">
                <div className="w-1.5 h-1.5 rounded-full shrink-0" style={{ backgroundColor: EVENT_COLORS[ev.type] }} />
                <span style={{ color: EVENT_COLORS[ev.type] }} className="font-medium">{ev.label}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    );
  };

  const B2C_COLOR       = 'hsl(215, 85%, 55%)';
  const B2B_COLOR       = 'hsl(25, 95%, 55%)';
  const B2B_CUSTOM_COLOR = 'hsl(40, 90%, 55%)';

  const granularities = [
    { value: 'day'   as Granularity, label: 'Day'   },
    { value: 'week'  as Granularity, label: 'Week'  },
    { value: 'month' as Granularity, label: 'Month' },
  ];

  return (
    <div className="chart-container">
      {/* ── Header ──────────────────────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-5">
        <div>
          <h3 className="text-sm font-semibold text-foreground">Orders Trend</h3>
          <p className="text-xs text-muted-foreground">
            {activeYear ? `Anno ${activeYear} — mensile` : 'B2C + B2B (+ B2B Custom)'}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {/* Year buttons */}
          <div className="flex rounded-md bg-muted p-0.5">
            <button onClick={() => setActiveYear(null)}
              className={`px-2.5 py-1 text-xs font-medium rounded transition-colors ${activeYear === null ? 'bg-secondary text-foreground' : 'text-muted-foreground hover:text-foreground'}`}>
              All
            </button>
            {YEARS.map(y => (
              <button key={y} onClick={() => setActiveYear(activeYear === y ? null : y)}
                className={`px-2.5 py-1 text-xs font-medium rounded transition-colors ${activeYear === y ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground'}`}>
                {y}
              </button>
            ))}
          </div>

          {/* Granularity */}
          {!activeYear && (
            <div className="flex rounded-md bg-muted p-0.5">
              {granularities.map(g => (
                <button key={g.value} onClick={() => setGranularity(g.value)}
                  className={`px-3 py-1 text-xs font-medium rounded transition-colors ${granularity === g.value ? 'bg-secondary text-foreground' : 'text-muted-foreground hover:text-foreground'}`}>
                  {g.label}
                </button>
              ))}
            </div>
          )}

          <button onClick={handleExport} className="p-2 rounded-md hover:bg-muted/50 text-muted-foreground hover:text-foreground transition-colors" title="Export CSV">
            <Download className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* ── Chart ───────────────────────────────────────────────────────── */}
      <div className="h-[360px]">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={chartData} margin={{ top: 32, right: 16, left: 0, bottom: 0 }}>
            <CartesianGrid stroke="hsl(218, 25%, 14%)" strokeDasharray="3 3" vertical={false} />
            <XAxis dataKey="date" stroke="hsl(215, 15%, 40%)" fontSize={11} tickLine={false} axisLine={false} dy={4} />
            <YAxis stroke="hsl(215, 15%, 40%)" fontSize={11} tickLine={false} axisLine={false} tickFormatter={formatYAxis} width={54} />
            <Tooltip content={<CustomTooltip />} />

            {/* Multi-month event areas */}
            {gran === 'month' && rangeEvents.map(ev => (
              <ReferenceArea
                key={ev.id}
                x1={monthLabel(ev.startYear, ev.startMonth)}
                x2={monthLabel(ev.endYear,   ev.endMonth)}
                fill={EVENT_COLORS[ev.type]}
                fillOpacity={0.08}
                stroke={EVENT_COLORS[ev.type]}
                strokeOpacity={0.3}
                strokeWidth={1}
              />
            ))}

            {/* Single-month event lines */}
            {gran === 'month' && Object.entries(singleEventsByLabel).map(([lbl, evs]) => (
              <ReferenceLine key={lbl} x={lbl}
                stroke={evs.length === 1 ? EVENT_COLORS[evs[0].type] : 'hsl(265,60%,60%)'}
                strokeDasharray="5 3" strokeWidth={1.5} strokeOpacity={0.75}
              />
            ))}

            <Line type="monotone" dataKey="b2c" name="B2C" stroke={B2C_COLOR} strokeWidth={2.5}
              dot={createPeakDot('b2c', B2C_COLOR)} activeDot={{ r: 5, strokeWidth: 2, stroke: 'hsl(218,35%,7%)' }} />
            <Line type="monotone" dataKey="b2b" name="B2B" stroke={B2B_COLOR} strokeWidth={2.5}
              dot={createPeakDot('b2b', B2B_COLOR)} activeDot={{ r: 5, strokeWidth: 2, stroke: 'hsl(218,35%,7%)' }} />
            <Line type="monotone" dataKey="b2bCustom" name="B2B Custom" stroke={B2B_CUSTOM_COLOR}
              strokeWidth={2} strokeDasharray="6 4"
              dot={createPeakDot('b2bCustom', B2B_CUSTOM_COLOR)} activeDot={{ r: 5, strokeWidth: 2, stroke: 'hsl(218,35%,7%)' }} />
          </LineChart>
        </ResponsiveContainer>
      </div>

      {/* ── Legend ──────────────────────────────────────────────────────── */}
      <div className="flex flex-wrap gap-x-5 gap-y-1 mt-3">
        {[
          { color: B2C_COLOR, label: 'B2C', dashed: false },
          { color: B2B_COLOR, label: 'B2B', dashed: false },
          { color: B2B_CUSTOM_COLOR, label: 'B2B Custom', dashed: true },
        ].map(({ color, label, dashed }) => (
          <div key={label} className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <div className={`w-5 h-0.5 rounded ${dashed ? 'border-t border-dashed' : ''}`}
              style={{ backgroundColor: dashed ? 'transparent' : color, borderColor: dashed ? color : undefined }} />
            {dashed && <div className="w-5 h-0.5 rounded" style={{ backgroundColor: color, opacity: 0.4, marginLeft: -18 }} />}
            <span>{label}</span>
          </div>
        ))}
      </div>

      {/* ── Events section ──────────────────────────────────────────────── */}
      <div className="mt-4 border-t border-border/40 pt-3">
        {/* Section header */}
        <div className="flex items-center gap-2 mb-2">
          <button onClick={() => setShowEvents(v => !v)}
            className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground hover:text-foreground transition-colors">
            <CalendarDays className="w-3.5 h-3.5" />
            <span>Eventi</span>
            {visibleEvents.length > 0 && (
              <span className="px-1.5 py-0.5 rounded-full bg-muted text-[10px] font-semibold">{visibleEvents.length}</span>
            )}
            <span className="text-[10px] opacity-40">{showEvents ? '▲' : '▼'}</span>
          </button>
          <div className="flex-1" />
          <button
            onClick={() => setShowForm(v => !v)}
            className="flex items-center gap-1 px-2 py-1 rounded-md text-[11px] font-medium bg-muted/60 text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
          >
            {showForm ? <X className="w-3 h-3" /> : <Plus className="w-3 h-3" />}
            {showForm ? 'Annulla' : 'Aggiungi evento'}
          </button>
        </div>

        {/* ── Add event form ───────────────────────────────────────────── */}
        {showForm && (
          <div className="mb-3 p-3 rounded-lg bg-muted/30 border border-border/50 space-y-3">
            <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">Nuovo evento</p>

            {/* Name + Type */}
            <div className="flex gap-2">
              <input
                type="text"
                placeholder="Nome evento"
                value={form.label}
                onChange={e => setForm(f => ({ ...f, label: e.target.value }))}
                onKeyDown={e => e.key === 'Enter' && addEvent()}
                className="flex-1 h-8 px-3 text-xs rounded-md bg-muted border border-border text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:ring-1 focus:ring-primary"
              />
              <select
                value={form.type}
                onChange={e => setForm(f => ({ ...f, type: e.target.value as CalendarEvent['type'] }))}
                className="h-8 px-2 text-xs rounded-md bg-muted border border-border text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
              >
                {(Object.keys(EVENT_TYPE_LABELS) as CalendarEvent['type'][]).map(t => (
                  <option key={t} value={t}>{EVENT_TYPE_LABELS[t]}</option>
                ))}
              </select>
            </div>

            {/* Start date */}
            <div className="flex items-center gap-2">
              <span className="text-[11px] text-muted-foreground w-14 shrink-0">Inizio</span>
              <select
                value={form.startMonth}
                onChange={e => setForm(f => ({ ...f, startMonth: e.target.value, endMonth: e.target.value }))}
                className="h-8 px-2 text-xs rounded-md bg-muted border border-border text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
              >
                {MONTHS_SHORT.map((m, i) => <option key={i} value={String(i + 1)}>{m}</option>)}
              </select>
              <select
                value={form.startYear}
                onChange={e => setForm(f => ({ ...f, startYear: e.target.value, endYear: e.target.value }))}
                className="h-8 px-2 text-xs rounded-md bg-muted border border-border text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
              >
                {[2024, 2025, 2026, 2027].map(y => <option key={y} value={String(y)}>{y}</option>)}
              </select>
            </div>

            {/* End date */}
            <div className="flex items-center gap-2">
              <span className="text-[11px] text-muted-foreground w-14 shrink-0">Fine</span>
              <select
                value={form.endMonth}
                onChange={e => setForm(f => ({ ...f, endMonth: e.target.value }))}
                className="h-8 px-2 text-xs rounded-md bg-muted border border-border text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
              >
                {MONTHS_SHORT.map((m, i) => <option key={i} value={String(i + 1)}>{m}</option>)}
              </select>
              <select
                value={form.endYear}
                onChange={e => setForm(f => ({ ...f, endYear: e.target.value }))}
                className="h-8 px-2 text-xs rounded-md bg-muted border border-border text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
              >
                {[2024, 2025, 2026, 2027].map(y => <option key={y} value={String(y)}>{y}</option>)}
              </select>
              <span className="text-[10px] text-muted-foreground/50">(stesso mese = evento singolo)</span>
            </div>

            {/* Preview + submit */}
            <div className="flex items-center justify-between gap-2">
              {form.label && (
                <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-medium"
                  style={{ backgroundColor: EVENT_COLORS[form.type] + '22', border: `1px solid ${EVENT_COLORS[form.type]}55`, color: EVENT_COLORS[form.type] }}>
                  <span className="opacity-70">{MONTHS_SHORT[parseInt(form.startMonth) - 1]} {form.startYear}</span>
                  {(form.endMonth !== form.startMonth || form.endYear !== form.startYear) && (
                    <span className="opacity-70"> → {MONTHS_SHORT[parseInt(form.endMonth) - 1]} {form.endYear}</span>
                  )}
                  <span>·</span>
                  <span>{form.label}</span>
                </div>
              )}
              <button onClick={addEvent} disabled={!form.label.trim()}
                className="ml-auto px-3 py-1.5 rounded-md text-xs font-semibold bg-primary text-primary-foreground hover:opacity-90 transition-opacity disabled:opacity-40 disabled:cursor-not-allowed">
                Aggiungi
              </button>
            </div>
          </div>
        )}

        {/* ── Event list ───────────────────────────────────────────────── */}
        {showEvents && visibleEvents.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {visibleEvents.map(ev => {
              const isRange = !(ev.startMonth === ev.endMonth && ev.startYear === ev.endYear);
              const startLbl = `${MONTHS_SHORT[ev.startMonth - 1]} ${ev.startYear}`;
              const endLbl   = `${MONTHS_SHORT[ev.endMonth - 1]} ${ev.endYear}`;
              return (
                <div key={ev.id}
                  className="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-medium group"
                  style={{ backgroundColor: EVENT_COLORS[ev.type] + '1a', border: `1px solid ${EVENT_COLORS[ev.type]}44`, color: EVENT_COLORS[ev.type] }}>
                  <span className="opacity-60 font-normal">
                    {isRange ? `${startLbl} → ${endLbl}` : startLbl}
                  </span>
                  <span className="opacity-40">·</span>
                  <span>{ev.label}</span>
                  <span className="text-[9px] px-1 py-0.5 rounded font-bold uppercase tracking-wide"
                    style={{ backgroundColor: EVENT_COLORS[ev.type] + '30' }}>
                    {EVENT_TYPE_LABELS[ev.type]}
                  </span>
                  {ev.custom && (
                    <button onClick={() => deleteEvent(ev.id)}
                      className="ml-0.5 opacity-0 group-hover:opacity-100 transition-opacity hover:opacity-100"
                      title="Rimuovi">
                      <X className="w-3 h-3" style={{ color: EVENT_COLORS[ev.type] }} />
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {showEvents && visibleEvents.length === 0 && (
          <p className="text-[11px] text-muted-foreground/40 italic">Nessun evento nel periodo visualizzato</p>
        )}
      </div>
    </div>
  );
}
