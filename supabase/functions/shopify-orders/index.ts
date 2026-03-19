import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

interface ShopifyOrder {
  id: number;
  order_number: number;
  name: string;
  created_at: string;
  total_price: string;
  subtotal_price: string;
  current_subtotal_price?: string;
  total_line_items_price?: string;
  total_discounts: string;
  current_total_discounts?: string;
  total_tax?: string;
  current_total_tax?: string;
  total_shipping_price_set?: {
    shop_money?: { amount: string };
  };
  current_total_shipping_price_set?: {
    shop_money?: { amount: string };
  };
  current_total_additional_fees_set?: {
    shop_money?: { amount: string };
  };
  currency: string;
  financial_status: string;
  fulfillment_status: string | null;
  customer: {
    id: number;
    email: string;
    first_name: string;
    last_name: string;
  } | null;
  line_items: Array<{
    id: number;
    title: string;
    variant_title: string | null;
    sku: string;
    quantity: number;
    price: string;
    product_id: number;
    discount_allocations?: Array<{
      amount: string;
    }>;
  }>;
  source_name: string;
  cancelled_at: string | null;
  refunds: Array<{
    refund_line_items?: Array<{
      quantity: number;
      line_item_id: number;
      subtotal: number;
    }>;
  }>;
  shipping_address?: {
    city?: string;
    province?: string;
    country?: string;
    country_code?: string;
    province_code?: string;
    zip?: string;
  } | null;
  billing_address?: {
    city?: string;
    province?: string;
    country?: string;
    country_code?: string;
  } | null;
  landing_site?: string | null;
  referring_site?: string | null;
  note_attributes?: Array<{ name: string; value: string }>;
}

interface ShopifyQlColumn {
  name: string;
  dataType?: string;
  displayName?: string;
}

interface ShopifyQlResponse {
  data?: {
    shopifyqlQuery?: {
      tableData?: {
        columns?: ShopifyQlColumn[];
        rows?: Array<Record<string, unknown> | unknown[]>;
      };
      parseErrors?: string[][];
    };
  };
  errors?: Array<{
    message?: string;
  }>;
}

interface ShopifySalesSummary {
  grossSales: number;
  discounts: number;
  returns: number;
  netSales: number;
  shippingCharges: number;
  returnFees: number;
  taxes: number;
  totalSales: number;
  source: 'shopify_analytics' | 'orders_fallback';
  dayCount: number;
}

function parseMoney(value: string | number | null | undefined): number {
  if (typeof value === 'number') {
    return Number.isFinite(value) ? value : 0;
  }

  if (!value) return 0;

  let normalized = String(value).trim();
  if (!normalized) return 0;

  normalized = normalized.replace(/[€$£¥\s]/g, '');

  const lastComma = normalized.lastIndexOf(',');
  const lastDot = normalized.lastIndexOf('.');
  const commaDecimal = lastComma > lastDot;

  if (commaDecimal) {
    normalized = normalized.replace(/\./g, '').replace(',', '.');
  } else {
    normalized = normalized.replace(/,/g, '');
  }

  const parsed = parseFloat(normalized);
  return Number.isFinite(parsed) ? parsed : 0;
}

function toCents(value: number): number {
  return Math.round(value * 100);
}

function fromCents(value: number): number {
  return Math.round(value) / 100;
}

function roundMoney(value: number): number {
  return fromCents(toCents(value));
}

function extractUtmParams(url: string | null | undefined): Record<string, string> {
  if (!url) return {};
  try {
    const parsed = new URL(url, 'https://placeholder.com');
    const utms: Record<string, string> = {};
    for (const key of ['utm_source', 'utm_medium', 'utm_campaign', 'utm_content', 'utm_term']) {
      const val = parsed.searchParams.get(key);
      if (val) utms[key] = val;
    }
    return utms;
  } catch {
    return {};
  }
}

