## Nuova sezione: Marketing B2C — Customer Tree & Cross-Sell

Creare una nuova pagina dedicata che mostra ogni cliente B2C come un nodo espandibile, con storico acquisti, segmentazione barca inferita da AI e suggerimenti di cross-sell (statistici + AI), con export per campagne marketing.

### 1. Nuova route e nav
- Nuova pagina `src/pages/B2CMarketing.tsx` su route `/b2c-marketing`.
- Aggiunta voce in `DraggableNav.tsx`: `nav.b2c_marketing` → "Marketing B2C" (IT/EN/DE in `i18n.ts`).
- Registrazione in `App.tsx` dentro `ProtectedRoute`.

### 2. Struttura dati cliente
Riutilizzando `useShopifyOrders` (filtrabile per data) si costruisce una struttura ad albero:
```text
Customer (email, nome, paese, LTV, # ordini, segmento barca)
 ├─ Ordine #1234 (data, totale, sconto)
 │   ├─ Prodotto A (qty, prezzo, categoria)
 │   └─ Prodotto B
 ├─ Ordine #1289
 │   └─ Prodotto C
 ├─ 🚤 Segmento barca inferito (AI)
 ├─ 💡 Cross-sell statistico (market basket)
 └─ 🤖 Cross-sell AI personalizzato
```

### 3. UI principale
- **Filtro data** (riutilizzo Calendar/Popover come in B2CAnalysis).
- **Barra ricerca** cliente per nome/email.
- **Filtro segmento** (dropdown: tutti, segmenti AI già calcolati).
- **KPI in alto**: # clienti totali, # repeat, LTV medio, # segmenti distinti.
- **Lista clienti** ordinabile (LTV, ultimo ordine, # ordini):
  - Riga collassata: nome, paese, # ordini, LTV, badge segmento, ultimo ordine.
  - Click → espande mostrando: timeline ordini con prodotti annidati, box "Profilo barca AI", tabella cross-sell statistico, box raccomandazioni AI.

### 4. Inferenza segmento barca (Lovable AI)
Edge function `supabase/functions/b2c-customer-insight/index.ts` (Gemini 3 Flash via Lovable AI Gateway):
- Input: lista prodotti acquistati dal cliente (nome, categoria, qty).
- Output strutturato (tool calling):
  ```json
  {
    "boatType": "gommone | cabinato | yacht | vela | day-cruiser | sconosciuto",
    "boatSizeRange": "<6m | 6-10m | 10-15m | 15-25m | >25m | n/d",
    "ownerProfile": "breve descrizione 1 riga",
    "confidence": 0-1,
    "crossSellSuggestions": [
      { "product": "...", "reason": "...", "suggestedDiscountPct": 10 }
    ]
  }
  ```
- Chiamata **on-demand** (bottone "🤖 Analizza con AI" sulla riga cliente espansa) per controllare i costi.
- Risultato cacheato in tabella `b2c_customer_insights` per non rifare le call.

### 5. Cross-sell statistico (client-side)
Calcolo market basket dagli ordini caricati:
- Per ogni prodotto X, conta i prodotti Y co-acquistati da altri clienti.
- Per il cliente corrente: prendi i suoi prodotti, somma i co-acquisti, escludi quelli che ha già, top 5 per frequenza.
- Affiancato al box AI nello stesso pannello cliente.

### 6. Database
Migration: tabella `b2c_customer_insights`
- `customer_id` (text, PK)
- `boat_type`, `boat_size_range`, `owner_profile` (text)
- `confidence` (numeric)
- `cross_sell_suggestions` (jsonb)
- `last_order_count` (int) — per invalidare cache quando il cliente fa nuovi ordini
- `generated_at` (timestamptz)
- RLS: authenticated read/write (coerente con altre tabelle del progetto).

### 7. Export & campagne
- **Export CSV per segmento**: filtra clienti per `boatType`/`boatSizeRange`, esporta `email, nome, paese, # ordini, LTV, prodotti, segmento` — pronto per Mailchimp / Klaviyo / Meta Custom Audiences.
- **Genera testo campagna AI**: bottone su un segmento → edge function `b2c-campaign-copy` (Lovable AI) restituisce: subject email, body email markdown, copy ads Meta (primary text + headline). Modale con tasto "Copia".

### 8. File da creare/modificare
- **Nuovi**: `src/pages/B2CMarketing.tsx`, `src/components/marketing/CustomerTreeRow.tsx`, `src/components/marketing/CampaignCopyDialog.tsx`, `supabase/functions/b2c-customer-insight/index.ts`, `supabase/functions/b2c-campaign-copy/index.ts`, migration per `b2c_customer_insights`.
- **Modificati**: `src/App.tsx` (route), `src/components/DraggableNav.tsx` (voce nav), `src/lib/i18n.ts` (label IT/EN/DE).

### Note
- Email cliente: già disponibile via `customerName`/`customerId` in `Order`. Verificherò se l'edge function `shopify-orders` espone anche `email` (al momento non risulta tra i campi mappati) — se manca, sarà aggiunto al payload per consentire l'export.
- Costi AI controllati: chiamata Gemini Flash on-demand per cliente, risultato persistito.
