import { useState, useMemo } from 'react';
import { ArrowUpDown, Globe, Download } from 'lucide-react';
import { Order } from '@/types/analytics';
import { downloadCsv } from '@/lib/csv-export';

// ─── Comprehensive country code / name → display name (IT) ───────────────
const COUNTRY_MAP: Record<string, string> = {
  'IT':'Italia','FR':'Francia','DE':'Germania','ES':'Spagna','GB':'Regno Unito',
  'UK':'Regno Unito','US':'Stati Uniti','USA':'Stati Uniti',
  'CH':'Svizzera','NL':'Paesi Bassi','BE':'Belgio','AT':'Austria',
  'PT':'Portogallo','SE':'Svezia','NO':'Norvegia','DK':'Danimarca',
  'FI':'Finlandia','PL':'Polonia','CZ':'Rep. Ceca','HU':'Ungheria',
  'RO':'Romania','GR':'Grecia','HR':'Croazia','SI':'Slovenia',
  'SK':'Slovacchia','BG':'Bulgaria','RS':'Serbia','UA':'Ucraina',
  'RU':'Russia','TR':'Turchia','JP':'Giappone','CN':'Cina',
  'KR':'Corea del Sud','IN':'India','AU':'Australia','CA':'Canada',
  'BR':'Brasile','MX':'Messico','AR':'Argentina','ZA':'Sudafrica',
  'AE':'Emirati Arabi','SA':'Arabia Saudita','IL':'Israele',
  'LU':'Lussemburgo','IE':'Irlanda','MT':'Malta','CY':'Cipro',
  'EE':'Estonia','LV':'Lettonia','LT':'Lituania','SG':'Singapore',
  'MY':'Malaysia','NZ':'Nuova Zelanda','MA':'Marocco',
  'EG':'Egitto','NG':'Nigeria','KE':'Kenya','GH':'Ghana',
  'HK':'Hong Kong','TW':'Taiwan','TH':'Tailandia','VN':'Vietnam',
  'PH':'Filippine','ID':'Indonesia','PK':'Pakistan','BD':'Bangladesh',
  'LK':'Sri Lanka','NP':'Nepal','QA':'Qatar','KW':'Kuwait',
  'JO':'Giordania','LB':'Libano','BA':'Bosnia Erzegovina',
  'MK':'Macedonia del Nord','ME':'Montenegro','AL':'Albania',
  'MD':'Moldova','BY':'Bielorussia','GE':'Georgia','AM':'Armenia',
  'AZ':'Azerbaigian','KZ':'Kazakistan','UZ':'Uzbekistan',
  'BO':'Bolivia','CL':'Cile','CO':'Colombia','PE':'Perù',
  'UY':'Uruguay','VE':'Venezuela','EC':'Ecuador',
  'GT':'Guatemala','HN':'Honduras','CR':'Costa Rica','PA':'Panama',
  'DO':'Rep. Dominicana',
  // Common text → normalized
  'Italia':'Italia','Italy':'Italia','Italie':'Italia',
  'Francia':'Francia','France':'Francia',
  'Germania':'Germania','Germany':'Germania','Deutschland':'Germania',
  'Spagna':'Spagna','Spain':'Spagna','España':'Spagna',
  'Regno Unito':'Regno Unito','United Kingdom':'Regno Unito',
  'Gran Bretagna':'Regno Unito','Great Britain':'Regno Unito',
  'Stati Uniti':'Stati Uniti','United States':'Stati Uniti','United States of America':'Stati Uniti',
  'Svizzera':'Svizzera','Switzerland':'Svizzera','Suisse':'Svizzera',
  'Paesi Bassi':'Paesi Bassi','Netherlands':'Paesi Bassi','Olanda':'Paesi Bassi','Holland':'Paesi Bassi',
  'Belgio':'Belgio','Belgium':'Belgio',
  'Austria':'Austria',
  'Portogallo':'Portogallo','Portugal':'Portogallo',
  'Svezia':'Svezia','Sweden':'Svezia',
  'Norvegia':'Norvegia','Norway':'Norvegia',
  'Danimarca':'Danimarca','Denmark':'Danimarca',
  'Finlandia':'Finlandia','Finland':'Finlandia',
  'Polonia':'Polonia','Poland':'Polonia',
  'Repubblica Ceca':'Rep. Ceca','Rep. Ceca':'Rep. Ceca','Czech Republic':'Rep. Ceca','Czechia':'Rep. Ceca',
  'Ungheria':'Ungheria','Hungary':'Ungheria',
  'Romania':'Romania',
  'Grecia':'Grecia','Greece':'Grecia',
  'Croazia':'Croazia','Croatia':'Croazia',
  'Slovenia':'Slovenia','Slovacchia':'Slovacchia','Slovakia':'Slovacchia',
  'Bulgaria':'Bulgaria','Serbia':'Serbia',
  'Ucraina':'Ucraina','Ukraine':'Ucraina',
  'Russia':'Russia','Turchia':'Turchia','Turkey':'Turchia',
  'Giappone':'Giappone','Japan':'Giappone',
  'Cina':'Cina','China':'Cina',
  'Corea del Sud':'Corea del Sud','South Korea':'Corea del Sud','Korea':'Corea del Sud',
  'India':'India','Australia':'Australia','Canada':'Canada',
  'Brasile':'Brasile','Brazil':'Brasile',
  'Messico':'Messico','Mexico':'Messico',
  'Argentina':'Argentina',
  'Sudafrica':'Sudafrica','South Africa':'Sudafrica','Sud Africa':'Sudafrica',
  'Emirati Arabi Uniti':'Emirati Arabi','Emirati Arabi':'Emirati Arabi','United Arab Emirates':'Emirati Arabi','UAE':'Emirati Arabi',
  'Arabia Saudita':'Arabia Saudita','Saudi Arabia':'Arabia Saudita',
  'Israele':'Israele','Israel':'Israele',
  'Lussemburgo':'Lussemburgo','Luxembourg':'Lussemburgo',
  'Irlanda':'Irlanda','Ireland':'Irlanda',
  'Malta':'Malta','Cipro':'Cipro','Cyprus':'Cipro',
  'Estonia':'Estonia','Lettonia':'Lettonia','Latvia':'Lettonia',
  'Lituania':'Lituania','Lithuania':'Lituania',
  'Singapore':'Singapore','Malaysia':'Malaysia',
  'Nuova Zelanda':'Nuova Zelanda','New Zealand':'Nuova Zelanda',
  'Marocco':'Marocco','Morocco':'Marocco',
  'Egitto':'Egitto','Egypt':'Egitto',
};

