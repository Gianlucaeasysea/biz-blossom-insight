import { Order, TimeSeriesData, CategoryData, KPIData } from '@/types/analytics';
import { subDays, format, eachDayOfInterval } from 'date-fns';

// Helper: is a B2B order NOT custom?
const isNotCustom = (o: Order) => !o.orderType || o.orderType.toLowerCase() !== 'custom';

// Generate time series data with B2C, B2B (excl custom), B2B custom
export function generateTimeSeriesData(orders: Order[], days: number = 30): TimeSeriesData[] {
  const endDate = new Date();
  const startDate = subDays(endDate, days);
  const dates = eachDayOfInterval({ start: startDate, end: endDate });

  return dates.map(date => {
    const dateStr = format(date, 'yyyy-MM-dd');
    const dayOrders = orders.filter(o => format(o.date, 'yyyy-MM-dd') === dateStr);

    const b2c = dayOrders
      .filter(o => o.customerType === 'B2C')
      .reduce((sum, o) => sum + o.totalAmount, 0);

    const b2b = dayOrders
      .filter(o => o.customerType === 'B2B' && isNotCustom(o))
      .reduce((sum, o) => sum + o.totalAmount, 0);

    const b2bCustom = dayOrders
      .filter(o => o.customerType === 'B2B' && !isNotCustom(o))
      .reduce((sum, o) => sum + o.totalAmount, 0);

    return {
      date: format(date, 'dd MMM'),
      b2c: Math.round(b2c * 100) / 100,
      b2b: Math.round(b2b * 100) / 100,
      b2bCustom: Math.round(b2bCustom * 100) / 100,
      total: Math.round((b2c + b2b) * 100) / 100,
    };
  });
}

// Generate category breakdown
export function generateCategoryData(orders: Order[]): CategoryData[] {
  const categories: Record<string, number> = {};
  orders.forEach(order => {
    order.products.forEach(product => {
      categories[product.category] = (categories[product.category] || 0) + product.totalPrice;
    });
  });
  const colors = ['hsl(190, 100%, 50%)', 'hsl(270, 60%, 55%)', 'hsl(160, 60%, 45%)', 'hsl(40, 90%, 55%)', 'hsl(0, 70%, 55%)'];
  return Object.entries(categories)
    .map(([name, value], index) => ({ name, value: Math.round(value * 100) / 100, fill: colors[index % colors.length] }))
    .sort((a, b) => b.value - a.value);
}

// Generate channel breakdown
export function generateChannelData(orders: Order[]): CategoryData[] {
  const channels: Record<string, number> = {};
  orders.forEach(order => {
    const channel = order.channel || 'Unknown';
    channels[channel] = (channels[channel] || 0) + order.totalAmount;
  });
  const colors = ['hsl(190, 100%, 50%)', 'hsl(270, 60%, 55%)', 'hsl(160, 60%, 45%)', 'hsl(40, 90%, 55%)', 'hsl(0, 70%, 55%)'];
  return Object.entries(channels)
    .map(([name, value], index) => ({ name, value: Math.round(value * 100) / 100, fill: colors[index % colors.length] }))
    .sort((a, b) => b.value - a.value);
}

