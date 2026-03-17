import { Order, Customer, Product, TimeSeriesData, CategoryData, KPIData } from '@/types/analytics';
import { subDays, format, eachDayOfInterval, startOfMonth, endOfMonth } from 'date-fns';

// Generate mock orders
export function generateMockOrders(count: number = 500): Order[] {
  const orders: Order[] = [];
  const products = [
    { id: 'p1', name: 'Premium Widget', sku: 'WGT-001', category: 'Widgets', price: 49.99 },
    { id: 'p2', name: 'Basic Gadget', sku: 'GDT-001', category: 'Gadgets', price: 29.99 },
    { id: 'p3', name: 'Pro Tool Set', sku: 'TLS-001', category: 'Tools', price: 149.99 },
    { id: 'p4', name: 'Starter Kit', sku: 'KIT-001', category: 'Kits', price: 79.99 },
    { id: 'p5', name: 'Enterprise Solution', sku: 'ENT-001', category: 'Enterprise', price: 499.99 },
  ];

  const b2cChannels = ['Online Store', 'Amazon', 'eBay', 'Instagram Shop'];
  const b2bAgents = ['Marco Rossi', 'Giulia Bianchi', 'Luca Verdi', 'Anna Neri'];
  const b2bCustomers = [
    'Tech Solutions Srl', 'Digital Corp', 'Innovation Hub', 'Smart Systems',
    'Future Tech', 'Global Industries', 'Prime Electronics', 'Alpha Trading'
  ];

  for (let i = 0; i < count; i++) {
    const isB2B = Math.random() > 0.6;
    const date = subDays(new Date(), Math.floor(Math.random() * 365));
    const productCount = isB2B ? Math.floor(Math.random() * 5) + 2 : Math.floor(Math.random() * 3) + 1;
    
    const orderProducts = Array.from({ length: productCount }, () => {
      const product = products[Math.floor(Math.random() * products.length)];
      const quantity = isB2B ? Math.floor(Math.random() * 50) + 10 : Math.floor(Math.random() * 3) + 1;
      return {
        id: product.id,
        name: product.name,
        sku: product.sku,
        category: product.category,
        quantity,
        unitPrice: product.price,
        totalPrice: product.price * quantity,
      };
    });

    const totalAmount = orderProducts.reduce((sum, p) => sum + p.totalPrice, 0);

    orders.push({
      id: `ord-${i + 1}`,
      orderNumber: isB2B ? `B2B-${10000 + i}` : `ORD-${10000 + i}`,
      customerType: isB2B ? 'B2B' : 'B2C',
      source: isB2B ? 'google_sheets' : 'shopify',
      customerId: `cust-${Math.floor(Math.random() * 100) + 1}`,
      customerName: isB2B 
        ? b2bCustomers[Math.floor(Math.random() * b2bCustomers.length)]
        : `Cliente ${Math.floor(Math.random() * 1000) + 1}`,
      date,
      products: orderProducts,
      totalAmount,
      currency: 'EUR',
      channel: isB2B ? 'B2B Direct' : b2cChannels[Math.floor(Math.random() * b2cChannels.length)],
      agent: isB2B ? b2bAgents[Math.floor(Math.random() * b2bAgents.length)] : undefined,
      status: 'completed',
    });
  }

  return orders.sort((a, b) => b.date.getTime() - a.date.getTime());
}

// Generate time series data
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
      .filter(o => o.customerType === 'B2B')
      .reduce((sum, o) => sum + o.totalAmount, 0);

    return {
      date: format(date, 'dd MMM'),
      b2c: Math.round(b2c * 100) / 100,
      b2b: Math.round(b2b * 100) / 100,
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

  const colors = [
    'hsl(199, 89%, 48%)',
    'hsl(262, 83%, 58%)',
    'hsl(142, 76%, 36%)',
    'hsl(38, 92%, 50%)',
    'hsl(0, 84%, 60%)',
  ];

  return Object.entries(categories)
    .map(([name, value], index) => ({
      name,
      value: Math.round(value * 100) / 100,
      fill: colors[index % colors.length],
    }))
    .sort((a, b) => b.value - a.value);
}

