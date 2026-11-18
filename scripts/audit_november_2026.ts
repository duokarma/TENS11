import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://fqdrgsbljplhfgjzvaoq.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZxZHJnc2JsanBsaGZnanp2YW9xIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4MTg4MDQzNiwiZXhwIjoyMDk3NDU2NDM2fQ.QhX0v4Qc7AO2IzNwarBcbW3HjFELrL45ldB2WcFaK_Q';

const supabase = createClient(supabaseUrl, supabaseKey);

async function runAudit() {
  console.log('=== AUDITING NOVEMBER 2026 DATABASE RECORDS ===');

  // 1. Fetch visits in Nov 2026
  const { data: visits, error: vErr } = await supabase
    .from('customer_visits')
    .select(`
      id,
      visit_date,
      grand_total,
      service_total,
      product_total,
      payment_method,
      is_deleted,
      customer_id,
      customers (
        id,
        name,
        phone
      )
    `)
    .gte('visit_date', '2026-11-01T00:00:00')
    .lte('visit_date', '2026-11-30T23:59:59.999')
    .order('visit_date', { ascending: true });

  if (vErr) {
    console.error('Error fetching visits:', vErr);
    return;
  }

  const activeVisits = visits.filter(v => !v.is_deleted);
  const deletedVisits = visits.filter(v => v.is_deleted);

  console.log(`Total Visits: ${visits.length}`);
  console.log(`Active Visits (Eligible Invoices): ${activeVisits.length}`);
  console.log(`Cancelled / Deleted Visits: ${deletedVisits.length}`);

  // Check customer fields (e.g. check customers table structure to see if gstin exists)
  const { data: customerSample, error: cErr } = await supabase
    .from('customers')
    .select('*')
    .limit(2);
  console.log('Customer table columns:', customerSample ? Object.keys(customerSample[0] || {}) : cErr);

  // 2. Fetch all visit services and visit products
  const visitIds = activeVisits.map(v => v.id);
  const { data: services, error: sErr } = await supabase
    .from('visit_services')
    .select(`
      id,
      visit_id,
      service_id,
      service_name,
      price
    `)
    .in('visit_id', visitIds);

  const { data: products, error: pErr } = await supabase
    .from('visit_products')
    .select(`
      id,
      visit_id,
      product_id,
      quantity,
      price,
      products (
        id,
        name
      )
    `)
    .in('visit_id', visitIds);

  if (sErr) console.error('Error fetching services:', sErr);
  if (pErr) console.error('Error fetching products:', pErr);

  console.log(`Total visit services fetched: ${services?.length}`);
  console.log(`Total visit products fetched: ${products?.length}`);

  // 3. Inspect items for Nil-rated, Exempt, Non-GST, or 0%
  let zeroPriceServices = 0;
  let zeroPriceProducts = 0;

  let totalServiceValue = 0;
  let totalProductValue = 0;

  const allItemNames = new Map<string, { count: number, total: number, type: string }>();

  for (const s of (services || [])) {
    const name = s.service_name || 'Hair & Beauty Treatment';
    const finalPrice = Number(s.price || 0);
    totalServiceValue += finalPrice;

    const existing = allItemNames.get(name) || { count: 0, total: 0, type: 'service' };
    existing.count += 1;
    existing.total += finalPrice;
    allItemNames.set(name, existing);

    if (finalPrice === 0) zeroPriceServices++;
  }

  for (const p of (products || [])) {
    const name = p.products?.name || 'Cosmetic / Hair Product';
    const finalPrice = Number(p.price || 0);
    const qty = Number(p.quantity || 1);
    const lineVal = finalPrice * qty;
    totalProductValue += lineVal;

    const existing = allItemNames.get(name) || { count: 0, total: 0, type: 'product' };
    existing.count += qty;
    existing.total += lineVal;
    allItemNames.set(name, existing);

    if (finalPrice === 0) zeroPriceProducts++;
  }

  console.log('\n--- FINANCIAL TOTALS FROM VISITS ---');
  const sumGrandTotal = activeVisits.reduce((acc, v) => acc + Number(v.grand_total || 0), 0);
  const sumServiceTotal = activeVisits.reduce((acc, v) => acc + Number(v.service_total || 0), 0);
  const sumProductTotal = activeVisits.reduce((acc, v) => acc + Number(v.product_total || 0), 0);

  console.log(`Sum of visit grand_total: ₹${sumGrandTotal.toFixed(2)}`);
  console.log(`Sum of visit service_total: ₹${sumServiceTotal.toFixed(2)}`);
  console.log(`Sum of visit product_total: ₹${sumProductTotal.toFixed(2)}`);
  const totalItemsValue = totalServiceValue + totalProductValue;
  console.log(`Sum of line items value: ₹${totalItemsValue.toFixed(2)}`);
  console.log(`Line items services: ₹${totalServiceValue.toFixed(2)}`);
  console.log(`Line items products: ₹${totalProductValue.toFixed(2)}`);

  console.log(`Zero price item lines: services=${zeroPriceServices}, products=${zeroPriceProducts}`);

  // List distinct item names to check for any exempt or non-gst services/goods
  console.log(`\nDistinct items sold (${allItemNames.size}):`);
  for (const [name, info] of Array.from(allItemNames.entries()).slice(0, 20)) {
    console.log(`  [${info.type}] ${name} -> Qty: ${info.count}, Val: ₹${info.total.toFixed(2)}`);
  }

  // 4. Check for any invoices > 2.5 Lakh (Table 5: B2C Large)
  const b2cLarge = activeVisits.filter(v => Number(v.grand_total) > 250000);
  console.log(`\nInvoices > ₹2,50,000 (Table 5 B2C Large): ${b2cLarge.length}`);

  // 5. Check for any credit / debit notes or advance adjustments table
  const { data: tables, error: tErr } = await supabase.rpc('get_tables').catch(() => ({ data: null, error: null }));
}

runAudit();
