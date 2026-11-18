import { fetchInvoicesForPeriod, processInvoices, calculateReportSummary } from '../src/lib/gstReportService';

async function verifyJasmin() {
  const raw = await fetchInvoicesForPeriod({ month: '2026-11' });
  const invoices = processInvoices(raw);
  const jasmin = invoices.find(i => i.customerName.includes('JASMIN AMIN'));
  console.log('Customer:', jasmin?.customerName);
  console.log('Grand Total:', jasmin?.grandTotal);
  console.log('Taxable Amount:', jasmin?.taxableAmount);
  console.log('CGST:', jasmin?.cgst, 'SGST:', jasmin?.sgst, 'Total GST:', jasmin?.totalGst);
  console.log('Items:');
  jasmin?.items.forEach(it => {
    console.log(`- ${it.name} | Type: ${it.type} | Rate: ₹${it.rate} | Taxable: ₹${it.taxableAmount} | GST Rate: ${it.gstRate}% | CGST: ₹${it.cgst} | SGST: ₹${it.sgst} | Total: ₹${it.total}`);
  });

  const shraddha = invoices.find(i => i.customerName.includes('SHRADDHA SOLANKI'));
  console.log('\nCustomer:', shraddha?.customerName);
  console.log('Grand Total:', shraddha?.grandTotal);
  console.log('Taxable Amount:', shraddha?.taxableAmount);
  console.log('CGST:', shraddha?.cgst, 'SGST:', shraddha?.sgst, 'Total GST:', shraddha?.totalGst);
  console.log('Items:');
  shraddha?.items.forEach(it => {
    console.log(`- ${it.name} | Type: ${it.type} | Rate: ₹${it.rate} | Taxable: ₹${it.taxableAmount} | GST Rate: ${it.gstRate}% | CGST: ₹${it.cgst} | SGST: ₹${it.sgst} | Total: ₹${it.total}`);
  });
}

verifyJasmin();
