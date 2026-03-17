import { useState, useMemo } from 'react';
import { subDays, format } from 'date-fns';
import { it } from 'date-fns/locale';
import { useMetaAds, useMetaCreatives, parseMetaKPIs, getActionValue, detectCampaignCategory, parseUrlTags } from '@/hooks/useMetaAds';
import { useShopifyOrders } from '@/hooks/useShopifyOrders';
import { DashboardHeader } from '@/components/dashboard/DashboardHeader';
import { KPICard } from '@/components/dashboard/KPICard';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { CalendarIcon, Download, Loader2, AlertCircle, Image as ImageIcon, ChevronDown, Link2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { NavLink } from '@/components/NavLink';
import { downloadCsv } from '@/lib/csv-export';
import {
  ResponsiveContainer, LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend,
} from 'recharts';

const COLLECTION_TO_CATEGORY: Record<string, string> = {
  "Flipper™ Collection": "Flipper™ Collection",
  "Olli™ Collection": "Olli™ Collection",
  "Jib Collection": "Jib Collection",
  "Textile connections": "Textile Connections",
  "Rope deflector": "Rope Deflector",
  "Way2": "Way2",
  "Shopify": "Altro",
};

function mapCollectionToCategory(collection: string): string {
  return COLLECTION_TO_CATEGORY[collection] || 'Altro';
}

const ALL_CATEGORIES = ['Flipper™ Collection', 'Olli™ Collection', 'Jib Collection', 'Way2', 'Textile Connections', 'Rope Deflector', 'Brand Awareness', 'Retargeting', 'Catalog / DPA', 'Altro'];

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

export default function MetaAds() {
  const [dateRange, setDateRange] = useState(() => ({
    start: subDays(new Date(), 30),
    end: new Date(),
  }));
  const [campaignFilter, setCampaignFilter] = useState<string>('all');
  const [categoryOverrides, setCategoryOverrides] = useState<Record<string, string>>({});
  const [adsetCategoryOverrides, setAdsetCategoryOverrides] = useState<Record<string, string>>({});
  const [showCreatives, setShowCreatives] = useState(false);
  const [showUtmMatch, setShowUtmMatch] = useState(false);

  const { data, isLoading, isError, error, refetch, isFetching } = useMetaAds(dateRange);
  const { data: creativesData, isLoading: isLoadingCreatives } = useMetaCreatives(dateRange, showCreatives || showUtmMatch);

  const [shopifyMinDate] = useState(() => new Date('2025-01-01'));
  const { data: shopifyOrders = [] } = useShopifyOrders({ limit: 250, status: 'any', createdAtMin: shopifyMinDate, enabled: true });

  const campaignNames = useMemo(() => {
    if (!data?.campaigns) return [];
    return [...new Set(data.campaigns.map(c => c.campaign_name))].sort();
  }, [data]);

  const campaignCategories = useMemo(() => {
    const map: Record<string, string> = {};
    campaignNames.forEach(name => {
      map[name] = categoryOverrides[name] || detectCampaignCategory(name);
    });
    return map;
  }, [campaignNames, categoryOverrides]);

  // Adset categories (inherit from campaign by default, overridable)
  const adsetCategories = useMemo(() => {
    const map: Record<string, string> = {};
    if (data?.adsets) {
      for (const as of data.adsets) {
        const key = `${as.campaign_name}::${as.adset_name}`;
        map[key] = adsetCategoryOverrides[key] || detectCampaignCategory(as.adset_name) !== 'Altro'
          ? (adsetCategoryOverrides[key] || detectCampaignCategory(as.adset_name))
          : (campaignCategories[as.campaign_name] || 'Altro');
      }
    }
    return map;
  }, [data, adsetCategoryOverrides, campaignCategories]);

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
        roas: parseFloat(c.spend || '0') > 0 ? getActionValue(c.action_values, 'purchase') / parseFloat(c.spend || '1') : 0,
      }));
  }, [data, campaignFilter, campaignCategories]);

  // Adset data
  const adsetData = useMemo(() => {
    if (!data?.adsets) return [];
    return data.adsets
      .filter(a => campaignFilter === 'all' || a.campaign_name === campaignFilter)
      .map(a => {
        const key = `${a.campaign_name}::${a.adset_name}`;
        return {
          name: a.adset_name,
          campaignName: a.campaign_name,
          category: adsetCategories[key] || 'Altro',
          key,
          spend: parseFloat(a.spend || '0'),
          impressions: parseInt(a.impressions || '0'),
          clicks: parseInt(a.clicks || '0'),
          ctr: parseFloat(a.ctr || '0'),
          cpc: parseFloat(a.cpc || '0'),
          purchases: getActionValue(a.actions, 'purchase'),
          purchaseValue: getActionValue(a.action_values, 'purchase'),
          roas: parseFloat(a.spend || '0') > 0 ? getActionValue(a.action_values, 'purchase') / parseFloat(a.spend || '1') : 0,
        };
      })
      .sort((a, b) => b.spend - a.spend);
  }, [data, campaignFilter, adsetCategories]);

  const adsData = useMemo(() => {
    if (!creativesData?.ads) return [];
    return creativesData.ads
      .filter(a => campaignFilter === 'all' || a.campaign_name === campaignFilter)
      .sort((a, b) => parseFloat(b.spend) - parseFloat(a.spend));
  }, [creativesData, campaignFilter]);

  // MER: B2C NET sales only
  const merData = useMemo(() => {
    const spendByCategory: Record<string, number> = {};
    if (data?.campaigns) {
      for (const c of data.campaigns) {
        const cat = campaignCategories[c.campaign_name] || 'Altro';
        spendByCategory[cat] = (spendByCategory[cat] || 0) + parseFloat(c.spend || '0');
      }
    }
    // Only B2C Shopify orders, use netAmount
    const revenueByCategory: Record<string, number> = {};
    const filteredSales = shopifyOrders.filter(o => {
      if (o.customerType !== 'B2C') return false;
      const d = o.date instanceof Date ? o.date : new Date(o.date);
      return d >= dateRange.start && d <= dateRange.end;
    });
    for (const order of filteredSales) {
      const netAmt = (order as any).netAmount ?? order.totalAmount;
      for (const product of order.products) {
        const cat = mapCollectionToCategory(product.category);
        const ratio = order.totalAmount > 0 ? product.totalPrice / order.totalAmount : 0;
        revenueByCategory[cat] = (revenueByCategory[cat] || 0) + (netAmt * ratio);
      }
    }
    const categories = [...new Set([...Object.keys(spendByCategory), ...Object.keys(revenueByCategory)])].sort();
    return categories.map(cat => {
      const spend = spendByCategory[cat] || 0;
      const revenue = revenueByCategory[cat] || 0;
      return { category: cat, spend, revenue, mer: spend > 0 ? revenue / spend : 0 };
    });
  }, [data, campaignCategories, shopifyOrders, dateRange]);

  const totalMER = useMemo(() => {
    const totalSpend = merData.reduce((s, m) => s + m.spend, 0);
    const totalRevenue = merData.reduce((s, m) => s + m.revenue, 0);
    return totalSpend > 0 ? totalRevenue / totalSpend : 0;
  }, [merData]);

  // UTM Content aggregation: B2C net sales grouped by utm_content
  const utmContentSales = useMemo(() => {
    const map = new Map<string, { utmContent: string; netSales: number; orderCount: number }>();
    const filteredOrders = shopifyOrders.filter(o => {
      if (o.customerType !== 'B2C') return false;
      const d = o.date instanceof Date ? o.date : new Date(o.date);
      return d >= dateRange.start && d <= dateRange.end;
    });
    for (const order of filteredOrders) {
      const utm = (order as any).utm as Record<string, string> | null;
      const utmContent = utm?.utm_content || '(nessuno)';
      const netAmt = (order as any).netAmount ?? order.totalAmount;
      const existing = map.get(utmContent);
      if (existing) {
        existing.netSales += netAmt;
        existing.orderCount += 1;
      } else {
        map.set(utmContent, { utmContent, netSales: netAmt, orderCount: 1 });
      }
    }
    return [...map.values()].sort((a, b) => b.netSales - a.netSales);
  }, [shopifyOrders, dateRange]);

  // Adset MER: cross ad set spend with B2C net sales by category
  const adsetMerData = useMemo(() => {
    if (!data?.adsets) return [];

    // B2C net sales by category in date range
    const revenueByCategory: Record<string, number> = {};
    const filteredSales = shopifyOrders.filter(o => {
      if (o.customerType !== 'B2C') return false;
      const d = o.date instanceof Date ? o.date : new Date(o.date);
      return d >= dateRange.start && d <= dateRange.end;
    });
    for (const order of filteredSales) {
      const netAmt = (order as any).netAmount ?? order.totalAmount;
      for (const product of order.products) {
        const cat = mapCollectionToCategory(product.category);
        const ratio = order.totalAmount > 0 ? product.totalPrice / order.totalAmount : 0;
        revenueByCategory[cat] = (revenueByCategory[cat] || 0) + (netAmt * ratio);
      }
    }

    return data.adsets
      .filter(a => campaignFilter === 'all' || a.campaign_name === campaignFilter)
      .map(a => {
        const key = `${a.campaign_name}::${a.adset_name}`;
        const category = adsetCategories[key] || 'Altro';
        const spend = parseFloat(a.spend || '0');
        const catRevenue = revenueByCategory[category] || 0;
        // Proportion of spend this adset represents within its category
        const totalCatSpend = data.adsets!
          .filter(x => (adsetCategories[`${x.campaign_name}::${x.adset_name}`] || 'Altro') === category)
          .reduce((s, x) => s + parseFloat(x.spend || '0'), 0);
        const allocatedRevenue = totalCatSpend > 0 ? catRevenue * (spend / totalCatSpend) : 0;
        const mer = spend > 0 ? allocatedRevenue / spend : 0;
        return {
          name: a.adset_name,
          campaignName: a.campaign_name,
          category,
          spend,
          allocatedRevenue,
          mer,
        };
      })
      .sort((a, b) => b.spend - a.spend);
  }, [data, shopifyOrders, dateRange, campaignFilter, adsetCategories]);

  // UTM cross-reference: match ad UTM tags with Shopify order UTMs
  const utmCrossRef = useMemo(() => {
    if (!creativesData?.ads || !shopifyOrders.length) return [];

    const adsByUtmCampaign = new Map<string, { adName: string; campaignName: string; adsetName: string; spend: number; clicks: number; impressions: number }[]>();
    for (const ad of creativesData.ads) {
      const utms = parseUrlTags(ad.url_tags);
      const utmCampaign = utms.utm_campaign || utms.utm_content || '';
      if (!utmCampaign) continue;
      const key = utmCampaign.toLowerCase();
      if (!adsByUtmCampaign.has(key)) adsByUtmCampaign.set(key, []);
      adsByUtmCampaign.get(key)!.push({
        adName: ad.name,
        campaignName: ad.campaign_name,
        adsetName: ad.adset_name,
        spend: parseFloat(ad.spend),
        clicks: parseInt(ad.clicks),
        impressions: parseInt(ad.impressions),
      });
    }

    const matches: { orderNumber: string; orderDate: string; orderAmount: number; netAmount: number; utmSource: string; utmCampaign: string; utmContent: string; matchedAd: string; matchedCampaign: string }[] = [];

    const filteredOrders = shopifyOrders.filter(o => {
      if (o.customerType !== 'B2C') return false;
      const d = o.date instanceof Date ? o.date : new Date(o.date);
      return d >= dateRange.start && d <= dateRange.end;
    });

    for (const order of filteredOrders) {
      const utm = (order as any).utm as Record<string, string> | null;
      if (!utm) continue;
      const utmCampaign = (utm.utm_campaign || '').toLowerCase();
      const utmContent = (utm.utm_content || '').toLowerCase();
      let matchedAds = adsByUtmCampaign.get(utmCampaign);
      if (!matchedAds && utmContent) matchedAds = adsByUtmCampaign.get(utmContent);
      const orderDate = order.date instanceof Date ? order.date : new Date(order.date);
      matches.push({
        orderNumber: order.orderNumber,
        orderDate: format(orderDate, 'dd/MM/yy'),
        orderAmount: order.totalAmount,
        netAmount: (order as any).netAmount ?? order.totalAmount,
        utmSource: utm.utm_source || '-',
        utmCampaign: utm.utm_campaign || '-',
        utmContent: utm.utm_content || '-',
        matchedAd: matchedAds?.[0]?.adName || '-',
        matchedCampaign: matchedAds?.[0]?.campaignName || '-',
      });
    }

    return matches.sort((a, b) => b.netAmount - a.netAmount);
  }, [creativesData, shopifyOrders, dateRange]);

  // Export handlers
  const handleExportDaily = () => {
    downloadCsv('meta-ads-daily', ['Data', 'Spesa', 'Impressioni', 'Click', 'CTR%', 'CPC', 'Reach', 'Acquisti'],
      chartData.map(r => [r.date, r.spend.toFixed(2), r.impressions, r.clicks, r.ctr.toFixed(2), r.cpc.toFixed(2), r.reach, r.purchases]));
  };
  const handleExportCampaigns = () => {
    downloadCsv('meta-ads-campaigns', ['Campagna', 'Categoria', 'Spesa', 'Impressioni', 'Click', 'CTR%', 'CPC', 'Acquisti', 'ROAS'],
      campaignData.map(r => [r.name, r.category, r.spend.toFixed(2), r.impressions, r.clicks, r.ctr.toFixed(2), r.cpc.toFixed(2), r.purchases, r.roas.toFixed(2)]));
  };
  const handleExportAdsets = () => {
    downloadCsv('meta-ads-adsets', ['Gruppo Inserzioni', 'Campagna', 'Categoria', 'Spesa', 'Impressioni', 'Click', 'CTR%', 'Acquisti', 'ROAS'],
      adsetData.map(r => [r.name, r.campaignName, r.category, r.spend.toFixed(2), r.impressions, r.clicks, r.ctr.toFixed(2), r.purchases, r.roas.toFixed(2)]));
  };
  const handleExportMER = () => {
    downloadCsv('meta-ads-mer', ['Categoria', 'Spesa Ads', 'Net Sales B2C', 'MER'],
      merData.map(r => [r.category, r.spend.toFixed(2), r.revenue.toFixed(2), r.mer.toFixed(2)]));
  };
  const handleExportUtmContent = () => {
    downloadCsv('utm-content-sales', ['UTM Content', 'Net Sales B2C', 'N. Ordini'],
      utmContentSales.map(r => [r.utmContent, r.netSales.toFixed(2), r.orderCount]));
  };
  const handleExportAdsetMer = () => {
    downloadCsv('adset-mer', ['Gruppo Inserzioni', 'Campagna', 'Categoria', 'Spesa Ads', 'Net Sales B2C Allocato', 'MER'],
      adsetMerData.map(r => [r.name, r.campaignName, r.category, r.spend.toFixed(2), r.allocatedRevenue.toFixed(2), r.mer.toFixed(2)]));
  };
  const handleExportUtm = () => {
    downloadCsv('meta-utm-match', ['Ordine', 'Data', 'Importo Netto', 'UTM Source', 'UTM Campaign', 'UTM Content', 'Ad Matched', 'Campagna Meta'],
      utmCrossRef.map(r => [r.orderNumber, r.orderDate, r.netAmount.toFixed(2), r.utmSource, r.utmCampaign, r.utmContent, r.matchedAd, r.matchedCampaign]));
  };

  const fmtCurrency = (v: number) => `€${v.toFixed(2)}`;
  const fmtNumber = (v: number) => v.toLocaleString('it-IT');
  const fmtPct = (v: number) => `${v.toFixed(2)}%`;

  return (
    <div className="min-h-screen bg-background text-foreground p-6 md:p-10">
      <DashboardHeader onRefresh={() => refetch()} isLoading={isFetching} />

      <div className="flex gap-2 mb-6">
        <NavLink to="/" className="px-4 py-2 rounded-lg text-sm font-medium bg-secondary text-secondary-foreground hover:bg-secondary/80 transition-colors" activeClassName="bg-primary text-primary-foreground">Sales Dashboard</NavLink>
        <NavLink to="/meta-ads" className="px-4 py-2 rounded-lg text-sm font-medium bg-secondary text-secondary-foreground hover:bg-secondary/80 transition-colors" activeClassName="bg-primary text-primary-foreground">Meta Ads</NavLink>
      </div>

      {/* Filters */}
      <div className="flex gap-3 mb-6 flex-wrap items-center">
        <Popover>
          <PopoverTrigger asChild>
            <Button variant="outline" className={cn('justify-start text-left font-normal w-[200px]')}>
              <CalendarIcon className="mr-2 h-4 w-4" />{format(dateRange.start, 'dd MMM yyyy', { locale: it })}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-0"><Calendar mode="single" selected={dateRange.start} onSelect={(d) => d && setDateRange(prev => ({ ...prev, start: d }))} /></PopoverContent>
        </Popover>
        <span className="text-muted-foreground">→</span>
        <Popover>
          <PopoverTrigger asChild>
            <Button variant="outline" className={cn('justify-start text-left font-normal w-[200px]')}>
              <CalendarIcon className="mr-2 h-4 w-4" />{format(dateRange.end, 'dd MMM yyyy', { locale: it })}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-0"><Calendar mode="single" selected={dateRange.end} onSelect={(d) => d && setDateRange(prev => ({ ...prev, end: d }))} /></PopoverContent>
        </Popover>
        <Select value={campaignFilter} onValueChange={setCampaignFilter}>
          <SelectTrigger className="w-[280px]"><SelectValue placeholder="Tutte le campagne" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Tutte le campagne</SelectItem>
            {campaignNames.map(name => (<SelectItem key={name} value={name}>{name}</SelectItem>))}
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
          {/* KPIs */}
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-4 mb-8">
            <KPICard data={{ label: 'Spesa Totale', value: kpis.totalSpend, trend: 'neutral', format: 'currency' }} />
            <KPICard data={{ label: 'Impressioni', value: kpis.totalImpressions, trend: 'neutral', format: 'number' }} />
            <KPICard data={{ label: 'Click', value: kpis.totalClicks, trend: 'neutral', format: 'number' }} />
            <KPICard data={{ label: 'CTR', value: kpis.ctr, trend: 'neutral', format: 'percent' }} />
            <KPICard data={{ label: 'Acquisti', value: kpis.totalPurchases, trend: 'neutral', format: 'number' }} />
            <KPICard data={{ label: 'ROAS', value: kpis.roas, trend: kpis.roas >= 1 ? 'up' : 'down', format: 'number' }} />
            <KPICard data={{ label: 'MER (B2C Net)', value: totalMER, trend: totalMER >= 1 ? 'up' : 'down', format: 'number' }} />
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
              <CardHeader className="pb-2"><CardTitle className="text-sm font-medium">Click & CTR</CardTitle></CardHeader>
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

          {/* Creatives - Lazy */}
          <Card className="mb-6">
            <CardHeader className="pb-2">
              <button onClick={() => setShowCreatives(!showCreatives)} className="flex items-center gap-2 text-sm font-medium hover:text-primary transition-colors w-full text-left">
                <ImageIcon className="w-4 h-4" /> Creatività
                <ChevronDown className={cn("w-4 h-4 transition-transform", showCreatives && "rotate-180")} />
                {isLoadingCreatives && showCreatives && <Loader2 className="w-3 h-3 animate-spin ml-2" />}
              </button>
            </CardHeader>
            {showCreatives && (
              <CardContent>
                {isLoadingCreatives ? (
                  <div className="flex items-center justify-center py-8"><Loader2 className="w-5 h-5 animate-spin text-primary" /><span className="ml-2 text-sm text-muted-foreground">Caricamento...</span></div>
                ) : adsData.length > 0 ? (
                  <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
                    {adsData.slice(0, 20).map((ad) => (
                      <div key={ad.id} className="rounded-lg border border-border bg-secondary/30 overflow-hidden">
                        {ad.thumbnail_url ? (
                          <img src={ad.thumbnail_url} alt={ad.name} className="w-full aspect-square object-cover" loading="lazy" />
                        ) : (
                          <div className="w-full aspect-square bg-muted flex items-center justify-center"><ImageIcon className="w-8 h-8 text-muted-foreground" /></div>
                        )}
                        <div className="p-3">
                          <p className="text-xs font-medium truncate mb-1">{ad.name}</p>
                          <p className="text-[10px] text-muted-foreground truncate">{ad.adset_name}</p>
                          <p className="text-[10px] text-muted-foreground truncate mb-2">{ad.campaign_name}</p>
                          <div className="flex items-center justify-between text-[10px]">
                            <span>€{parseFloat(ad.spend).toFixed(2)}</span>
                            <span>{fmtNumber(parseInt(ad.clicks))} click</span>
                          </div>
                          {ad.url_tags && (
                            <p className="text-[9px] text-muted-foreground mt-1 truncate" title={ad.url_tags}>UTM: {ad.url_tags}</p>
                          )}
                          <Badge className={cn('mt-2 text-[9px]', categoryBadgeColors[campaignCategories[ad.campaign_name] || 'Altro'] || categoryBadgeColors['Altro'])}>
                            {campaignCategories[ad.campaign_name] || 'Altro'}
                          </Badge>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground text-center py-4">Nessuna creatività trovata</p>
                )}
              </CardContent>
            )}
          </Card>

          {/* Campaigns Table */}
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
                      <th className="text-left py-3 px-2 text-muted-foreground font-medium">Categoria</th>
                      <th className="text-right py-3 px-2 text-muted-foreground font-medium">Spesa</th>
                      <th className="text-right py-3 px-2 text-muted-foreground font-medium">Impr.</th>
                      <th className="text-right py-3 px-2 text-muted-foreground font-medium">Click</th>
                      <th className="text-right py-3 px-2 text-muted-foreground font-medium">CTR</th>
                      <th className="text-right py-3 px-2 text-muted-foreground font-medium">Acquisti</th>
                      <th className="text-right py-3 px-2 text-muted-foreground font-medium">ROAS</th>
                    </tr>
                  </thead>
                  <tbody>
                    {campaignData.map((c, i) => (
                      <tr key={i} className="border-b border-border/50 hover:bg-secondary/30 transition-colors">
                        <td className="py-3 px-2 font-medium truncate max-w-[200px]">{c.name}</td>
                        <td className="py-3 px-2">
                          <Select value={c.category} onValueChange={(val) => setCategoryOverrides(prev => ({ ...prev, [c.name]: val }))}>
                            <SelectTrigger className="h-7 text-xs w-[150px]"><SelectValue /></SelectTrigger>
                            <SelectContent>{ALL_CATEGORIES.map(cat => (<SelectItem key={cat} value={cat}>{cat}</SelectItem>))}</SelectContent>
                          </Select>
                        </td>
                        <td className="text-right py-3 px-2">{fmtCurrency(c.spend)}</td>
                        <td className="text-right py-3 px-2">{fmtNumber(c.impressions)}</td>
                        <td className="text-right py-3 px-2">{fmtNumber(c.clicks)}</td>
                        <td className="text-right py-3 px-2">{fmtPct(c.ctr)}</td>
                        <td className="text-right py-3 px-2">{c.purchases}</td>
                        <td className="text-right py-3 px-2 font-semibold">{c.roas.toFixed(2)}x</td>
                      </tr>
                    ))}
                    {campaignData.length === 0 && (<tr><td colSpan={8} className="text-center py-6 text-muted-foreground">Nessuna campagna</td></tr>)}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>

          {/* Adset Table */}
          <Card className="mb-6">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Gruppi di Inserzioni (Ad Sets)</CardTitle>
              <Button variant="ghost" size="icon" onClick={handleExportAdsets}><Download className="w-4 h-4" /></Button>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border">
                      <th className="text-left py-3 px-2 text-muted-foreground font-medium">Gruppo Inserzioni</th>
                      <th className="text-left py-3 px-2 text-muted-foreground font-medium">Campagna</th>
                      <th className="text-left py-3 px-2 text-muted-foreground font-medium">Categoria</th>
                      <th className="text-right py-3 px-2 text-muted-foreground font-medium">Spesa</th>
                      <th className="text-right py-3 px-2 text-muted-foreground font-medium">Impr.</th>
                      <th className="text-right py-3 px-2 text-muted-foreground font-medium">Click</th>
                      <th className="text-right py-3 px-2 text-muted-foreground font-medium">CTR</th>
                      <th className="text-right py-3 px-2 text-muted-foreground font-medium">Acquisti</th>
                      <th className="text-right py-3 px-2 text-muted-foreground font-medium">ROAS</th>
                    </tr>
                  </thead>
                  <tbody>
                    {adsetData.map((a, i) => (
                      <tr key={i} className="border-b border-border/50 hover:bg-secondary/30 transition-colors">
                        <td className="py-3 px-2 font-medium truncate max-w-[180px]">{a.name}</td>
                        <td className="py-3 px-2 text-muted-foreground truncate max-w-[150px]">{a.campaignName}</td>
                        <td className="py-3 px-2">
                          <Select value={a.category} onValueChange={(val) => setAdsetCategoryOverrides(prev => ({ ...prev, [a.key]: val }))}>
                            <SelectTrigger className="h-7 text-xs w-[150px]"><SelectValue /></SelectTrigger>
                            <SelectContent>{ALL_CATEGORIES.map(cat => (<SelectItem key={cat} value={cat}>{cat}</SelectItem>))}</SelectContent>
                          </Select>
                        </td>
                        <td className="text-right py-3 px-2">{fmtCurrency(a.spend)}</td>
                        <td className="text-right py-3 px-2">{fmtNumber(a.impressions)}</td>
                        <td className="text-right py-3 px-2">{fmtNumber(a.clicks)}</td>
                        <td className="text-right py-3 px-2">{fmtPct(a.ctr)}</td>
                        <td className="text-right py-3 px-2">{a.purchases}</td>
                        <td className="text-right py-3 px-2 font-semibold">{a.roas.toFixed(2)}x</td>
                      </tr>
                    ))}
                    {adsetData.length === 0 && (<tr><td colSpan={9} className="text-center py-6 text-muted-foreground">Nessun gruppo di inserzioni</td></tr>)}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>

          {/* MER Table - B2C Net Sales only */}
          <Card className="mb-6">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">MER per Categoria (Net Sales B2C)</CardTitle>
              <Button variant="ghost" size="icon" onClick={handleExportMER}><Download className="w-4 h-4" /></Button>
            </CardHeader>
            <CardContent>
              <p className="text-xs text-muted-foreground mb-4">MER = Net Sales B2C / Spesa Ads — escluso B2B, al netto di resi e sconti</p>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border">
                      <th className="text-left py-3 px-2 text-muted-foreground font-medium">Categoria</th>
                      <th className="text-right py-3 px-2 text-muted-foreground font-medium">Spesa Ads</th>
                      <th className="text-right py-3 px-2 text-muted-foreground font-medium">Net Sales B2C</th>
                      <th className="text-right py-3 px-2 text-muted-foreground font-medium">MER</th>
                    </tr>
                  </thead>
                  <tbody>
                    {merData.map((m, i) => (
                      <tr key={i} className="border-b border-border/50 hover:bg-secondary/30 transition-colors">
                        <td className="py-3 px-2"><Badge className={cn('text-xs', categoryBadgeColors[m.category] || categoryBadgeColors['Altro'])}>{m.category}</Badge></td>
                        <td className="text-right py-3 px-2">{fmtCurrency(m.spend)}</td>
                        <td className="text-right py-3 px-2">{fmtCurrency(m.revenue)}</td>
                        <td className={cn("text-right py-3 px-2 font-bold", m.mer >= 1 ? 'text-success' : 'text-destructive')}>{m.mer.toFixed(2)}x</td>
                      </tr>
                    ))}
                    {merData.length > 0 && (
                      <tr className="border-t-2 border-border bg-secondary/20">
                        <td className="py-3 px-2 font-bold">TOTALE</td>
                        <td className="text-right py-3 px-2 font-bold">{fmtCurrency(merData.reduce((s, m) => s + m.spend, 0))}</td>
                        <td className="text-right py-3 px-2 font-bold">{fmtCurrency(merData.reduce((s, m) => s + m.revenue, 0))}</td>
                        <td className={cn("text-right py-3 px-2 font-bold", totalMER >= 1 ? 'text-success' : 'text-destructive')}>{totalMER.toFixed(2)}x</td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>

          {/* UTM Content → Net Sales B2C */}
          <Card className="mb-6">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Net Sales B2C per UTM Content</CardTitle>
              <Button variant="ghost" size="icon" onClick={handleExportUtmContent}><Download className="w-4 h-4" /></Button>
            </CardHeader>
            <CardContent>
              <p className="text-xs text-muted-foreground mb-4">Vendite nette B2C aggregate per valore utm_content degli ordini Shopify</p>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border">
                      <th className="text-left py-3 px-2 text-muted-foreground font-medium">UTM Content</th>
                      <th className="text-right py-3 px-2 text-muted-foreground font-medium">Net Sales B2C</th>
                      <th className="text-right py-3 px-2 text-muted-foreground font-medium">N. Ordini</th>
                      <th className="text-right py-3 px-2 text-muted-foreground font-medium">AOV Netto</th>
                    </tr>
                  </thead>
                  <tbody>
                    {utmContentSales.map((r, i) => (
                      <tr key={i} className="border-b border-border/50 hover:bg-secondary/30 transition-colors">
                        <td className="py-3 px-2 font-medium truncate max-w-[250px]">{r.utmContent}</td>
                        <td className="text-right py-3 px-2 font-semibold">{fmtCurrency(r.netSales)}</td>
                        <td className="text-right py-3 px-2">{r.orderCount}</td>
                        <td className="text-right py-3 px-2">{fmtCurrency(r.orderCount > 0 ? r.netSales / r.orderCount : 0)}</td>
                      </tr>
                    ))}
                    {utmContentSales.length > 0 && (
                      <tr className="border-t-2 border-border bg-secondary/20">
                        <td className="py-3 px-2 font-bold">TOTALE</td>
                        <td className="text-right py-3 px-2 font-bold">{fmtCurrency(utmContentSales.reduce((s, r) => s + r.netSales, 0))}</td>
                        <td className="text-right py-3 px-2 font-bold">{utmContentSales.reduce((s, r) => s + r.orderCount, 0)}</td>
                        <td className="text-right py-3 px-2 font-bold">{fmtCurrency(utmContentSales.reduce((s, r) => s + r.netSales, 0) / Math.max(utmContentSales.reduce((s, r) => s + r.orderCount, 0), 1))}</td>
                      </tr>
                    )}
                    {utmContentSales.length === 0 && (<tr><td colSpan={4} className="text-center py-6 text-muted-foreground">Nessun ordine con utm_content nel periodo</td></tr>)}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>

          {/* Adset MER: ad set spend vs B2C net sales by category */}
          <Card className="mb-6">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">MER per Gruppo di Inserzione (Adset ↔ Net Sales B2C)</CardTitle>
              <Button variant="ghost" size="icon" onClick={handleExportAdsetMer}><Download className="w-4 h-4" /></Button>
            </CardHeader>
            <CardContent>
              <p className="text-xs text-muted-foreground mb-4">Net Sales B2C allocato proporzionalmente alla spesa di ogni adset nella stessa categoria</p>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border">
                      <th className="text-left py-3 px-2 text-muted-foreground font-medium">Gruppo Inserzioni</th>
                      <th className="text-left py-3 px-2 text-muted-foreground font-medium">Campagna</th>
                      <th className="text-left py-3 px-2 text-muted-foreground font-medium">Categoria</th>
                      <th className="text-right py-3 px-2 text-muted-foreground font-medium">Spesa Ads</th>
                      <th className="text-right py-3 px-2 text-muted-foreground font-medium">Net Sales Allocato</th>
                      <th className="text-right py-3 px-2 text-muted-foreground font-medium">MER</th>
                    </tr>
                  </thead>
                  <tbody>
                    {adsetMerData.map((r, i) => (
                      <tr key={i} className="border-b border-border/50 hover:bg-secondary/30 transition-colors">
                        <td className="py-3 px-2 font-medium truncate max-w-[180px]">{r.name}</td>
                        <td className="py-3 px-2 text-muted-foreground truncate max-w-[150px]">{r.campaignName}</td>
                        <td className="py-3 px-2"><Badge className={cn('text-xs', categoryBadgeColors[r.category] || categoryBadgeColors['Altro'])}>{r.category}</Badge></td>
                        <td className="text-right py-3 px-2">{fmtCurrency(r.spend)}</td>
                        <td className="text-right py-3 px-2">{fmtCurrency(r.allocatedRevenue)}</td>
                        <td className={cn("text-right py-3 px-2 font-bold", r.mer >= 1 ? 'text-success' : 'text-destructive')}>{r.mer.toFixed(2)}x</td>
                      </tr>
                    ))}
                    {adsetMerData.length > 0 && (() => {
                      const totSpend = adsetMerData.reduce((s, r) => s + r.spend, 0);
                      const totRev = adsetMerData.reduce((s, r) => s + r.allocatedRevenue, 0);
                      const totMer = totSpend > 0 ? totRev / totSpend : 0;
                      return (
                        <tr className="border-t-2 border-border bg-secondary/20">
                          <td className="py-3 px-2 font-bold" colSpan={3}>TOTALE</td>
                          <td className="text-right py-3 px-2 font-bold">{fmtCurrency(totSpend)}</td>
                          <td className="text-right py-3 px-2 font-bold">{fmtCurrency(totRev)}</td>
                          <td className={cn("text-right py-3 px-2 font-bold", totMer >= 1 ? 'text-success' : 'text-destructive')}>{totMer.toFixed(2)}x</td>
                        </tr>
                      );
                    })()}
                    {adsetMerData.length === 0 && (<tr><td colSpan={6} className="text-center py-6 text-muted-foreground">Nessun dato</td></tr>)}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>


          <Card>
            <CardHeader className="pb-2">
              <button onClick={() => setShowUtmMatch(!showUtmMatch)} className="flex items-center gap-2 text-sm font-medium hover:text-primary transition-colors w-full text-left">
                <Link2 className="w-4 h-4" /> UTM Cross-Reference (Ordini Shopify ↔ Meta Ads)
                <ChevronDown className={cn("w-4 h-4 transition-transform", showUtmMatch && "rotate-180")} />
                {showUtmMatch && utmCrossRef.length > 0 && <Badge variant="secondary" className="ml-2 text-[10px]">{utmCrossRef.length} match</Badge>}
              </button>
            </CardHeader>
            {showUtmMatch && (
              <CardContent>
                {isLoadingCreatives ? (
                  <div className="flex items-center justify-center py-8"><Loader2 className="w-5 h-5 animate-spin text-primary" /><span className="ml-2 text-sm text-muted-foreground">Caricamento...</span></div>
                ) : utmCrossRef.length > 0 ? (
                  <>
                    <div className="flex justify-end mb-3">
                      <Button variant="ghost" size="sm" onClick={handleExportUtm}><Download className="w-4 h-4 mr-1" /> CSV</Button>
                    </div>
                    <div className="overflow-x-auto">
                      <table className="w-full text-xs">
                        <thead>
                          <tr className="border-b border-border">
                            <th className="text-left py-2 px-2 text-muted-foreground font-medium">Ordine</th>
                            <th className="text-left py-2 px-2 text-muted-foreground font-medium">Data</th>
                            <th className="text-right py-2 px-2 text-muted-foreground font-medium">Netto</th>
                            <th className="text-left py-2 px-2 text-muted-foreground font-medium">UTM Source</th>
                            <th className="text-left py-2 px-2 text-muted-foreground font-medium">UTM Campaign</th>
                            <th className="text-left py-2 px-2 text-muted-foreground font-medium">UTM Content</th>
                            <th className="text-left py-2 px-2 text-muted-foreground font-medium">Ad Matched</th>
                            <th className="text-left py-2 px-2 text-muted-foreground font-medium">Campagna Meta</th>
                          </tr>
                        </thead>
                        <tbody>
                          {utmCrossRef.slice(0, 50).map((r, i) => (
                            <tr key={i} className="border-b border-border/50 hover:bg-secondary/30 transition-colors">
                              <td className="py-2 px-2 font-medium">{r.orderNumber}</td>
                              <td className="py-2 px-2">{r.orderDate}</td>
                              <td className="text-right py-2 px-2">{fmtCurrency(r.netAmount)}</td>
                              <td className="py-2 px-2">{r.utmSource}</td>
                              <td className="py-2 px-2 truncate max-w-[120px]">{r.utmCampaign}</td>
                              <td className="py-2 px-2 truncate max-w-[120px]">{r.utmContent}</td>
                              <td className="py-2 px-2 truncate max-w-[150px]">{r.matchedAd !== '-' ? <span className="text-success">{r.matchedAd}</span> : <span className="text-muted-foreground">—</span>}</td>
                              <td className="py-2 px-2 truncate max-w-[150px]">{r.matchedCampaign !== '-' ? r.matchedCampaign : <span className="text-muted-foreground">—</span>}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                      {utmCrossRef.length > 50 && <p className="text-xs text-muted-foreground text-center mt-3">Mostrando 50 di {utmCrossRef.length} ordini con UTM. Esporta CSV per vedere tutti.</p>}
                    </div>
                  </>
                ) : (
                  <p className="text-sm text-muted-foreground text-center py-4">Nessun ordine Shopify con parametri UTM trovato nel periodo selezionato</p>
                )}
              </CardContent>
            )}
          </Card>
        </>
      )}
    </div>
  );
}
