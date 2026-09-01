/**
 * aiInsights.ts — AI computation engine for TEN11 Salon
 * All logic runs entirely on already-fetched Supabase data.
 * Zero external API calls. Zero monthly cost.
 */

import { differenceInDays, startOfMonth, endOfMonth, subMonths, getDay, format } from 'date-fns';

// ─── Types ───────────────────────────────────────────────────────────────────

export type ChurnStatus = 'Active' | 'AtRisk' | 'Churned' | 'New';

export interface InsightCard {
  id: string;
  label: string;
  value: string;
  subtext: string;
  trend?: 'up' | 'down' | 'neutral';
  trendPct?: number;
  icon: 'revenue' | 'service' | 'day' | 'staff' | 'retention' | 'customers';
}

export interface ServiceRecommendation {
  serviceName: string;
  count: number;
  totalVisits: number;
  pct: number;
}

export interface StockForecast {
  productId: number;
  daysRemaining: number | null;
  avgDailyUsage: number;
  status: 'critical' | 'warning' | 'ok' | 'unknown';
}

// ─── Feature 3: AI Dashboard Insights ────────────────────────────────────────

export function computeInsights(
  visits: any[],
  expenses: any[],
  customers: any[]
): InsightCard[] {
  const now = new Date();
  const thisMonthStart = startOfMonth(now);
  const lastMonthStart = startOfMonth(subMonths(now, 1));
  const lastMonthEnd = endOfMonth(subMonths(now, 1));

  const thisMonthVisits = visits.filter(v => v.visit_date && new Date(v.visit_date) >= thisMonthStart);
  const lastMonthVisits = visits.filter(v => {
    if (!v.visit_date) return false;
    const d = new Date(v.visit_date);
    return d >= lastMonthStart && d <= lastMonthEnd;
  });

  // 1. Revenue trend
  const thisRevenue = thisMonthVisits.reduce((s, v) => s + (Number(v.grand_total) || 0), 0);
  const lastRevenue = lastMonthVisits.reduce((s, v) => s + (Number(v.grand_total) || 0), 0);
  const revPct = lastRevenue > 0 ? Math.round(((thisRevenue - lastRevenue) / lastRevenue) * 100) : 0;

  // 2. Top service this month
  const svcCount: Record<string, number> = {};
  thisMonthVisits.forEach(v => {
    (v.visit_services || []).forEach((vs: any) => {
      if (vs.service_name) {
        svcCount[vs.service_name] = (svcCount[vs.service_name] || 0) + 1;
      }
    });
  });
  const topSvc = Object.entries(svcCount).sort((a, b) => b[1] - a[1])[0];

  // 3. Busiest day of week (overall)
  const dayCount: Record<number, number> = { 0: 0, 1: 0, 2: 0, 3: 0, 4: 0, 5: 0, 6: 0 };
  visits.forEach(v => {
    if (v.visit_date) {
      const d = getDay(new Date(v.visit_date));
      dayCount[d] = (dayCount[d] || 0) + 1;
    }
  });
  const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  const busiestDayIdx = Object.entries(dayCount).sort((a, b) => b[1] - a[1])[0];
  const busiestDay = busiestDayIdx ? dayNames[Number(busiestDayIdx[0])] : 'N/A';

  // 4. Best staff by revenue this month
  const staffRevenue: Record<string, number> = {};
  thisMonthVisits.forEach(v => {
    const staffIds: any[] = Array.isArray(v.staff_ids) ? v.staff_ids : (v.staff_id ? [v.staff_id] : []);
    const share = staffIds.length > 0 ? (Number(v.grand_total) || 0) / staffIds.length : 0;
    staffIds.forEach((id: any) => {
      const key = String(id);
      staffRevenue[key] = (staffRevenue[key] || 0) + share;
    });
    // Also track by staff name if available via join
    if (v.staff?.name) {
      staffRevenue[v.staff.name] = (staffRevenue[v.staff.name] || 0) + (Number(v.grand_total) || 0);
    }
  });

  // 5. New vs returning customers this month
  const thisMonthCustomerIds = new Set(
    thisMonthVisits.map(v => v.customer_id).filter(Boolean)
  );
  const prevVisitedCustomers = new Set(
    visits
      .filter(v => v.visit_date && new Date(v.visit_date) < thisMonthStart && v.customer_id)
      .map(v => v.customer_id)
  );
  let returning = 0;
  thisMonthCustomerIds.forEach(id => {
    if (prevVisitedCustomers.has(id)) returning++;
  });
  const returningPct =
    thisMonthCustomerIds.size > 0
      ? Math.round((returning / thisMonthCustomerIds.size) * 100)
      : 0;

  const cards: InsightCard[] = [];

  cards.push({
    id: 'revenue-trend',
    label: 'Revenue This Month',
    value: `₹${thisRevenue.toLocaleString()}`,
    subtext:
      lastRevenue > 0
        ? `${revPct >= 0 ? '+' : ''}${revPct}% vs last month`
        : 'First month tracked',
    trend: revPct > 0 ? 'up' : revPct < 0 ? 'down' : 'neutral',
    trendPct: Math.abs(revPct),
    icon: 'revenue',
  });

  if (topSvc) {
    cards.push({
      id: 'top-service',
      label: 'Top Service',
      value: topSvc[0],
      subtext: `Performed ${topSvc[1]} time${topSvc[1] !== 1 ? 's' : ''} this month`,
      icon: 'service',
    });
  }

  cards.push({
    id: 'busiest-day',
    label: 'Busiest Day',
    value: busiestDay,
    subtext: `${busiestDayIdx ? busiestDayIdx[1] : 0} total visits on ${busiestDay}s`,
    icon: 'day',
  });

  cards.push({
    id: 'retention',
    label: 'Returning Customers',
    value: `${returningPct}%`,
    subtext: `${returning} of ${thisMonthCustomerIds.size} visitors this month are returning`,
    icon: 'retention',
  });

  cards.push({
    id: 'visits-month',
    label: 'Visits This Month',
    value: `${thisMonthVisits.length}`,
    subtext: `vs ${lastMonthVisits.length} last month`,
    trend: thisMonthVisits.length >= lastMonthVisits.length ? 'up' : 'down',
    icon: 'customers',
  });

  return cards;
}