// Calculate KPIs - new structure
export function calculateKPIs(orders: Order[]): KPIData[] {
  // B2C: net sales = totalAmount
  const b2cOrders = orders.filter(o => o.customerType === 'B2C');
  const b2bOrdersNoCustom = orders.filter(o => o.customerType === 'B2B' && isNotCustom(o));

  // Total Order B2C = net sales totale
  const totalOrderB2C = b2cOrders.reduce((s, o) => s + o.totalAmount, 0);
  // Total Order B2B = sum price by order date (already filtered by date range upstream), excl custom
  const totalOrderB2B = b2bOrdersNoCustom.reduce((s, o) => s + o.products.reduce((ps, p) => ps + p.totalPrice, 0), 0);
  // Total Order = B2C + B2B
  const totalOrder = totalOrderB2C + totalOrderB2B;

  // Fatturato B2C = net sales solo ordini evasi (completed)
  const fatturatoB2C = b2cOrders.filter(o => o.status === 'completed').reduce((s, o) => s + o.totalAmount, 0);
  // Fatturato B2B = sum price for DELIVERED (completed) + delivery date exists, excl custom
  const fatturatoB2B = b2bOrdersNoCustom
    .filter(o => o.status === 'completed' && o.deliveryDate)
    .reduce((s, o) => s + o.products.reduce((ps, p) => ps + p.totalPrice, 0), 0);

  // Totale ordini B2C = count
  const totaleOrdiniB2C = b2cOrders.length;
  // Totale ordini B2B = unique order names, excl custom
  const uniqueB2BOrders = new Set(b2bOrdersNoCustom.map(o => o.orderNumber));
  const totaleOrdiniB2B = uniqueB2BOrders.size;

  return [
    { label: 'Total Order', value: totalOrder, trend: 'neutral', format: 'currency', currency: 'EUR' },
    { label: 'Total Order B2C', value: totalOrderB2C, trend: 'neutral', format: 'currency', currency: 'EUR' },
    { label: 'Total Order B2B', value: totalOrderB2B, trend: 'neutral', format: 'currency', currency: 'EUR' },
    { label: 'Fatturato B2C', value: fatturatoB2C, trend: 'neutral', format: 'currency', currency: 'EUR' },
    { label: 'Fatturato B2B', value: fatturatoB2B, trend: 'neutral', format: 'currency', currency: 'EUR' },
    { label: 'Totale Ordini B2C', value: totaleOrdiniB2C, trend: 'neutral', format: 'number' },
    { label: 'Totale Ordini B2B', value: totaleOrdiniB2B, trend: 'neutral', format: 'number' },
  ];
}

// B2C SKU breakdown: qty sold, net sales total, net sales fulfilled
export function getB2CSkuBreakdown(orders: Order[]): Array<{
  sku: string; name: string; qtySold: number; netSalesTotal: number; netSalesFulfilled: number;
}> {
  const skuMap: Record<string, { name: string; qtySold: number; netSalesTotal: number; netSalesFulfilled: number }> = {};
  const b2cOrders = orders.filter(o => o.customerType === 'B2C');

  b2cOrders.forEach(order => {
    order.products.forEach(product => {
      if (!skuMap[product.sku]) {
        skuMap[product.sku] = { name: product.name, qtySold: 0, netSalesTotal: 0, netSalesFulfilled: 0 };
      }
      skuMap[product.sku].qtySold += product.quantity;
      skuMap[product.sku].netSalesTotal += product.totalPrice;
      if (order.status === 'completed') {
        skuMap[product.sku].netSalesFulfilled += product.totalPrice;
      }
    });
  });

  return Object.entries(skuMap)
    .map(([sku, d]) => ({ sku, name: d.name, qtySold: d.qtySold, netSalesTotal: Math.round(d.netSalesTotal * 100) / 100, netSalesFulfilled: Math.round(d.netSalesFulfilled * 100) / 100 }))
    .sort((a, b) => b.netSalesTotal - a.netSalesTotal);
}

// B2B SKU breakdown: qty sold, price raccolto, price consegnato
export function getB2BSkuBreakdown(orders: Order[]): Array<{
  sku: string; name: string; qtySold: number; priceRaccolto: number; priceConsegnato: number;
}> {
  const skuMap: Record<string, { name: string; qtySold: number; priceRaccolto: number; priceConsegnato: number }> = {};
  const b2bOrders = orders.filter(o => o.customerType === 'B2B' && isNotCustom(o));

  b2bOrders.forEach(order => {
    order.products.forEach(product => {
      if (!skuMap[product.sku]) {
        skuMap[product.sku] = { name: product.name, qtySold: 0, priceRaccolto: 0, priceConsegnato: 0 };
      }
      skuMap[product.sku].qtySold += product.quantity;
      skuMap[product.sku].priceRaccolto += product.totalPrice;
      if (order.status === 'completed' && order.deliveryDate) {
        skuMap[product.sku].priceConsegnato += product.totalPrice;
      }
    });
  });

  return Object.entries(skuMap)
    .map(([sku, d]) => ({ sku, name: d.name, qtySold: d.qtySold, priceRaccolto: Math.round(d.priceRaccolto * 100) / 100, priceConsegnato: Math.round(d.priceConsegnato * 100) / 100 }))
    .sort((a, b) => b.priceRaccolto - a.priceRaccolto);
}