// Generate channel breakdown
export function generateChannelData(orders: Order[]): CategoryData[] {
  const channels: Record<string, number> = {};
  
  orders.forEach(order => {
    const channel = order.channel || 'Unknown';
    channels[channel] = (channels[channel] || 0) + order.totalAmount;
  });

  const colors = [
    'hsl(199, 89%, 48%)',
    'hsl(262, 83%, 58%)',
    'hsl(142, 76%, 36%)',
    'hsl(38, 92%, 50%)',
    'hsl(0, 84%, 60%)',
  ];

  return Object.entries(channels)
    .map(([name, value], index) => ({
      name,
      value: Math.round(value * 100) / 100,
      fill: colors[index % colors.length],
    }))
    .sort((a, b) => b.value - a.value);
}

// Calculate KPIs
export function calculateKPIs(orders: Order[]): KPIData[] {
  const now = new Date();
  const thirtyDaysAgo = subDays(now, 30);
  const sixtyDaysAgo = subDays(now, 60);

  const currentPeriod = orders.filter(o => o.date >= thirtyDaysAgo);
  const previousPeriod = orders.filter(o => o.date >= sixtyDaysAgo && o.date < thirtyDaysAgo);

  const calcTotal = (list: Order[]) => list.reduce((sum, o) => sum + o.totalAmount, 0);
  const calcB2CFatturato = (list: Order[]) => list.filter(o => o.customerType === 'B2C' && o.status === 'completed').reduce((sum, o) => sum + o.totalAmount, 0);
  const calcB2CRaccolti = (list: Order[]) => list.filter(o => o.customerType === 'B2C').reduce((sum, o) => sum + o.totalAmount, 0);

  // B2B: Fatturato = filter by deliveryDate in period, sum product prices
  const calcB2BFatturato = (allOrders: Order[], start: Date, end: Date) => allOrders
    .filter(o => o.customerType === 'B2B' && o.deliveryDate && o.deliveryDate >= start && o.deliveryDate <= end)
    .reduce((sum, o) => sum + o.products.reduce((ps, p) => ps + p.totalPrice, 0), 0);

  // B2B: Ordini Raccolti = all B2B orders, sum product prices (filtered by order date - already done via currentPeriod)
  const calcB2BRaccolti = (list: Order[]) => list
    .filter(o => o.customerType === 'B2B')
    .reduce((sum, o) => sum + o.products.reduce((ps, p) => ps + p.totalPrice, 0), 0);

  // B2B: Ordini Pagati = filter by payedDate in period, sum product prices
  const calcB2BPagati = (allOrders: Order[], start: Date, end: Date) => allOrders
    .filter(o => o.customerType === 'B2B' && o.payedDate && o.payedDate >= start && o.payedDate <= end)
    .reduce((sum, o) => sum + o.products.reduce((ps, p) => ps + p.totalPrice, 0), 0);

  const currentTotal = calcTotal(currentPeriod);
  const previousTotal = calcTotal(previousPeriod);
  const totalChange = previousTotal ? ((currentTotal - previousTotal) / previousTotal) * 100 : 0;

  const currentB2CFatt = calcB2CFatturato(currentPeriod);
  const previousB2CFatt = calcB2CFatturato(previousPeriod);
  const b2cFattChange = previousB2CFatt ? ((currentB2CFatt - previousB2CFatt) / previousB2CFatt) * 100 : 0;

  const currentB2CRacc = calcB2CRaccolti(currentPeriod);
  const previousB2CRacc = calcB2CRaccolti(previousPeriod);
  const b2cRaccChange = previousB2CRacc ? ((currentB2CRacc - previousB2CRacc) / previousB2CRacc) * 100 : 0;

  const currentB2BFatt = calcB2BFatturato(orders, thirtyDaysAgo, now);
  const previousB2BFatt = calcB2BFatturato(orders, sixtyDaysAgo, thirtyDaysAgo);
  const b2bFattChange = previousB2BFatt ? ((currentB2BFatt - previousB2BFatt) / previousB2BFatt) * 100 : 0;

  const currentB2BRacc = calcB2BRaccolti(currentPeriod);
  const previousB2BRacc = calcB2BRaccolti(previousPeriod);
  const b2bRaccChange = previousB2BRacc ? ((currentB2BRacc - previousB2BRacc) / previousB2BRacc) * 100 : 0;

  const currentB2BPagati = calcB2BPagati(orders, thirtyDaysAgo, now);
  const previousB2BPagati = calcB2BPagati(orders, sixtyDaysAgo, thirtyDaysAgo);
  const b2bPagatiChange = previousB2BPagati ? ((currentB2BPagati - previousB2BPagati) / previousB2BPagati) * 100 : 0;

  const currentOrders = currentPeriod.length;
  const previousOrders = previousPeriod.length;
  const ordersChange = previousOrders ? ((currentOrders - previousOrders) / previousOrders) * 100 : 0;

  return [
    {
      label: 'Fatturato Totale',
      value: currentTotal,
      previousValue: previousTotal,
      changePercent: Math.round(totalChange * 10) / 10,
      trend: totalChange >= 0 ? 'up' : 'down',
      format: 'currency',
      currency: 'EUR',
    },
    {
      label: 'Fatturato B2C',
      value: currentB2CFatt,
      previousValue: previousB2CFatt,
      changePercent: Math.round(b2cFattChange * 10) / 10,
      trend: b2cFattChange >= 0 ? 'up' : 'down',
      format: 'currency',
      currency: 'EUR',
    },
    {
      label: 'Ordini Raccolti B2C',
      value: currentB2CRacc,
      previousValue: previousB2CRacc,
      changePercent: Math.round(b2cRaccChange * 10) / 10,
      trend: b2cRaccChange >= 0 ? 'up' : 'down',
      format: 'currency',
      currency: 'EUR',
    },
    {
      label: 'Fatturato B2B',
      value: currentB2BFatt,
      previousValue: previousB2BFatt,
      changePercent: Math.round(b2bFattChange * 10) / 10,
      trend: b2bFattChange >= 0 ? 'up' : 'down',
      format: 'currency',
      currency: 'EUR',
    },
    {
      label: 'Ordini Raccolti B2B',
      value: currentB2BRacc,
      previousValue: previousB2BRacc,
      changePercent: Math.round(b2bRaccChange * 10) / 10,
      trend: b2bRaccChange >= 0 ? 'up' : 'down',
      format: 'currency',
      currency: 'EUR',
    },
    {
      label: 'Ordini Pagati B2B',
      value: currentB2BPagati,
      previousValue: previousB2BPagati,
      changePercent: Math.round(b2bPagatiChange * 10) / 10,
      trend: b2bPagatiChange >= 0 ? 'up' : 'down',
      format: 'currency',
      currency: 'EUR',
    },
    {
      label: 'Numero Ordini',
      value: currentOrders,
      previousValue: previousOrders,
      changePercent: Math.round(ordersChange * 10) / 10,
      trend: ordersChange >= 0 ? 'up' : 'down',
      format: 'number',
    },
  ];
}