function normalizeStoreName(storeName: string): string {
  let normalized = storeName;

  if (normalized.includes('admin.shopify.com/store/')) {
    const match = normalized.match(/admin\.shopify\.com\/store\/([^\/\?]+)/);
    if (match) normalized = match[1];
  } else if (normalized.includes('.myshopify.com')) {
    normalized = normalized.replace(/https?:\/\//, '').replace('.myshopify.com', '').replace(/\/.*/g, '');
  }

  return normalized.replace(/https?:\/\//g, '').replace(/\//g, '').trim();
}

function normalizeColumnName(name: string): string {
  return name
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[_\s]+/g, ' ')
    .trim();
}

function findColumnKey(columns: ShopifyQlColumn[], possibleNames: string[]): string | null {
  const candidates = possibleNames.map(normalizeColumnName);
  const mapped = columns.map((column) => ({
    key: column.name,
    name: normalizeColumnName(column.name || ''),
    displayName: normalizeColumnName(column.displayName || ''),
  }));

  for (const candidate of candidates) {
    const exact = mapped.find((column) => column.name === candidate || column.displayName === candidate);
    if (exact) return exact.key;
  }

  for (const candidate of candidates) {
    const startsWith = mapped.find((column) => column.name.startsWith(candidate) || column.displayName.startsWith(candidate));
    if (startsWith) return startsWith.key;
  }

  for (const candidate of candidates) {
    const contains = mapped.find((column) => column.name.includes(candidate) || column.displayName.includes(candidate));
    if (contains) return contains.key;
  }

  return null;
}

function getRowValue(
  row: Record<string, unknown> | unknown[],
  columns: ShopifyQlColumn[],
  columnKey: string | null,
): unknown {
  if (!columnKey) return null;

  if (Array.isArray(row)) {
    const index = columns.findIndex((column) => column.name === columnKey);
    return index >= 0 ? row[index] : null;
  }

  return row[columnKey] ?? null;
}

function sumTableColumn(
  rows: Array<Record<string, unknown> | unknown[]>,
  columns: ShopifyQlColumn[],
  possibleNames: string[],
): number {
  const columnKey = findColumnKey(columns, possibleNames);
  if (!columnKey) return 0;

  return rows.reduce((sum, row) => sum + toCents(parseMoney(getRowValue(row, columns, columnKey) as string | number | null | undefined)), 0);
}

function extractDateOnly(value: string | null): string | null {
  if (!value) return null;
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) return value;

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return null;

  const year = parsed.getUTCFullYear();
  const month = String(parsed.getUTCMonth() + 1).padStart(2, '0');
  const day = String(parsed.getUTCDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

async function sleep(ms: number) {
  await new Promise((resolve) => setTimeout(resolve, ms));
}

async function fetchShopifyGraphql<T>(
  storeName: string,
  accessToken: string,
  query: string,
  variables: Record<string, unknown>,
): Promise<T> {
  const response = await fetch(`https://${storeName}.myshopify.com/admin/api/2025-10/graphql.json`, {
    method: 'POST',
    headers: {
      'X-Shopify-Access-Token': accessToken,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ query, variables }),
  });

  const payload = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(`Shopify GraphQL error: ${response.status} - ${JSON.stringify(payload)}`);
  }

  return payload as T;
}

