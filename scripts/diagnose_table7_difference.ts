import { fetchInvoicesForPeriod } from '../src/lib/gstReportService';

async function diagnose() {
  console.log('=== DIAGNOSING TABLE 7 DIFFERENCE (₹3,357.05 TAXABLE / ₹167.97 GST) ===');

  const rawVisits = await fetchInvoicesForPeriod({ month: '2026-11' });
  console.log(`Total active visits fetched: ${rawVisits.length}`);

  let totalGrandTotal = 0;
  let totalRawItemSum = 0;

  // Let's analyze both calculations:
  // METHOD A (OLD / UNSCALED): Line items used raw price without scaling to match grandTotal
  // METHOD B (PROPORTIONAL SCALED): Line items scaled so line sum equals grandTotal

  interface DiffRecord {
    visitId: string;
    visitDate: string;
    grandTotal: number;
    rawItemSum: number;
    diffGross: number;
    unscaledTaxable: number;
    unscaledGst: number;
    scaledTaxable: number;
    scaledGst: number;
    diffTaxable: number;
    diffGst: number;
    servicesCount: number;
    productsCount: number;
  }

  const discrepancies: DiffRecord[] = [];

  let sumUnscaledTaxable = 0;
  let sumUnscaledGst = 0;
  let sumUnscaledCgst = 0;
  let sumUnscaledSgst = 0;

  let sumScaledTaxable = 0;
  let sumScaledGst = 0;
  let sumScaledCgst = 0;
  let sumScaledSgst = 0;

  for (const v of rawVisits) {
    const gt = Number(v.grand_total || 0);
    totalGrandTotal += gt;

    const services = v.visit_services || [];
    const products = v.visit_products || [];

    const rawItems: { rate: number; price: number; type: string }[] = [];
    services.forEach((s: any) => rawItems.push({ rate: 5, price: Number(s.price || 0), type: 'service' }));
    products.forEach((p: any) => rawItems.push({ rate: 18, price: Number(p.price || 0) * Number(p.quantity || 1), type: 'product' }));

    if (rawItems.length === 0) {
      rawItems.push({ rate: 5, price: gt, type: 'service' });
    }

    const itemSum = rawItems.reduce((acc, it) => acc + it.price, 0);
    totalRawItemSum += itemSum;

    // Calc A: Unscaled
    let vUnscaledTaxable = 0;
    let vUnscaledCgst = 0;
    let vUnscaledSgst = 0;
    for (const it of rawItems) {
      const taxable = Math.round((it.price / (1 + it.rate / 100)) * 100) / 100;
      const totalGst = Math.round((it.price - taxable) * 100) / 100;
      const cgst = Math.round((totalGst / 2) * 100) / 100;
      const sgst = Math.round((totalGst - cgst) * 100) / 100;
      vUnscaledTaxable += taxable;
      vUnscaledCgst += cgst;
      vUnscaledSgst += sgst;
    }

    // Calc B: Scaled to match gt
    const scale = itemSum > 0 ? gt / itemSum : 1;
    let vScaledTaxable = 0;
    let vScaledCgst = 0;
    let vScaledSgst = 0;
    for (const it of rawItems) {
      const lineGross = Math.round(it.price * scale * 100) / 100;
      const taxable = Math.round((lineGross / (1 + it.rate / 100)) * 100) / 100;
      const totalGst = Math.round((lineGross - taxable) * 100) / 100;
      const cgst = Math.round((totalGst / 2) * 100) / 100;
      const sgst = Math.round((totalGst - cgst) * 100) / 100;
      vScaledTaxable += taxable;
      vScaledCgst += cgst;
      vScaledSgst += sgst;
    }

    sumUnscaledTaxable += vUnscaledTaxable;
    sumUnscaledCgst += vUnscaledCgst;
    sumUnscaledSgst += vUnscaledSgst;
    sumUnscaledGst += (vUnscaledCgst + vUnscaledSgst);

    sumScaledTaxable += vScaledTaxable;
    sumScaledCgst += vScaledCgst;
    sumScaledSgst += vScaledSgst;
    sumScaledGst += (vScaledCgst + vScaledSgst);

    const diffTax = Math.round((vScaledTaxable - vUnscaledTaxable) * 100) / 100;
    const diffGst = Math.round(((vScaledCgst + vScaledSgst) - (vUnscaledCgst + vUnscaledSgst)) * 100) / 100;

    if (Math.abs(diffTax) > 0.01 || Math.abs(itemSum - gt) > 0.01) {
      discrepancies.push({
        visitId: v.id,
        visitDate: v.visit_date,
        grandTotal: gt,
        rawItemSum: itemSum,
        diffGross: gt - itemSum,
        unscaledTaxable: vUnscaledTaxable,
        unscaledGst: vUnscaledCgst + vUnscaledSgst,
        scaledTaxable: vScaledTaxable,
        scaledGst: vScaledCgst + vScaledSgst,
        diffTaxable: diffTax,
        diffGst: diffGst,
        servicesCount: services.length,
        productsCount: products.length
      });
    }
  }

  console.log('\n--- OVERALL COMPARISON ---');
  console.log(`Total Invoices: ${rawVisits.length}`);
  console.log(`Total Grand Total (Gross): ₹${totalGrandTotal.toFixed(2)}`);
  console.log(`Total Raw Item Sum: ₹${totalRawItemSum.toFixed(2)}`);
  console.log(`Gross Difference: ₹${(totalGrandTotal - totalRawItemSum).toFixed(2)}`);

  console.log('\nUNSCALED (OLD TABLE 7 VALUES):');
  console.log(`  Taxable: ₹${sumUnscaledTaxable.toFixed(2)}`);
  console.log(`  CGST: ₹${sumUnscaledCgst.toFixed(2)}`);
  console.log(`  SGST: ₹${sumUnscaledSgst.toFixed(2)}`);
  console.log(`  Total GST: ₹${sumUnscaledGst.toFixed(2)}`);
  console.log(`  Taxable + GST: ₹${(sumUnscaledTaxable + sumUnscaledGst).toFixed(2)}`);

  console.log('\nSCALED (RECONCILED VALUES):');
  console.log(`  Taxable: ₹${sumScaledTaxable.toFixed(2)}`);
  console.log(`  CGST: ₹${sumScaledCgst.toFixed(2)}`);
  console.log(`  SGST: ₹${sumScaledSgst.toFixed(2)}`);
  console.log(`  Total GST: ₹${sumScaledGst.toFixed(2)}`);
  console.log(`  Taxable + GST: ₹${(sumScaledTaxable + sumScaledGst).toFixed(2)}`);

  console.log('\nDIFFERENCE (SCALED - UNSCALED):');
  console.log(`  Taxable Diff: ₹${(sumScaledTaxable - sumUnscaledTaxable).toFixed(2)}`);
  console.log(`  GST Diff: ₹${(sumScaledGst - sumUnscaledGst).toFixed(2)}`);

  console.log(`\nInvoices causing the difference (${discrepancies.length} invoices):`);
  for (const d of discrepancies) {
    console.log(`  Visit ID: ${d.visitId} | Date: ${d.visitDate.substring(0, 10)} | Bill: ₹${d.grandTotal} | ItemsSum: ₹${d.rawItemSum} | GrossDiff: ₹${d.diffGross} | TaxableDiff: ₹${d.diffTaxable} | GSTDiff: ₹${d.diffGst} | Svcs: ${d.servicesCount}, Prods: ${d.productsCount}`);
  }
}

diagnose();
