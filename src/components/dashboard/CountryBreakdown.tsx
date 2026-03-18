import { useMemo } from 'react';
import { Globe, Download, ShoppingBag, Building2 } from 'lucide-react';
import { Order } from '@/types/analytics';
import { downloadCsv } from '@/lib/csv-export';
import { normalizeCountryName } from '@/lib/country-utils';

interface CountryBreakdownProps {
  orders: Order[];
}

const fmt = (v: number) => new Intl.NumberFormat('it-IT', { style: 'currency', currency: 'EUR' }).format(v);
const isNotCustom = (o: Order) => !o.orderType || o.orderType.toLowerCase() !== 'custom';

function getB2CCountryData(orders: Order[]) {
  const map: Record<string, number> = {};
  orders.filter(o => o.customerType === 'B2C').forEach(o => {
    const country = normalizeCountryName(o.destinationCountry || o.country);
    const amount = o.netAmount ?? o.totalAmount;
    if (amount <= 0) return;
    map[country] = (map[country] || 0) + amount;
  });
  return Object.entries(map)
    .map(([country, sales]) => ({ country, sales: Math.round(sales * 100) / 100 }))
    .sort((a, b) => b.sales - a.sales);
}

function getB2BCountryData(orders: Order[]) {
  const map: Record<string, number> = {};
  orders.filter(o => o.customerType === 'B2B' && isNotCustom(o)).forEach(o => {
    const country = normalizeCountryName(o.country);
    const amount = o.totalAmount;
    if (amount <= 0) return;
    map[country] = (map[country] || 0) + amount;
  });
  return Object.entries(map)
    .map(([country, sales]) => ({ country, sales: Math.round(sales * 100) / 100 }))
    .sort((a, b) => b.sales - a.sales);
}

function getCombinedCountryData(orders: Order[]) {
  const map: Record<string, { b2c: number; b2b: number }> = {};
  orders.filter(o => o.customerType === 'B2C' || isNotCustom(o)).forEach(o => {
    const country = normalizeCountryName(
      o.customerType === 'B2C' ? (o.destinationCountry || o.country) : o.country
    );
    const amount = o.customerType === 'B2C' ? (o.netAmount ?? o.totalAmount) : o.totalAmount;
    if (amount <= 0) return;
    if (!map[country]) map[country] = { b2c: 0, b2b: 0 };
    if (o.customerType === 'B2C') map[country].b2c += amount;
    else map[country].b2b += amount;
  });
  return Object.entries(map)
    .map(([country, d]) => ({
      country,
      b2cSales: Math.round(d.b2c * 100) / 100,
      b2bSales: Math.round(d.b2b * 100) / 100,
      totalSales: Math.round((d.b2c + d.b2b) * 100) / 100,
    }))
    .sort((a, b) => b.totalSales - a.totalSales);
}

