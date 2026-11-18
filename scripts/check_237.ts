import { fetchInvoicesForPeriod } from '../src/lib/gstReportService';

async function check237() {
  const visits = await fetchInvoicesForPeriod({ month: '2026-11' });
  console.log(`Visits count: ${visits.length}`);
  // Sort by created_at or visit_date
  visits.sort((a, b) => new Date(b.created_at || b.visit_date).getTime() - new Date(a.created_at || a.visit_date).getTime());
  console.log('Most recent visits:');
  for (let i = 0; i < 5; i++) {
    const v = visits[i];
    console.log(`- ${v.id} | Visit: ${v.visit_date} | Created: ${v.created_at} | Customer: ${v.customer?.name} | Total: ${v.grand_total}`);
  }
}

check237();
