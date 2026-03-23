import { useState, useEffect, useCallback } from 'react';
import { Plus, MessageSquare, Trash2, Check, X, Pencil } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/supabase/client';
import { cn } from '@/lib/utils';

export interface Conversation {
  id: string;
  title: string;
  created_at: string;
  updated_at: string;
}

interface Props {
  activeId: string | null;
  onSelect: (id: string) => void;
  onNew: () => void;
}

export function ConversationList({ activeId, onSelect, onNew }: Props) {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState('');

  const load = useCallback(async () => {
    const { data } = await supabase
      .from('frank_conversations')
      .select('*')
      .order('updated_at', { ascending: false });
    if (data) setConversations(data as Conversation[]);
  }, []);

  useEffect(() => { load(); }, [load]);

  // Reload when activeId changes (new conversation created externally)
  useEffect(() => { load(); }, [activeId, load]);

  const handleDelete = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    await supabase.from('frank_conversations').delete().eq('id', id);
    load();
    if (activeId === id) onNew();
  };

  const startEdit = (conv: Conversation, e: React.MouseEvent) => {
    e.stopPropagation();
    setEditingId(conv.id);
    setEditTitle(conv.title);
  };

  const saveEdit = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (editingId && editTitle.trim()) {
      await supabase.from('frank_conversations').update({ title: editTitle.trim() }).eq('id', editingId);
      load();
    }
    setEditingId(null);
  };

  return (
    <div className="flex flex-col h-full">
      <div className="p-3 border-b border-border">
        <Button variant="outline" size="sm" className="w-full justify-start gap-2" onClick={onNew}>
          <Plus className="w-4 h-4" /> Nuova chat
        </Button>
      </div>
      <div className="flex-1 overflow-y-auto p-2 space-y-1">
        {conversations.length === 0 && (
          <p className="text-xs text-muted-foreground text-center py-4">Nessuna conversazione</p>
        )}
        {conversations.map(conv => (
          <button
            key={conv.id}
            onClick={() => onSelect(conv.id)}
            className={cn(
              'w-full text-left px-3 py-2 rounded-lg text-sm flex items-center gap-2 group transition-colors',
              activeId === conv.id
                ? 'bg-primary/10 text-primary font-medium'
                : 'hover:bg-muted text-foreground'
            )}
          >
            <MessageSquare className="w-3.5 h-3.5 shrink-0 opacity-60" />
            {editingId === conv.id ? (
              <div className="flex-1 flex items-center gap-1" onClick={e => e.stopPropagation()}>
                <input
                  value={editTitle}
                  onChange={e => setEditTitle(e.target.value)}
                  className="flex-1 bg-background border border-input rounded px-1.5 py-0.5 text-xs"
                  autoFocus
                  onKeyDown={e => { if (e.key === 'Enter') saveEdit(e as any); if (e.key === 'Escape') setEditingId(null); }}
                />
                <button onClick={saveEdit} className="p-0.5 hover:text-primary"><Check className="w-3 h-3" /></button>
                <button onClick={(e) => { e.stopPropagation(); setEditingId(null); }} className="p-0.5 hover:text-destructive"><X className="w-3 h-3" /></button>
              </div>
            ) : (
              <>
                <span className="flex-1 truncate">{conv.title}</span>
                <span className="hidden group-hover:flex items-center gap-0.5">
                  <button onClick={(e) => startEdit(conv, e)} className="p-0.5 hover:text-primary"><Pencil className="w-3 h-3" /></button>
                  <button onClick={(e) => handleDelete(conv.id, e)} className="p-0.5 hover:text-destructive"><Trash2 className="w-3 h-3" /></button>
                </span>
              </>
            )}
          </button>
        ))}
      </div>
    </div>
  );
}