function SimpleCountryTable({ title, icon, badge, badgeColor, data, valueLabel, onExport }: {
  title: string;
  icon: React.ReactNode;
  badge: string;
  badgeColor: string;
  data: Array<{ country: string; sales: number }>;
  valueLabel: string;
  onExport: () => void;
}) {
  return (
    <div className="chart-container">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          {icon}
          <h3 className="text-sm font-semibold">{title}</h3>
          <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium ${badgeColor}`}>{badge}</span>
        </div>
        <button onClick={onExport} className="p-2 rounded-md hover:bg-muted/50 text-muted-foreground hover:text-foreground transition-colors" title="Esporta CSV">
          <Download className="w-4 h-4" />
        </button>
      </div>
      <div className="overflow-x-auto scrollbar-custom">
        <table className="data-table">
          <thead><tr>
            <th>Paese</th>
            <th className="text-right">{valueLabel}</th>
          </tr></thead>
          <tbody>
            {data.map(r => (
              <tr key={r.country}>
                <td className="text-xs">{r.country}</td>
                <td className="text-right font-mono text-xs font-semibold">{fmt(r.sales)}</td>
              </tr>
            ))}
            {!data.length && <tr><td colSpan={2} className="text-center text-muted-foreground py-6 text-xs">Nessun dato</td></tr>}
          </tbody>
          {data.length > 0 && (
            <tfoot><tr className="border-t-2 border-border font-semibold text-xs">
              <td>Totale</td>
              <td className="text-right font-mono">{fmt(data.reduce((s, r) => s + r.sales, 0))}</td>
            </tr></tfoot>
          )}
        </table>
      </div>
    </div>
  );
}

export function CountryBreakdown({ orders }: CountryBreakdownProps) {
  const b2cData = useMemo(() => getB2CCountryData(orders), [orders]);
  const b2bData = useMemo(() => getB2BCountryData(orders), [orders]);
  const combinedData = useMemo(() => getCombinedCountryData(orders), [orders]);

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <SimpleCountryTable
          title="Vendite per Paese"
          icon={<ShoppingBag className="w-4 h-4 text-blue-400" />}
          badge="B2C"
          badgeColor="bg-blue-500/10 text-blue-400"
          data={b2cData}
          valueLabel="Net Sales"
          onExport={() => downloadCsv('paese-b2c', ['Paese', 'Net Sales'], b2cData.map(r => [r.country, r.sales]))}
        />
        <SimpleCountryTable
          title="Vendite per Paese"
          icon={<Building2 className="w-4 h-4 text-amber-400" />}
          badge="B2B"
          badgeColor="bg-amber-500/10 text-amber-400"
          data={b2bData}
          valueLabel="Totale"
          onExport={() => downloadCsv('paese-b2b', ['Paese', 'Totale'], b2bData.map(r => [r.country, r.sales]))}
        />
      </div>

      {/* Combined */}
      <div className="chart-container">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <Globe className="w-4 h-4 text-muted-foreground" />
            <h3 className="text-sm font-semibold">Vendite per Paese</h3>
            <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-muted text-muted-foreground font-medium">B2C + B2B</span>
          </div>
          <button
            onClick={() => downloadCsv('paese-combinato', ['Paese', 'B2C', 'B2B', 'Totale'], combinedData.map(r => [r.country, r.b2cSales, r.b2bSales, r.totalSales]))}
            className="p-2 rounded-md hover:bg-muted/50 text-muted-foreground hover:text-foreground transition-colors"
            title="Esporta CSV"
          >
            <Download className="w-4 h-4" />
          </button>
        </div>
        <div className="overflow-x-auto scrollbar-custom">
          <table className="data-table">
            <thead><tr>
              <th>Paese</th>
              <th className="text-right">B2C</th>
              <th className="text-right">B2B</th>
              <th className="text-right">Totale</th>
            </tr></thead>
            <tbody>
              {combinedData.map(r => (
                <tr key={r.country}>
                  <td className="text-xs">{r.country}</td>
                  <td className="text-right font-mono text-xs">{fmt(r.b2cSales)}</td>
                  <td className="text-right font-mono text-xs">{fmt(r.b2bSales)}</td>
                  <td className="text-right font-mono text-xs font-semibold">{fmt(r.totalSales)}</td>
                </tr>
              ))}
              {!combinedData.length && <tr><td colSpan={4} className="text-center text-muted-foreground py-6 text-xs">Nessun dato</td></tr>}
            </tbody>
            {combinedData.length > 0 && (
              <tfoot><tr className="border-t-2 border-border font-semibold text-xs">
                <td>Totale</td>
                <td className="text-right font-mono">{fmt(combinedData.reduce((s, r) => s + r.b2cSales, 0))}</td>
                <td className="text-right font-mono">{fmt(combinedData.reduce((s, r) => s + r.b2bSales, 0))}</td>
                <td className="text-right font-mono">{fmt(combinedData.reduce((s, r) => s + r.totalSales, 0))}</td>
              </tr></tfoot>
            )}
          </table>
        </div>
      </div>
    </div>
  );
}
