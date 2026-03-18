import { useState } from 'react';
import { Calendar, ChevronDown } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar as CalendarComponent } from '@/components/ui/calendar';
import { format, subDays } from 'date-fns';
import { it } from 'date-fns/locale';
import { CustomerType } from '@/types/analytics';

interface FilterBarProps {
  customerTypeFilter: CustomerType | 'all';
  onCustomerTypeChange: (type: CustomerType | 'all') => void;
  dateRange: { start: Date; end: Date };
  onDateRangeChange: (range: { start: Date; end: Date }) => void;
}

export function FilterBar({
  customerTypeFilter,
  onCustomerTypeChange,
  dateRange,
  onDateRangeChange,
}: FilterBarProps) {
  const [calendarOpen, setCalendarOpen] = useState(false);

  const presets = [
    { label: '7g', days: 7 },
    { label: '30g', days: 30 },
    { label: '90g', days: 90 },
    { label: '1a', days: 365 },
  ];

  return (
    <div className="flex flex-wrap items-center gap-3">
      {/* Type toggle */}
      <div className="flex rounded-lg bg-muted/60 p-0.5 gap-0.5">
        {(['all', 'B2C', 'B2B'] as const).map(type => {
          const isActive = customerTypeFilter === type;
          const b2cActive = type === 'B2C' && isActive;
          const b2bActive = type === 'B2B' && isActive;
          return (
            <button
              key={type}
              onClick={() => onCustomerTypeChange(type)}
              className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-all duration-150 ${
                isActive && type === 'all'
                  ? 'bg-primary text-primary-foreground shadow-sm'
                  : !isActive
                  ? 'text-muted-foreground hover:text-foreground'
                  : ''
              }`}
              style={
                b2cActive
                  ? { background: 'hsl(168,70%,14%)', color: 'hsl(168,70%,60%)', border: '1px solid hsl(168,70%,26%)', boxShadow: '0 0 8px hsl(168,70%,30%/0.4)' }
                  : b2bActive
                  ? { background: 'hsl(42,96%,12%)', color: 'hsl(42,96%,62%)', border: '1px solid hsl(42,90%,26%)', boxShadow: '0 0 8px hsl(42,96%,36%/0.4)' }
                  : {}
              }
            >
              {type === 'all' ? 'Tutti' : type}
            </button>
          );
        })}
      </div>

      {/* Quick presets */}
      <div className="flex rounded-md bg-muted p-0.5">
        {presets.map(p => (
          <button
            key={p.days}
            onClick={() => onDateRangeChange({ start: subDays(new Date(), p.days), end: new Date() })}
            className="px-2.5 py-1.5 text-xs text-muted-foreground hover:text-foreground rounded transition-colors"
          >
            {p.label}
          </button>
        ))}
      </div>

      {/* Date range picker */}
      <Popover open={calendarOpen} onOpenChange={setCalendarOpen}>
        <PopoverTrigger asChild>
          <Button variant="ghost" size="sm" className="text-xs text-muted-foreground hover:text-foreground gap-1.5">
            <Calendar className="w-3.5 h-3.5" />
            {format(dateRange.start, 'dd MMM', { locale: it })} – {format(dateRange.end, 'dd MMM yy', { locale: it })}
            <ChevronDown className="w-3 h-3" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-0 bg-popover border-border" align="start">
          <div className="flex">
            <div className="border-r border-border">
              <CalendarComponent
                mode="single"
                selected={dateRange.start}
                onSelect={date => date && onDateRangeChange({ ...dateRange, start: date })}
                locale={it}
              />
            </div>
            <CalendarComponent
              mode="single"
              selected={dateRange.end}
              onSelect={date => date && onDateRangeChange({ ...dateRange, end: date })}
              locale={it}
            />
          </div>
        </PopoverContent>
      </Popover>
    </div>
  );
}