// ─── Feature 4: Churn Detection ───────────────────────────────────────────────

export function computeChurnStatus(
  customerId: number,
  allVisits: any[]
): { status: ChurnStatus; lastVisitDate: Date | null; daysSince: number | null } {
  const customerVisits = allVisits
    .filter(v => v.customer_id === customerId && !v.is_deleted)
    .sort((a, b) => new Date(b.visit_date).getTime() - new Date(a.visit_date).getTime());

  if (customerVisits.length === 0) {
    return { status: 'New', lastVisitDate: null, daysSince: null };
  }

  const lastVisit = customerVisits[0];
  const lastVisitDate = new Date(lastVisit.visit_date);
  const daysSince = differenceInDays(new Date(), lastVisitDate);

  let status: ChurnStatus;
  if (daysSince <= 30) {
    status = 'Active';
  } else if (daysSince <= 60) {
    status = 'AtRisk';
  } else {
    status = 'Churned';
  }

  return { status, lastVisitDate, daysSince };
}

export function getChurnBadgeStyle(status: ChurnStatus): {
  bg: string;
  border: string;
  text: string;
  dot: string;
  label: string;
} {
  switch (status) {
    case 'Active':
      return {
        bg: 'rgba(52, 211, 153, 0.08)',
        border: 'rgba(52, 211, 153, 0.25)',
        text: '#34d399',
        dot: '#34d399',
        label: 'Active',
      };
    case 'AtRisk':
      return {
        bg: 'rgba(251, 191, 36, 0.08)',
        border: 'rgba(251, 191, 36, 0.25)',
        text: '#fbbf24',
        dot: '#fbbf24',
        label: 'At Risk',
      };
    case 'Churned':
      return {
        bg: 'rgba(207, 102, 121, 0.08)',
        border: 'rgba(207, 102, 121, 0.25)',
        text: '#CF6679',
        dot: '#CF6679',
        label: 'Churned',
      };
    case 'New':
    default:
      return { 
        bg: 'rgba(200, 157, 60, 0.08)', 
        border: 'rgba(200, 157, 60, 0.25)', 
        text: '#E6C27A', 
        dot: '#E6C27A', 
        label: 'New' 
      };
  }
}

// ─── Feature 5: Smart Inventory — Days of Stock ───────────────────────────────

export function computeDaysOfStock(
  product: any,
  visitProducts: any[]
): StockForecast {
  const productId = product.id;
  const currentStock = Number(product.current_stock) || 0;

  // Look at the last 90 days of usage
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - 90);

  const recentUsage = visitProducts.filter(vp => {
    if (Number(vp.product_id) !== productId) return false;
    if (!vp.visit?.visit_date) return false;
    return new Date(vp.visit.visit_date) >= cutoff;
  });

  if (recentUsage.length === 0) {
    return { productId, daysRemaining: null, avgDailyUsage: 0, status: 'unknown' };
  }

  const totalUsed = recentUsage.reduce((s, vp) => s + (Number(vp.quantity) || 1), 0);
  const avgDailyUsage = totalUsed / 90;

  if (avgDailyUsage <= 0) {
    return { productId, daysRemaining: null, avgDailyUsage: 0, status: 'unknown' };
  }

  const daysRemaining = Math.floor(currentStock / avgDailyUsage);

  let status: StockForecast['status'];
  if (daysRemaining < 7) {
    status = 'critical';
  } else if (daysRemaining < 14) {
    status = 'warning';
  } else {
    status = 'ok';
  }

  return { productId, daysRemaining, avgDailyUsage, status };
}

