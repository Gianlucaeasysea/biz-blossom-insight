import { useState, useMemo } from 'react';
import { subDays, format } from 'date-fns';
import { it } from 'date-fns/locale';
import { useMetaAds, parseMetaKPIs, getActionValue } from '@/hooks/useMetaAds';
import { DashboardHeader } from '@/components/dashboard/DashboardHeader';
import { KPICard } from '@/components/dashboard/KPICard';
import { KPIData } from '@/types/analytics';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { CalendarIcon, Download, Loader2, AlertCircle, TrendingUp, Eye, MousePointerClick, DollarSign, Target, ShoppingCart } from 'lucide-react';
import { cn } from '@/lib/utils';
import { NavLink } from '@/components/NavLink';
import { downloadCsv } from '@/lib/csv-export';
import {
  ResponsiveContainer, LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend,
} from 'recharts';

export default function MetaAds() {
  const [dateRange, setDateRange] = useState(() => ({
    start: subDays(new Date(), 30),
    end: new Date(),
  }));

  const { data, isLoading, isError, error, refetch, isFetching } = useMetaAds(dateRange);

  const kpis = useMemo(() => {
    if (!data?.daily) return null;
    return parseMetaKPIs(data.daily);
  }, [data]);

  const chartData = useMemo(() => {
    if (!data?.daily) return [];
    return data.daily.map(d => ({
      date: format(new Date(d.date_start), 'dd MMM', { locale: it }),
      spend: parseFloat(d.spend || '0'),
      impressions: parseInt(d.impressions || '0'),
      clicks: parseInt(d.clicks || '0'),
      ctr: parseFloat(d.ctr || '0'),
      cpc: parseFloat(d.cpc || '0'),
      reach: parseInt(d.reach || '0'),
      purchases: getActionValue(d.actions, 'purchase'),
    }));
  }, [data]);

  const campaignData = useMemo(() => {
    if (!data?.campaigns) return [];
    return data.campaigns.map(c => ({
      name: c.campaign_name,
      spend: parseFloat(c.spend || '0'),
      impressions: parseInt(c.impressions || '0'),
      clicks: parseInt(c.clicks || '0'),
      ctr: parseFloat(c.ctr || '0'),
      cpc: parseFloat(c.cpc || '0'),
      purchases: getActionValue(c.actions, 'purchase'),
      purchaseValue: getActionValue(c.action_values, 'purchase'),
      roas: parseFloat(c.spend || '0') > 0
        ? getActionValue(c.action_values, 'purchase') / parseFloat(c.spend || '1')
        : 0,
    }));
  }, [data]);

  const handleExportDaily = () => {
    downloadCsv('meta-ads-daily', ['Data', 'Spesa', 'Impressioni', 'Click', 'CTR%', 'CPC', 'Reach', 'Acquisti'],
      chartData.map(r => [r.date, r.spend.toFixed(2), r.impressions, r.clicks, r.ctr.toFixed(2), r.cpc.toFixed(2), r.reach, r.purchases])
    );
  };

  const handleExportCampaigns = () => {
    downloadCsv('meta-ads-campaigns', ['Campagna', 'Spesa', 'Impressioni', 'Click', 'CTR%', 'CPC', 'Acquisti', 'Valore Acquisti', 'ROAS'],
      campaignData.map(r => [r.name, r.spend.toFixed(2), r.impressions, r.clicks, r.ctr.toFixed(2), r.cpc.toFixed(2), r.purchases, r.purchaseValue.toFixed(2), r.roas.toFixed(2)])
    );
  };

  const fmtCurrency = (v: number) => `€${v.toFixed(2)}`;
  const fmtNumber = (v: number) => v.toLocaleString('it-IT');
  const fmtPct = (v: number) => `${v.toFixed(2)}%`;

  return (
    <div className="min-h-screen bg-background text-foreground p-6 md:p-10">
      <DashboardHeader onRefresh={() => refetch()} isLoading={isFetching} />

      {/* Navigation */}
      <div className="flex gap-2 mb-6">
        <NavLink
          to="/"
          className="px-4 py-2 rounded-lg text-sm font-medium bg-secondary text-secondary-foreground hover:bg-secondary/80 transition-colors"
          activeClassName="bg-primary text-primary-foreground"
        >
          Sales Dashboard
        </NavLink>
        <NavLink
          to="/meta-ads"
          className="px-4 py-2 rounded-lg text-sm font-medium bg-secondary text-secondary-foreground hover:bg-secondary/80 transition-colors"
          activeClassName="bg-primary text-primary-foreground"
        >
          Meta Ads
        </NavLink>
      </div>

      {/* Date Range */}
      <div className="flex gap-3 mb-6 flex-wrap items-center">
        <Popover>
          <PopoverTrigger asChild>
            <Button variant="outline" className={cn('justify-start text-left font-normal w-[200px]')}>
              <CalendarIcon className="mr-2 h-4 w-4" />
              {format(dateRange.start, 'dd MMM yyyy', { locale: it })}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-0"><Calendar mode="single" selected={dateRange.start} onSelect={(d) => d && setDateRange(prev => ({ ...prev, start: d }))} /></PopoverContent>
        </Popover>
        <span className="text-muted-foreground">→</span>
        <Popover>
          <PopoverTrigger asChild>
            <Button variant="outline" className={cn('justify-start text-left font-normal w-[200px]')}>
              <CalendarIcon className="mr-2 h-4 w-4" />
              {format(dateRange.end, 'dd MMM yyyy', { locale: it })}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-0"><Calendar mode="single" selected={dateRange.end} onSelect={(d) => d && setDateRange(prev => ({ ...prev, end: d }))} /></PopoverContent>
        </Popover>
      </div>

      {isLoading && (
        <div className="flex items-center justify-center h-64">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
          <span className="ml-3 text-muted-foreground">Caricamento dati Meta Ads...</span>
        </div>
      )}

      {isError && (
        <div className="flex items-center justify-center h-64 text-destructive">
          <AlertCircle className="w-6 h-6 mr-2" />
          <span>{error instanceof Error ? error.message : 'Errore nel caricamento'}</span>
        </div>
      )}

      {kpis && !isLoading && (
        <>
          {/* KPI Cards */}
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4 mb-8">
            <KPICard title="Spesa Totale" value={fmtCurrency(kpis.totalSpend)} icon={<DollarSign className="w-4 h-4" />} />
            <KPICard title="Impressioni" value={fmtNumber(kpis.totalImpressions)} icon={<Eye className="w-4 h-4" />} />
            <KPICard title="Click" value={fmtNumber(kpis.totalClicks)} icon={<MousePointerClick className="w-4 h-4" />} />
            <KPICard title="CTR" value={fmtPct(kpis.ctr)} icon={<Target className="w-4 h-4" />} />
            <KPICard title="Acquisti" value={fmtNumber(kpis.totalPurchases)} icon={<ShoppingCart className="w-4 h-4" />} />
            <KPICard title="ROAS" value={kpis.roas.toFixed(2) + 'x'} icon={<TrendingUp className="w-4 h-4" />} />
          </div>

          {/* Spend & Clicks Chart */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium">Spesa Giornaliera</CardTitle>
                <Button variant="ghost" size="icon" onClick={handleExportDaily}><Download className="w-4 h-4" /></Button>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={chartData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                    <XAxis dataKey="date" tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 11 }} />
                    <YAxis tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 11 }} />
                    <Tooltip contentStyle={{ background: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: 8, color: 'hsl(var(--foreground))' }} />
                    <Bar dataKey="spend" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} name="Spesa €" />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium">Click & CTR</CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <LineChart data={chartData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                    <XAxis dataKey="date" tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 11 }} />
                    <YAxis yAxisId="left" tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 11 }} />
                    <YAxis yAxisId="right" orientation="right" tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 11 }} />
                    <Tooltip contentStyle={{ background: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: 8, color: 'hsl(var(--foreground))' }} />
                    <Legend />
                    <Line yAxisId="left" type="monotone" dataKey="clicks" stroke="hsl(var(--primary))" strokeWidth={2} dot={false} name="Click" />
                    <Line yAxisId="right" type="monotone" dataKey="ctr" stroke="hsl(var(--accent))" strokeWidth={2} dot={false} name="CTR %" />
                  </LineChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </div>

          {/* Campaigns Table */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Performance Campagne</CardTitle>
              <Button variant="ghost" size="icon" onClick={handleExportCampaigns}><Download className="w-4 h-4" /></Button>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border">
                      <th className="text-left py-3 px-2 text-muted-foreground font-medium">Campagna</th>
                      <th className="text-right py-3 px-2 text-muted-foreground font-medium">Spesa</th>
                      <th className="text-right py-3 px-2 text-muted-foreground font-medium">Impressioni</th>
                      <th className="text-right py-3 px-2 text-muted-foreground font-medium">Click</th>
                      <th className="text-right py-3 px-2 text-muted-foreground font-medium">CTR</th>
                      <th className="text-right py-3 px-2 text-muted-foreground font-medium">CPC</th>
                      <th className="text-right py-3 px-2 text-muted-foreground font-medium">Acquisti</th>
                      <th className="text-right py-3 px-2 text-muted-foreground font-medium">ROAS</th>
                    </tr>
                  </thead>
                  <tbody>
                    {campaignData.map((c, i) => (
                      <tr key={i} className="border-b border-border/50 hover:bg-secondary/30 transition-colors">
                        <td className="py-3 px-2 font-medium truncate max-w-[200px]">{c.name}</td>
                        <td className="text-right py-3 px-2">{fmtCurrency(c.spend)}</td>
                        <td className="text-right py-3 px-2">{fmtNumber(c.impressions)}</td>
                        <td className="text-right py-3 px-2">{fmtNumber(c.clicks)}</td>
                        <td className="text-right py-3 px-2">{fmtPct(c.ctr)}</td>
                        <td className="text-right py-3 px-2">{fmtCurrency(c.cpc)}</td>
                        <td className="text-right py-3 px-2">{c.purchases}</td>
                        <td className="text-right py-3 px-2 font-semibold">{c.roas.toFixed(2)}x</td>
                      </tr>
                    ))}
                    {campaignData.length === 0 && (
                      <tr><td colSpan={8} className="text-center py-6 text-muted-foreground">Nessuna campagna nel periodo selezionato</td></tr>
                    )}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
