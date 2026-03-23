import { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import { Bot, Send, Paperclip, Download, Trash2, User, FileText, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { DraggableNav } from '@/components/DraggableNav';
import ReactMarkdown from 'react-markdown';
import { useShopifyOrders } from '@/hooks/useShopifyOrders';
import { useGoogleSheetsOrders } from '@/hooks/useGoogleSheetsOrders';
import { useShopifyProducts } from '@/hooks/useShopifyProducts';
import { downloadCsv } from '@/lib/csv-export';

type Msg = { role: 'user' | 'assistant'; content: string; files?: UploadedFile[] };
type UploadedFile = { name: string; content: string; type: string };

const CHAT_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/frank-ai`;

export default function Frank() {
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [uploadedFiles, setUploadedFiles] = useState<UploadedFile[]>([]);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const { data: shopifyOrders } = useShopifyOrders();
  const { data: b2bOrders } = useGoogleSheetsOrders();
  const { data: products } = useShopifyProducts();

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const dataContext = useMemo(() => {
    const parts: string[] = [];

    if (shopifyOrders?.length) {
      const total = shopifyOrders.reduce((s, o) => s + (o.netAmount ?? o.totalAmount), 0);
      const fulfilled = shopifyOrders.filter(o => o.status === 'completed');
      const fulfilledTotal = fulfilled.reduce((s, o) => s + (o.netAmount ?? o.totalAmount), 0);
      const countries = new Map<string, number>();
      shopifyOrders.forEach(o => {
        const c = o.country || 'Unknown';
        countries.set(c, (countries.get(c) || 0) + (o.netAmount ?? o.totalAmount));
      });
      const skuMap = new Map<string, { qty: number; rev: number }>();
      shopifyOrders.forEach(o => o.products.forEach(p => {
        const k = p.sku || p.name;
        const e = skuMap.get(k) || { qty: 0, rev: 0 };
        e.qty += p.quantity; e.rev += p.totalPrice;
        skuMap.set(k, e);
      }));
      const topSkus = [...skuMap.entries()].sort((a, b) => b[1].rev - a[1].rev).slice(0, 20);

      parts.push(`=== DATI B2C (Shopify) ===
Totale ordini: ${shopifyOrders.length}
Net Sales totale: €${total.toFixed(0)}
Ordini evasi: ${fulfilled.length} (€${fulfilledTotal.toFixed(0)})
Top 20 SKU per revenue: ${topSkus.map(([k, v]) => `${k}: ${v.qty}pz €${v.rev.toFixed(0)}`).join('; ')}
Paesi: ${[...countries.entries()].sort((a, b) => b[1] - a[1]).map(([c, v]) => `${c}: €${v.toFixed(0)}`).join('; ')}
Range date: ${shopifyOrders.length ? shopifyOrders[shopifyOrders.length - 1].date + ' → ' + shopifyOrders[0].date : 'N/A'}`);
    }

    if (b2bOrders?.length) {
      const total = b2bOrders.reduce((s, o) => s + o.totalAmount, 0);
      const byClient = new Map<string, number>();
      b2bOrders.forEach(o => byClient.set(o.customerName, (byClient.get(o.customerName) || 0) + o.totalAmount));
      const topClients = [...byClient.entries()].sort((a, b) => b[1] - a[1]).slice(0, 15);

      parts.push(`=== DATI B2B (Google Sheets) ===
Totale ordini: ${b2bOrders.length}
Fatturato totale: €${total.toFixed(0)}
Top 15 clienti: ${topClients.map(([c, v]) => `${c}: €${v.toFixed(0)}`).join('; ')}`);
    }

    if (products?.length) {
      const inStock = products.filter(p => p.totalInventory > 0);
      const outOfStock = products.filter(p => p.totalInventory <= 0);
      parts.push(`=== STOCK PRODOTTI ===
Totale varianti: ${products.length}
In stock: ${inStock.length}
Esauriti: ${outOfStock.length}
Dettaglio stock: ${products.slice(0, 30).map(p => `${p.sku || p.title}: ${p.totalInventory}pz`).join('; ')}`);
    }

    return parts.join('\n\n') || 'Dati non ancora caricati.';
  }, [shopifyOrders, b2bOrders, products]);

  const handleFileUpload = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;
    
    for (const file of Array.from(files)) {
      const reader = new FileReader();
      reader.onload = () => {
        const content = reader.result as string;
        setUploadedFiles(prev => [...prev, { name: file.name, content, type: file.type }]);
      };
      if (file.type.startsWith('text/') || file.name.endsWith('.csv') || file.name.endsWith('.json') || file.name.endsWith('.md') || file.name.endsWith('.txt')) {
        reader.readAsText(file);
      } else {
        reader.readAsDataURL(file);
      }
    }
    e.target.value = '';
  }, []);

  const removeFile = useCallback((idx: number) => {
    setUploadedFiles(prev => prev.filter((_, i) => i !== idx));
  }, []);

  const extractDownloadables = useCallback((content: string) => {
    const csvBlocks: { label: string; data: string }[] = [];
    const csvRegex = /```csv\n([\s\S]*?)```/g;
    let match;
    while ((match = csvRegex.exec(content)) !== null) {
      csvBlocks.push({ label: 'CSV', data: match[1].trim() });
    }
    return csvBlocks;
  }, []);

  const handleDownloadCsv = useCallback((data: string, idx: number) => {
    const blob = new Blob(['\uFEFF' + data], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `frank-export-${idx + 1}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }, []);

  const sendMessage = useCallback(async () => {
    const text = input.trim();
    if (!text || isLoading) return;

    const userMsg: Msg = { role: 'user', content: text, files: uploadedFiles.length ? [...uploadedFiles] : undefined };
    setInput('');
    setUploadedFiles([]);
    setMessages(prev => [...prev, userMsg]);
    setIsLoading(true);

    let assistantSoFar = '';
    const upsertAssistant = (chunk: string) => {
      assistantSoFar += chunk;
      setMessages(prev => {
        const last = prev[prev.length - 1];
        if (last?.role === 'assistant') {
          return prev.map((m, i) => (i === prev.length - 1 ? { ...m, content: assistantSoFar } : m));
        }
        return [...prev, { role: 'assistant', content: assistantSoFar }];
      });
    };

    const fileContents = userMsg.files?.map(f => `[File: ${f.name}]\n${f.content}`).join('\n\n') || '';

    try {
      const resp = await fetch(CHAT_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
        },
        body: JSON.stringify({
          messages: [...messages, userMsg].map(m => ({ role: m.role, content: m.content })),
          dataContext,
          fileContents,
        }),
      });

      if (!resp.ok || !resp.body) {
        const err = await resp.json().catch(() => ({ error: 'Errore' }));
        upsertAssistant(`⚠️ ${err.error || 'Errore di comunicazione'}`);
        setIsLoading(false);
        return;
      }

      const reader = resp.body.getReader();
      const decoder = new TextDecoder();
      let textBuffer = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        textBuffer += decoder.decode(value, { stream: true });
        let newlineIndex: number;
        while ((newlineIndex = textBuffer.indexOf('\n')) !== -1) {
          let line = textBuffer.slice(0, newlineIndex);
          textBuffer = textBuffer.slice(newlineIndex + 1);
          if (line.endsWith('\r')) line = line.slice(0, -1);
          if (line.startsWith(':') || line.trim() === '') continue;
          if (!line.startsWith('data: ')) continue;
          const jsonStr = line.slice(6).trim();
          if (jsonStr === '[DONE]') break;
          try {
            const parsed = JSON.parse(jsonStr);
            const content = parsed.choices?.[0]?.delta?.content as string | undefined;
            if (content) upsertAssistant(content);
          } catch {
            textBuffer = line + '\n' + textBuffer;
            break;
          }
        }
      }
    } catch (e) {
      console.error('Frank AI error:', e);
      upsertAssistant('⚠️ Errore di connessione. Riprova.');
    }

    setIsLoading(false);
  }, [input, isLoading, messages, dataContext, uploadedFiles]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage(); }
  };

  const clearChat = () => { setMessages([]); };

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <DraggableNav />
      <div className="flex-1 flex flex-col max-w-5xl w-full mx-auto px-2 sm:px-4">
        {/* Header */}
        <div className="flex items-center justify-between py-4 border-b border-border">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-primary flex items-center justify-center">
              <Bot className="w-5 h-5 text-primary-foreground" />
            </div>
            <div>
              <h1 className="text-lg font-bold text-foreground">Frank</h1>
              <p className="text-xs text-muted-foreground">Chief Data Analyst · EasySea</p>
            </div>
          </div>
          <Button variant="ghost" size="sm" onClick={clearChat} className="text-muted-foreground">
            <Trash2 className="w-4 h-4 mr-1" /> Nuova chat
          </Button>
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto py-4 space-y-4 min-h-0" style={{ maxHeight: 'calc(100vh - 220px)' }}>
          {messages.length === 0 && (
            <div className="text-center py-16 space-y-4">
              <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mx-auto">
                <Bot className="w-8 h-8 text-primary" />
              </div>
              <h2 className="text-xl font-semibold text-foreground">Ciao, sono Frank 👋</h2>
              <p className="text-muted-foreground text-sm max-w-lg mx-auto">
                Il tuo analista dati personale. Conosco tutti i dati di EasySea — vendite B2C, ordini B2B, stock, budget, ads.
                Chiedimi qualsiasi cosa, carica file per analisi, e posso generare report esportabili.
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-w-lg mx-auto mt-6">
                {[
                  '📊 Dammi un report completo vendite del mese',
                  '📦 Qual è la situazione stock attuale?',
                  '🌍 Analisi vendite per paese',
                  '💡 Suggeriscimi strategie di crescita',
                ].map(q => (
                  <button
                    key={q}
                    onClick={() => setInput(q)}
                    className="text-left px-3 py-2.5 rounded-lg border border-border bg-card hover:bg-accent text-xs text-foreground transition-colors"
                  >
                    {q}
                  </button>
                ))}
              </div>
            </div>
          )}

          {messages.map((msg, i) => {
            const downloadables = msg.role === 'assistant' ? extractDownloadables(msg.content) : [];
            return (
              <div key={i} className={`flex gap-3 ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                {msg.role === 'assistant' && (
                  <div className="w-8 h-8 rounded-full bg-primary flex items-center justify-center shrink-0 mt-1">
                    <Bot className="w-4 h-4 text-primary-foreground" />
                  </div>
                )}
                <div className={`max-w-[85%] space-y-2 ${msg.role === 'user' ? 'order-first' : ''}`}>
                  {msg.files?.length ? (
                    <div className="flex flex-wrap gap-1 mb-1">
                      {msg.files.map((f, fi) => (
                        <span key={fi} className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-primary/10 text-xs text-primary">
                          <FileText className="w-3 h-3" />{f.name}
                        </span>
                      ))}
                    </div>
                  ) : null}
                  <div className={`rounded-2xl px-4 py-3 text-sm leading-relaxed ${
                    msg.role === 'user'
                      ? 'bg-primary text-primary-foreground rounded-br-md'
                      : 'bg-muted text-foreground rounded-bl-md'
                  }`}>
                    {msg.role === 'assistant' ? (
                      <div className="prose prose-sm max-w-none dark:prose-invert [&>*:first-child]:mt-0 [&>*:last-child]:mb-0 [&_table]:text-xs [&_th]:px-2 [&_td]:px-2">
                        <ReactMarkdown>{msg.content}</ReactMarkdown>
                      </div>
                    ) : msg.content}
                  </div>
                  {downloadables.length > 0 && (
                    <div className="flex flex-wrap gap-1.5">
                      {downloadables.map((d, di) => (
                        <Button key={di} variant="outline" size="sm" className="text-xs h-7"
                          onClick={() => handleDownloadCsv(d.data, di)}>
                          <Download className="w-3 h-3 mr-1" /> Scarica {d.label} #{di + 1}
                        </Button>
                      ))}
                    </div>
                  )}
                </div>
                {msg.role === 'user' && (
                  <div className="w-8 h-8 rounded-full bg-secondary flex items-center justify-center shrink-0 mt-1">
                    <User className="w-4 h-4 text-secondary-foreground" />
                  </div>
                )}
              </div>
            );
          })}

          {isLoading && messages[messages.length - 1]?.role !== 'assistant' && (
            <div className="flex gap-3">
              <div className="w-8 h-8 rounded-full bg-primary flex items-center justify-center shrink-0">
                <Bot className="w-4 h-4 text-primary-foreground" />
              </div>
              <div className="bg-muted rounded-2xl rounded-bl-md px-4 py-3 text-sm text-muted-foreground">
                <span className="animate-pulse">Frank sta analizzando...</span>
              </div>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* Uploaded files preview */}
        {uploadedFiles.length > 0 && (
          <div className="flex flex-wrap gap-1.5 px-1 pb-1">
            {uploadedFiles.map((f, i) => (
              <span key={i} className="inline-flex items-center gap-1 pl-2 pr-1 py-1 rounded-lg bg-muted text-xs">
                <FileText className="w-3 h-3 text-primary" />
                <span className="max-w-[120px] truncate">{f.name}</span>
                <button onClick={() => removeFile(i)} className="p-0.5 hover:bg-destructive/20 rounded">
                  <X className="w-3 h-3" />
                </button>
              </span>
            ))}
          </div>
        )}

        {/* Input */}
        <div className="border-t border-border py-3">
          <div className="flex items-end gap-2">
            <input
              ref={fileInputRef}
              type="file"
              multiple
              accept=".csv,.txt,.json,.md,.xlsx,.pdf,.png,.jpg"
              className="hidden"
              onChange={handleFileUpload}
            />
            <Button variant="ghost" size="icon" className="h-10 w-10 shrink-0"
              onClick={() => fileInputRef.current?.click()}>
              <Paperclip className="w-4 h-4" />
            </Button>
            <textarea
              ref={inputRef}
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Chiedi a Frank qualsiasi cosa sui dati..."
              rows={1}
              className="flex-1 resize-none rounded-xl border border-input bg-background px-4 py-2.5 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring min-h-[42px] max-h-[120px]"
              style={{ height: 'auto', overflow: 'auto' }}
              onInput={e => { const t = e.currentTarget; t.style.height = 'auto'; t.style.height = Math.min(t.scrollHeight, 120) + 'px'; }}
            />
            <Button size="icon" className="h-10 w-10 shrink-0" onClick={sendMessage}
              disabled={isLoading || !input.trim()}>
              <Send className="w-4 h-4" />
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
