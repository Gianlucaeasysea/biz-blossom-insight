import { useMemo, useState, useCallback } from 'react';
import { ComposableMap, Geographies, Geography, ZoomableGroup } from 'react-simple-maps';
import { format } from 'date-fns';
import { it } from 'date-fns/locale';
import { Order } from '@/types/analytics';
import { ZoomIn, ZoomOut, RotateCcw } from 'lucide-react';

const GEO_URL = 'https://cdn.jsdelivr.net/npm/world-atlas@2/countries-110m.json';

// Mapping country names (English + Italian variants) → ISO alpha-2
const COUNTRY_NAME_TO_ISO = new Map<string, string>([
  // Italian names
  ['Italia', 'IT'], ['Francia', 'FR'], ['Germania', 'DE'], ['Spagna', 'ES'],
  ['Regno Unito', 'GB'], ['Stati Uniti', 'US'], ['Svizzera', 'CH'],
  ['Paesi Bassi', 'NL'], ['Olanda', 'NL'], ['Belgio', 'BE'], ['Austria', 'AT'],
  ['Portogallo', 'PT'], ['Svezia', 'SE'], ['Norvegia', 'NO'], ['Danimarca', 'DK'],
  ['Finlandia', 'FI'], ['Polonia', 'PL'], ['Repubblica Ceca', 'CZ'],
  ['Ungheria', 'HU'], ['Romania', 'RO'], ['Grecia', 'GR'], ['Croazia', 'HR'],
  ['Slovenia', 'SI'], ['Slovacchia', 'SK'], ['Bulgaria', 'BG'], ['Serbia', 'RS'],
  ['Ucraina', 'UA'], ['Russia', 'RU'], ['Turchia', 'TR'], ['Giappone', 'JP'],
  ['Cina', 'CN'], ['Corea del Sud', 'KR'], ['India', 'IN'], ['Australia', 'AU'],
  ['Canada', 'CA'], ['Brasile', 'BR'], ['Messico', 'MX'], ['Argentina', 'AR'],
  ['Sudafrica', 'ZA'], ['Sud Africa', 'ZA'], ['Emirati Arabi Uniti', 'AE'],
  ['Arabia Saudita', 'SA'], ['Israele', 'IL'], ['Lussemburgo', 'LU'],
  ['Irlanda', 'IE'], ['Malta', 'MT'], ['Cipro', 'CY'], ['Estonia', 'EE'],
  ['Lettonia', 'LV'], ['Lituania', 'LT'],
  // English names
  ['Italy', 'IT'], ['France', 'FR'], ['Germany', 'DE'], ['Spain', 'ES'],
  ['United Kingdom', 'GB'], ['United States', 'US'], ['Switzerland', 'CH'],
  ['Netherlands', 'NL'], ['Belgium', 'BE'], ['Portugal', 'PT'],
  ['Sweden', 'SE'], ['Norway', 'NO'], ['Denmark', 'DK'], ['Finland', 'FI'],
  ['Poland', 'PL'], ['Czech Republic', 'CZ'], ['Hungary', 'HU'],
  ['Greece', 'GR'], ['Croatia', 'HR'], ['Slovenia', 'SI'], ['Slovakia', 'SK'],
  ['Ukraine', 'UA'], ['Turkey', 'TR'], ['Japan', 'JP'], ['China', 'CN'],
  ['South Korea', 'KR'], ['Brazil', 'BR'], ['Mexico', 'MX'],
  ['South Africa', 'ZA'], ['United Arab Emirates', 'AE'], ['Saudi Arabia', 'SA'],
  ['Israel', 'IL'], ['Luxembourg', 'LU'], ['Ireland', 'IE'], ['Cyprus', 'CY'],
  ['Latvia', 'LV'], ['Lithuania', 'LT'],
]);

