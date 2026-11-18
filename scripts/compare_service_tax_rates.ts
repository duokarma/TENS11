import { fetchInvoicesForPeriod, processInvoices, calculateReportSummary } from '../src/lib/gstReportService';

async function compareRates() {
  const rawVisits = await fetchInvoicesForPeriod({ month: '2026-11' });
  console.log(`Analyzing ${rawVisits.length} visits for Rate Sensitivity Analysis...`);

  // Scenario 1: Services @ 5% (Current configuration: 5% without ITC)
  const invoices5 = processInvoices(rawVisits, 5);
  const summary5 = calculateReportSummary(invoices5);

  // Scenario 2: Services @ 18% (Standard Heading 9997 with ITC)
  const invoices18 = processInvoices(rawVisits, 18);
  const summary18 = calculateReportSummary(invoices18);

  console.log('\n===============================================================');
  console.log('SCENARIO 1: Salon Services @ 5% (Current System)');
  console.log('===============================================================');
  console.log(`Total Invoices: ${summary5.invoiceCount}`);
  console.log(`Gross Sales: ₹${summary5.totalSalesValue.toFixed(2)}`);
  console.log(`5% Taxable Value: ₹${summary5.rateBuckets[5]?.taxable.toFixed(2) || '0.00'}`);
  console.log(`18% Taxable Value: ₹${summary5.rateBuckets[18]?.taxable.toFixed(2) || '0.00'}`);
  console.log(`Total Taxable Sales: ₹${summary5.taxableSales.toFixed(2)}`);
  console.log(`CGST Total: ₹${summary5.cgstTotal.toFixed(2)}`);
  console.log(`SGST Total: ₹${summary5.sgstTotal.toFixed(2)}`);
  console.log(`Total GST Output Liability: ₹${summary5.totalGst.toFixed(2)}`);

  console.log('\n===============================================================');
  console.log('SCENARIO 2: Salon Services @ 18% (Standard CBIC Heading 9997)');
  console.log('===============================================================');
  console.log(`Total Invoices: ${summary18.invoiceCount}`);
  console.log(`Gross Sales: ₹${summary18.totalSalesValue.toFixed(2)}`);
  console.log(`5% Taxable Value: ₹${summary18.rateBuckets[5]?.taxable.toFixed(2) || '0.00'}`);
  console.log(`18% Taxable Value: ₹${summary18.rateBuckets[18]?.taxable.toFixed(2) || '0.00'}`);
  console.log(`Total Taxable Sales: ₹${summary18.taxableSales.toFixed(2)}`);
  console.log(`CGST Total: ₹${summary18.cgstTotal.toFixed(2)}`);
  console.log(`SGST Total: ₹${summary18.sgstTotal.toFixed(2)}`);
  console.log(`Total GST Output Liability: ₹${summary18.totalGst.toFixed(2)}`);

  console.log('\n===============================================================');
  console.log('VARIANCE & TAX EXPOSURE ANALYSIS (18% vs 5%)');
  console.log('===============================================================');
  const taxDiff = summary18.totalGst - summary5.totalGst;
  const taxableDiff = summary18.taxableSales - summary5.taxableSales;
  console.log(`Taxable Value Impact (Tax-inclusive backward calc): ₹${taxableDiff.toFixed(2)}`);
  console.log(`GST Output Liability Difference (18% vs 5%): +₹${taxDiff.toFixed(2)}`);
  console.log(`  CGST Exposure: +₹${(summary18.cgstTotal - summary5.cgstTotal).toFixed(2)}`);
  console.log(`  SGST Exposure: +₹${(summary18.sgstTotal - summary5.sgstTotal).toFixed(2)}`);

  // Service Invoices breakdown
  let pureServiceInvoices = 0;
  let mixedInvoices = 0;
  let pureProductInvoices = 0;

  for (const inv of invoices5) {
    const hasService = inv.items.some(i => i.type === 'service');
    const hasProduct = inv.items.some(i => i.type === 'product');
    if (hasService && !hasProduct) pureServiceInvoices++;
    else if (hasService && hasProduct) mixedInvoices++;
    else if (!hasService && hasProduct) pureProductInvoices++;
  }

  console.log(`\nInvoice Mix Breakdown:`);
  console.log(`  Pure Service Invoices (100% Services): ${pureServiceInvoices}`);
  console.log(`  Mixed Invoices (Services + Retail Products): ${mixedInvoices}`);
  console.log(`  Pure Product Invoices (100% Retail Products): ${pureProductInvoices}`);
}

compareRates();
