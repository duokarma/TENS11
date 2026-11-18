import { supabase } from '../src/lib/supabase';

async function checkAllInvoices() {
  const { data: visits, error } = await supabase
    .from('customer_visits')
    .select('*, customer:customer_id(*), visit_services(*), visit_products(*)')
    .gte('visit_date', '2026-11-01T00:00:00')
    .lt('visit_date', '2026-12-01T00:00:00')
    .eq('is_deleted', false);

  if (error) {
    console.error(error);
    return;
  }

  const activeVisits = visits.filter(v => !v.customer || !v.customer.is_deleted);
  console.log(`Total active visits in Nov 2026: ${activeVisits.length}`);

  const unexplained: any[] = [];
  const withDiscount: any[] = [];

  for (const v of activeVisits) {
    const svcs = v.visit_services || [];
    const prods = v.visit_products || [];
    const rawSum = svcs.reduce((a: number, b: any) => a + Number(b.price || 0), 0) +
                   prods.reduce((a: number, b: any) => a + (Number(b.price || 0) * Number(b.quantity || 1)), 0);

    const gt = Number(v.grand_total || 0);
    const disc = Number(v.discount_amount || 0);
    const orig = Number(v.original_total || 0);

    if (disc > 0) {
      withDiscount.push({ id: v.id, rawSum, orig, disc, gt, diff: (rawSum - disc) - gt });
    }

    if (Math.abs(rawSum - disc - gt) > 0.01) {
      unexplained.push({
        id: v.id,
        customer: v.customer?.name,
        date: v.visit_date,
        rawSum,
        orig,
        disc,
        gt,
        diff: gt - (rawSum - disc),
        svcsCount: svcs.length,
        prodsCount: prods.length,
        services: svcs.map((s: any) => `${s.service_name}: ${s.price}`),
        products: prods.map((p: any) => `${p.product_name}: ${p.price} x ${p.quantity}`)
      });
    }
  }

  console.log(`Visits with discount: ${withDiscount.length}`);
  console.log(`Visits where (rawSum - discount) !== grand_total: ${unexplained.length}`);
  for (const u of unexplained) {
    console.log(`- ${u.customer} (${u.date?.substring(0, 10)}) ID: ${u.id}`);
    console.log(`  rawSum: ${u.rawSum}, orig: ${u.orig}, disc: ${u.disc}, grand_total: ${u.gt}, DIFF: ${u.diff}`);
    console.log(`  Services: ${u.services.join(', ')}`);
    console.log(`  Products: ${u.products.join(', ') || 'None'}`);
  }
}

checkAllInvoices();
