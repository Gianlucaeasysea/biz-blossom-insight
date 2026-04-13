

## Piano: Portafoglio Clienti B2C + Spending Ads Meta nella Sales Call Analysis

### Cosa cambia

**1. Portafoglio Clienti B2C (valore dinamico)**

Il "portafoglio ordini" attuale calcola `raccolti - evasi` mese per mese, ma non riflette il valore reale degli ordini ancora da evadere. Il nuovo approccio:
- Calcola il **totale cumulativo** di tutti gli ordini B2C **non fulfilled** (status ≠ completed/fulfilled) dal Net Sales Shopify, applicando il fattore di scala.
- Questo valore è **globale** (non per mese) e si aggiorna automaticamente: quando un ordine viene evaso, esce dal conteggio.
- Verrà mostrato come una **SummaryCard dedicata** nella sezione B2C, con label "Portafoglio Clienti B2C" e tooltip esplicativo.
- La riga tabellare "portafoglio ordini" mensile resta, ma viene aggiunta la card con il valore complessivo attuale.

**2. Spending Ads Meta mese per mese**

- Integra l'hook `useMetaAds` nella pagina Sales Call Analysis.
- Aggiunge una nuova riga nella tabella B2C con lo spending Meta Ads mensile, così da poter confrontare spesa pubblicitaria e vendite fianco a fianco.
- La riga sarà derivata (non editabile), con i dati aggregati per mese dai daily insights di Meta.

### File modificati

- **`src/pages/SalesCallAnalysis.tsx`**:
  - Import di `useMetaAds` e `parseMetaKPIs`
  - Nuovo `useMemo` per calcolare il portafoglio clienti globale (somma net sales ordini non fulfilled)
  - Nuova `SummaryCard` "Portafoglio Clienti" nella sezione B2C
  - Nuovo `useMemo` per aggregare lo spending Meta per mese
  - Nuova riga `isDerived` nella tabella B2C con lo spending ads mensile

### Dettagli tecnici

- **Portafoglio**: filtra `allOrders` dove `customerType === 'B2C'` e `status !== 'completed'`, somma `(netAmount ?? totalAmount) * currScaleFactor`. Per l'anno precedente fa lo stesso con `prevScaleFactor`.
- **Meta Ads**: usa i `daily` insights da `useMetaAds` con date range dell'anno selezionato, raggruppa per mese e inserisce lo spend come riga tabellare.

