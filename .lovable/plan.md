## Obiettivo strategico

La sezione **Marketing B2C** deve trasformare i dati di acquisto in **azioni commerciali concrete**: identificare segmenti, prevedere il prossimo acquisto, costruire campagne cross-sell/win-back e misurarne il potenziale prima di lanciarle. Oggi la lavagna mostra solo un cliente alla volta in modo radiale — manca la dimensione "segmento", "tempo" e "azione".

## Brainstorming — cosa serve davvero

Pensando al fine ultimo (vendere di più ai clienti esistenti), le funzioni chiave mancanti sono:

1. **Segmentazione automatica** — non solo "tipo barca", ma comportamenti: VIP, ricorrenti, dormienti, one-shot, alto potenziale.
2. **Predizione next-best-action** — chi è "maturo" per un riacquisto? Chi sta scivolando via?
3. **Affinità prodotto reale** — market basket: "chi compra X compra anche Y" con lift/confidence.
4. **Costruzione campagna guidata** — partire da un *obiettivo* (es. "vendere prodotto Z") e farsi suggerire il pubblico, non viceversa.
5. **Stima e tracciamento** — salvare le campagne simulate, vederne lo storico, esportare audience pronta per Meta/Mailchimp.

## Piano di intervento (`src/pages/B2CMarketing.tsx` + `src/components/marketing/*`)

### 1. Pannello "Segmenti intelligenti" (sopra la lavagna)
Calcolo client-side via `useMemo` su clienti già caricati. Chip filtrabili che alimentano la lista a sinistra:
- **VIP** — top 10% per LTV
- **Ricorrenti** — ≥3 ordini, ultimo <90gg
- **Dormienti** — ultimo ordine 180-365gg, LTV > mediana → target win-back
- **A rischio churn** — ultimo ordine 90-180gg dopo cadenza media
- **One-shot ad alto valore** — 1 ordine, AOV > p75 → upsell
- **Nuovi** — primo ordine <60gg → onboarding

Ogni chip mostra count e LTV totale del segmento.

### 2. Lista clienti potenziata
- Filtro per segmento attivo + filtro per tipo barca (dropdown).
- Ordinamento selezionabile: LTV / Recency / Frequency / "Propensity score".
- Badge segmento accanto al nome.
- Mini RFM score (R-F-M 1-5) visibile nella riga.

### 3. Lavagna — modalità multiple
Toggle in alto a destra della board:
- **Cliente** (attuale) — radiale come oggi.
- **Prodotto** — seleziono un prodotto dalla lista prodotti (nuova tab della sidebar), vedo cluster di clienti che l'hanno comprato + prodotti co-acquistati con lift score.
- **Segmento** — vista aggregata: cluster di clienti del segmento, prodotti più venduti al segmento, gap prodotti (cosa NON hanno comprato rispetto alla media segmento).

### 4. Cross-sell "intelligente" per cliente selezionato
Sotto al radiale del cliente, aggiungere una sezione **"Prodotti suggeriti"**:
- Calcolo lift = P(Y|X)/P(Y) sui co-acquisti.
- Mostro top 5 prodotti che clienti simili hanno comprato e questo NO.
- Click → li aggiunge automaticamente al Campaign Set.

### 5. Simulatore campagna potenziato
Estendere il pannello esistente:
- Input **obiettivo**: cross-sell / win-back / upsell / nuovo prodotto.
- Calcolo **propensity score** per ogni lookalike (basato su segmento + RFM + presenza prodotti correlati) → ordinamento audience.
- **Cadenza di riacquisto media** del segmento → stima realistica della conversione.
- **Revenue stimato** con range min/max invece di singolo valore.
- Pulsante **"Salva campagna"** → persiste in nuova tabella `b2c_marketing_campaigns` (nome, segmento, prodotti, sconto, audience size, revenue stimato, data).

### 6. Storico campagne (nuova tab)
Lista campagne salvate con possibilità di:
- Esportare CSV audience (email + nome + segmento + propensity).
- Generare copy AI direttamente per quella campagna (riusa `b2c-campaign-copy`).
- Duplicare / archiviare.

### 7. Mini-KPI bar in cima alla pagina
4 card sempre visibili sopra i tab esistenti:
- **LTV medio** / **Repeat rate** / **Tempo medio tra ordini** / **Tasso clienti dormienti**.
Danno il polso del parco clienti in un colpo d'occhio.

### 8. Performance
- Tutti i calcoli (segmenti, RFM, market basket, propensity) in **un singolo `useMemo`** sui dati ordini, esposti via context interno alla pagina così la lavagna, la lista e i KPI condividono lo stesso compute.
- Market basket limitato ai top 200 prodotti per evitare matrici esplose.
- Liste virtualizzate solo se >300 righe (oggi 150 va bene).

## Dettagli tecnici

- **Nuova tabella** `b2c_marketing_campaigns` (id, name, objective, segment, product_names jsonb, discount_pct, audience_size, est_revenue_min, est_revenue_max, created_at, created_by) con RLS authenticated.
- **Nuovo hook** `useCustomerSegmentation(customers)` — restituisce `{ segments, rfmScores, basketRules, propensity }`.
- **Refactor** `MarketingWhiteboard.tsx` → split in `WhiteboardCustomerView`, `WhiteboardProductView`, `WhiteboardSegmentView` + `BoardToolbar` + `CampaignSimulator` (file attuale è oltre 300 righe, va spezzato).
- **Nuovo componente** `SegmentChips.tsx` e `CampaignHistory.tsx`.
- Riuso edge function `b2c-campaign-copy` esistente per generazione copy dallo storico.

## Cosa NON viene toccato
- Tab "Customer Tree", "Cross-sell", "Generatore copy", "Export" esistenti restano.
- Date picker e preset già ottimizzati nello step precedente.
- AI profiling esistente continua a funzionare e alimenta segmentazione "tipo barca".

## Domanda prima di iniziare
Confermi che vuoi anche la **persistenza delle campagne** (richiede migrazione DB) o preferisci tenere tutto in-memory per ora e aggiungere solo segmentazione, modalità lavagna multiple, cross-sell intelligente e simulatore potenziato?
