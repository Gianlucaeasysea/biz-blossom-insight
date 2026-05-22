import { Trash2, Download, Sparkles, Target, Calendar, Users } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { format } from 'date-fns';
import { SavedCampaign, useDeleteCampaign } from '@/hooks/useSavedCampaigns';
import { downloadCsv } from '@/lib/csv-export';
import { toast } from 'sonner';

interface CustomerLite {
  id: string;
  name: string;
  email: string | null;
  country: string;
  totalSpent: number;
}

interface Props {
  campaigns: SavedCampaign[];
  customers: CustomerLite[];
  fmt: (v: number) => string;
  isLoading?: boolean;
}

export function CampaignHistory({ campaigns, customers, fmt, isLoading }: Props) {
  const del = useDeleteCampaign();

  const exportAudience = (c: SavedCampaign) => {
    const idSet = new Set(c.audience_ids);
    const rows: (string | number)[][] = [];
    customers.forEach(cu => {
      if (!idSet.has(cu.id)) return;
      rows.push([cu.email || '', cu.name, cu.country, Math.round(cu.totalSpent)]);
    });
    if (rows.length === 0) {
      toast.warning('Nessun cliente trovato nell\'audience (potrebbe essere fuori dal range date corrente)');
      return;
    }
    downloadCsv(
      `campagna-${c.name.replace(/\s+/g, '-')}-${format(new Date(c.created_at), 'yyyyMMdd')}`,
      ['Email', 'Nome', 'Paese', 'LTV €'],
      rows,
    );
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Eliminare definitivamente questa campagna?')) return;
    try {
      await del.mutateAsync(id);
      toast.success('Campagna eliminata');
    } catch (e: any) {
      toast.error(e.message || 'Errore eliminazione');
    }
  };

  if (isLoading) {
    return <div className="glass-card p-6 text-center text-sm text-muted-foreground">Caricamento campagne...</div>;
  }

  if (campaigns.length === 0) {
    return (
      <div className="glass-card p-8 text-center">
        <Sparkles className="w-8 h-8 mx-auto text-muted-foreground/40 mb-2" />
        <p className="text-sm font-semibold">Nessuna campagna salvata</p>
        <p className="text-xs text-muted-foreground mt-1">
          Crea una campagna dalla Lavagna interattiva e salvala qui per riusarla, esportare l'audience o generare nuovo copy AI.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {campaigns.map(c => (
        <div key={c.id} className="glass-card p-3">
          <div className="flex items-start justify-between gap-3 flex-wrap">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap mb-1">
                <h4 className="text-sm font-bold truncate">{c.name}</h4>
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-primary/15 text-primary font-semibold uppercase">
                  {c.objective}
                </span>
                {c.segment && (
                  <span className="text-[10px] px-2 py-0.5 rounded-full bg-muted text-muted-foreground font-semibold">
                    {c.segment}
                  </span>
                )}
                <span className="text-[10px] text-muted-foreground flex items-center gap-1">
                  <Calendar className="w-3 h-3" /> {format(new Date(c.created_at), 'dd/MM/yy HH:mm')}
                </span>
              </div>
              <div className="flex items-center gap-3 text-[11px] text-muted-foreground flex-wrap">
                <span className="flex items-center gap-1"><Users className="w-3 h-3" />{c.audience_size} clienti</span>
                <span className="flex items-center gap-1"><Target className="w-3 h-3" />sconto {c.discount_pct}%</span>
                <span className="font-mono">Revenue stimato: <span className="text-foreground font-semibold">{fmt(c.est_revenue_min)} – {fmt(c.est_revenue_max)}</span></span>
              </div>
              {c.product_names.length > 0 && (
                <div className="mt-1.5 flex flex-wrap gap-1">
                  {c.product_names.slice(0, 4).map(p => (
                    <span key={p} className="text-[10px] bg-muted/60 px-1.5 py-0.5 rounded">
                      {p.length > 28 ? p.slice(0, 28) + '…' : p}
                    </span>
                  ))}
                  {c.product_names.length > 4 && (
                    <span className="text-[10px] text-muted-foreground">+{c.product_names.length - 4}</span>
                  )}
                </div>
              )}
            </div>
            <div className="flex gap-1.5">
              <Button size="sm" variant="outline" className="h-7 text-[11px] gap-1" onClick={() => exportAudience(c)}>
                <Download className="w-3 h-3" /> CSV
              </Button>
              <Button size="sm" variant="ghost" className="h-7 text-destructive hover:text-destructive"
                onClick={() => handleDelete(c.id)}>
                <Trash2 className="w-3 h-3" />
              </Button>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