async function fetchAnalyticsSummary(
  storeName: string,
  accessToken: string,
  createdAtMin: string | null,
  createdAtMax: string | null,
): Promise<ShopifySalesSummary | null> {
  const since = extractDateOnly(createdAtMin);
  const until = extractDateOnly(createdAtMax);

  if (!since || !until) return null;

  const shopifyQlQuery = `FROM sales SHOW gross_sales, discounts, returns, net_sales, shipping_charges, taxes, total_sales GROUP BY day SINCE ${since} UNTIL ${until} ORDER BY day`;
  const graphqlQuery = `query ShopifyQlSummary($query: String!) {
    shopifyqlQuery(query: $query) {
      tableData {
        columns {
          name
          dataType
          displayName
        }
        rows
      }
      parseErrors
    }
  }`;

  const payload = await fetchShopifyGraphql<ShopifyQlResponse>(storeName, accessToken, graphqlQuery, {
    query: shopifyQlQuery,
  });

  if (payload.errors?.length) {
    throw new Error(payload.errors.map((error) => error.message).filter(Boolean).join('; '));
  }

  const parseErrors = (payload.data?.shopifyqlQuery?.parseErrors ?? []).flat().filter(Boolean);
  if (parseErrors.length > 0) {
    throw new Error(parseErrors.join('; '));
  }

  const columns = payload.data?.shopifyqlQuery?.tableData?.columns ?? [];
  const rows = payload.data?.shopifyqlQuery?.tableData?.rows ?? [];

  return {
    grossSales: fromCents(sumTableColumn(rows, columns, ['gross_sales', 'gross sales'])),
    discounts: fromCents(sumTableColumn(rows, columns, ['discounts'])),
    returns: fromCents(sumTableColumn(rows, columns, ['sales_reversals', 'sales reversals', 'returns'])),
    netSales: fromCents(sumTableColumn(rows, columns, ['net_sales', 'net sales'])),
    shippingCharges: fromCents(sumTableColumn(rows, columns, ['shipping', 'shipping charges'])),
    returnFees: 0,
    taxes: fromCents(sumTableColumn(rows, columns, ['taxes'])),
    totalSales: fromCents(sumTableColumn(rows, columns, ['total_sales', 'total sales'])),
    source: 'shopify_analytics',
    dayCount: rows.length,
  };
}