// Map GeoJSON country name → ISO alpha-2
const GEO_NAME_TO_ISO: Record<string, string> = {
  'Italy': 'IT', 'France': 'FR', 'Germany': 'DE', 'Spain': 'ES',
  'United Kingdom': 'GB', 'United States of America': 'US', 'Switzerland': 'CH',
  'Netherlands': 'NL', 'Belgium': 'BE', 'Austria': 'AT', 'Portugal': 'PT',
  'Sweden': 'SE', 'Norway': 'NO', 'Denmark': 'DK', 'Finland': 'FI',
  'Poland': 'PL', 'Czech Republic': 'CZ', 'Czechia': 'CZ', 'Hungary': 'HU',
  'Romania': 'RO', 'Greece': 'GR', 'Croatia': 'HR', 'Slovenia': 'SI',
  'Slovakia': 'SK', 'Bulgaria': 'BG', 'Serbia': 'RS', 'Ukraine': 'UA',
  'Russia': 'RU', 'Turkey': 'TR', 'Japan': 'JP', 'China': 'CN',
  'South Korea': 'KR', 'India': 'IN', 'Australia': 'AU', 'Canada': 'CA',
  'Brazil': 'BR', 'Mexico': 'MX', 'Argentina': 'AR', 'South Africa': 'ZA',
  'United Arab Emirates': 'AE', 'Saudi Arabia': 'SA', 'Israel': 'IL',
  'Luxembourg': 'LU', 'Ireland': 'IE', 'Malta': 'MT', 'Cyprus': 'CY',
  'Estonia': 'EE', 'Latvia': 'LV', 'Lithuania': 'LT',
};

interface TooltipState {
  x: number;
  y: number;
  country: string;
  sales: number;
  orders: number;
}

interface B2CSalesHeatmapProps {
  orders: Order[];
  dateRange: { start: Date; end: Date };
}

