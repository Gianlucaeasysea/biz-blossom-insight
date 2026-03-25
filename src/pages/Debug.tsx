import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { DashboardHeader } from '@/components/dashboard/DashboardHeader';
import { DraggableNav } from '@/components/DraggableNav';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Trash2, StickyNote, Plus } from 'lucide-react';
import { toast } from 'sonner';

interface Proposal {
  id: string;
  author: string;
  note: string;
  created_at: string;
}

export default function Debug() {
  const [proposals, setProposals] = useState<Proposal[]>([]);
  const [author, setAuthor] = useState('');
  const [note, setNote] = useState('');
  const [loading, setLoading] = useState(false);

  const fetchProposals = async () => {
    const { data, error } = await supabase
      .from('debug_proposals')
      .select('*')
      .order('created_at', { ascending: false });
    if (!error && data) setProposals(data);
  };

  useEffect(() => { fetchProposals(); }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!author.trim() || !note.trim()) return;
    setLoading(true);
    const { error } = await supabase.from('debug_proposals').insert({ author: author.trim(), note: note.trim() });
    if (error) {
      toast.error('Errore nel salvataggio');
    } else {
      toast.success('Nota aggiunta!');
      setNote('');
      fetchProposals();
    }
    setLoading(false);
  };

  const handleDelete = async (id: string) => {
    const { error } = await supabase.from('debug_proposals').delete().eq('id', id);
    if (!error) {
      setProposals(prev => prev.filter(p => p.id !== id));
      toast.success('Nota rimossa');
    }
  };

  const formatDate = (d: string) =>
    new Date(d).toLocaleDateString('it-IT', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });

  return (
    <div className="min-h-screen bg-background p-3 sm:p-6 lg:p-10">
      <div className="max-w-5xl mx-auto space-y-4">
        <DashboardHeader />
        <DraggableNav />

        <Card>
          <CardHeader className="pb-4">
            <CardTitle className="flex items-center gap-2 text-lg">
              <StickyNote className="w-5 h-5 text-primary" />
              Bacheca Modifiche Dashboard
            </CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="flex flex-col sm:flex-row gap-3 mb-6">
              <Input
                placeholder="Il tuo nome"
                value={author}
                onChange={e => setAuthor(e.target.value)}
                className="sm:w-48"
              />
              <Textarea
                placeholder="Descrivi la modifica proposta..."
                value={note}
                onChange={e => setNote(e.target.value)}
                className="min-h-[60px] flex-1"
              />
              <Button type="submit" disabled={loading || !author.trim() || !note.trim()} className="shrink-0 self-end">
                <Plus className="w-4 h-4 mr-1" /> Aggiungi
              </Button>
            </form>

            <div className="space-y-3">
              {proposals.length === 0 && (
                <p className="text-muted-foreground text-sm text-center py-8">Nessuna nota ancora. Aggiungi la prima!</p>
              )}
              {proposals.map(p => (
                <div key={p.id} className="flex items-start gap-3 p-4 rounded-lg border bg-muted/30 group">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="font-semibold text-sm text-foreground">{p.author}</span>
                      <span className="text-xs text-muted-foreground">{formatDate(p.created_at)}</span>
                    </div>
                    <p className="text-sm text-foreground/80 whitespace-pre-wrap">{p.note}</p>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => handleDelete(p.id)}
                    className="shrink-0 opacity-0 group-hover:opacity-100 transition-opacity text-muted-foreground hover:text-destructive h-8 w-8"
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
