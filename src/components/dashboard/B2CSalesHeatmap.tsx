import { useMemo, useState, useRef, useCallback } from 'react';
import {
  ComposableMap, Geographies, Geography, Marker, ZoomableGroup,
} from 'react-simple-maps';
import { format } from 'date-fns';
import { it } from 'date-fns/locale';
import { Order } from '@/types/analytics';
import { ZoomIn, ZoomOut, RotateCcw, MapPin, Filter } from 'lucide-react';

// ─── GeoJSON source ────────────────────────────────────────────────────────────
const GEO_URL = 'https://cdn.jsdelivr.net/npm/world-atlas@2/countries-110m.json';

// ─── ISO 3166-1 numeric-3 → alpha-2 ──────────────────────────────────────────
const NUM_TO_A2: Record<string, string> = {
  '004':'AF','008':'AL','012':'DZ','024':'AO','032':'AR','036':'AU','040':'AT',
  '050':'BD','056':'BE','068':'BO','076':'BR','100':'BG','124':'CA','144':'LK',
  '152':'CL','156':'CN','170':'CO','191':'HR','196':'CY','203':'CZ','208':'DK',
  '218':'EC','231':'ET','233':'EE','246':'FI','250':'FR','276':'DE','288':'GH',
  '300':'GR','320':'GT','348':'HU','356':'IN','360':'ID','364':'IR','372':'IE',
  '376':'IL','380':'IT','388':'JM','392':'JP','400':'JO','404':'KE','410':'KR',
  '414':'KW','428':'LV','440':'LT','442':'LU','458':'MY','470':'MT','484':'MX',
  '504':'MA','524':'NP','528':'NL','554':'NZ','566':'NG','578':'NO','586':'PK',
  '591':'PA','604':'PE','608':'PH','616':'PL','620':'PT','634':'QA','642':'RO',
  '643':'RU','682':'SA','703':'SK','705':'SI','710':'ZA','716':'ZW','724':'ES',
  '752':'SE','756':'CH','764':'TH','784':'AE','792':'TR','804':'UA','818':'EG',
  '826':'GB','840':'US','858':'UY','862':'VE','704':'VN','887':'YE',
  '031':'AZ','051':'AM','070':'BA','112':'BY','116':'KH','158':'TW','188':'CR',
  '214':'DO','268':'GE','340':'HN','398':'KZ','417':'KG','496':'MN','498':'MD',
  '499':'ME','562':'NE','600':'PY','688':'RS','694':'SL','706':'SO','728':'SS',
  '748':'SZ','760':'SY','800':'UG','807':'MK','860':'UZ','894':'ZM',
  '702':'SG','344':'HK',
};

// ─── ISO 3166-1 numeric-3 → country name (IT) ────────────────────────────────
const NUM_TO_NAME: Record<string, string> = {
  '004':'Afghanistan','008':'Albania','012':'Algeria','024':'Angola','032':'Argentina',
  '036':'Australia','040':'Austria','050':'Bangladesh','056':'Belgio','068':'Bolivia',
  '076':'Brasile','100':'Bulgaria','124':'Canada','144':'Sri Lanka','152':'Cile',
  '156':'Cina','170':'Colombia','191':'Croazia','196':'Cipro','203':'Rep. Ceca',
  '208':'Danimarca','218':'Ecuador','233':'Estonia','246':'Finlandia','250':'Francia',
  '276':'Germania','288':'Ghana','300':'Grecia','320':'Guatemala','348':'Ungheria',
  '356':'India','360':'Indonesia','364':'Iran','372':'Irlanda','376':'Israele',
  '380':'Italia','392':'Giappone','400':'Giordania','404':'Kenya','410':'Corea del Sud',
  '414':'Kuwait','428':'Lettonia','440':'Lituania','442':'Lussemburgo','458':'Malaysia',
  '470':'Malta','484':'Messico','504':'Marocco','524':'Nepal','528':'Paesi Bassi',
  '554':'Nuova Zelanda','566':'Nigeria','578':'Norvegia','586':'Pakistan','604':'Perù',
  '608':'Filippine','616':'Polonia','620':'Portogallo','634':'Qatar','642':'Romania',
  '643':'Russia','682':'Arabia Saudita','703':'Slovacchia','705':'Slovenia',
  '710':'Sudafrica','724':'Spagna','752':'Svezia','756':'Svizzera','764':'Tailandia',
  '784':'Emirati Arabi','792':'Turchia','804':'Ucraina','818':'Egitto',
  '826':'Regno Unito','840':'Stati Uniti','858':'Uruguay','862':'Venezuela',
  '704':'Vietnam','716':'Zimbabwe','702':'Singapore','344':'Hong Kong',
  '070':'Bosnia Erzegovina','807':'Macedonia del Nord','499':'Montenegro','688':'Serbia',
  '112':'Bielorussia','268':'Georgia','398':'Kazakistan','051':'Armenia','031':'Azerbaigian',
};

