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
    const iPrice = colIdx('price');
    const iSender = colIdx('sender');
    const iOwner = colIdx('owner');
    const iCountry = colIdx('country');
    const iNomeProdotto = headers.findIndex((h: string) => h.includes('nome prodotto'));
    const iCollection = colIdx('collection');

    console.log(`Column indices: business=${iBusiness}, totFatt=${iTotFattFallback}, orderDate=${iOrderDate}, product=${iProduct}, qty=${iQty}, nomeProdotto=${iNomeProdotto}`);

    // Transform rows to orders
    const orders = [];
    for (let i = 1; i < rows.length; i++) {
      const row = rows[i];
      if (!row || row.length < 5) continue;

      const get = (idx: number) => (idx >= 0 && idx < row.length) ? (row[idx] || '').trim() : '';
      
      const business = get(iBusiness);
      const totalStr = get(iTotFattFallback);
      const orderDateStr = get(iOrderDate);
      const productName = get(iNomeProdotto) || get(iProduct);
      const code = get(iCode);
      
      // Skip rows without essential data
      if (!business && !totalStr && !orderDateStr) continue;

      // Parse amount - handle European format: "1.936,00" (dot=thousands, comma=decimal)
      const parseEuropeanNumber = (str: string): number => {
        if (!str) return 0;
        const cleaned = str.replace(/[^\d.,-]/g, '');
        // If has both dot and comma, determine format
        if (cleaned.includes(',') && cleaned.includes('.')) {
          // European: 1.936,00 → remove dots, replace comma with dot
          if (cleaned.lastIndexOf(',') > cleaned.lastIndexOf('.')) {
            return parseFloat(cleaned.replace(/\./g, '').replace(',', '.')) || 0;
          }
          // US: 1,936.00
          return parseFloat(cleaned.replace(/,/g, '')) || 0;
        }
        // Only comma: could be "1936,00" (decimal) or "1,936" (thousands)
        if (cleaned.includes(',')) {
          const afterComma = cleaned.split(',')[1];
          if (afterComma && afterComma.length <= 2) {
            return parseFloat(cleaned.replace(',', '.')) || 0;
          }
          return parseFloat(cleaned.replace(/,/g, '')) || 0;
        }
        // Only dots: could be "1.936" (thousands) or "19.36" (decimal)
        if (cleaned.includes('.')) {
          const parts = cleaned.split('.');
          const lastPart = parts[parts.length - 1];
          // If last segment is exactly 3 digits and there are multiple parts, it's thousands separator
          if (parts.length > 1 && lastPart.length === 3 && parts.length > 2) {
            return parseFloat(cleaned.replace(/\./g, '')) || 0;
          }
        }
        return parseFloat(cleaned) || 0;
      };
      const totalAmount = parseEuropeanNumber(totalStr);
      
      // Parse date - try multiple formats
      let orderDate: string | null = null;
      if (orderDateStr) {
        // Try DD/MM/YYYY, MM/DD/YYYY, YYYY-MM-DD, etc.
        const parts = orderDateStr.split(/[\/\-\.]/);
        if (parts.length === 3) {
          const [a, b, c] = parts.map(Number);
          if (c > 100) {
            // DD/MM/YYYY or MM/DD/YYYY
            orderDate = new Date(c, b - 1, a).toISOString();
          } else if (a > 100) {
            // YYYY-MM-DD
            orderDate = new Date(a, b - 1, c).toISOString();
          }
        }
        if (!orderDate) {
          const d = new Date(orderDateStr);
          if (!isNaN(d.getTime())) orderDate = d.toISOString();
        }
      }
      if (!orderDate) continue; // Skip rows without valid date

      // Parse quantity
      const qty = parseInt(get(iQty)) || 1;
      const unitPrice = parseFloat(get(iPrice).replace(/[^\d.,-]/g, '').replace(',', '.')) || totalAmount;

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
        products: [{
          id: `gsheets-item-${i}`,
          name: productName || 'Prodotto B2B',
          sku: code || `GS-SKU-${i}`,
          category,
          quantity: qty,
          unitPrice,
          totalPrice: totalAmount,
        }],
        totalAmount,
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
