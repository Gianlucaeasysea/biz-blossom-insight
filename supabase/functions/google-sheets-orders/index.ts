import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

const SPREADSHEET_ID = '1S_Si86x7GdKAuRdRkx5wFK231lGnujChZtFXwo9tMzg';

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const apiKey = Deno.env.get('GOOGLE_SHEETS_API_KEY');
    if (!apiKey) {
      throw new Error('Missing GOOGLE_SHEETS_API_KEY secret');
    }

    // Get all sheet names to find the orders sheet
    const metaUrl = `https://sheets.googleapis.com/v4/spreadsheets/${SPREADSHEET_ID}?key=${apiKey}&fields=sheets.properties.title`;
    const metaResponse = await fetch(metaUrl);
    if (!metaResponse.ok) {
      const errorText = await metaResponse.text();
      throw new Error(`Google Sheets metadata error: ${metaResponse.status} - ${errorText}`);
    }
    const metaData = await metaResponse.json();
    const sheetNames = metaData.sheets?.map((s: { properties: { title: string } }) => s.properties.title) || [];
    console.log('All sheet names:', JSON.stringify(sheetNames));

    // Use the "B2B" sheet which contains the order data with proper headers
    const orderSheetKeywords = ['b2b'];
    let sheetName = sheetNames.find((name: string) => {
      const lower = name.toLowerCase().trim();
      return lower === 'b2b'; // Exact match first
    }) || sheetNames.find((name: string) => 
      orderSheetKeywords.some((kw: string) => name.toLowerCase().includes(kw))
    ) || sheetNames[1] || sheetNames[0];
    
    console.log('Using sheet:', sheetName);

    // Fetch all rows
    const range = `'${sheetName}'!A1:AG5000`;
    const sheetsUrl = `https://sheets.googleapis.com/v4/spreadsheets/${SPREADSHEET_ID}/values/${encodeURIComponent(range)}?key=${apiKey}&majorDimension=ROWS&valueRenderOption=FORMATTED_VALUE`;

    console.log(`Fetching sheet: ${sheetName}, range: ${range}`);
    const response = await fetch(sheetsUrl);

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`Google Sheets API error: ${response.status} - ${errorText}`);
      throw new Error(`Google Sheets API error: ${response.status} - ${errorText}`);
    }

    const data = await response.json();
    const rows: string[][] = data.values || [];
    
    // Debug: log first 3 rows to understand structure
    console.log('Total rows:', rows.length);
    console.log('Row 0 (length=' + (rows[0]?.length || 0) + '):', JSON.stringify(rows[0]?.slice(0, 15)));
    console.log('Row 1 (length=' + (rows[1]?.length || 0) + '):', JSON.stringify(rows[1]?.slice(0, 15)));
    console.log('Row 2 (length=' + (rows[2]?.length || 0) + '):', JSON.stringify(rows[2]?.slice(0, 15)));

    if (rows.length < 2) {
      return new Response(
        JSON.stringify({ success: true, orders: [], count: 0 }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
      );
    }

    // Header row (row 0)
    const headers = rows[0].map((h: string) => h.trim().toLowerCase());
    console.log('Raw headers:', JSON.stringify(rows[0]));
    console.log('Normalized headers:', JSON.stringify(headers));
    
    // Map column indices - use flexible matching
    const colIdx = (name: string) => headers.findIndex((h: string) => h.includes(name));
    
    const iBusiness = colIdx('business');
    const iCode = colIdx('code');
    const iStatusOrder = colIdx('status order');
    const iTotFatt = headers.findIndex((h: string) => h.includes('tot') && (h.includes('fatt') || h.includes(',')));
    const iTotFattFallback = iTotFatt >= 0 ? iTotFatt : headers.findIndex((h: string) => h.startsWith('tot'));
    const iQty = headers.findIndex((h: string) => h.includes('q.ty') || h.includes('qty') || h.includes('quantity'));
    const iProduct = colIdx('product');
    const iOrderDate = headers.findIndex((h: string) => h.includes('order date') || h.includes('order_date'));
    const iDeliveryDate = headers.findIndex((h: string) => h.includes('delivery date') || h.includes('delivery_date'));
    const iPayedDate = headers.findIndex((h: string) => h.includes('payed date') || h.includes('payed_date') || h.includes('paid date') || h.includes('paid_date') || h.includes('payment date'));
    const iPrice = colIdx('price');
    const iSender = colIdx('sender');
    const iOwner = colIdx('owner');
    const iCountry = colIdx('country');
    const iNomeProdotto = headers.findIndex((h: string) => h.includes('nome prodotto'));
    const iCollection = colIdx('collection');

    // SKU mapping for B2B products
    const skuMap: Record<string, string> = {
      'Flipper™ - Standard Foldable Winch Handle': 'FS-101-1',
      'Flipper MAX™ - Foldable Winch Handle': 'FM-101-1',
      'Flipper™ Max Carbon': 'FCM-101-1',
      'Flipper™ Anti-Mould Winch Cover - Gray / S - 30': 'CWC-101GY',
      'Anti-Mould Winch Cover - Gray / S - 36': 'CWC-101GY',
      'Anti-Mould Winch Cover - Gray / M - 40': 'CWC-102GY',
      'Anti-Mould Winch Cover - Gray / L - 46': 'CWC-103GY',
      'Anti-Mould Winch Cover - Gray / XL - 50': 'CWC-104GY',
      'Olli™ - Anti Shock low friction ring aluminium - XS': 'OA-101',
      'Olli™ - Anti Shock low friction ring aluminium - S': 'OA-102',
      'Olli™ - Anti Shock low friction ring aluminium - M': 'OA-103',
      'Olli™ - Anti Shock low friction ring aluminium - L': 'OA-104',
      'Olli™ - Anti Shock low friction ring aluminium - XL': 'OA-105',
      'Olli™ - Anti Shock solid ring aluminium - S - 20x38': 'SRA-101',
      'Olli™ - Anti Shock solid ring aluminium - M - 26x50': 'SRA-102',
      'Olli™ - Anti Shock solid ring aluminium - L - 38x70': 'SRA-103',
      'Olli™ - Anti Shock solid ring aluminium - XL - 55x101': 'SRA-104',
      'Olli™ - Snatch and Anti-shock block - M 50x12': 'OB-103',
      'Olli™ - Snatch and Anti-shock block S 40X10': 'OB-102',
      'Covered Loop in Dyneema® - S - 14x10': 'LC-101',
      'Covered Loop in Dyneema® for Olli - S - 14x10': 'LC-101',
      'Covered Loop in Dyneema® - M - 20x14': 'LC-102',
      'Covered Loop in Dyneema® for Olli - M - 20x14': 'LC-102',
      'Covered Loop in Dyneema® - L - 28x20': 'LC-103',
      'Covered Loop in Dyneema® for Olli - L - 28x20': 'LC-103',
      'Covered Loop in Dyneema® - XL - 38x28': 'LC-104',
      'Covered Loop in Dyneema® for Olli - XL - 38x28': 'LC-104',
      'Sheathed Loop Dyneema® - XS - 8x5': 'LS-101',
      'Sheathed Loop Dyneema® - S - 14x10': 'LS-102',
      'Sheathed Loop Dyneema® - M - 20x14': 'LS-103',
      'Sheathed Loop Dyneema® - L - 28x20': 'LS-104',
      'Soft Shackle in Dyneema® - XS - 8x5': 'SS-101',
      'Soft Shackle in Dyneema® - S - 14x10': 'SS-102',
      'Soft Shackle in Dyneema® - M - 20x14': 'SS-103',
      'Soft Shackle in Dyneema® - L - 28x20': 'SS-104',
      'Spira – The Twistable Guardrail Cover': 'SP-101',
      'Way2 - The inflatable reversible gangway': 'W2G-101',
    };

    const lookupSku = (productName: string): string => {
      if (!productName) return 'UNKNOWN';
      // Exact match first
      if (skuMap[productName]) return skuMap[productName];
      // Case-insensitive match
      const lower = productName.toLowerCase().trim();
      for (const [key, sku] of Object.entries(skuMap)) {
        if (key.toLowerCase().trim() === lower) return sku;
      }
      // Partial match (product name contains or is contained)
      for (const [key, sku] of Object.entries(skuMap)) {
        if (lower.includes(key.toLowerCase()) || key.toLowerCase().includes(lower)) return sku;
      }
      return 'UNKNOWN';
    };

    console.log(`Column indices: business=${iBusiness}, totFatt=${iTotFattFallback}, orderDate=${iOrderDate}, deliveryDate=${iDeliveryDate}, payedDate=${iPayedDate}, price=${iPrice}, product=${iProduct}, qty=${iQty}, nomeProdotto=${iNomeProdotto}`);
    // Transform rows to orders
    const orders = [];
    for (let i = 1; i < rows.length; i++) {
      const row = rows[i];
      if (!row || row.length < 5) continue;

      const get = (idx: number) => (idx >= 0 && idx < row.length) ? (row[idx] || '').trim() : '';
      
      const business = get(iBusiness);
      const totalStr = get(iTotFattFallback);
      const orderDateStr = get(iOrderDate);
      const deliveryDateStr = get(iDeliveryDate);
      const payedDateStr = get(iPayedDate);
      const productName = get(iProduct);
      const code = get(iCode);
      
      // Skip rows without essential data
      if (!business && !totalStr && !orderDateStr) continue;

      // Parse amount - handle European format: "1.936,00" (dot=thousands, comma=decimal)
      const parseEuropeanNumber = (str: string): number => {
        if (!str) return 0;
        const cleaned = str.replace(/[^\d.,-]/g, '');
        if (cleaned.includes(',') && cleaned.includes('.')) {
          if (cleaned.lastIndexOf(',') > cleaned.lastIndexOf('.')) {
            return parseFloat(cleaned.replace(/\./g, '').replace(',', '.')) || 0;
          }
          return parseFloat(cleaned.replace(/,/g, '')) || 0;
        }
        if (cleaned.includes(',')) {
          const afterComma = cleaned.split(',')[1];
          if (afterComma && afterComma.length <= 2) {
            return parseFloat(cleaned.replace(',', '.')) || 0;
          }
          return parseFloat(cleaned.replace(/,/g, '')) || 0;
        }
        if (cleaned.includes('.')) {
          const parts = cleaned.split('.');
          const lastPart = parts[parts.length - 1];
          if (parts.length > 1 && lastPart.length === 3 && parts.length > 2) {
            return parseFloat(cleaned.replace(/\./g, '')) || 0;
          }
        }
        return parseFloat(cleaned) || 0;
      };
      const totalAmount = parseEuropeanNumber(totalStr);
      
      // Parse date helper
      const parseDate = (dateStr: string): string | null => {
        if (!dateStr) return null;
        const parts = dateStr.split(/[\/\-\.]/);
        if (parts.length === 3) {
          const [a, b, c] = parts.map(Number);
          if (c > 100) {
            return new Date(c, b - 1, a).toISOString();
          } else if (a > 100) {
            return new Date(a, b - 1, c).toISOString();
          }
        }
        const d = new Date(dateStr);
        if (!isNaN(d.getTime())) return d.toISOString();
        return null;
      };

      const orderDate = parseDate(orderDateStr);
      const deliveryDate = parseDate(deliveryDateStr);
      const payedDate = parseDate(payedDateStr);

      if (!orderDate) continue; // Skip rows without valid order date

      // Parse quantity
      const qty = parseInt(get(iQty)) || 1;
      const priceValue = parseEuropeanNumber(get(iPrice));
      const unitPrice = priceValue || totalAmount;
      const productTotal = priceValue > 0 ? priceValue : totalAmount;

      // Map order status
      const statusOrderRaw = get(iStatusOrder).toLowerCase();
      let status: 'pending' | 'completed' | 'cancelled' | 'refunded' = 'pending';
      if (statusOrderRaw.includes('complet') || statusOrderRaw.includes('deliver') || statusOrderRaw.includes('consegn')) {
        status = 'completed';
      } else if (statusOrderRaw.includes('cancel') || statusOrderRaw.includes('annull')) {
        status = 'cancelled';
      } else if (statusOrderRaw.includes('refund') || statusOrderRaw.includes('rimbors')) {
        status = 'refunded';
      }

      const category = get(iCollection) || 'B2B';

      orders.push({
        id: `gsheets-${i}`,
        orderNumber: code || `GS-${i}`,
        customerType: 'B2B' as const,
        source: 'google_sheets' as const,
        customerId: `gsheets-customer-${business.toLowerCase().replace(/\s+/g, '-')}`,
        customerName: business || 'Sconosciuto',
        date: orderDate,
        deliveryDate: deliveryDate || null,
        payedDate: payedDate || null,
        products: [{
          id: `gsheets-item-${i}`,
          name: productName || 'Prodotto B2B',
          sku: lookupSku(productName),
          category,
          quantity: qty,
          unitPrice,
          totalPrice: productTotal,
        }],
        totalAmount: productTotal,
        currency: 'EUR',
        channel: 'wholesale',
        agent: get(iSender) || get(iOwner),
        status,
      });
    }

    console.log(`Successfully transformed ${orders.length} B2B orders from Google Sheets`);

    return new Response(
      JSON.stringify({ success: true, orders, count: orders.length }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
    );
  } catch (error) {
    console.error('Error fetching Google Sheets data:', error);
    return new Response(
      JSON.stringify({ success: false, error: error instanceof Error ? error.message : 'Unknown error' }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
    );
  }
});
