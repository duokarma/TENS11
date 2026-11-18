import { fetchInvoicesForPeriod } from '../src/lib/gstReportService';

async function investigate() {
  const rawVisits = await fetchInvoicesForPeriod({ month: '2026-11' });
  console.log(`Analyzing ${rawVisits.length} visits...`);

  // Let's inspect the 236 invoices in the old way
  let old5Taxable = 0;
  let old18Taxable = 0;
  let oldCgst = 0;
  let oldSgst = 0;

  let grandTotalSum = 0;

  const discrepancies: any[] = [];

  for (const v of rawVisits) {
    const gt = Number(v.grand_total || 0);
    grandTotalSum += gt;
    const discount = Number(v.discount_amount || 0);

    const services = v.visit_services || [];
    const products = v.visit_products || [];

    const rawItems: { name: string; rate: number; price: number; type: string }[] = [];
    services.forEach((s: any) => rawItems.push({ name: s.service_name, rate: 5, price: Number(s.price || 0), type: 'service' }));
    products.forEach((p: any) => rawItems.push({ name: p.product_name, rate: 18, price: Number(p.price || 0) * Number(p.quantity || 1), type: 'product' }));

    if (rawItems.length === 0) {
      rawItems.push({ name: 'Default Salon Service', rate: 5, price: gt, type: 'service' });
    }

    const rawSum = rawItems.reduce((a, b) => a + b.price, 0);

    // Old logic:
    let vOldTaxable5 = 0;
    let vOldTaxable18 = 0;
    let vOldCgst = 0;
    let vOldSgst = 0;
    let vOldLinesSum = 0;

    for (const it of rawItems) {
      const itDiscount = rawSum > 0 ? Math.round((discount * (it.price / rawSum)) * 100) / 100 : 0;
      const netGross = Math.max(0, it.price - itDiscount);
      const taxable = Math.round((netGross / (1 + it.rate / 100)) * 100) / 100;
      const gst = Math.round((netGross - taxable) * 100) / 100;
      const cgst = Math.round((gst / 2) * 100) / 100;
      const sgst = Math.round((gst - cgst) * 100) / 100;

      if (it.rate === 5) vOldTaxable5 += taxable;
      if (it.rate === 18) vOldTaxable18 += taxable;
      vOldCgst += cgst;
      vOldSgst += sgst;
      vOldLinesSum += (taxable + cgst + sgst);
    }

    old5Taxable += vOldTaxable5;
    old18Taxable += vOldTaxable18;
    oldCgst += vOldCgst;
    oldSgst += vOldSgst;

    if (Math.abs(vOldLinesSum - gt) > 0.05) {
      discrepancies.push({
        id: v.id,
        date: v.visit_date?.substring(0, 10),
        customer: v.customer?.name || 'Walk-in',
        grandTotal: gt,
        rawItemsSum: rawSum,
        discount,
        vOldLinesSum,
        diff: gt - vOldLinesSum,
        services: services.map((s: any) => `${s.service_name} (₹${s.price})`),
        products: products.map((p: any) => `${p.product_name || 'Product'} (₹${p.price} x ${p.quantity})`)
      });
    }
  }

  console.log(`\nOLD LOGIC RESULTS ACROSS ALL 236 INVOICES:`);
  console.log(`  5% Taxable: ₹${old5Taxable.toFixed(2)}`);
  console.log(`  18% Taxable: ₹${old18Taxable.toFixed(2)}`);
  console.log(`  Total Taxable: ₹${(old5Taxable + old18Taxable).toFixed(2)}`);
  console.log(`  CGST: ₹${oldCgst.toFixed(2)}`);
  console.log(`  SGST: ₹${oldSgst.toFixed(2)}`);
  console.log(`  Total GST: ₹${(oldCgst + oldSgst).toFixed(2)}`);
  console.log(`  Grand Total Sum: ₹${grandTotalSum.toFixed(2)}`);
  console.log(`  Lines Sum (Taxable + GST): ₹${(old5Taxable + old18Taxable + oldCgst + oldSgst).toFixed(2)}`);
  console.log(`  UNEXPLAINED VARIANCE IN OLD LOGIC: ₹${(grandTotalSum - (old5Taxable + old18Taxable + oldCgst + oldSgst)).toFixed(2)}`);

  console.log(`\nExact invoices responsible for the variance (${discrepancies.length} invoices):`);
  let sumDiff = 0;
  for (const d of discrepancies) {
    sumDiff += d.diff;
    console.log(`- Visit ID: ${d.id} | Date: ${d.date} | Customer: ${d.customer}`);
    console.log(`  Grand Total: ₹${d.grandTotal} | Line Items Sum: ₹${d.rawItemsSum} | Diff: ₹${d.diff.toFixed(2)}`);
    console.log(`  Services: ${d.services.join(', ') || 'None'}`);
    console.log(`  Products: ${d.products.join(', ') || 'None'}`);
  }
  console.log(`\nTotal sum of diffs across these ${discrepancies.length} invoices: ₹${sumDiff.toFixed(2)}`);
}

investigate();
