import { fetchInvoicesForPeriod } from '../src/lib/gstReportService';

async function listNovVisits() {
  const visits = await fetchInvoicesForPeriod({ month: '2026-11' });
  console.log(`Visits fetched: ${visits.length}`);
  const outOfRange = visits.filter(v => {
    const d = new Date(v.visit_date);
    return d.getFullYear() !== 2026 || d.getMonth() !== 10; // Month is 0-indexed (10 is Nov)
  });
  console.log(`Visits with date outside Nov 2026: ${outOfRange.length}`);
  outOfRange.forEach(v => console.log('Out of range:', v.id, v.visit_date, v.customer?.name, v.grand_total));
}

listNovVisits();