// Get B2B SKU breakdown
export function getB2BSkuBreakdown(orders: Order[]): Array<{
  sku: string;
  name: string;
  fatturato: number;
  ordiniRaccolti: number;
  ordiniPagati: number;
}> {
  const skuMap: Record<string, { name: string; fatturato: number; ordiniRaccolti: number; ordiniPagati: number }> = {};

  const b2bOrders = orders.filter(o => o.customerType === 'B2B');

  b2bOrders.forEach(order => {
    order.products.forEach(product => {
      if (!skuMap[product.sku]) {
        skuMap[product.sku] = { name: product.name, fatturato: 0, ordiniRaccolti: 0, ordiniPagati: 0 };
      }
      // Ordini Raccolti = all orders (by order date)
      skuMap[product.sku].ordiniRaccolti += product.totalPrice;
      // Fatturato = only orders with deliveryDate
      if (order.deliveryDate) {
        skuMap[product.sku].fatturato += product.totalPrice;
      }
      // Ordini Pagati = only orders with payedDate
      if (order.payedDate) {
        skuMap[product.sku].ordiniPagati += product.totalPrice;
      }
    });
  });

  return Object.entries(skuMap)
    .map(([sku, data]) => ({
      sku,
      name: data.name,
      fatturato: Math.round(data.fatturato * 100) / 100,
      ordiniRaccolti: Math.round(data.ordiniRaccolti * 100) / 100,
      ordiniPagati: Math.round(data.ordiniPagati * 100) / 100,
    }))
    .sort((a, b) => b.ordiniRaccolti - a.ordiniRaccolti);
}