function buildSummaryFromOrders(transformedOrders: Array<Record<string, unknown>>): ShopifySalesSummary {
  const grossSales = transformedOrders.reduce((sum, order) => sum + toCents(parseMoney(order.grossSales as number | string | null | undefined)), 0);
  const discounts = transformedOrders.reduce((sum, order) => sum + toCents(parseMoney(order.totalDiscounts as number | string | null | undefined)), 0);
  const returns = transformedOrders.reduce((sum, order) => sum + toCents(parseMoney(order.totalRefunds as number | string | null | undefined)), 0);
  const netSales = transformedOrders.reduce((sum, order) => sum + toCents(parseMoney(order.netAmount as number | string | null | undefined)), 0);
  const shippingCharges = transformedOrders.reduce((sum, order) => sum + toCents(parseMoney(order.shippingCharges as number | string | null | undefined)), 0);
  const taxes = transformedOrders.reduce((sum, order) => sum + toCents(parseMoney(order.taxes as number | string | null | undefined)), 0);
  const totalSales = transformedOrders.reduce((sum, order) => sum + toCents(parseMoney(order.totalSales as number | string | null | undefined)), 0);

  return {
    grossSales: fromCents(grossSales),
    discounts: fromCents(discounts),
    returns: fromCents(returns),
    netSales: fromCents(netSales),
    shippingCharges: fromCents(shippingCharges),
    returnFees: 0,
    taxes: fromCents(taxes),
    totalSales: fromCents(totalSales),
    source: 'orders_fallback',
    dayCount: 0,
  };
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const storeNameRaw = Deno.env.get('SHOPIFY_STORE_NAME');
    const accessToken = Deno.env.get('SHOPIFY_ACCESS_TOKEN');

    if (!storeNameRaw || !accessToken) {
      throw new Error('Missing Shopify credentials. Please configure SHOPIFY_STORE_NAME and SHOPIFY_ACCESS_TOKEN.');
    }

    const storeName = normalizeStoreName(storeNameRaw);
    const url = new URL(req.url);
    const limit = url.searchParams.get('limit') || '50';
    const status = url.searchParams.get('status') || 'any';
    const createdAtMin = url.searchParams.get('created_at_min');
    const createdAtMax = url.searchParams.get('created_at_max');
    const reportMode = url.searchParams.get('report_mode');

    let analyticsSummary: ShopifySalesSummary | null = null;
    if (createdAtMin && createdAtMax) {
      try {
        analyticsSummary = await fetchAnalyticsSummary(storeName, accessToken, createdAtMin, createdAtMax);
      } catch (error) {
        console.error('Error fetching Shopify analytics summary:', error);
      }
    }

    if (reportMode === 'summary' && analyticsSummary) {
      return new Response(
        JSON.stringify({
          success: true,
          summary: analyticsSummary,
        }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 200,
        },
      );
    }

    const baseParams = `limit=${limit}&status=${status}`;
    let shopifyUrl = `https://${storeName}.myshopify.com/admin/api/2024-01/orders.json?${baseParams}`;

    if (createdAtMin) shopifyUrl += `&created_at_min=${createdAtMin}`;
    if (createdAtMax) shopifyUrl += `&created_at_max=${createdAtMax}`;

    const allOrders: ShopifyOrder[] = [];
    let nextPageUrl: string | null = shopifyUrl;
    let pageCount = 0;
    const maxPages = 20;

    while (nextPageUrl && pageCount < maxPages) {
      pageCount++;
      console.log(`Fetching orders page ${pageCount}: ${nextPageUrl}`);

      let data: { orders?: ShopifyOrder[] } | null = null;
      const maxRetries = 3;
      let lastError: Error | null = null;

      for (let attempt = 0; attempt < maxRetries; attempt++) {
        try {
          const resp: Response = await fetch(nextPageUrl!, {
            method: 'GET',
            headers: {
              'X-Shopify-Access-Token': accessToken,
              'Content-Type': 'application/json',
            },
          });

          if (!resp.ok) {
            const errorText = await resp.text().catch(() => 'Unable to read error body');
            if ((resp.status === 429 || resp.status >= 500) && attempt < maxRetries - 1) {
              const retryAfter: string | null = resp.headers.get('Retry-After');
              const waitMs = retryAfter ? parseInt(retryAfter, 10) * 1000 : Math.pow(2, attempt) * 1000;
              console.log(`Shopify returned ${resp.status}, retrying in ${waitMs}ms`);
              await sleep(Math.min(waitMs, 60000));
              continue;
            }
            throw new Error(`Shopify API error: ${resp.status} - ${errorText}`);
          }

          const lnkHeader: string | null = resp.headers.get('Link');
          nextPageUrl = null;
          if (lnkHeader) {
            const nxtMatch: RegExpMatchArray | null = lnkHeader.match(/<([^>]+)>;\s*rel="next"/);
            if (nxtMatch) nextPageUrl = nxtMatch[1];
          }

          const responseText = await resp.text();
          data = JSON.parse(responseText);
          break;
        } catch (error) {
          lastError = error instanceof Error ? error : new Error(String(error));
          if (attempt < maxRetries - 1) {
            const waitMs = Math.pow(2, attempt) * 1000;
            console.log(`Retry ${attempt + 1}/${maxRetries}: ${lastError.message}`);
            await sleep(waitMs);
            continue;
          }
        }
      }

      if (!data) {
        throw lastError ?? new Error(`Failed to fetch orders page ${pageCount}`);
      }

      const pageOrders = data.orders || [];
      allOrders.push(...pageOrders);

      if (pageOrders.length < parseInt(limit, 10)) nextPageUrl = null;
      if (nextPageUrl) await sleep(500);
    }

    console.log(`Fetched ${allOrders.length} total orders across ${pageCount} pages`);

    const transformedOrders = allOrders.map((order) => {
      let orderStatus: 'pending' | 'completed' | 'cancelled' | 'refunded' = 'pending';
      if (order.cancelled_at) {
        orderStatus = 'cancelled';
      } else if (order.refunds && order.refunds.length > 0) {
        orderStatus = 'refunded';
      } else if (order.financial_status === 'paid' && order.fulfillment_status === 'fulfilled') {
        orderStatus = 'completed';
      }

      const grossSales = roundMoney(parseMoney(order.total_line_items_price || order.subtotal_price));
      const discountsValue = roundMoney(-parseMoney(order.current_total_discounts || order.total_discounts));
      const netAmount = roundMoney(parseMoney(order.current_subtotal_price || order.subtotal_price));
      const returnsValue = roundMoney(netAmount - (grossSales + discountsValue));

      const utmFromLanding = extractUtmParams(order.landing_site);
      const utmFromReferring = extractUtmParams(order.referring_site);
      const utmFromNotes: Record<string, string> = {};
      if (order.note_attributes) {
        for (const attr of order.note_attributes) {
          if (attr.name.startsWith('utm_')) {
            utmFromNotes[attr.name] = attr.value;
          }
        }
      }
      const utm = { ...utmFromReferring, ...utmFromLanding, ...utmFromNotes };

      const country = order.shipping_address?.country || order.billing_address?.country || undefined;
      const destinationCountry = order.shipping_address?.country || undefined;
      const destinationCity = order.shipping_address?.city || undefined;
      const destinationProvince = order.shipping_address?.province || order.shipping_address?.province_code || undefined;
      const shippingCharges = roundMoney(parseMoney(
        order.current_total_shipping_price_set?.shop_money?.amount || order.total_shipping_price_set?.shop_money?.amount,
      ));
      const taxes = roundMoney(parseMoney(order.current_total_tax || order.total_tax));
      const fees = roundMoney(parseMoney(order.current_total_additional_fees_set?.shop_money?.amount));
      const totalSales = roundMoney(netAmount + shippingCharges + taxes + fees);

      return {
        id: `shopify-${order.id}`,
        orderNumber: order.name,
        customerType: 'B2C' as const,
        source: 'shopify' as const,
        customerId: order.customer ? `shopify-customer-${order.customer.id}` : 'guest',
        customerName: order.customer
          ? `${order.customer.first_name} ${order.customer.last_name}`.trim()
          : 'Ospite',
        date: order.created_at,
      products: order.line_items.map((item) => {
          const grossPrice = parseMoney(item.price) * item.quantity;
          const itemDiscount = (item.discount_allocations || []).reduce(
            (sum, discount) => sum + parseMoney(discount.amount),
            0,
          );

          let itemRefund = 0;
          let refundedQty = 0;
          if (order.refunds) {
            for (const refund of order.refunds) {
              for (const rli of refund.refund_line_items || []) {
                if (rli.line_item_id === item.id) {
                  itemRefund += rli.subtotal || 0;
                  refundedQty += rli.quantity || 0;
                }
              }
            }
          }

          const netQty = item.quantity - refundedQty;
          const netPrice = roundMoney(grossPrice - itemDiscount - itemRefund);
          const displayName = item.variant_title ? `${item.title} - ${item.variant_title}` : item.title;
          return {
            id: `shopify-item-${item.id}`,
            name: displayName,
            sku: item.sku || `SKU-${item.product_id}`,
            category: 'Shopify',
            quantity: netQty,
            unitPrice: parseMoney(item.price),
            totalPrice: netPrice,
          };
        }),
        totalAmount: roundMoney(parseMoney(order.total_price)),
        netAmount,
        grossSales,
        totalDiscounts: discountsValue,
        totalRefunds: returnsValue,
        shippingCharges,
        taxes,
        fees,
        totalSales,
        currency: order.currency,
        channel: order.source_name,
        status: orderStatus,
        country,
        destinationCountry,
        destinationCity,
        destinationProvince,
        landingSite: order.landing_site || null,
        referringSite: order.referring_site || null,
        utm: Object.keys(utm).length > 0 ? utm : null,
      };
    });

    console.log(`Successfully fetched ${transformedOrders.length} orders from Shopify`);

    const summary = analyticsSummary ?? (reportMode === 'summary'
      ? {
          ...buildSummaryFromOrders(transformedOrders),
          warning: 'Report Shopify non disponibile: sto mostrando un fallback calcolato dagli ordini, che può non coincidere con la reportistica ufficiale.',
        }
      : null);

    return new Response(
      JSON.stringify({
        success: true,
        orders: transformedOrders,
        count: transformedOrders.length,
        summary,
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      },
    );
  } catch (error) {
    console.error('Error fetching Shopify orders:', error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500,
      },
    );
  }
});