// ─── Country name (order field) → ISO alpha-2 ─────────────────────────────────
const NAME_TO_A2: Record<string, string> = {
  'Italia':'IT','Italy':'IT','Italie':'IT',
  'Francia':'FR','France':'FR',
  'Germania':'DE','Germany':'DE','Deutschland':'DE',
  'Spagna':'ES','Spain':'ES','España':'ES',
  'Regno Unito':'GB','United Kingdom':'GB','UK':'GB','Gran Bretagna':'GB',
  'Stati Uniti':'US','United States':'US','USA':'US','United States of America':'US',
  'Svizzera':'CH','Switzerland':'CH','Suisse':'CH',
  'Paesi Bassi':'NL','Netherlands':'NL','Olanda':'NL','Holland':'NL',
  'Belgio':'BE','Belgium':'BE',
  'Austria':'AT',
  'Portogallo':'PT','Portugal':'PT',
  'Svezia':'SE','Sweden':'SE',
  'Norvegia':'NO','Norway':'NO',
  'Danimarca':'DK','Denmark':'DK',
  'Finlandia':'FI','Finland':'FI',
  'Polonia':'PL','Poland':'PL',
  'Repubblica Ceca':'CZ','Rep. Ceca':'CZ','Czech Republic':'CZ','Czechia':'CZ',
  'Ungheria':'HU','Hungary':'HU',
  'Romania':'RO',
  'Grecia':'GR','Greece':'GR',
  'Croazia':'HR','Croatia':'HR',
  'Slovenia':'SI',
  'Slovacchia':'SK','Slovakia':'SK',
  'Bulgaria':'BG',
  'Serbia':'RS',
  'Ucraina':'UA','Ukraine':'UA',
  'Russia':'RU',
  'Turchia':'TR','Turkey':'TR',
  'Giappone':'JP','Japan':'JP',
  'Cina':'CN','China':'CN',
  'Corea del Sud':'KR','South Korea':'KR',
  'India':'IN',
  'Australia':'AU',
  'Canada':'CA',
  'Brasile':'BR','Brazil':'BR',
  'Messico':'MX','Mexico':'MX',
  'Argentina':'AR',
  'Sudafrica':'ZA','Sud Africa':'ZA','South Africa':'ZA',
  'Emirati Arabi Uniti':'AE','Emirati Arabi':'AE','United Arab Emirates':'AE','UAE':'AE',
  'Arabia Saudita':'SA','Saudi Arabia':'SA',
  'Israele':'IL','Israel':'IL',
  'Lussemburgo':'LU','Luxembourg':'LU',
  'Irlanda':'IE','Ireland':'IE',
  'Malta':'MT',
  'Cipro':'CY','Cyprus':'CY',
  'Estonia':'EE',
  'Lettonia':'LV','Latvia':'LV',
  'Lituania':'LT','Lithuania':'LT',
  'Singapore':'SG',
  'Malaysia':'MY',
  'Nuova Zelanda':'NZ','New Zealand':'NZ',
  'Marocco':'MA','Morocco':'MA',
};

