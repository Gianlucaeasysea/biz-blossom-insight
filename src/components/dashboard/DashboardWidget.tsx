import { useState, ReactNode } from 'react';
import { ChevronDown, ChevronUp, GripVertical } from 'lucide-react';
import { cn } from '@/lib/utils';

interface DashboardWidgetProps {
  title: string;
  subtitle?: string;
  children: ReactNode;
  defaultCollapsed?: boolean;
  className?: string;
}

export function DashboardWidget({ title, subtitle, children, defaultCollapsed = false, className }: DashboardWidgetProps) {
  const [collapsed, setCollapsed] = useState(defaultCollapsed);

  return (
    <div className={cn('glass-card flex flex-col h-full overflow-hidden', className)}>
      {/* Header - always visible, acts as drag handle */}
      <div className="flex items-center gap-2 px-3 py-2 border-b border-border/50 cursor-grab active:cursor-grabbing drag-handle shrink-0 select-none">
        <GripVertical className="w-3.5 h-3.5 text-muted-foreground/50 shrink-0" />
        <div className="flex-1 min-w-0">
          <h3 className="text-xs font-semibold truncate">{title}</h3>
          {subtitle && <p className="text-[10px] text-muted-foreground truncate">{subtitle}</p>}
        </div>
        <button
          onClick={(e) => { e.stopPropagation(); setCollapsed(c => !c); }}
          className="p-1 rounded hover:bg-muted/50 transition-colors text-muted-foreground hover:text-foreground shrink-0"
          title={collapsed ? 'Espandi' : 'Comprimi'}
        >
          {collapsed ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronUp className="w-3.5 h-3.5" />}
        </button>
      </div>
      {/* Content */}
      {!collapsed && (
        <div className="flex-1 overflow-auto p-3 min-h-0">
          {children}
        </div>
      )}
    </div>
  );
}
