import { useState } from 'react';
import { motion } from 'framer-motion';
import { Calendar, Filter, Download, Bookmark, ChevronDown } from 'lucide-react';
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

  const datePresets = [
    { label: 'Ultimi 7 giorni', days: 7 },
    { label: 'Ultimi 30 giorni', days: 30 },
    { label: 'Ultimi 90 giorni', days: 90 },
    { label: 'Ultimo anno', days: 365 },
  ];

  const handlePresetClick = (days: number) => {
    onDateRangeChange({
      start: subDays(new Date(), days),
      end: new Date(),
    });
    setCalendarOpen(false);
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: -10 }}
      animate={{ opacity: 1, y: 0 }}
      className="glass-card p-4 flex flex-wrap items-center gap-4"
    >
      {/* Customer Type Toggle */}
      <div className="flex items-center gap-2">
        <span className="text-sm text-muted-foreground mr-2">Visualizza:</span>
        <div className="flex rounded-lg bg-muted/50 p-1">
          {(['all', 'B2C', 'B2B'] as const).map((type) => (
            <button
              key={type}
              onClick={() => onCustomerTypeChange(type)}
              className={`px-4 py-2 rounded-md text-sm font-medium transition-all duration-200 ${
                customerTypeFilter === type
                  ? 'bg-primary text-primary-foreground shadow-sm'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              {type === 'all' ? 'Tutti' : type}
            </button>
          ))}
        </div>
      </div>

      {/* Date Range */}
      <Popover open={calendarOpen} onOpenChange={setCalendarOpen}>
        <PopoverTrigger asChild>
          <Button variant="outline" className="flex items-center gap-2 bg-muted/50 border-border/50">
            <Calendar className="w-4 h-4" />
            <span className="text-sm">
              {format(dateRange.start, 'dd MMM', { locale: it })} - {format(dateRange.end, 'dd MMM yyyy', { locale: it })}
            </span>
            <ChevronDown className="w-4 h-4" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-0 bg-popover border-border" align="start">
          <div className="p-3 border-b border-border">
            <div className="flex flex-wrap gap-2">
              {datePresets.map((preset) => (
                <button
                  key={preset.days}
                  onClick={() => handlePresetClick(preset.days)}
                  className="px-3 py-1.5 text-xs rounded-md bg-muted hover:bg-muted/80 transition-colors"
                >
                  {preset.label}
                </button>
              ))}
            </div>
          </div>
          <div className="flex">
            <div className="border-r border-border">
              <CalendarComponent
                mode="single"
                selected={dateRange.start}
                onSelect={(date) => date && onDateRangeChange({ ...dateRange, start: date })}
                locale={it}
              />
            </div>
            <div>
              <CalendarComponent
                mode="single"
                selected={dateRange.end}
                onSelect={(date) => date && onDateRangeChange({ ...dateRange, end: date })}
                locale={it}
              />
            </div>
          </div>
        </PopoverContent>
      </Popover>

      {/* Spacer */}
      <div className="flex-1" />

      {/* Action Buttons */}
      <div className="flex items-center gap-2">
        <Button variant="ghost" size="sm" className="text-muted-foreground">
          <Filter className="w-4 h-4 mr-2" />
          Altri filtri
        </Button>
        <Button variant="ghost" size="sm" className="text-muted-foreground">
          <Bookmark className="w-4 h-4 mr-2" />
          Salva vista
        </Button>
        <Button variant="ghost" size="sm" className="text-muted-foreground">
          <Download className="w-4 h-4 mr-2" />
          Esporta
        </Button>
      </div>
    </motion.div>
  );
}
