import { useState, useRef, useCallback } from 'react';
import { NavLink } from '@/components/NavLink';
import { useLanguage } from '@/contexts/LanguageContext';
import { GripVertical, ChevronLeft, ChevronRight } from 'lucide-react';

const STORAGE_KEY = 'nav-order';

interface NavItem {
  to: string;
  labelKey: string;
}

const DEFAULT_ITEMS: NavItem[] = [
  { to: '/', labelKey: 'nav.sales' },
  { to: '/meta-ads', labelKey: 'nav.meta' },
  { to: '/budget-2026', labelKey: 'nav.budget' },
  { to: '/geo-insights', labelKey: 'nav.geo' },
  { to: '/product-analysis', labelKey: 'nav.products' },
  { to: '/b2c-customers', labelKey: 'nav.b2c_customers' },
  { to: '/b2b-analysis', labelKey: 'nav.b2b_analysis' },
  { to: '/b2c-analysis', labelKey: 'nav.b2c_analysis' },
  { to: '/sales-call', labelKey: 'nav.sales_call' },
  { to: '/stock', labelKey: 'nav.stock' },
  { to: '/frank', labelKey: 'nav.frank' },
  { to: '/debug', labelKey: 'nav.debug' },
];

function loadOrder(): NavItem[] {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (!saved) return DEFAULT_ITEMS;
    const paths: string[] = JSON.parse(saved);
    const map = new Map(DEFAULT_ITEMS.map(i => [i.to, i]));
    const ordered = paths.map(p => map.get(p)).filter(Boolean) as NavItem[];
    DEFAULT_ITEMS.forEach(item => {
      if (!ordered.find(o => o.to === item.to)) ordered.push(item);
    });
    return ordered;
  } catch {
    return DEFAULT_ITEMS;
  }
}

function saveOrder(items: NavItem[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(items.map(i => i.to)));
}

export function DraggableNav() {
  const { t } = useLanguage();
  const [items, setItems] = useState(loadOrder);
  const [dragIdx, setDragIdx] = useState<number | null>(null);
  const [overIdx, setOverIdx] = useState<number | null>(null);
  const dragRef = useRef<number | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  const handleDragStart = useCallback((e: React.DragEvent, idx: number) => {
    dragRef.current = idx;
    setDragIdx(idx);
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', String(idx));
  }, []);

  const handleDragOver = useCallback((e: React.DragEvent, idx: number) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    setOverIdx(idx);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent, dropIdx: number) => {
    e.preventDefault();
    const fromIdx = dragRef.current;
    if (fromIdx === null || fromIdx === dropIdx) {
      setDragIdx(null);
      setOverIdx(null);
      return;
    }
    setItems(prev => {
      const next = [...prev];
      const [moved] = next.splice(fromIdx, 1);
      next.splice(dropIdx, 0, moved);
      saveOrder(next);
      return next;
    });
    setDragIdx(null);
    setOverIdx(null);
  }, []);

  const handleDragEnd = useCallback(() => {
    setDragIdx(null);
    setOverIdx(null);
  }, []);

  const scroll = (dir: 'left' | 'right') => {
    scrollRef.current?.scrollBy({ left: dir === 'left' ? -200 : 200, behavior: 'smooth' });
  };

  return (
    <div className="relative flex items-center gap-1">
      {/* Scroll left button - mobile only */}
      <button
        onClick={() => scroll('left')}
        className="sm:hidden shrink-0 p-1 text-muted-foreground hover:text-foreground"
        aria-label="Scroll left"
      >
        <ChevronLeft className="w-4 h-4" />
      </button>

      <div
        ref={scrollRef}
        className="flex gap-1.5 overflow-x-auto scrollbar-hide sm:flex-wrap sm:overflow-visible"
        style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
      >
        {items.map((item, idx) => (
          <div
            key={item.to}
            draggable
            onDragStart={e => handleDragStart(e, idx)}
            onDragOver={e => handleDragOver(e, idx)}
            onDrop={e => handleDrop(e, idx)}
            onDragEnd={handleDragEnd}
            className={`flex items-center transition-all duration-150 shrink-0 ${
              dragIdx === idx ? 'opacity-40 scale-95' : ''
            } ${overIdx === idx && dragIdx !== idx ? 'ring-2 ring-primary/40 rounded-lg' : ''}`}
          >
            <NavLink
              to={item.to}
              className="group flex items-center gap-1 px-2.5 sm:px-3.5 py-1.5 rounded-lg text-[11px] sm:text-xs font-semibold bg-muted text-muted-foreground hover:text-foreground transition-colors whitespace-nowrap"
              activeClassName="bg-primary text-primary-foreground"
            >
              <GripVertical className="w-3 h-3 opacity-0 group-hover:opacity-40 transition-opacity cursor-grab shrink-0 hidden sm:block" />
              {t(item.labelKey)}
            </NavLink>
          </div>
        ))}
      </div>

      {/* Scroll right button - mobile only */}
      <button
        onClick={() => scroll('right')}
        className="sm:hidden shrink-0 p-1 text-muted-foreground hover:text-foreground"
        aria-label="Scroll right"
      >
        <ChevronRight className="w-4 h-4" />
      </button>
    </div>
  );
}