function normalizeCountry(raw: string): string {
  if (!raw || !raw.trim()) return 'Unknown';
  const t = raw.trim();
  return COUNTRY_MAP[t] || COUNTRY_MAP[t.toUpperCase()] || t;
}

interface CountryRow { country: string; sales: number; orders: number }
type Tab = 'b2c' | 'b2b' | 'all';
const isNotCustom = (o: Order) => !o.orderType || o.orderType.toLowerCase() !== 'custom';

export function CountryBreakdown({ orders, allSkus, allProductNames = [] }: { orders: Order[]; allSkus: string[]; allProductNames?: string[] }) {
  const [tab, setTab] = useState<Tab>('b2c');
  const [skuFilter, setSkuFilter] = useState('');
  const [productFilter, setProductFilter] = useState('');
  const [sortField, setSortField] = useState<'country' | 'sales'>('sales');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');

  const { b2cRows, b2bRows, allRows } = useMemo(() => {
    const b2c: Record<string, CountryRow> = {};
    const b2b: Record<string, CountryRow> = {};

    orders.forEach(order => {
      if (order.customerType === 'B2B' && !isNotCustom(order)) return;
      let amount = 0;
      if (skuFilter) {
        amount = order.products.filter(p => p.sku === skuFilter).reduce((s, p) => s + p.totalPrice, 0);
      } else if (productFilter) {
        amount = order.products.filter(p => p.name === productFilter).reduce((s, p) => s + p.totalPrice, 0);
      } else {
        amount = order.customerType === 'B2C' ? (order.netAmount ?? order.totalAmount) : order.totalAmount;
      }
      if (amount <= 0) return;

      const rawCountry = order.customerType === 'B2C'
        ? (order.destinationCountry || order.country || '')
        : (order.country || '');
      const country = normalizeCountry(rawCountry);

      const map = order.customerType === 'B2C' ? b2c : b2b;
      if (!map[country]) map[country] = { country, sales: 0, orders: 0 };
      map[country].sales += amount;
      map[country].orders++;
    });

    const allMap: Record<string, CountryRow> = {};
    [...Object.values(b2c), ...Object.values(b2b)].forEach(r => {
      if (!allMap[r.country]) allMap[r.country] = { country: r.country, sales: 0, orders: 0 };
      allMap[r.country].sales += r.sales;
      allMap[r.country].orders += r.orders;
    });

    const doSort = (rows: CountryRow[]) =>
      [...rows].sort((a, b) => {
        const cmp = sortField === 'country' ? a.country.localeCompare(b.country) : a.sales - b.sales;
        return sortDir === 'asc' ? cmp : -cmp;
      });

    return { b2cRows: doSort(Object.values(b2c)), b2bRows: doSort(Object.values(b2b)), allRows: doSort(Object.values(allMap)) };
  }, [orders, skuFilter, productFilter, sortField, sortDir]);

  const rows = tab === 'b2c' ? b2cRows : tab === 'b2b' ? b2bRows : allRows;
  const total = rows.reduce((s, r) => s + r.sales, 0);

  const handleSort = (f: typeof sortField) => {
    if (sortField === f) setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    else { setSortField(f); setSortDir('desc'); }
  };
  const fmt = (v: number) => new Intl.NumberFormat('it-IT', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(v);
  const SortBtn = ({ field, children }: { field: typeof sortField; children: React.ReactNode }) => (
    <button onClick={() => handleSort(field)} className="flex items-center gap-1 hover:text-foreground transition-colors">
      {children}<ArrowUpDown className={`w-3 h-3 ${sortField === field ? 'text-primary' : ''}`} />
    </button>
  );

  const handleExport = () => downloadCsv(`sales-by-country-${tab}`, ['Country','Revenue','Orders'], rows.map(r => [r.country, r.sales.toFixed(2), r.orders]));

  return (
    <div className="chart-container">
      <div className="flex items-center justify-between gap-2 mb-3">
        <div className="flex items-center gap-2">
          <Globe className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
          <h3 className="text-sm font-semibold">Sales by Country</h3>
        </div>
        <div className="flex items-center gap-1.5">
          <select value={skuFilter} onChange={e => setSkuFilter(e.target.value)}
            className="h-7 text-xs rounded border border-border/50 bg-muted/50 px-2 text-foreground">
            <option value="">All SKUs</option>
            {allSkus.map(s => <option key={s} value={s}>{s}</option>)}
          </select>
          <button onClick={handleExport} className="p-1.5 rounded hover:bg-muted/50 text-muted-foreground hover:text-foreground transition-colors">
            <Download className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-0.5 bg-muted/40 rounded-lg p-0.5 mb-3 w-fit">
        {[
          { id: 'b2c' as Tab, label: 'B2C', cls: 'badge-b2c' },
          { id: 'b2b' as Tab, label: 'B2B', cls: 'badge-b2b' },
          { id: 'all' as Tab, label: 'All', cls: '' },
        ].map(({ id, label, cls }) => (
          <button
            key={id}
            onClick={() => setTab(id)}
            className={`px-3 py-1 rounded-md text-xs font-medium transition-all ${
              tab === id ? 'bg-card shadow-sm text-foreground' : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            {cls
              ? <span className={`${cls} px-1.5 py-px rounded text-[9px] font-bold uppercase`}>{label}</span>
              : label}
          </button>
        ))}
      </div>

      <div className="table-scroll overflow-x-auto">
        <table className="data-table">
          <thead><tr>
            <th><SortBtn field="country">Country</SortBtn></th>
            <th className="text-right"><SortBtn field="sales">Revenue</SortBtn></th>
            <th className="text-right">Orders</th>
            <th className="text-right">%</th>
          </tr></thead>
          <tbody>
            {rows.map(r => (
              <tr key={r.country}>
                <td className="font-medium">{r.country}</td>
                <td className="text-right font-mono">{fmt(r.sales)}</td>
                <td className="text-right text-muted-foreground">{r.orders}</td>
                <td className="text-right text-muted-foreground">{total > 0 ? ((r.sales / total) * 100).toFixed(1) : '0'}%</td>
              </tr>
            ))}
            {!rows.length && <tr><td colSpan={4} className="text-center text-muted-foreground py-8 text-xs">No data</td></tr>}
          </tbody>
          {rows.length > 0 && (
            <tfoot><tr>
              <td className="font-semibold">Total</td>
              <td className="text-right font-mono font-semibold">{fmt(total)}</td>
              <td className="text-right">{rows.reduce((s, r) => s + r.orders, 0)}</td>
              <td className="text-right">100%</td>
            </tr></tfoot>
          )}
        </table>
      </div>
    </div>
  );
}