// ─── City coordinates lookup ───────────────────────────────────────────────────
const CITY_COORDS: Record<string, [number, number]> = {
  // Italy
  'Roma':[12.4964,41.9028],'Rome':[12.4964,41.9028],
  'Milano':[9.1900,45.4654],'Milan':[9.1900,45.4654],
  'Napoli':[14.2681,40.8518],'Naples':[14.2681,40.8518],
  'Torino':[7.6869,45.0703],'Turin':[7.6869,45.0703],
  'Firenze':[11.2558,43.7696],'Florence':[11.2558,43.7696],
  'Venezia':[12.3155,45.4408],'Venice':[12.3155,45.4408],
  'Genova':[8.9463,44.4056],'Genoa':[8.9463,44.4056],
  'Bologna':[11.3426,44.4949],
  'Palermo':[13.3614,38.1157],
  'Bari':[16.8719,41.1177],
  'Catania':[15.0873,37.5023],
  'Verona':[10.9916,45.4384],
  'Padova':[11.8768,45.4064],
  'Trieste':[13.7681,45.6496],
  'Brescia':[10.2118,45.5416],
  'Bergamo':[9.6773,45.6983],
  // France
  'Paris':[2.3522,48.8566],'Parigi':[2.3522,48.8566],
  'Lyon':[4.8357,45.7640],'Lione':[4.8357,45.7640],
  'Marseille':[5.3698,43.2965],'Marsiglia':[5.3698,43.2965],
  'Nice':[7.2620,43.7102],'Nizza':[7.2620,43.7102],
  'Bordeaux':[-0.5792,44.8378],
  'Toulouse':[1.4442,43.6047],
  // Germany
  'Berlin':[13.4050,52.5200],'Berlino':[13.4050,52.5200],
  'Munich':[11.5820,48.1351],'Monaco':[11.5820,48.1351],'München':[11.5820,48.1351],
  'Hamburg':[9.9937,53.5753],'Amburgo':[9.9937,53.5753],
  'Frankfurt':[8.6821,50.1109],'Francoforte':[8.6821,50.1109],
  'Cologne':[6.9603,50.9333],'Colonia':[6.9603,50.9333],
  'Düsseldorf':[6.7734,51.2217],
  'Stuttgart':[9.1829,48.7758],
  // Spain
  'Madrid':[-3.7038,40.4168],
  'Barcelona':[2.1734,41.3851],'Barcellona':[2.1734,41.3851],
  'Valencia':[-0.3763,39.4699],
  'Seville':[-5.9845,37.3891],'Siviglia':[-5.9845,37.3891],
  // UK
  'London':[-0.1276,51.5074],'Londra':[-0.1276,51.5074],
  'Manchester':[-2.2426,53.4808],
  'Birmingham':[-1.8904,52.4862],
  'Edinburgh':[-3.1883,55.9533],
  // US
  'New York':[-74.0060,40.7128],
  'Los Angeles':[-118.2437,34.0522],
  'Chicago':[-87.6298,41.8781],
  'Miami':[-80.1918,25.7617],
  'San Francisco':[-122.4194,37.7749],
  'Seattle':[-122.3321,47.6062],
  'Boston':[-71.0589,42.3601],
  // Others
  'Amsterdam':[4.9041,52.3676],
  'Brussels':[4.3517,50.8503],'Bruxelles':[4.3517,50.8503],
  'Vienna':[16.3738,48.2082],'Wien':[16.3738,48.2082],
  'Zurich':[8.5417,47.3769],'Zurigo':[8.5417,47.3769],
  'Geneva':[6.1432,46.2044],'Ginevra':[6.1432,46.2044],
  'Stockholm':[18.0686,59.3293],
  'Oslo':[10.7522,59.9139],
  'Copenhagen':[12.5683,55.6761],
  'Helsinki':[24.9384,60.1699],
  'Warsaw':[21.0122,52.2297],'Varsavia':[21.0122,52.2297],
  'Prague':[14.4378,50.0755],'Praga':[14.4378,50.0755],
  'Budapest':[19.0402,47.4979],
  'Bucharest':[26.1025,44.4268],'Bucarest':[26.1025,44.4268],
  'Athens':[23.7275,37.9838],'Atene':[23.7275,37.9838],
  'Lisbon':[-9.1393,38.7223],'Lisbona':[-9.1393,38.7223],
  'Tokyo':[139.6917,35.6895],
  'Sydney':[151.2093,-33.8688],
  'Toronto':[-79.3832,43.6532],
  'Dubai':[55.2708,25.2048],
  'Singapore':[103.8198,1.3521],
};

