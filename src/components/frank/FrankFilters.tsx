import { useState } from 'react';
import { Calendar, Filter, ChevronDown, ChevronUp } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { format } from 'date-fns';

export interface FrankDataFilters {
  dateFrom: string;
  dateTo: string;
  sources: ('b2c' | 'b2b')[];
  statusFilter: 'all' | 'fulfilled' | 'pending';
  searchTerm: string;
}

const getDefaultFilters = (): FrankDataFilters => {
  const now = new Date();
  const from = new Date(now.getFullYear(), now.getMonth(), 1);
  return {
    dateFrom: format(from, 'yyyy-MM-dd'),
    dateTo: format(now, 'yyyy-MM-dd'),
    sources: ['b2c', 'b2b'],
    statusFilter: 'all',
    searchTerm: '',
  };
};

interface Props {
  filters: FrankDataFilters;
  onChange: (f: FrankDataFilters) => void;
}

export function FrankFilters({ filters, onChange }: Props) {
  const [open, setOpen] = useState(false);

  const update = (partial: Partial<FrankDataFilters>) =>
    onChange({ ...filters, ...partial });

  const toggleSource = (src: 'b2c' | 'b2b') => {
    const current = filters.sources;
    if (current.includes(src)) {
      if (current.length > 1) update({ sources: current.filter(s => s !== src) });
    } else {
      update({ sources: [...current, src] });
    }
  };

  return (
    <div className="border border-border rounded-xl bg-card overflow-hidden">
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between px-3 py-2 text-xs font-medium text-muted-foreground hover:text-foreground transition-colors"
      >
        <span className="flex items-center gap-1.5">
          <Filter className="w-3.5 h-3.5" />
          Filtri dati: {filters.sources.map(s => s.toUpperCase()).join(' + ')} · {filters.dateFrom} → {filters.dateTo}
          {filters.statusFilter !== 'all' && ` · ${filters.statusFilter}`}
        </span>
        {open ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
      </button>

      {open && (
        <div className="px-3 pb-3 space-y-3 border-t border-border pt-3">
          {/* Date range */}
          <div className="flex flex-wrap items-center gap-2">
            <Calendar className="w-3.5 h-3.5 text-muted-foreground" />
            <input
              type="date"
              value={filters.dateFrom}
              onChange={e => update({ dateFrom: e.target.value })}
              className="text-xs border border-input rounded-md px-2 py-1 bg-background"
            />
            <span className="text-xs text-muted-foreground">→</span>
            <input
              type="date"
              value={filters.dateTo}
              onChange={e => update({ dateTo: e.target.value })}
              className="text-xs border border-input rounded-md px-2 py-1 bg-background"
            />
            {/* Quick presets */}
            <div className="flex gap-1 ml-auto flex-wrap">
              {[
                { label: 'Mese', fn: () => { const n = new Date(); update({ dateFrom: format(new Date(n.getFullYear(), n.getMonth(), 1), 'yyyy-MM-dd'), dateTo: format(n, 'yyyy-MM-dd') }); } },
                { label: 'Q1', fn: () => { const y = new Date().getFullYear(); update({ dateFrom: `${y}-01-01`, dateTo: `${y}-03-31` }); } },
                { label: 'YTD', fn: () => { const n = new Date(); update({ dateFrom: `${n.getFullYear()}-01-01`, dateTo: format(n, 'yyyy-MM-dd') }); } },
                { label: 'Tutto', fn: () => update({ dateFrom: '2020-01-01', dateTo: format(new Date(), 'yyyy-MM-dd') }) },
              ].map(p => (
                <Button key={p.label} variant="outline" size="sm" className="h-6 text-[10px] px-2" onClick={p.fn}>
                  {p.label}
                </Button>
              ))}
            </div>
          </div>

          {/* Sources */}
          <div className="flex items-center gap-2">
            <span className="text-xs text-muted-foreground">Fonti:</span>
            {(['b2c', 'b2b'] as const).map(src => (
              <button
                key={src}
                onClick={() => toggleSource(src)}
                className={`px-2.5 py-1 rounded-md text-xs font-medium transition-colors ${
                  filters.sources.includes(src)
                    ? 'bg-primary text-primary-foreground'
                    : 'bg-muted text-muted-foreground hover:text-foreground'
                }`}
              >
                {src.toUpperCase()}
              </button>
            ))}

            <span className="text-xs text-muted-foreground ml-3">Stato:</span>
            {(['all', 'fulfilled', 'pending'] as const).map(st => (
              <button
                key={st}
                onClick={() => update({ statusFilter: st })}
                className={`px-2.5 py-1 rounded-md text-xs font-medium transition-colors ${
                  filters.statusFilter === st
                    ? 'bg-primary text-primary-foreground'
                    : 'bg-muted text-muted-foreground hover:text-foreground'
                }`}
              >
                {st === 'all' ? 'Tutti' : st === 'fulfilled' ? 'Evasi' : 'Pending'}
              </button>
            ))}
          </div>

          {/* Search */}
          <input
            type="text"
            placeholder="Cerca per SKU, cliente, paese..."
            value={filters.searchTerm}
            onChange={e => update({ searchTerm: e.target.value })}
            className="w-full text-xs border border-input rounded-md px-2.5 py-1.5 bg-background placeholder:text-muted-foreground"
          />
        </div>
      )}
    </div>
  );
}

export { getDefaultFilters };
