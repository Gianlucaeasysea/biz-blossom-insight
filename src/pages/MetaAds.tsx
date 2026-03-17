import { useState, useMemo } from 'react';
import { subDays, format } from 'date-fns';
import { it } from 'date-fns/locale';
import { useMetaAds, parseMetaKPIs, getActionValue, detectCampaignCategory } from '@/hooks/useMetaAds';
import { useShopifyOrders } from '@/hooks/useShopifyOrders';
import { useGoogleSheetsOrders } from '@/hooks/useGoogleSheetsOrders';
import { DashboardHeader } from '@/components/dashboard/DashboardHeader';
import { KPICard } from '@/components/dashboard/KPICard';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { CalendarIcon, Download, Loader2, AlertCircle, Image as ImageIcon } from 'lucide-react';
import { cn } from '@/lib/utils';
import { NavLink } from '@/components/NavLink';
import { downloadCsv } from '@/lib/csv-export';
import {
  ResponsiveContainer, LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend,
} from 'recharts';

// Map product collection names to their category for MER cross-reference
const COLLECTION_TO_CATEGORY: Record<string, string> = {
  "Flipper™ Collection": "Flipper™ Collection",
  "Olli™ Collection": "Olli™ Collection",
  "Jib Collection": "Jib Collection",
  "Textile connections": "Textile Connections",
  "Rope deflector": "Rope Deflector",
  "Way2": "Way2",
  "Shopify": "Altro", // default Shopify category
  "B2B": "Altro",
};

function mapCollectionToCategory(collection: string): string {
  return COLLECTION_TO_CATEGORY[collection] || 'Altro';
}

