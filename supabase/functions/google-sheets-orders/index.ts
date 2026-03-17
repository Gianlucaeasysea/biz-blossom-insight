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

    // Fetch all rows from the first sheet
    const range = 'A1:AG5000'; // Cover all columns up to Collection (col AG)
    const sheetsUrl = `https://sheets.googleapis.com/v4/spreadsheets/${SPREADSHEET_ID}/values/${encodeURIComponent(range)}?key=${apiKey}`;

    console.log('Fetching Google Sheets data...');
    const response = await fetch(sheetsUrl);

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`Google Sheets API error: ${response.status} - ${errorText}`);
      throw new Error(`Google Sheets API error: ${response.status} - ${errorText}`);
    }

    const data = await response.json();
    const rows: string[][] = data.values || [];

    if (rows.length < 2) {
      return new Response(
        JSON.stringify({ success: true, orders: [], count: 0 }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
      );
    }

    // Header row (row 0)
    const headers = rows[0].map((h: string) => h.trim().toLowerCase());
    
    // Map column indices
    const colIdx = (name: string) => headers.findIndex((h: string) => h.includes(name));
    
    const iOrderType = colIdx('type order');
    const iType = colIdx('type');  
    const iBusiness = colIdx('business');
    const iCode = colIdx('code');
    const iStatusOrder = colIdx('status order');
    const iStatusPayment = colIdx('status pay');
    const iTotFatt = colIdx('tot');
    const iQty = colIdx('q.ty');
    const iProduct = colIdx('product');
    const iOrderDate = colIdx('order date');
    const iPrice = colIdx('price');
    const iSender = colIdx('sender');
    const iOwner = colIdx('owner');
    const iCountry = colIdx('country');
    const iNomeProdotto = colIdx('nome prodotto ok');
    const iCollection = colIdx('collection');

    console.log(`Found ${rows.length - 1} data rows. Header indices: business=${iBusiness}, totFatt=${iTotFatt}, orderDate=${iOrderDate}, product=${iProduct}`);

    // Transform rows to orders
    const orders = [];
    for (let i = 1; i < rows.length; i++) {
      const row = rows[i];
      if (!row || row.length < 5) continue;

      const get = (idx: number) => (idx >= 0 && idx < row.length) ? (row[idx] || '').trim() : '';
      
      const business = get(iBusiness);
      const totalStr = get(iTotFatt);
      const orderDateStr = get(iOrderDate);
      const productName = get(iNomeProdotto) || get(iProduct);
      const code = get(iCode);
      
      // Skip rows without essential data
      if (!business && !totalStr && !orderDateStr) continue;

      // Parse total amount - handle European number format (comma as decimal)
      const totalAmount = parseFloat(totalStr.replace(/[^\d.,-]/g, '').replace(',', '.')) || 0;
      
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