const fmtCurrency = (v: number) =>
  new Intl.NumberFormat('it-IT', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(v);

export function B2CSalesHeatmap({ orders, dateRange }: B2CSalesHeatmapProps) {
  const [zoom, setZoom] = useState(1);
  const [center, setCenter] = useState<[number, number]>([10, 45]);
  const [tooltip, setTooltip] = useState<TooltipState | null>(null);

  // Aggregate B2C sales by ISO country code
  const { salesByIso, maxSales, topCountries } = useMemo(() => {
    const b2cOrders = orders.filter(o => o.customerType === 'B2C');
    const byIso: Record<string, { sales: number; orders: number; name: string }> = {};

    b2cOrders.forEach(o => {
      const rawName = o.destinationCountry || o.country || '';
      const iso = COUNTRY_NAME_TO_ISO[rawName] || rawName.toUpperCase().slice(0, 2);
      if (!iso || iso.length !== 2) return;
      const amount = o.netAmount ?? o.totalAmount;
      if (!byIso[iso]) byIso[iso] = { sales: 0, orders: 0, name: rawName };
      byIso[iso].sales += amount;
      byIso[iso].orders += 1;
    });

    const maxSales = Math.max(...Object.values(byIso).map(v => v.sales), 1);
    const topCountries = Object.entries(byIso)
      .sort((a, b) => b[1].sales - a[1].sales)
      .slice(0, 20);

    return { salesByIso: byIso, maxSales, topCountries };
  }, [orders]);

  const getCountryColor = useCallback((geoName: string, isoA2: string) => {
    const iso = isoA2 || GEO_NAME_TO_ISO[geoName] || '';
    const data = salesByIso[iso];
    if (!data || data.sales === 0) return 'hsl(218 25% 14%)';
    const t = data.sales / maxSales;
    const lightness = Math.round(55 - t * 38);
    const saturation = Math.round(50 + t * 35);
    return `hsl(215 ${saturation}% ${lightness}%)`;
  }, [salesByIso, maxSales]);

  const periodLabel = `${format(dateRange.start, 'dd MMM', { locale: it })} – ${format(dateRange.end, 'dd MMM yyyy', { locale: it })}`;

  return (
    <div className="chart-container">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
        <div>
          <h3 className="text-sm font-semibold">Mappa Vendite B2C per Paese</h3>
          <p className="text-xs text-muted-foreground mt-0.5">{periodLabel}</p>
        </div>
        <div className="flex items-center gap-1.5">
          <button
            onClick={() => setZoom(z => Math.min(z * 1.5, 8))}
            className="p-1.5 rounded-md border border-border/50 bg-muted/50 hover:bg-muted text-foreground transition-colors"
            title="Zoom in"
          >
            <ZoomIn className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={() => setZoom(z => Math.max(z / 1.5, 1))}
            className="p-1.5 rounded-md border border-border/50 bg-muted/50 hover:bg-muted text-foreground transition-colors"
            title="Zoom out"
          >
            <ZoomOut className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={() => { setZoom(1); setCenter([10, 45]); }}
            className="p-1.5 rounded-md border border-border/50 bg-muted/50 hover:bg-muted text-foreground transition-colors"
            title="Reset"
          >
            <RotateCcw className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Map */}
      <div
        className="relative rounded-lg overflow-hidden border border-border/30"
        style={{ background: 'hsl(218 35% 5%)' }}
        onMouseLeave={() => setTooltip(null)}
      >
        <ComposableMap
          projectionConfig={{ scale: 140, center }}
          style={{ width: '100%', height: 'auto' }}
          height={420}
        >
          <ZoomableGroup
            zoom={zoom}
            center={center}
            onMoveEnd={({ zoom: z, coordinates }) => {
              setZoom(z);
              setCenter(coordinates);
            }}
          >
            <Geographies geography={GEO_URL}>
              {({ geographies }) =>
                geographies.map(geo => {
                  const geoName = geo.properties.NAME || geo.properties.name || '';
                  const isoA2 = geo.properties.ISO_A2 || GEO_NAME_TO_ISO[geoName] || '';
                  const data = salesByIso[isoA2];
                  return (
                    <Geography
                      key={geo.rsmKey}
                      geography={geo}
                      fill={getCountryColor(geoName, isoA2)}
                      stroke="hsl(218 25% 20%)"
                      strokeWidth={0.5}
                      style={{
                        default: { outline: 'none' },
                        hover: {
                          outline: 'none',
                          fill: data
                            ? `hsl(25 95% 55%)`
                            : 'hsl(218 25% 20%)',
                          cursor: data ? 'pointer' : 'default',
                        },
                        pressed: { outline: 'none' },
                      }}
                      onMouseEnter={e => {
                        if (!data) return;
                        setTooltip({
                          x: e.clientX,
                          y: e.clientY,
                          country: data.name || geoName,
                          sales: data.sales,
                          orders: data.orders,
                        });
                      }}
                      onMouseMove={e => {
                        if (!data) return;
                        setTooltip(t => t ? { ...t, x: e.clientX, y: e.clientY } : null);
                      }}
                      onMouseLeave={() => setTooltip(null)}
                    />
                  );
                })
              }
            </Geographies>
          </ZoomableGroup>
        </ComposableMap>

        {/* Tooltip */}
        {tooltip && (
          <div
            className="fixed z-50 pointer-events-none px-3 py-2 rounded-lg shadow-xl text-xs"
            style={{
              left: tooltip.x + 12,
              top: tooltip.y - 10,
              background: 'hsl(218 30% 12%)',
              border: '1px solid hsl(218 25% 22%)',
              transform: 'translateY(-100%)',
            }}
          >
            <p className="font-semibold text-foreground mb-1">{tooltip.country}</p>
            <p className="text-primary font-mono">{fmtCurrency(tooltip.sales)}</p>
            <p className="text-muted-foreground">{tooltip.orders} ordini</p>
          </div>
        )}

        {/* Hint */}
        <p className="absolute bottom-2 left-3 text-[10px] text-muted-foreground/50 select-none">
          Trascina per spostarti · Scroll per zoom
        </p>
      </div>

      {/* Legend + Top Countries */}
      <div className="mt-4 flex flex-col sm:flex-row gap-4 items-start justify-between">
        {/* Color scale */}
        <div className="flex items-center gap-2">
          <span className="text-xs text-muted-foreground">Nessuna vendita</span>
          <div className="flex gap-0.5">
            {[0.05, 0.2, 0.4, 0.6, 0.8, 1].map(v => {
              const t = v;
              const l = Math.round(55 - t * 38);
              const s = Math.round(50 + t * 35);
              return (
                <div
                  key={v}
                  className="w-5 h-3 rounded-sm"
                  style={{ backgroundColor: `hsl(215 ${s}% ${l}%)` }}
                />
              );
            })}
          </div>
          <span className="text-xs text-muted-foreground">Massimo</span>
        </div>

        {/* Top 5 countries */}
        {topCountries.length > 0 && (
          <div className="flex flex-wrap gap-x-4 gap-y-1">
            {topCountries.slice(0, 5).map(([iso, data]) => (
              <div key={iso} className="flex items-center gap-1.5 text-xs">
                <div
                  className="w-2.5 h-2.5 rounded-sm shrink-0"
                  style={{ backgroundColor: getCountryColor('', iso) }}
                />
                <span className="text-muted-foreground">{data.name}</span>
                <span className="font-mono text-foreground">{fmtCurrency(data.sales)}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