export function getDaysRemainingStyle(status: StockForecast['status']): {
  color: string;
  bg: string;
  border: string;
} {
  switch (status) {
    case 'critical':
      return { color: '#CF6679', bg: 'rgba(207,102,121,0.08)', border: 'rgba(207,102,121,0.2)' };
    case 'warning':
      return { color: '#fbbf24', bg: 'rgba(251,191,36,0.08)', border: 'rgba(251,191,36,0.2)' };
    case 'ok':
      return { color: '#34d399', bg: 'rgba(52,211,153,0.08)', border: 'rgba(52,211,153,0.2)' };
    default:
      return { color: '#6b7280', bg: 'rgba(107,114,128,0.08)', border: 'rgba(107,114,128,0.2)' };
  }
}

// ─── Feature 6: Service Recommender ──────────────────────────────────────────

export function getServiceRecommendations(
  customerId: number,
  allVisits: any[]
): ServiceRecommendation[] {
  const customerVisits = allVisits.filter(
    v => v.customer_id === customerId && !v.is_deleted
  );

  if (customerVisits.length < 2) return [];

  const totalVisits = customerVisits.length;
  const svcCount: Record<string, number> = {};

  customerVisits.forEach(v => {
    (v.visit_services || []).forEach((vs: any) => {
      if (vs.service_name) {
        svcCount[vs.service_name] = (svcCount[vs.service_name] || 0) + 1;
      }
    });
  });

  return Object.entries(svcCount)
    .map(([serviceName, count]) => ({
      serviceName,
      count,
      totalVisits,
      pct: Math.round((count / totalVisits) * 100),
    }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 3)
    .filter(r => r.pct >= 25); // only recommend if used 25%+ of the time
}

// ─── Feature 7: Ask AI — Natural Language Query Parser ───────────────────────

interface AIQueryContext {
  visits: any[];
  customers: any[];
  products: any[];
  expenses?: any[];
}

export function parseAIQuery(query: string, ctx: AIQueryContext): string {
  const q = query.toLowerCase().trim();
  const now = new Date();

  // ── Revenue queries ───────────────────────────────────────────────────────
  if (q.includes('revenue') || q.includes('income') || q.includes('earn')) {
    if (q.includes('today')) {
      const todayVisits = ctx.visits.filter(
        v => v.visit_date && new Date(v.visit_date).toDateString() === now.toDateString()
      );
      const rev = todayVisits.reduce((s, v) => s + (Number(v.grand_total) || 0), 0);
      return `Today's revenue is **₹${rev.toLocaleString()}** from ${todayVisits.length} visit${todayVisits.length !== 1 ? 's' : ''}.`;
    }
    if (q.includes('week')) {
      const weekAgo = new Date(); weekAgo.setDate(weekAgo.getDate() - 7);
      const weekVisits = ctx.visits.filter(v => v.visit_date && new Date(v.visit_date) >= weekAgo);
      const rev = weekVisits.reduce((s, v) => s + (Number(v.grand_total) || 0), 0);
      return `Revenue in the last 7 days: **₹${rev.toLocaleString()}** from ${weekVisits.length} visits.`;
    }
    if (q.includes('month')) {
      const monthStart = startOfMonth(now);
      const monthVisits = ctx.visits.filter(v => v.visit_date && new Date(v.visit_date) >= monthStart);
      const rev = monthVisits.reduce((s, v) => s + (Number(v.grand_total) || 0), 0);
      return `Revenue this month (${format(now, 'MMMM')}): **₹${rev.toLocaleString()}** from ${monthVisits.length} visits.`;
    }
    const total = ctx.visits.reduce((s, v) => s + (Number(v.grand_total) || 0), 0);
    return `All-time total revenue: **₹${total.toLocaleString()}** from ${ctx.visits.length} visits.`;
  }

  // ── Top customers ─────────────────────────────────────────────────────────
  if (q.includes('top customer') || q.includes('best customer') || q.includes('highest spend')) {
    const monthStart = q.includes('month') ? startOfMonth(now) : new Date(0);
    const filteredVisits = ctx.visits.filter(v =>
      v.visit_date && new Date(v.visit_date) >= monthStart && v.customer_id
    );
    const spendMap: Record<number, number> = {};
    filteredVisits.forEach(v => {
      spendMap[v.customer_id] = (spendMap[v.customer_id] || 0) + (Number(v.grand_total) || 0);
    });
    const top = Object.entries(spendMap)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3);
    if (top.length === 0) return 'No visit data found for this period.';
    const lines = top.map(([id, spend], i) => {
      const c = ctx.customers.find((x: any) => x.id === Number(id));
      return `${i + 1}. **${c?.name || 'Unknown'}** — ₹${spend.toLocaleString()}`;
    });
    return `Top customers${q.includes('month') ? ' this month' : ''}:\n${lines.join('\n')}`;
  }

  // ── Best service ──────────────────────────────────────────────────────────
  if (q.includes('best service') || q.includes('top service') || q.includes('popular service') || q.includes('most booked')) {
    const monthStart = q.includes('month') ? startOfMonth(now) : new Date(0);
    const filteredVisits = ctx.visits.filter(v => v.visit_date && new Date(v.visit_date) >= monthStart);
    const svcRevenue: Record<string, number> = {};
    const svcCount: Record<string, number> = {};
    filteredVisits.forEach(v => {
      (v.visit_services || []).forEach((vs: any) => {
        if (vs.service_name) {
          svcRevenue[vs.service_name] = (svcRevenue[vs.service_name] || 0) + (Number(vs.price) || 0);
          svcCount[vs.service_name] = (svcCount[vs.service_name] || 0) + 1;
        }
      });
    });
    const top = Object.entries(svcCount).sort((a, b) => b[1] - a[1]).slice(0, 3);
    if (top.length === 0) return 'No service data found.';
    const lines = top.map(([name, count], i) =>
      `${i + 1}. **${name}** — ${count} bookings, ₹${(svcRevenue[name] || 0).toLocaleString()} revenue`
    );
    return `Top services${q.includes('month') ? ' this month' : ''}:\n${lines.join('\n')}`;
  }

  // ── Who visited today ─────────────────────────────────────────────────────
  if (
    q.includes('visit today') || q.includes('visited today') ||
    q.includes('came today') || q.includes('today visit') ||
    q.includes('who today') || q.includes('who visited') ||
    q.includes('visited now') || q.includes('today customer')
  ) {
    // Convert visit_date (UTC ISO) to local date string for accurate IST comparison
    const todayLocal = now.toLocaleDateString('en-CA'); // YYYY-MM-DD in local timezone
    const todayVisits = ctx.visits.filter(v => {
      if (!v.visit_date) return false;
      const visitLocal = new Date(v.visit_date).toLocaleDateString('en-CA');
      return visitLocal === todayLocal;
    });
    if (todayVisits.length === 0) return 'No visits recorded today yet.';
    const names = todayVisits.map(v => {
      const c = ctx.customers.find((x: any) => x.id === v.customer_id);
      return c ? c.name : 'Walk-in';
    });
    return `**${todayVisits.length} visit${todayVisits.length !== 1 ? 's' : ''} today:**\n${names.map((n, i) => `${i + 1}. ${n}`).join('\n')}`;
  }

  // ── Low stock ─────────────────────────────────────────────────────────────
  if (q.includes('low stock') || q.includes('running out') || q.includes('stock alert')) {
    const low = ctx.products.filter(p => (Number(p.current_stock) || 0) <= (Number(p.low_stock_threshold) || 5));
    if (low.length === 0) return 'All inventory levels are healthy. No products are low on stock.';
    const lines = low.map((p: any) => `• **${p.name}** — ${p.current_stock} left`);
    return `**${low.length} product${low.length !== 1 ? 's' : ''} low on stock:**\n${lines.join('\n')}`;
  }

  // ── Customer count ────────────────────────────────────────────────────────
  if (q.includes('how many customer') || q.includes('total customer') || q.includes('customer count')) {
    const monthStart = startOfMonth(now);
    const newThisMonth = ctx.customers.filter(c => c.createdAt && new Date(c.createdAt) >= monthStart).length;
    return `Total customers: **${ctx.customers.length}**. New this month: **${newThisMonth}**.`;
  }

  // ── Churn / at risk ───────────────────────────────────────────────────────
  if (q.includes('churn') || q.includes('at risk') || q.includes('inactive') || q.includes('lost customer')) {
    const cutoff45 = new Date(); cutoff45.setDate(cutoff45.getDate() - 45);
    const cutoff60 = new Date(); cutoff60.setDate(cutoff60.getDate() - 60);
    const lastVisitMap: Record<number, Date> = {};
    ctx.visits.forEach(v => {
      if (!v.customer_id || !v.visit_date) return;
      const d = new Date(v.visit_date);
      if (!lastVisitMap[v.customer_id] || d > lastVisitMap[v.customer_id]) {
        lastVisitMap[v.customer_id] = d;
      }
    });
    let atRisk = 0, churned = 0;
    Object.values(lastVisitMap).forEach(d => {
      const days = differenceInDays(now, d);
      if (days > 60) churned++;
      else if (days > 30) atRisk++;
    });
    return `Customer health check:\n• **Active** (visited in 30 days): ${Object.values(lastVisitMap).filter(d => differenceInDays(now, d) <= 30).length}\n• **At Risk** (31–60 days): **${atRisk}**\n• **Churned** (60+ days): **${churned}**`;
  }

  // ── Expenses ──────────────────────────────────────────────────────────────
  if (q.includes('expense') || q.includes('spend') || q.includes('cost')) {
    if (!ctx.expenses || ctx.expenses.length === 0) return 'No expense data is currently available.';
    if (q.includes('today')) {
      const todayExpenses = ctx.expenses.filter(
        e => e.date && new Date(e.date).toDateString() === now.toDateString()
      );
      const sum = todayExpenses.reduce((s, e) => s + (Number(e.amount) || 0), 0);
      return `Today's expenses are **₹${sum.toLocaleString()}** from ${todayExpenses.length} record${todayExpenses.length !== 1 ? 's' : ''}.`;
    }
    if (q.includes('month') || q.includes('recent')) {
      const monthStart = startOfMonth(now);
      const monthExpenses = ctx.expenses.filter(e => e.date && new Date(e.date) >= monthStart);
      const sum = monthExpenses.reduce((s, e) => s + (Number(e.amount) || 0), 0);
      return `Expenses this month: **₹${sum.toLocaleString()}** across ${monthExpenses.length} record${monthExpenses.length !== 1 ? 's' : ''}.`;
    }
    const total = ctx.expenses.reduce((s, e) => s + (Number(e.amount) || 0), 0);
    return `All-time expenses: **₹${total.toLocaleString()}**.`;
  }

  // ── Staff Performance ─────────────────────────────────────────────────────
  if (q.includes('staff') || q.includes('performing') || q.includes('top employee')) {
    const monthStart = startOfMonth(now);
    const monthVisits = ctx.visits.filter(v => v.visit_date && new Date(v.visit_date) >= monthStart);
    const staffRevenue: Record<string, number> = {};
    monthVisits.forEach(v => {
      if (v.staff?.name) {
        staffRevenue[v.staff.name] = (staffRevenue[v.staff.name] || 0) + (Number(v.grand_total) || 0);
      }
    });
    const topStaff = Object.entries(staffRevenue).sort((a, b) => b[1] - a[1]);
    if (topStaff.length === 0) return 'No staff performance data found for this month.';
    const lines = topStaff.slice(0, 3).map(([name, rev], i) => `${i + 1}. **${name}** — ₹${rev.toLocaleString()}`);
    return `Top performing staff this month:\n${lines.join('\n')}`;
  }

  // ── Customer Retention ────────────────────────────────────────────────────
  if (q.includes('return') || q.includes('retention')) {
    const monthStart = startOfMonth(now);
    const thisMonthCustomerIds = new Set(
      ctx.visits.filter(v => v.visit_date && new Date(v.visit_date) >= monthStart && v.customer_id)
        .map(v => v.customer_id)
    );
    const prevVisitedCustomers = new Set(
      ctx.visits.filter(v => v.visit_date && new Date(v.visit_date) < monthStart && v.customer_id)
        .map(v => v.customer_id)
    );
    let returning = 0;
    thisMonthCustomerIds.forEach(id => {
      if (prevVisitedCustomers.has(id)) returning++;
    });
    return `**${returning}** out of ${thisMonthCustomerIds.size} customers who visited this month are returning clients.`;
  }

  // ── Profit ────────────────────────────────────────────────────────────────
  if (q.includes('profit')) {
    const monthStart = startOfMonth(now);
    const monthVisits = ctx.visits.filter(v => v.visit_date && new Date(v.visit_date) >= monthStart);
    const monthExpenses = (ctx.expenses || []).filter(e => e.date && new Date(e.date) >= monthStart);
    const rev = monthVisits.reduce((s, v) => s + (Number(v.grand_total) || 0), 0);
    const exp = monthExpenses.reduce((s, e) => s + (Number(e.amount) || 0), 0);
    const profit = rev - exp;
    return `Profit this month:\n• Revenue: ₹${rev.toLocaleString()}\n• Expenses: ₹${exp.toLocaleString()}\n• **Net Profit: ₹${profit.toLocaleString()}**`;
  }

  // ── Out of stock specifically ─────────────────────────────────────────────
  if (q.includes('out of stock') || q.includes('empty stock') || q.includes('zero stock')) {
    const out = ctx.products.filter(p => (Number(p.current_stock) || 0) <= 0);
    if (out.length === 0) return 'Good news! No products are completely out of stock.';
    const lines = out.map((p: any) => `• **${p.name}**`);
    return `**${out.length} product${out.length !== 1 ? 's' : ''} out of stock:**\n${lines.join('\n')}`;
  }

  // ── Payment method breakdown ──────────────────────────────────────────────
  if (q.includes('payment method') || q.includes('cash vs upi') || q.includes('cash upi') || q.includes('how paid') || q.includes('payment split')) {
    const monthStart = q.includes('month') ? startOfMonth(now) : new Date(0);
    const filtered = ctx.visits.filter(v => v.visit_date && new Date(v.visit_date) >= monthStart);
    const methodMap: Record<string, { count: number; amount: number }> = {};
    filtered.forEach(v => {
      const m = v.payment_method || 'Unknown';
      if (!methodMap[m]) methodMap[m] = { count: 0, amount: 0 };
      methodMap[m].count++;
      methodMap[m].amount += Number(v.grand_total) || 0;
    });
    if (Object.keys(methodMap).length === 0) return 'No payment data found.';
    const lines = Object.entries(methodMap)
      .sort((a, b) => b[1].amount - a[1].amount)
      .map(([method, d]) => `• **${method}** — ${d.count} visits, ₹${d.amount.toLocaleString()}`);
    return `Payment method breakdown${q.includes('month') ? ' this month' : ''}:\n${lines.join('\n')}`;
  }

  // ── Product revenue ───────────────────────────────────────────────────────
  if (q.includes('product revenue') || q.includes('product sales') || q.includes('top product') || q.includes('best product')) {
    const monthStart = q.includes('month') ? startOfMonth(now) : new Date(0);
    const filtered = ctx.visits.filter(v => v.visit_date && new Date(v.visit_date) >= monthStart);
    const prodRevenue: Record<string, number> = {};
    const prodCount: Record<string, number> = {};
    filtered.forEach(v => {
      (v.visit_products || []).forEach((vp: any) => {
        if (vp.product_name) {
          prodRevenue[vp.product_name] = (prodRevenue[vp.product_name] || 0) + (Number(vp.price) || 0);
          prodCount[vp.product_name] = (prodCount[vp.product_name] || 0) + (Number(vp.quantity) || 1);
        }
      });
    });
    const top = Object.entries(prodRevenue).sort((a, b) => b[1] - a[1]).slice(0, 5);
    if (top.length === 0) return 'No product sales data found.';
    const lines = top.map(([name, rev], i) =>
      `${i + 1}. **${name}** — ₹${rev.toLocaleString()} (${prodCount[name]} units)`
    );
    return `Top products by revenue${q.includes('month') ? ' this month' : ''}:\n${lines.join('\n')}`;
  }

  // ── Discount analytics ────────────────────────────────────────────────────
  if (q.includes('discount') || q.includes('offer') || q.includes('how much discount')) {
    const monthStart = q.includes('month') ? startOfMonth(now) : new Date(0);
    const filtered = ctx.visits.filter(v => v.visit_date && new Date(v.visit_date) >= monthStart && Number(v.discount_amount) > 0);
    const totalDiscount = filtered.reduce((s, v) => s + (Number(v.discount_amount) || 0), 0);
    const allVisitsInPeriod = ctx.visits.filter(v => v.visit_date && new Date(v.visit_date) >= monthStart);
    const avgDiscount = filtered.length > 0 ? Math.round(totalDiscount / filtered.length) : 0;
    return `Discount analysis${q.includes('month') ? ' this month' : ' (all time)'}:\n• **${filtered.length}** visits had a discount\n• Total discounts given: **₹${totalDiscount.toLocaleString()}**\n• Avg discount per visit: **₹${avgDiscount.toLocaleString()}**\n• Discount visit rate: **${allVisitsInPeriod.length > 0 ? Math.round((filtered.length / allVisitsInPeriod.length) * 100) : 0}%** of visits`;
  }

  // ── Average bill / average order value ───────────────────────────────────
  if (q.includes('average bill') || q.includes('avg bill') || q.includes('average order') || q.includes('avg order') || q.includes('average visit value')) {
    const monthStart = q.includes('month') ? startOfMonth(now) : new Date(0);
    const filtered = ctx.visits.filter(v => v.visit_date && new Date(v.visit_date) >= monthStart);
    if (filtered.length === 0) return 'No visit data found for this period.';
    const total = filtered.reduce((s, v) => s + (Number(v.grand_total) || 0), 0);
    const avg = Math.round(total / filtered.length);
    const maxVisit = filtered.reduce((max, v) => Number(v.grand_total) > Number(max.grand_total) ? v : max, filtered[0]);
    return `Average bill${q.includes('month') ? ' this month' : ' (all time)'}:\n• **₹${avg.toLocaleString()}** per visit (across ${filtered.length} visits)\n• Highest single bill: **₹${Number(maxVisit.grand_total).toLocaleString()}**`;
  }

  // ── Customer lifetime value (CLV) ─────────────────────────────────────────
  if (q.includes('lifetime value') || q.includes('clv') || q.includes('customer value') || q.includes('average spend per customer')) {
    const spendMap: Record<number, number> = {};
    ctx.visits.forEach(v => {
      if (v.customer_id) {
        spendMap[v.customer_id] = (spendMap[v.customer_id] || 0) + (Number(v.grand_total) || 0);
      }
    });
    const spendValues = Object.values(spendMap);
    if (spendValues.length === 0) return 'No spend data available.';
    const totalRevenue = spendValues.reduce((s, v) => s + v, 0);
    const avgCLV = Math.round(totalRevenue / spendValues.length);
    const sorted = spendValues.sort((a, b) => b - a);
    const top10pct = sorted.slice(0, Math.max(1, Math.floor(sorted.length * 0.1)));
    const top10avg = Math.round(top10pct.reduce((s, v) => s + v, 0) / top10pct.length);
    return `Customer Lifetime Value (CLV):\n• Avg CLV: **₹${avgCLV.toLocaleString()}**\n• Top 10% customers avg: **₹${top10avg.toLocaleString()}**\n• Total customers with visits: **${spendValues.length}**`;
  }

  // ── Monthly revenue trend (last 6 months) ────────────────────────────────
  if (q.includes('monthly trend') || q.includes('last 6 months') || q.includes('6 month') || q.includes('monthly revenue') || q.includes('trend')) {
    const months: { label: string; rev: number }[] = [];
    for (let i = 5; i >= 0; i--) {
      const mStart = startOfMonth(subMonths(now, i));
      const mEnd = endOfMonth(subMonths(now, i));
      const mVisits = ctx.visits.filter(v => {
        if (!v.visit_date) return false;
        const d = new Date(v.visit_date);
        return d >= mStart && d <= mEnd;
      });
      const rev = mVisits.reduce((s, v) => s + (Number(v.grand_total) || 0), 0);
      months.push({ label: format(mStart, 'MMM yyyy'), rev });
    }
    const lines = months.map(m => `• **${m.label}**: ₹${m.rev.toLocaleString()}`);
    return `Revenue trend — last 6 months:\n${lines.join('\n')}`;
  }

  // ── Staff visit count ─────────────────────────────────────────────────────
  if (q.includes('staff visit') || q.includes('staff count') || q.includes('who handled') || q.includes('visits by staff')) {
    const monthStart = q.includes('month') ? startOfMonth(now) : new Date(0);
    const filtered = ctx.visits.filter(v => v.visit_date && new Date(v.visit_date) >= monthStart);
    const staffVisits: Record<string, number> = {};
    filtered.forEach(v => {
      if (v.staff?.name) {
        staffVisits[v.staff.name] = (staffVisits[v.staff.name] || 0) + 1;
      }
    });
    const top = Object.entries(staffVisits).sort((a, b) => b[1] - a[1]);
    if (top.length === 0) return 'No staff visit data found.';
    const lines = top.slice(0, 5).map(([name, count], i) => `${i + 1}. **${name}** — ${count} visits`);
    return `Staff visit count${q.includes('month') ? ' this month' : ''}:\n${lines.join('\n')}`;
  }

  // ── Birthday lists ────────────────────────────────────────────────────────
  if (q.includes('birthday') || q.includes('born this') || q.includes('dob')) {
    const isWeek = q.includes('week');
    const isMonth = q.includes('month') || !isWeek;
    const todayMon = now.getMonth() + 1;
    const todayDay = now.getDate();
    // Get end of week
    const weekEnd = new Date(now);
    weekEnd.setDate(now.getDate() + 7);

    const matches = ctx.customers.filter((c: any) => {
      if (!c.dob) return false;
      const parts = c.dob.split('-');
      if (parts.length < 3) return false;
      const month = Number(parts[1]);
      const day = Number(parts[2]);
      if (isWeek) {
        // Check if birthday falls in next 7 days
        for (let d = 0; d <= 7; d++) {
          const check = new Date(now);
          check.setDate(now.getDate() + d);
          if (month === check.getMonth() + 1 && day === check.getDate()) return true;
        }
        return false;
      }
      return month === todayMon; // same month
    });

    if (matches.length === 0) return `No customer birthdays ${isWeek ? 'this week' : 'this month'}.`;
    const lines = matches.map((c: any) => {
      const parts = c.dob.split('-');
      return `• **${c.name}** — ${parts[2]}/${parts[1]}`;
    });
    return `Birthdays ${isWeek ? 'this week' : 'this month'} (${matches.length}):\n${lines.join('\n')}`;
  }

  // ── Churned customer names list ───────────────────────────────────────────
  if (q.includes('churned customers') || q.includes('who churned') || q.includes('lost customers') || q.includes('list churned')) {
    const cutoff = new Date(); cutoff.setDate(cutoff.getDate() - 60);
    const lastVisitMap: Record<number, Date> = {};
    ctx.visits.forEach(v => {
      if (!v.customer_id || !v.visit_date) return;
      const d = new Date(v.visit_date);
      if (!lastVisitMap[v.customer_id] || d > lastVisitMap[v.customer_id]) {
        lastVisitMap[v.customer_id] = d;
      }
    });
    const churned = Object.entries(lastVisitMap)
      .filter(([, d]) => d < cutoff)
      .map(([id]) => {
        const c = ctx.customers.find((x: any) => x.id === Number(id));
        return c ? c.name : null;
      })
      .filter(Boolean);
    if (churned.length === 0) return 'Great news! No customers have churned (60+ days inactive).';
    const preview = churned.slice(0, 10).map(name => `• **${name}**`);
    const extra = churned.length > 10 ? `\n…and ${churned.length - 10} more` : '';
    return `**${churned.length} churned customers** (60+ days inactive):\n${preview.join('\n')}${extra}`;
  }

  // ── New customers this week ───────────────────────────────────────────────
  if (q.includes('new this week') || q.includes('new customers this week') || q.includes('joined this week')) {
    const weekAgo = new Date(); weekAgo.setDate(weekAgo.getDate() - 7);
    const newOnes = ctx.customers.filter((c: any) => {
      const created = c.created_at || c.createdAt;
      return created && new Date(created) >= weekAgo;
    });
    return `**${newOnes.length} new customer${newOnes.length !== 1 ? 's' : ''}** joined this week.${newOnes.length > 0 ? '\n' + newOnes.slice(0, 5).map((c: any) => `• **${c.name}**`).join('\n') : ''}`;
  }

  // ── Service revenue breakdown ─────────────────────────────────────────────
  if (q.includes('service revenue') || q.includes('revenue by service') || q.includes('service breakdown')) {
    const monthStart = q.includes('month') ? startOfMonth(now) : new Date(0);
    const filtered = ctx.visits.filter(v => v.visit_date && new Date(v.visit_date) >= monthStart);
    const svcRevMap: Record<string, number> = {};
    filtered.forEach(v => {
      (v.visit_services || []).forEach((vs: any) => {
        if (vs.service_name) {
          svcRevMap[vs.service_name] = (svcRevMap[vs.service_name] || 0) + (Number(vs.price) || 0);
        }
      });
    });
    const top = Object.entries(svcRevMap).sort((a, b) => b[1] - a[1]).slice(0, 5);
    if (top.length === 0) return 'No service revenue data found.';
    const total = Object.values(svcRevMap).reduce((s, v) => s + v, 0);
    const lines = top.map(([name, rev], i) =>
      `${i + 1}. **${name}** — ₹${rev.toLocaleString()} (${total > 0 ? Math.round((rev / total) * 100) : 0}%)`
    );
    return `Service revenue breakdown${q.includes('month') ? ' this month' : ''}:\n${lines.join('\n')}\nTotal: ₹${total.toLocaleString()}`;
  }

  // ── Busiest month ─────────────────────────────────────────────────────────
  if (q.includes('busiest month') || q.includes('best month') || q.includes('peak month')) {
    const monthRevMap: Record<string, { visits: number; revenue: number }> = {};
    ctx.visits.forEach(v => {
      if (!v.visit_date) return;
      const key = format(new Date(v.visit_date), 'MMMM yyyy');
      if (!monthRevMap[key]) monthRevMap[key] = { visits: 0, revenue: 0 };
      monthRevMap[key].visits++;
      monthRevMap[key].revenue += Number(v.grand_total) || 0;
    });
    const sorted = Object.entries(monthRevMap).sort((a, b) => b[1].revenue - a[1].revenue);
    if (sorted.length === 0) return 'No visit data to determine busiest month.';
    const [topMonth, topData] = sorted[0];
    const lines = sorted.slice(0, 5).map(([month, data], i) =>
      `${i + 1}. **${month}** — ${data.visits} visits, ₹${data.revenue.toLocaleString()}`
    );
    return `Busiest months by revenue:\n${lines.join('\n')}`;
  }

  // ── Top 5 customers (extended) ────────────────────────────────────────────
  if (q.includes('top 5') || q.includes('top five')) {
    const spendMap: Record<number, number> = {};
    ctx.visits.forEach(v => {
      if (v.customer_id) {
        spendMap[v.customer_id] = (spendMap[v.customer_id] || 0) + (Number(v.grand_total) || 0);
      }
    });
    const top = Object.entries(spendMap).sort((a, b) => b[1] - a[1]).slice(0, 5);
    if (top.length === 0) return 'No visit data found.';
    const lines = top.map(([id, spend], i) => {
      const c = ctx.customers.find((x: any) => x.id === Number(id));
      return `${i + 1}. **${c?.name || 'Unknown'}** — ₹${spend.toLocaleString()}`;
    });
    return `Top 5 customers by lifetime spend:\n${lines.join('\n')}`;
  }

  // ── Fallback ──────────────────────────────────────────────────────────────
  return `I can answer questions about:\n• **Revenue** — "revenue today/week/month/all time"\n• **Customers** — "top customers", "top 5", "how many customers", "new this week"\n• **Services** — "best service", "service revenue breakdown"\n• **Products** — "product revenue", "low stock", "out of stock"\n• **Staff** — "top performing staff", "staff visit count"\n• **Health** — "at risk customers", "churned customers", "who churned"\n• **Finance** — "profit", "expenses", "average bill", "discounts", "payment method breakdown"\n• **Trends** — "monthly trend", "last 6 months", "busiest month"\n• **Analytics** — "customer lifetime value", "returning customers", "birthday this month"\n• **Visits** — "who visited today", "revenue this month"`;
}
