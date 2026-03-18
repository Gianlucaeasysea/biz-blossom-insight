// Unified data model for B2C and B2B analytics

export type CustomerType = 'B2C' | 'B2B';
export type DataSource = 'shopify' | 'google_sheets';

export interface Order {
  id: string;
  orderNumber: string;
  customerType: CustomerType;
  source: DataSource;
  customerId: string;
  customerName: string;
  date: Date;
  deliveryDate?: Date | null;
  payedDate?: Date | null;
  products: OrderProduct[];
  totalAmount: number;
  netAmount?: number;
  grossSales?: number;
  totalDiscounts?: number;
  totalRefunds?: number;
  shippingCharges?: number;
  taxes?: number;
  fees?: number;
  totalSales?: number;
  currency: string;
  channel?: string;
  agent?: string;
  status: 'pending' | 'completed' | 'cancelled' | 'refunded';
  orderType?: string; // B2B: 'custom', etc.
  country?: string;
  destinationCountry?: string; // B2C: shipping destination country
  landingSite?: string | null;
  referringSite?: string | null;
  utm?: Record<string, string> | null;
}

export interface OrderProduct {
  id: string;
  name: string;
  sku: string;
  category: string;
  quantity: number;
  unitPrice: number;
  totalPrice: number;
}

export interface Customer {
  id: string;
  name: string;
  email: string;
  type: CustomerType;
  source: DataSource;
  totalOrders: number;
  totalSpent: number;
  firstOrderDate: Date;
  lastOrderDate: Date;
  agent?: string;
}

export interface Product {
  id: string;
  name: string;
  sku: string;
  category: string;
  price: number;
  totalSold: number;
  revenue: number;
}

export interface SalesChannel {
  id: string;
  name: string;
  type: 'online' | 'retail' | 'wholesale' | 'marketplace';
}

export interface KPIData {
  label: string;
  value: number;
  previousValue?: number;
  changePercent?: number;
  trend: 'up' | 'down' | 'neutral';
  format: 'currency' | 'number' | 'percent';
  currency?: string;
}

export interface DashboardFilters {
  dateRange: {
    start: Date;
    end: Date;
  };
  customerType: CustomerType | 'all';
  products: string[];
  categories: string[];
  customers: string[];
  channels: string[];
  agents: string[];
}

export interface TimeSeriesData {
  date: string;
  b2c: number;
  b2b: number;
  b2bCustom: number;
  total: number;
}

export interface CategoryData {
  name: string;
  value: number;
  fill?: string;
}

export interface SavedView {
  id: string;
  name: string;
  filters: DashboardFilters;
  visibleWidgets: string[];
  createdAt: Date;
}
