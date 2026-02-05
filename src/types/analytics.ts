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
  products: OrderProduct[];
  totalAmount: number;
  currency: string;
  channel?: string;
  agent?: string; // For B2B orders
  status: 'pending' | 'completed' | 'cancelled' | 'refunded';
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

// KPI Types
export interface KPIData {
  label: string;
  value: number;
  previousValue?: number;
  changePercent?: number;
  trend: 'up' | 'down' | 'neutral';
  format: 'currency' | 'number' | 'percent';
  currency?: string;
}

// Filter Types
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

// Chart Data Types
export interface TimeSeriesData {
  date: string;
  b2c: number;
  b2b: number;
  total: number;
}

export interface CategoryData {
  name: string;
  value: number;
  fill?: string;
}

// View Configuration
export interface SavedView {
  id: string;
  name: string;
  filters: DashboardFilters;
  visibleWidgets: string[];
  createdAt: Date;
}
