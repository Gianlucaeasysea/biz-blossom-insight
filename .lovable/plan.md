

## Piano: Aggiungere righe Budget mensile per canale nella SalesCallAnalysis

### Cosa cambia

Aggiungere in entrambe le tabelle (B2C e B2B) una riga **"Budget 2026"** con i target mensili, posizionata subito dopo il "delta mensile", per confronto diretto con il consuntivo del mese. La riga B2B esiste già; va aggiunta quella B2C.

### Modifiche

**File: `src/pages/SalesCallAnalysis.tsx`**

1. **Import**: aggiungere `BUDGET_MONTHLY_TARGETS` dall'import di `budget-targets.ts` (attualmente importa solo `BUDGET_B2B_MONTHLY_TARGETS`).

2. **Tabella B2C (`b2cRows`)**: inserire una nuova riga dopo "delta mensile" e prima di "Spending Meta Ads":
   - `id: 'budget-b2c'`
   - `label: 'Budget B2C 2026'`
   - `sub: 'target mensile (tutti i prodotti)'`
   - `currMonthly: [...BUDGET_MONTHLY_TARGETS]`
   - `prevMonthly: Array(12).fill(0)`
   - `isDerived: true, dimmed: true`

3. **Nessuna modifica alla tabella B2B** — la riga Budget B2B 2026 è già presente (riga 722-731).

Questo darà visibilità immediata al target di budget mensile accanto ai valori consuntivi per entrambi i canali.