export default function MetaAds() {
  const [dateRange, setDateRange] = useState(() => ({
    start: subDays(new Date(), 30),
    end: new Date(),
  }));
  const [campaignFilter, setCampaignFilter] = useState<string>('all');
  const [categoryOverrides, setCategoryOverrides] = useState<Record<string, string>>({});

  const { data, isLoading, isError, error, refetch, isFetching } = useMetaAds(dateRange);

  // Sales data for MER calculation
  const { data: shopifyOrders = [] } = useShopifyOrders({ limit: 250, status: 'any', createdAtMin: new Date('2025-01-01'), enabled: true });
  const { data: gsOrders = [] } = useGoogleSheetsOrders(true);

  // All campaigns list
  const campaignNames = useMemo(() => {
    if (!data?.campaigns) return [];
    return [...new Set(data.campaigns.map(c => c.campaign_name))].sort();
  }, [data]);

  // Detect categories for each campaign
  const campaignCategories = useMemo(() => {
    const map: Record<string, string> = {};
    campaignNames.forEach(name => {
      map[name] = categoryOverrides[name] || detectCampaignCategory(name);
    });
    return map;
  }, [campaignNames, categoryOverrides]);

  // All unique categories
  const allCategories = useMemo(() => {
    return [...new Set(Object.values(campaignCategories))].sort();
  }, [campaignCategories]);

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
    return data.campaigns
      .filter(c => campaignFilter === 'all' || c.campaign_name === campaignFilter)
      .map(c => ({
        name: c.campaign_name,
        category: campaignCategories[c.campaign_name] || 'Altro',
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
  }, [data, campaignFilter, campaignCategories]);

  // Ads / creatives filtered by campaign
  const adsData = useMemo(() => {
    if (!data?.ads) return [];
    return data.ads
      .filter(a => campaignFilter === 'all' || a.campaign_name === campaignFilter)
      .sort((a, b) => parseFloat(b.spend) - parseFloat(a.spend));
  }, [data, campaignFilter]);

  // MER calculation: Revenue per category from sales / Ad spend per category
  const merData = useMemo(() => {
    // Ad spend per category
    const spendByCategory: Record<string, number> = {};
    if (data?.campaigns) {
      for (const c of data.campaigns) {
        const cat = campaignCategories[c.campaign_name] || 'Altro';
        spendByCategory[cat] = (spendByCategory[cat] || 0) + parseFloat(c.spend || '0');
      }
    }

    // Revenue per category from sales (both B2C + B2B)
    const allSalesOrders = [...shopifyOrders, ...gsOrders];
    const revenueByCategory: Record<string, number> = {};
    const filteredSales = allSalesOrders.filter(o => {
      const d = o.date instanceof Date ? o.date : new Date(o.date);
      return d >= dateRange.start && d <= dateRange.end;
    });

    for (const order of filteredSales) {
      for (const product of order.products) {
        const cat = mapCollectionToCategory(product.category);
        revenueByCategory[cat] = (revenueByCategory[cat] || 0) + product.totalPrice;
      }
    }

    // Calculate MER per category
    const categories = [...new Set([...Object.keys(spendByCategory), ...Object.keys(revenueByCategory)])].sort();
    return categories.map(cat => {
      const spend = spendByCategory[cat] || 0;
      const revenue = revenueByCategory[cat] || 0;
      const mer = spend > 0 ? revenue / spend : 0;
      return { category: cat, spend, revenue, mer };
    });
  }, [data, campaignCategories, shopifyOrders, gsOrders, dateRange]);

  // Total MER
  const totalMER = useMemo(() => {
    const totalSpend = merData.reduce((s, m) => s + m.spend, 0);
    const totalRevenue = merData.reduce((s, m) => s + m.revenue, 0);
    return totalSpend > 0 ? totalRevenue / totalSpend : 0;
  }, [merData]);

  const handleExportDaily = () => {
    downloadCsv('meta-ads-daily', ['Data', 'Spesa', 'Impressioni', 'Click', 'CTR%', 'CPC', 'Reach', 'Acquisti'],
      chartData.map(r => [r.date, r.spend.toFixed(2), r.impressions, r.clicks, r.ctr.toFixed(2), r.cpc.toFixed(2), r.reach, r.purchases])
    );
  };

  const handleExportCampaigns = () => {
    downloadCsv('meta-ads-campaigns', ['Campagna', 'Categoria', 'Spesa', 'Impressioni', 'Click', 'CTR%', 'CPC', 'Acquisti', 'Valore Acquisti', 'ROAS'],
      campaignData.map(r => [r.name, r.category, r.spend.toFixed(2), r.impressions, r.clicks, r.ctr.toFixed(2), r.cpc.toFixed(2), r.purchases, r.purchaseValue.toFixed(2), r.roas.toFixed(2)])
    );
  };

  const handleExportMER = () => {
    downloadCsv('meta-ads-mer', ['Categoria', 'Spesa Ads', 'Ricavo Vendite', 'MER'],
      merData.map(r => [r.category, r.spend.toFixed(2), r.revenue.toFixed(2), r.mer.toFixed(2)])
    );
  };

  const handleCategoryChange = (campaignName: string, newCategory: string) => {
    setCategoryOverrides(prev => ({ ...prev, [campaignName]: newCategory }));
  };

  const fmtCurrency = (v: number) => `€${v.toFixed(2)}`;
  const fmtNumber = (v: number) => v.toLocaleString('it-IT');
  const fmtPct = (v: number) => `${v.toFixed(2)}%`;

  const categoryBadgeColors: Record<string, string> = {
    'Flipper™ Collection': 'bg-primary/20 text-primary',
    'Olli™ Collection': 'bg-accent/20 text-accent',
    'Jib Collection': 'bg-success/20 text-success',
    'Way2': 'bg-purple-500/20 text-purple-400',
    'Textile Connections': 'bg-cyan-500/20 text-cyan-400',
    'Rope Deflector': 'bg-yellow-500/20 text-yellow-400',
    'Brand Awareness': 'bg-pink-500/20 text-pink-400',
    'Retargeting': 'bg-indigo-500/20 text-indigo-400',
    'Catalog / DPA': 'bg-emerald-500/20 text-emerald-400',
    'Altro': 'bg-muted text-muted-foreground',
  };

  return (
    <div className="min-h-screen bg-background text-foreground p-6 md:p-10">
      <DashboardHeader onRefresh={() => refetch()} isLoading={isFetching} />

      {/* Navigation */}
      <div className="flex gap-2 mb-6">
        <NavLink to="/" className="px-4 py-2 rounded-lg text-sm font-medium bg-secondary text-secondary-foreground hover:bg-secondary/80 transition-colors" activeClassName="bg-primary text-primary-foreground">Sales Dashboard</NavLink>
        <NavLink to="/meta-ads" className="px-4 py-2 rounded-lg text-sm font-medium bg-secondary text-secondary-foreground hover:bg-secondary/80 transition-colors" activeClassName="bg-primary text-primary-foreground">Meta Ads</NavLink>
      </div>

      {/* Filters */}
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

        <Select value={campaignFilter} onValueChange={setCampaignFilter}>
          <SelectTrigger className="w-[280px]">
            <SelectValue placeholder="Tutte le campagne" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Tutte le campagne</SelectItem>
            {campaignNames.map(name => (
              <SelectItem key={name} value={name}>{name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
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
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-4 mb-8">
            <KPICard data={{ label: 'Spesa Totale', value: kpis.totalSpend, trend: 'neutral', format: 'currency' }} />
            <KPICard data={{ label: 'Impressioni', value: kpis.totalImpressions, trend: 'neutral', format: 'number' }} />
            <KPICard data={{ label: 'Click', value: kpis.totalClicks, trend: 'neutral', format: 'number' }} />
            <KPICard data={{ label: 'CTR', value: kpis.ctr, trend: 'neutral', format: 'percent' }} />
            <KPICard data={{ label: 'Acquisti', value: kpis.totalPurchases, trend: 'neutral', format: 'number' }} />
            <KPICard data={{ label: 'ROAS', value: kpis.roas, trend: kpis.roas >= 1 ? 'up' : 'down', format: 'number' }} />
            <KPICard data={{ label: 'MER Totale', value: totalMER, trend: totalMER >= 1 ? 'up' : 'down', format: 'number' }} />
          </div>

          {/* Charts */}
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

          {/* Creatives Grid */}
          {adsData.length > 0 && (
            <Card className="mb-6">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium flex items-center gap-2">
                  <ImageIcon className="w-4 h-4" /> Creatività ({adsData.length})
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
                  {adsData.slice(0, 20).map((ad) => (
                    <div key={ad.id} className="rounded-lg border border-border bg-secondary/30 overflow-hidden">
                      {ad.thumbnail_url ? (
                        <img
                          src={ad.thumbnail_url}
                          alt={ad.name}
                          className="w-full aspect-square object-cover"
                          loading="lazy"
                        />
                      ) : (
                        <div className="w-full aspect-square bg-muted flex items-center justify-center">
                          <ImageIcon className="w-8 h-8 text-muted-foreground" />
                        </div>
                      )}
                      <div className="p-3">
                        <p className="text-xs font-medium truncate mb-1">{ad.name}</p>
                        <p className="text-[10px] text-muted-foreground truncate mb-2">{ad.campaign_name}</p>
                        <div className="flex items-center justify-between text-[10px]">
                          <span>Spesa: {fmtCurrency(parseFloat(ad.spend))}</span>
                          <span>Click: {fmtNumber(parseInt(ad.clicks))}</span>
                        </div>
                        <div className="flex items-center justify-between text-[10px] mt-1">
                          <span>Impr: {fmtNumber(parseInt(ad.impressions))}</span>
                          <span>CTR: {fmtPct(parseFloat(ad.ctr || '0'))}</span>
                        </div>
                        <Badge className={cn('mt-2 text-[9px]', categoryBadgeColors[campaignCategories[ad.campaign_name] || 'Altro'] || categoryBadgeColors['Altro'])}>
                          {campaignCategories[ad.campaign_name] || 'Altro'}
                        </Badge>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Campaigns Table with Category */}
          <Card className="mb-6">
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
                      <th className="text-left py-3 px-2 text-muted-foreground font-medium">Categoria Prodotto</th>
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
                        <td className="py-3 px-2">
                          <Select
                            value={c.category}
                            onValueChange={(val) => handleCategoryChange(c.name, val)}
                          >
                            <SelectTrigger className="h-7 text-xs w-[160px]">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {['Flipper™ Collection', 'Olli™ Collection', 'Jib Collection', 'Way2', 'Textile Connections', 'Rope Deflector', 'Brand Awareness', 'Retargeting', 'Catalog / DPA', 'Altro'].map(cat => (
                                <SelectItem key={cat} value={cat}>{cat}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </td>
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
                      <tr><td colSpan={9} className="text-center py-6 text-muted-foreground">Nessuna campagna nel periodo selezionato</td></tr>
                    )}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>

          {/* MER Table */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">MER per Categoria Prodotto (Marketing Efficiency Ratio)</CardTitle>
              <Button variant="ghost" size="icon" onClick={handleExportMER}><Download className="w-4 h-4" /></Button>
            </CardHeader>
            <CardContent>
              <p className="text-xs text-muted-foreground mb-4">MER = Ricavo Vendite (B2C+B2B) / Spesa Ads — incrocia i dati delle campagne Meta con le vendite reali per categoria prodotto</p>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border">
                      <th className="text-left py-3 px-2 text-muted-foreground font-medium">Categoria Prodotto</th>
                      <th className="text-right py-3 px-2 text-muted-foreground font-medium">Spesa Ads</th>
                      <th className="text-right py-3 px-2 text-muted-foreground font-medium">Ricavo Vendite</th>
                      <th className="text-right py-3 px-2 text-muted-foreground font-medium">MER</th>
                    </tr>
                  </thead>
                  <tbody>
                    {merData.map((m, i) => (
                      <tr key={i} className="border-b border-border/50 hover:bg-secondary/30 transition-colors">
                        <td className="py-3 px-2">
                          <Badge className={cn('text-xs', categoryBadgeColors[m.category] || categoryBadgeColors['Altro'])}>
                            {m.category}
                          </Badge>
                        </td>
                        <td className="text-right py-3 px-2">{fmtCurrency(m.spend)}</td>
                        <td className="text-right py-3 px-2">{fmtCurrency(m.revenue)}</td>
                        <td className={cn("text-right py-3 px-2 font-bold", m.mer >= 1 ? 'text-success' : 'text-destructive')}>
                          {m.mer.toFixed(2)}x
                        </td>
                      </tr>
                    ))}
                    {merData.length === 0 && (
                      <tr><td colSpan={4} className="text-center py-6 text-muted-foreground">Nessun dato disponibile</td></tr>
                    )}
                    {/* Total row */}
                    {merData.length > 0 && (
                      <tr className="border-t-2 border-border bg-secondary/20">
                        <td className="py-3 px-2 font-bold">TOTALE</td>
                        <td className="text-right py-3 px-2 font-bold">{fmtCurrency(merData.reduce((s, m) => s + m.spend, 0))}</td>
                        <td className="text-right py-3 px-2 font-bold">{fmtCurrency(merData.reduce((s, m) => s + m.revenue, 0))}</td>
                        <td className={cn("text-right py-3 px-2 font-bold", totalMER >= 1 ? 'text-success' : 'text-destructive')}>
                          {totalMER.toFixed(2)}x
                        </td>
                      </tr>
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