// ─── Color helpers ────────────────────────────────────────────────────────────
function salesColor(t: number): string {
  // t in [0,1]: 0 = no sales (dark), 1 = max (bright)
  if (t <= 0) return 'hsl(220,18%,13%)';
  const h = 210 - t * 20;          // 210 → 190
  const s = 50 + t * 40;           // 50 → 90
  const l = 25 + t * 40;           // 25 → 65
  return `hsl(${h},${s}%,${l}%)`;
}

const fmtCurrency = (v: number) =>
  new Intl.NumberFormat('it-IT', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(v);

// ─── Types ────────────────────────────────────────────────────────────────────
interface CountryData { iso: string; name: string; sales: number; orders: number }
interface CityData { city: string; province: string; iso: string; sales: number; orders: number; coords?: [number, number] }
interface TooltipState { x: number; y: number; content: React.ReactNode }

interface B2CSalesHeatmapProps {
  orders: Order[];
  dateRange: { start: Date; end: Date };
}

// ─── Component ────────────────────────────────────────────────────────────────
export function B2CSalesHeatmap({ orders, dateRange }: B2CSalesHeatmapProps) {
  const [position, setPosition] = useState<{ zoom: number; coordinates: [number, number] }>({
    zoom: 1,
    coordinates: [10, 45],
  });
  const [selectedSku, setSelectedSku] = useState<string>('all');
  const [tooltip, setTooltip] = useState<TooltipState | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // ── Available SKUs (B2C only)
  const skuOptions = useMemo(() => {
    const map = new Map<string, string>();
    orders.filter(o => o.customerType === 'B2C').forEach(o =>
      o.products.forEach(p => { if (!map.has(p.sku)) map.set(p.sku, p.name || p.sku); })
    );
    return Array.from(map.entries()).sort((a, b) => a[1].localeCompare(b[1]));
  }, [orders]);

  // ── Aggregate sales by ISO alpha-2 and by city
  const { salesByIso, maxSales, cityData, topCountries } = useMemo(() => {
    const byIso: Record<string, CountryData> = {};
    const byCity: Record<string, CityData> = {};

    orders.filter(o => o.customerType === 'B2C').forEach(o => {
      let amount: number;
      if (selectedSku === 'all') {
        amount = o.netAmount ?? o.totalAmount;
      } else {
        const prod = o.products.find(p => p.sku === selectedSku);
        if (!prod) return;
        amount = prod.totalPrice;
      }
      if (amount <= 0) return;

      const rawCountry = o.destinationCountry || o.country || '';
      const iso = NAME_TO_A2[rawCountry] || (rawCountry.length === 2 ? rawCountry.toUpperCase() : '');
      if (!iso) return;

      if (!byIso[iso]) byIso[iso] = { iso, name: rawCountry, sales: 0, orders: 0 };
      byIso[iso].sales += amount;
      byIso[iso].orders++;

      // City level
      const city = o.destinationCity || '';
      if (city) {
        const key = `${iso}:${city}`;
        if (!byCity[key]) {
          const coords = CITY_COORDS[city] as [number, number] | undefined;
          byCity[key] = { city, province: o.destinationProvince || '', iso, sales: 0, orders: 0, coords };
        }
        byCity[key].sales += amount;
        byCity[key].orders++;
      }
    });

    const maxSales = Math.max(...Object.values(byIso).map(v => v.sales), 1);
    const topCountries = Object.values(byIso).sort((a, b) => b.sales - a.sales).slice(0, 8);
    const cityData = Object.values(byCity).filter(c => c.coords).sort((a, b) => b.sales - a.sales);

    return { salesByIso: byIso, maxSales, cityData, topCountries };
  }, [orders, selectedSku]);

  // ── Mouse tooltip helpers
  const showTooltip = useCallback((e: React.MouseEvent, content: React.ReactNode) => {
    const rect = containerRef.current?.getBoundingClientRect();
    if (!rect) return;
    setTooltip({ x: e.clientX - rect.left, y: e.clientY - rect.top, content });
  }, []);

  const moveTooltip = useCallback((e: React.MouseEvent) => {
    const rect = containerRef.current?.getBoundingClientRect();
    if (!rect || !tooltip) return;
    setTooltip(t => t ? { ...t, x: e.clientX - rect.left, y: e.clientY - rect.top } : null);
  }, [tooltip]);

  // ── Zoom controls
  const handleZoomIn = () => setPosition(p => ({ ...p, zoom: Math.min(p.zoom * 1.6, 10) }));
  const handleZoomOut = () => setPosition(p => ({ ...p, zoom: Math.max(p.zoom / 1.6, 1) }));
  const handleReset = () => setPosition({ zoom: 1, coordinates: [10, 45] });

  const periodLabel = `${format(dateRange.start, 'dd MMM', { locale: it })} – ${format(dateRange.end, 'dd MMM yyyy', { locale: it })}`;
  const showCities = position.zoom >= 3 && cityData.length > 0;

  return (
    <div className="chart-container space-y-4">
      {/* ─ Header ────────────────────────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
        <div>
          <h3 className="text-sm font-semibold text-foreground">Mappa Vendite B2C</h3>
          <p className="text-xs text-muted-foreground mt-0.5">{periodLabel}</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {/* SKU filter */}
          <div className="flex items-center gap-1.5 bg-muted/60 rounded-lg px-2 py-1">
            <Filter className="w-3 h-3 text-muted-foreground shrink-0" />
            <select
              value={selectedSku}
              onChange={e => setSelectedSku(e.target.value)}
              className="bg-transparent text-xs text-foreground outline-none cursor-pointer max-w-[180px]"
            >
              <option value="all">Tutti i prodotti</option>
              {skuOptions.map(([sku, name]) => (
                <option key={sku} value={sku}>{sku} — {name}</option>
              ))}
            </select>
          </div>
          {/* Zoom controls */}
          <div className="flex items-center gap-1">
            {[
              { icon: <ZoomIn className="w-3.5 h-3.5" />, fn: handleZoomIn, title: 'Zoom in' },
              { icon: <ZoomOut className="w-3.5 h-3.5" />, fn: handleZoomOut, title: 'Zoom out' },
              { icon: <RotateCcw className="w-3.5 h-3.5" />, fn: handleReset, title: 'Reset' },
            ].map(({ icon, fn, title }) => (
              <button key={title} onClick={fn} title={title}
                className="p-1.5 rounded-md border border-border/40 bg-muted/40 hover:bg-muted text-foreground transition-colors">
                {icon}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* ─ Map ───────────────────────────────────────────────────────────── */}
      <div
        ref={containerRef}
        className="relative rounded-xl overflow-hidden border border-border/30"
        style={{ background: 'hsl(222,35%,6%)' }}
        onMouseLeave={() => setTooltip(null)}
      >
        <ComposableMap
          projectionConfig={{ scale: 145, center: [10, 20] }}
          style={{ width: '100%', height: 'auto' }}
          height={440}
        >
          <ZoomableGroup
            zoom={position.zoom}
            center={position.coordinates}
            onMoveEnd={({ zoom, coordinates }) =>
              setPosition({ zoom, coordinates: coordinates as [number, number] })
            }
          >
            <Geographies geography={GEO_URL}>
              {({ geographies }) =>
                geographies.map(geo => {
                  const numId = String(geo.id).padStart(3, '0');
                  const iso = NUM_TO_A2[numId] || '';
                  const countryName = NUM_TO_NAME[numId] || iso;
                  const data = salesByIso[iso];
                  const t = data ? data.sales / maxSales : 0;
                  const fill = salesColor(t);
                  const hoverFill = data ? 'hsl(38,96%,58%)' : 'hsl(220,18%,20%)';

                  return (
                    <Geography
                      key={geo.rsmKey}
                      geography={geo}
                      fill={fill}
                      stroke="hsl(220,20%,18%)"
                      strokeWidth={0.4}
                      style={{
                        default: { outline: 'none', transition: 'fill 0.15s ease' },
                        hover: { outline: 'none', fill: hoverFill, cursor: 'pointer' },
                        pressed: { outline: 'none' },
                      }}
                      onMouseEnter={e => {
                        showTooltip(e,
                          <div>
                            <p className="font-semibold text-foreground mb-1">{countryName}</p>
                            {data ? (
                              <>
                                <p className="text-primary font-mono font-bold">{fmtCurrency(data.sales)}</p>
                                <p className="text-muted-foreground">{data.orders} {data.orders === 1 ? 'ordine' : 'ordini'}</p>
                              </>
                            ) : (
                              <p className="text-muted-foreground text-[10px]">Nessuna vendita</p>
                            )}
                          </div>
                        );
                      }}
                      onMouseMove={moveTooltip}
                      onMouseLeave={() => setTooltip(null)}
                    />
                  );
                })
              }
            </Geographies>

            {/* City markers (visible when zoomed in) */}
            {showCities && cityData.map((c, i) => {
              if (!c.coords) return null;
              const t = c.sales / maxSales;
              const r = Math.max(3, Math.min(10, 3 + t * 7)) / position.zoom;
              return (
                <Marker key={i} coordinates={c.coords}>
                  <circle
                    r={r}
                    fill="hsl(38,96%,58%)"
                    fillOpacity={0.85}
                    stroke="hsl(222,35%,6%)"
                    strokeWidth={0.5 / position.zoom}
                    style={{ cursor: 'pointer' }}
                    onMouseEnter={e => {
                      showTooltip(e as unknown as React.MouseEvent,
                        <div>
                          <div className="flex items-center gap-1 mb-1">
                            <MapPin className="w-3 h-3 text-amber-400" />
                            <p className="font-semibold text-foreground">{c.city}</p>
                          </div>
                          {c.province && <p className="text-muted-foreground text-[10px] mb-1">{c.province}</p>}
                          <p className="text-amber-400 font-mono font-bold">{fmtCurrency(c.sales)}</p>
                          <p className="text-muted-foreground">{c.orders} {c.orders === 1 ? 'ordine' : 'ordini'}</p>
                        </div>
                      );
                    }}
                    onMouseMove={e => moveTooltip(e as unknown as React.MouseEvent)}
                    onMouseLeave={() => setTooltip(null)}
                  />
                </Marker>
              );
            })}
          </ZoomableGroup>
        </ComposableMap>

        {/* Tooltip */}
        {tooltip && (
          <div
            className="absolute pointer-events-none z-50 px-3 py-2.5 rounded-xl shadow-2xl text-xs"
            style={{
              left: Math.min(tooltip.x + 14, (containerRef.current?.offsetWidth ?? 400) - 160),
              top: Math.max(tooltip.y - 70, 8),
              background: 'hsl(222,30%,11%)',
              border: '1px solid hsl(220,20%,22%)',
              backdropFilter: 'blur(8px)',
              maxWidth: 180,
            }}
          >
            {tooltip.content}
          </div>
        )}

        {/* Hint */}
        <p className="absolute bottom-2 right-3 text-[10px] text-muted-foreground/40 select-none">
          Scroll/pinch per zoom · Trascina per spostarti
        </p>
        {showCities && (
          <div className="absolute bottom-2 left-3 flex items-center gap-1 text-[10px] text-amber-400/70">
            <MapPin className="w-2.5 h-2.5" />
            <span>Dettaglio città attivo</span>
          </div>
        )}
      </div>

      {/* ─ Bottom: Legend + Top countries ────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row gap-4 items-start justify-between">
        {/* Color scale */}
        <div className="flex items-center gap-2 shrink-0">
          <span className="text-[10px] text-muted-foreground whitespace-nowrap">Nessuna</span>
          <div className="flex gap-px rounded overflow-hidden">
            {[0, 0.15, 0.35, 0.55, 0.75, 1].map(v => (
              <div key={v} className="w-6 h-3" style={{ backgroundColor: salesColor(v) }} />
            ))}
          </div>
          <span className="text-[10px] text-muted-foreground whitespace-nowrap">Massimo</span>
        </div>

        {/* Top countries */}
        {topCountries.length > 0 && (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-x-6 gap-y-1.5 w-full sm:w-auto">
            {topCountries.map((c, i) => (
              <div key={c.iso} className="flex items-center gap-2 text-xs min-w-0">
                <span className="text-muted-foreground/60 font-mono w-4 shrink-0">{i + 1}.</span>
                <div
                  className="w-2 h-2 rounded-sm shrink-0"
                  style={{ backgroundColor: salesColor(c.sales / maxSales) }}
                />
                <span className="text-muted-foreground truncate">{c.name}</span>
                <span className="font-mono text-foreground ml-auto shrink-0">{fmtCurrency(c.sales)}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
