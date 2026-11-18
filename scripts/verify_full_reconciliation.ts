import { fetchInvoicesForPeriod, processInvoices, calculateReportSummary } from '../src/lib/gstReportService';

async function testReconciliation() {
  console.log('=== RUNNING FULL RECONCILIATION FOR NOVEMBER 2026 ===');

  try {
    const rawVisits = await fetchInvoicesForPeriod({ month: '2026-11' });
    const invoices = processInvoices(rawVisits);
    const summary = calculateReportSummary(invoices);

    console.log('\n--- 1. INVOICE COUNTS & CLASSIFICATION ---');
    console.log(`Total Invoices: ${summary.invoiceCount}`);
    console.log(`B2B Invoices (Table 4): ${summary.b2bCount}`);
    console.log(`B2C Invoices (Table 7): ${summary.b2cCount}`);
    console.log(`Total Line Items Count: ${summary.totalItemsCount}`);

    console.log('\n--- 2. FINANCIAL & TAX RECONCILIATION ---');
    console.log(`Total Sales Value (Gross): ₹${summary.totalSalesValue.toLocaleString('en-IN', { minimumFractionDigits: 2 })}`);
    console.log(`Taxable Sales Base: ₹${summary.taxableSales.toLocaleString('en-IN', { minimumFractionDigits: 2 })}`);
    console.log(`Central Tax (CGST): ₹${summary.cgstTotal.toLocaleString('en-IN', { minimumFractionDigits: 2 })}`);
    console.log(`State / UT Tax (SGST): ₹${summary.sgstTotal.toLocaleString('en-IN', { minimumFractionDigits: 2 })}`);
    console.log(`Integrated Tax (IGST): ₹${summary.igstTotal.toLocaleString('en-IN', { minimumFractionDigits: 2 })}`);
    console.log(`Total GST (CGST+SGST+IGST): ₹${summary.totalGst.toLocaleString('en-IN', { minimumFractionDigits: 2 })}`);

    const mathCheck = summary.taxableSales + summary.totalGst;
    const diff = Math.abs(summary.totalSalesValue - mathCheck);
    console.log(`Math Check (Taxable + GST): ₹${mathCheck.toLocaleString('en-IN', { minimumFractionDigits: 2 })}`);
    console.log(`Difference (Rounding variance): ₹${diff.toFixed(2)}`);

    console.log('\n--- 3. RATE BUCKETS ---');
    for (const [rate, b] of Object.entries(summary.rateBuckets)) {
      console.log(`Rate ${rate}% -> Taxable: ₹${b.taxable.toFixed(2)}, CGST: ₹${b.cgst.toFixed(2)}, SGST: ₹${b.sgst.toFixed(2)}, Gross: ₹${b.total.toFixed(2)}`);
    }

    console.log('\n--- 4. HSN / SAC BREAKDOWN SUMMARY ---');
    let hsnTotalQty = 0;
    let hsnTotalVal = 0;
    let hsnTotalTaxable = 0;
    let hsnTotalCgst = 0;
    let hsnTotalSgst = 0;

    for (const h of summary.hsnSummary) {
      hsnTotalQty += h.quantity;
      hsnTotalVal += h.totalValue;
      hsnTotalTaxable += h.taxableValue;
      hsnTotalCgst += h.cgst;
      hsnTotalSgst += h.sgst;
      console.log(`  HSN/SAC ${h.code} [${h.type}] ${h.desc} (Rate: ${h.gstRate}%) -> Qty: ${h.quantity}, Taxable: ₹${h.taxableValue.toFixed(2)}, CGST: ₹${h.cgst.toFixed(2)}, SGST: ₹${h.sgst.toFixed(2)}, Total: ₹${h.totalValue.toFixed(2)}`);
    }

    console.log('\n--- HSN RECONCILIATION AGAINST INVOICES ---');
    console.log(`HSN Total Taxable: ₹${hsnTotalTaxable.toFixed(2)} vs Invoices Taxable: ₹${summary.taxableSales.toFixed(2)} -> Match: ${Math.abs(hsnTotalTaxable - summary.taxableSales) < 0.05 ? 'PERFECT' : 'DIFF ' + (hsnTotalTaxable - summary.taxableSales)}`);
    console.log(`HSN Total CGST: ₹${hsnTotalCgst.toFixed(2)} vs Invoices CGST: ₹${summary.cgstTotal.toFixed(2)} -> Match: ${Math.abs(hsnTotalCgst - summary.cgstTotal) < 0.05 ? 'PERFECT' : 'DIFF ' + (hsnTotalCgst - summary.cgstTotal)}`);
    console.log(`HSN Total SGST: ₹${hsnTotalSgst.toFixed(2)} vs Invoices SGST: ₹${summary.sgstTotal.toFixed(2)} -> Match: ${Math.abs(hsnTotalSgst - summary.sgstTotal) < 0.05 ? 'PERFECT' : 'DIFF ' + (hsnTotalSgst - summary.sgstTotal)}`);
    console.log(`HSN Total Gross: ₹${hsnTotalVal.toFixed(2)} vs Invoices Gross: ₹${summary.totalSalesValue.toFixed(2)} -> Match: ${Math.abs(hsnTotalVal - summary.totalSalesValue) < 0.05 ? 'PERFECT' : 'DIFF ' + (hsnTotalVal - summary.totalSalesValue)}`);

    console.log('\n--- 5. PAYMENT BREAKDOWN RECONCILIATION ---');
    let paymentSum = 0;
    for (const [mode, amt] of Object.entries(summary.paymentBreakdown)) {
      paymentSum += amt;
      console.log(`  ${mode}: ₹${amt.toFixed(2)}`);
    }
    console.log(`Payment Sum: ₹${paymentSum.toFixed(2)} vs Total Sales: ₹${summary.totalSalesValue.toFixed(2)} -> Match: ${paymentSum === summary.totalSalesValue ? 'PERFECT' : 'DIFF ' + (paymentSum - summary.totalSalesValue)}`);

  } catch (err) {
    console.error('Error during reconciliation test:', err);
  }
}

testReconciliation();
