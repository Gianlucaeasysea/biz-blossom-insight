import type { Order } from '@/types/analytics';
import type { FrankDataFilters } from './FrankFilters';

interface ProductData {
  productTitle: string;
  sku: string;
  inventoryQuantity: number;
}

export function buildFilteredContext(
  shopifyOrders: Order[] | undefined,
  b2bOrders: Order[] | undefined,
  products: ProductData[] | undefined,
  filters: FrankDataFilters,
): string {
  const parts: string[] = [];
  const from = new Date(filters.dateFrom);
  const to = new Date(filters.dateTo + 'T23:59:59');
  const search = filters.searchTerm.toLowerCase();

  const matchesSearch = (o: Order) => {
    if (!search) return true;
    return (
      o.customerName.toLowerCase().includes(search) ||
      o.country?.toLowerCase().includes(search) ||
      o.products.some(p => p.sku.toLowerCase().includes(search) || p.name.toLowerCase().includes(search))
    );
  };

  const matchesDate = (o: Order) => {
    const d = new Date(o.date);
    return d >= from && d <= to;
  };

  const matchesStatus = (o: Order) => {
    if (filters.statusFilter === 'all') return true;
    if (filters.statusFilter === 'fulfilled') return o.status === 'completed';
    return o.status === 'pending';
  };

  // B2C
  if (filters.sources.includes('b2c') && shopifyOrders?.length) {
    const filtered = shopifyOrders.filter(o => matchesDate(o) && matchesStatus(o) && matchesSearch(o));
    const total = filtered.reduce((s, o) => s + (o.netAmount ?? o.totalAmount), 0);
    const fulfilled = filtered.filter(o => o.status === 'completed');
    const fulfilledTotal = fulfilled.reduce((s, o) => s + (o.netAmount ?? o.totalAmount), 0);

    const countries = new Map<string, number>();
    filtered.forEach(o => {
      const c = o.country || 'Unknown';
      countries.set(c, (countries.get(c) || 0) + (o.netAmount ?? o.totalAmount));
    });

    const skuMap = new Map<string, { qty: number; rev: number }>();
    filtered.forEach(o => o.products.forEach(p => {
      const k = p.sku || p.name;
      const e = skuMap.get(k) || { qty: 0, rev: 0 };
      e.qty += p.quantity; e.rev += p.totalPrice;
      skuMap.set(k, e);
    }));
    const topSkus = [...skuMap.entries()].sort((a, b) => b[1].rev - a[1].rev).slice(0, 30);

    // Per-client breakdown
    const clientMap = new Map<string, { orders: number; rev: number }>();
    filtered.forEach(o => {
      const e = clientMap.get(o.customerName) || { orders: 0, rev: 0 };
      e.orders++; e.rev += (o.netAmount ?? o.totalAmount);
      clientMap.set(o.customerName, e);
    });
    const topClients = [...clientMap.entries()].sort((a, b) => b[1].rev - a[1].rev).slice(0, 15);

    parts.push(`=== DATI B2C (Shopify) — Filtro: ${filters.dateFrom} → ${filters.dateTo} ${filters.statusFilter !== 'all' ? `| Stato: ${filters.statusFilter}` : ''} ===
Ordini nel periodo: ${filtered.length}
Net Sales periodo: €${total.toFixed(0)}
Ordini evasi: ${fulfilled.length} (€${fulfilledTotal.toFixed(0)})
Top 30 SKU: ${topSkus.map(([k, v]) => `${k}: ${v.qty}pz €${v.rev.toFixed(0)}`).join('; ')}
Top 15 clienti: ${topClients.map(([c, v]) => `${c}: ${v.orders} ordini €${v.rev.toFixed(0)}`).join('; ')}
Paesi: ${[...countries.entries()].sort((a, b) => b[1] - a[1]).map(([c, v]) => `${c}: €${v.toFixed(0)}`).join('; ')}
Dettaglio ultimi 50 ordini:
${filtered.slice(0, 50).map(o => `${o.date.toString().slice(0, 10)} | ${o.orderNumber} | ${o.customerName} | ${o.country || '?'} | €${(o.netAmount ?? o.totalAmount).toFixed(0)} | ${o.status} | SKU: ${o.products.map(p => `${p.sku}x${p.quantity}`).join(',')}`).join('\n')}`);
  }

  // B2B
  if (filters.sources.includes('b2b') && b2bOrders?.length) {
    const filtered = b2bOrders.filter(o => matchesDate(o) && matchesStatus(o) && matchesSearch(o));
    const total = filtered.reduce((s, o) => s + o.totalAmount, 0);

    const byClient = new Map<string, { orders: number; rev: number }>();
    filtered.forEach(o => {
      const e = byClient.get(o.customerName) || { orders: 0, rev: 0 };
      e.orders++; e.rev += o.totalAmount;
      byClient.set(o.customerName, e);
    });
    const topClients = [...byClient.entries()].sort((a, b) => b[1].rev - a[1].rev).slice(0, 20);

    const skuMap = new Map<string, { qty: number; rev: number }>();
    filtered.forEach(o => o.products.forEach(p => {
      const k = p.sku || p.name;
      const e = skuMap.get(k) || { qty: 0, rev: 0 };
      e.qty += p.quantity; e.rev += p.totalPrice;
      skuMap.set(k, e);
    }));
    const topSkus = [...skuMap.entries()].sort((a, b) => b[1].rev - a[1].rev).slice(0, 30);

    const byCountry = new Map<string, number>();
    filtered.forEach(o => {
      const c = o.country || 'Unknown';
      byCountry.set(c, (byCountry.get(c) || 0) + o.totalAmount);
    });

    parts.push(`=== DATI B2B (Google Sheets) — Filtro: ${filters.dateFrom} → ${filters.dateTo} ${filters.statusFilter !== 'all' ? `| Stato: ${filters.statusFilter}` : ''} ===
Ordini nel periodo: ${filtered.length}
Fatturato periodo: €${total.toFixed(0)}
Top 20 clienti: ${topClients.map(([c, v]) => `${c}: ${v.orders} ordini €${v.rev.toFixed(0)}`).join('; ')}
Top 30 SKU: ${topSkus.map(([k, v]) => `${k}: ${v.qty}pz €${v.rev.toFixed(0)}`).join('; ')}
Paesi: ${[...byCountry.entries()].sort((a, b) => b[1] - a[1]).map(([c, v]) => `${c}: €${v.toFixed(0)}`).join('; ')}
Dettaglio ultimi 50 ordini:
${filtered.slice(0, 50).map(o => `${o.date.toString().slice(0, 10)} | ${o.orderNumber} | ${o.customerName} | ${o.country || '?'} | €${o.totalAmount.toFixed(0)} | ${o.status} | ${o.orderType || ''} | SKU: ${o.products.map(p => `${p.sku}x${p.quantity}`).join(',')}`).join('\n')}`);
  }

  if (products?.length) {
    const inStock = products.filter(p => p.inventoryQuantity > 0);
    const outOfStock = products.filter(p => p.inventoryQuantity <= 0);
    parts.push(`=== STOCK PRODOTTI ===
Totale varianti: ${products.length}
In stock: ${inStock.length}
Esauriti: ${outOfStock.length}
Dettaglio: ${products.map(p => `${p.sku || p.productTitle}: ${p.inventoryQuantity}pz`).join('; ')}`);
  }

  return parts.join('\n\n') || 'Dati non ancora caricati.';
}