// Combined B2C+B2B SKU breakdown
export function getCombinedSkuBreakdown(orders: Order[]): Array<{
  sku: string; name: string; qtySold: number; totalValue: number; b2cValue: number; b2bValue: number;
}> {
  const skuMap: Record<string, { name: string; qtySold: number; b2cValue: number; b2bValue: number }> = {};

  orders.filter(o => o.customerType === 'B2C' || isNotCustom(o)).forEach(order => {
    order.products.forEach(product => {
      if (!skuMap[product.sku]) {
        skuMap[product.sku] = { name: product.name, qtySold: 0, b2cValue: 0, b2bValue: 0 };
      }
      skuMap[product.sku].qtySold += product.quantity;
      if (order.customerType === 'B2C') {
        skuMap[product.sku].b2cValue += product.totalPrice;
      } else {
        skuMap[product.sku].b2bValue += product.totalPrice;
      }
    });
  });

  return Object.entries(skuMap)
    .map(([sku, d]) => ({
      sku, name: d.name, qtySold: d.qtySold,
      totalValue: Math.round((d.b2cValue + d.b2bValue) * 100) / 100,
      b2cValue: Math.round(d.b2cValue * 100) / 100,
      b2bValue: Math.round(d.b2bValue * 100) / 100,
    }))
    .sort((a, b) => b.totalValue - a.totalValue);
}

// Country breakdown
export function getCountryBreakdown(orders: Order[], skuFilter?: string): Array<{
  country: string; b2cSales: number; b2bSales: number; totalSales: number;
}> {
  const countryMap: Record<string, { b2c: number; b2b: number }> = {};

  orders.filter(o => o.customerType === 'B2C' || isNotCustom(o)).forEach(order => {
    const country = order.country || 'Sconosciuto';
    let amount = 0;
    if (skuFilter) {
      amount = order.products.filter(p => p.sku === skuFilter).reduce((s, p) => s + p.totalPrice, 0);
    } else {
      amount = order.totalAmount;
    }
    if (amount <= 0) return;
    if (!countryMap[country]) countryMap[country] = { b2c: 0, b2b: 0 };
    if (order.customerType === 'B2C') countryMap[country].b2c += amount;
    else countryMap[country].b2b += amount;
  });

  return Object.entries(countryMap)
    .map(([country, d]) => ({
      country, b2cSales: Math.round(d.b2c * 100) / 100, b2bSales: Math.round(d.b2b * 100) / 100,
      totalSales: Math.round((d.b2c + d.b2b) * 100) / 100,
    }))
    .sort((a, b) => b.totalSales - a.totalSales);
}

// Get top products
export function getTopProducts(orders: Order[], limit: number = 5) {
  const products: Record<string, { name: string; sku: string; category: string; price: number; quantity: number; revenue: number }> = {};
  orders.forEach(order => {
    order.products.forEach(product => {
      if (!products[product.id]) {
        products[product.id] = { name: product.name, sku: product.sku, category: product.category, price: product.unitPrice, quantity: 0, revenue: 0 };
      }
      products[product.id].quantity += product.quantity;
      products[product.id].revenue += product.totalPrice;
    });
  });
  return Object.entries(products)
    .map(([id, data]) => ({ id, name: data.name, sku: data.sku, category: data.category, price: data.price, totalSold: data.quantity, revenue: Math.round(data.revenue * 100) / 100 }))
    .sort((a, b) => b.revenue - a.revenue)
    .slice(0, limit);
}

// Get top customers
export function getTopCustomers(orders: Order[], limit: number = 5) {
  const customers: Record<string, { name: string; type: 'B2C' | 'B2B'; orders: number; spent: number; firstDate: Date; lastDate: Date; agent?: string }> = {};
  orders.forEach(order => {
    if (!customers[order.customerId]) {
      customers[order.customerId] = { name: order.customerName, type: order.customerType, orders: 0, spent: 0, firstDate: order.date, lastDate: order.date, agent: order.agent };
    }
    customers[order.customerId].orders++;
    customers[order.customerId].spent += order.totalAmount;
    if (order.date < customers[order.customerId].firstDate) customers[order.customerId].firstDate = order.date;
    if (order.date > customers[order.customerId].lastDate) customers[order.customerId].lastDate = order.date;
  });
  return Object.entries(customers)
    .map(([id, data]) => ({
      id, name: data.name, email: `${data.name.toLowerCase().replace(/\s/g, '.')}@example.com`,
      type: data.type, source: data.type === 'B2B' ? 'google_sheets' as const : 'shopify' as const,
      totalOrders: data.orders, totalSpent: Math.round(data.spent * 100) / 100,
      firstOrderDate: data.firstDate, lastOrderDate: data.lastDate, agent: data.agent,
    }))
    .sort((a, b) => b.totalSpent - a.totalSpent)
    .slice(0, limit);
}