// Get B2C SKU breakdown with fatturato (completed) and ordini raccolti (all)
export function getB2CSkuBreakdown(orders: Order[]): Array<{
  sku: string;
  name: string;
  fatturato: number;
  ordiniRaccolti: number;
  qtyEvasi: number;
  qtyTotali: number;
}> {
  const skuMap: Record<string, { name: string; fatturato: number; ordiniRaccolti: number; qtyEvasi: number; qtyTotali: number }> = {};

  const b2cOrders = orders.filter(o => o.customerType === 'B2C');

  b2cOrders.forEach(order => {
    order.products.forEach(product => {
      if (!skuMap[product.sku]) {
        skuMap[product.sku] = { name: product.name, fatturato: 0, ordiniRaccolti: 0, qtyEvasi: 0, qtyTotali: 0 };
      }
      skuMap[product.sku].ordiniRaccolti += product.totalPrice;
      skuMap[product.sku].qtyTotali += product.quantity;
      if (order.status === 'completed') {
        skuMap[product.sku].fatturato += product.totalPrice;
        skuMap[product.sku].qtyEvasi += product.quantity;
      }
    });
  });

  return Object.entries(skuMap)
    .map(([sku, data]) => ({
      sku,
      name: data.name,
      fatturato: Math.round(data.fatturato * 100) / 100,
      ordiniRaccolti: Math.round(data.ordiniRaccolti * 100) / 100,
      qtyEvasi: data.qtyEvasi,
      qtyTotali: data.qtyTotali,
    }))
    .sort((a, b) => b.ordiniRaccolti - a.ordiniRaccolti);
}

// Get top products
export function getTopProducts(orders: Order[], limit: number = 5): Product[] {
  const products: Record<string, { name: string; sku: string; category: string; price: number; quantity: number; revenue: number }> = {};

  orders.forEach(order => {
    order.products.forEach(product => {
      if (!products[product.id]) {
        products[product.id] = {
          name: product.name,
          sku: product.sku,
          category: product.category,
          price: product.unitPrice,
          quantity: 0,
          revenue: 0,
        };
      }
      products[product.id].quantity += product.quantity;
      products[product.id].revenue += product.totalPrice;
    });
  });

  return Object.entries(products)
    .map(([id, data]) => ({
      id,
      name: data.name,
      sku: data.sku,
      category: data.category,
      price: data.price,
      totalSold: data.quantity,
      revenue: Math.round(data.revenue * 100) / 100,
    }))
    .sort((a, b) => b.revenue - a.revenue)
    .slice(0, limit);
}

// Get top customers
export function getTopCustomers(orders: Order[], limit: number = 5): Customer[] {
  const customers: Record<string, { name: string; type: 'B2C' | 'B2B'; orders: number; spent: number; firstDate: Date; lastDate: Date; agent?: string }> = {};

  orders.forEach(order => {
    if (!customers[order.customerId]) {
      customers[order.customerId] = {
        name: order.customerName,
        type: order.customerType,
        orders: 0,
        spent: 0,
        firstDate: order.date,
        lastDate: order.date,
        agent: order.agent,
      };
    }
    customers[order.customerId].orders++;
    customers[order.customerId].spent += order.totalAmount;
    if (order.date < customers[order.customerId].firstDate) {
      customers[order.customerId].firstDate = order.date;
    }
    if (order.date > customers[order.customerId].lastDate) {
      customers[order.customerId].lastDate = order.date;
    }
  });

  return Object.entries(customers)
    .map(([id, data]) => ({
      id,
      name: data.name,
      email: `${data.name.toLowerCase().replace(/\s/g, '.')}@example.com`,
      type: data.type,
      source: data.type === 'B2B' ? 'google_sheets' as const : 'shopify' as const,
      totalOrders: data.orders,
      totalSpent: Math.round(data.spent * 100) / 100,
      firstOrderDate: data.firstDate,
      lastOrderDate: data.lastDate,
      agent: data.agent,
    }))
    .sort((a, b) => b.totalSpent - a.totalSpent)
    .slice(0, limit);
}
