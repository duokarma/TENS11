import React, { useState, useMemo, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { PieChart as PieChartIcon, ArrowUpRight, ArrowDownRight, IndianRupee, Download, Package, Calendar } from 'lucide-react';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip as RechartsTooltip } from 'recharts';
import { format, startOfMonth, endOfMonth, parseISO } from 'date-fns';
import toast from 'react-hot-toast';

const COLORS = ['#F4E3C5', '#D4AF37', '#996515', '#C5B358', '#E6C200', '#FFDF00'];

export default function Accounts() {
  const [startDate, setStartDate] = useState(format(startOfMonth(new Date()), 'yyyy-MM-dd'));
  const [endDate, setEndDate] = useState(format(endOfMonth(new Date()), 'yyyy-MM-dd'));
  
  const [visits, setVisits] = useState<any[]>([]);
  const [expenses, setExpenses] = useState<any[]>([]);
  const [products, setProducts] = useState<any[]>([]);
  const [recentTransactions, setRecentTransactions] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const fetchData = async () => {
    setIsLoading(true);
    try {
      const sDate = new Date(startDate);
      sDate.setHours(0, 0, 0, 0);
      const eDate = new Date(endDate);
      eDate.setHours(23, 59, 59, 999);

      let visitQuery = supabase.from('customer_visits').select('grand_total, visit_date').eq('is_deleted', false)
        .gte('visit_date', sDate.toISOString()).lte('visit_date', eDate.toISOString());
        
      let expenseQuery = supabase.from('expenses').select('amount, category, date').eq('is_deleted', false)
        .gte('date', sDate.toISOString()).lte('date', eDate.toISOString());

      // Products don't have date filtering for purchased/sold quantities, so we fetch all to show lifetime inventory impact
      let productQuery = supabase.from('products').select('purchase_price, selling_price, purchased_quantity, sold_quantity').eq('is_deleted', false);

      // Recent Transactions Queries
      let recentVisitsQuery = supabase.from('customer_visits')
        .select('id, grand_total, visit_date, customer:customer_id(name)')
        .eq('is_deleted', false)
        .gte('visit_date', sDate.toISOString()).lte('visit_date', eDate.toISOString())
        .order('visit_date', { ascending: false })
        .limit(10);
        
      let recentExpensesQuery = supabase.from('expenses')
        .select('id, title, category, amount, date')
        .eq('is_deleted', false)
        .gte('date', sDate.toISOString()).lte('date', eDate.toISOString())
        .order('date', { ascending: false })
        .limit(10);

      const [vRes, eRes, pRes, rvRes, reRes] = await Promise.all([
        visitQuery,
        expenseQuery,
        productQuery,
        recentVisitsQuery,
        recentExpensesQuery
      ]);

      if (vRes.data) setVisits(vRes.data);
      if (eRes.data) setExpenses(eRes.data);
      if (pRes.data) setProducts(pRes.data);

      const incomes = (rvRes.data || []).map((v: any) => ({
        id: v.id,
        title: `Visit: ${v.customer?.name || 'Walk-in'}`,
        amount: Number(v.grand_total) || 0,
        type: 'income',
        date: new Date(v.visit_date)
      }));
      
      const outgoings = (reRes.data || []).map((exp: any) => ({
        id: exp.id,
        title: exp.title || exp.category,
        amount: Number(exp.amount) || 0,
        type: 'expense',
        date: new Date(exp.date)
      }));

      const merged = [...incomes, ...outgoings]
        .sort((a, b) => b.date.getTime() - a.date.getTime())
        .slice(0, 10);

      setRecentTransactions(merged);
    } catch (err) {
      console.error(err);
      toast.error('Failed to load accounts data');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [startDate, endDate]);

  // Calculations
  const totalRevenue = visits.reduce((sum, v) => sum + (Number(v.grand_total) || 0), 0);
  const totalExpenses = expenses.reduce((sum, exp) => sum + (Number(exp.amount) || 0), 0);
  
  // Inventory Impact (Lifetime)
  const totalInventoryPurchasedCost = products.reduce((sum, p) => sum + ((Number(p.purchased_quantity) || 0) * (Number(p.purchase_price) || 0)), 0);
  const totalInventorySoldRevenue = products.reduce((sum, p) => sum + ((Number(p.sold_quantity) || 0) * (Number(p.selling_price) || 0)), 0);

  // We factor the inventory purchased cost into net profit to represent cash flow accurately
  // Note: If managers manually log inventory purchases in 'expenses' table, this might double count,
  // but the user requested explicit inventory calculation for net profit.
  const netProfit = totalRevenue - totalExpenses - totalInventoryPurchasedCost;

  // Pie Chart Data (Category breakdown)
  const expenseData = useMemo(() => {
    const breakdown: Record<string, number> = {};
    expenses.forEach(exp => {
      if (!breakdown[exp.category]) breakdown[exp.category] = 0;
      breakdown[exp.category] += Number(exp.amount) || 0;
    });
    // Add Inventory as an expense category for the pie chart representation visually
    if (totalInventoryPurchasedCost > 0) {
       breakdown['Inventory Purchases (Total)'] = totalInventoryPurchasedCost;
    }

    return Object.entries(breakdown).map(([name, value]) => ({ name, value })).sort((a,b) => b.value - a.value);
  }, [expenses, totalInventoryPurchasedCost]);

  // CSV Exports
  const exportCustomerCSV = async () => {
    try {
      const { data, error } = await supabase.from('customers').select('*').eq('is_deleted', false);
      if (error) throw error;
      if (!data || data.length === 0) {
        toast.error('No customers found.');
        return;
      }
      
      const headers = ['ID', 'Name', 'Phone', 'Date of Birth', 'Services Taken', 'Staff Served', 'Amount Paid'];
      const rows = data.map(c => [
        c.id,
        `"${c.name}"`,
        `"${c.phone || ''}"`,
        c.dob || '',
        `"${(c.services_taken || []).join(', ')}"`,
        `"${(c.staff_served || []).join(', ')}"`,
        c.amount_paid || 0
      ]);
      
      const csvContent = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const link = document.createElement('a');
      link.href = URL.createObjectURL(blob);
      link.setAttribute('download', `customers_export_${format(new Date(), 'yyyy-MM-dd')}.csv`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      toast.success('Customer CSV exported!');
    } catch (err: any) {
      console.error(err);
      toast.error('Failed to export customers');
    }
  };

  const exportFinanceCSV = async () => {
    try {
      const { data: allVisits } = await supabase.from('customer_visits').select('visit_date, grand_total, customer:customer_id(name)').eq('is_deleted', false);
      const { data: allExpenses } = await supabase.from('expenses').select('date, title, category, amount').eq('is_deleted', false);
      const { data: allProducts } = await supabase.from('products').select('name, purchased_quantity, purchase_price, created_at');

      if ((!allVisits || allVisits.length === 0) && (!allExpenses || allExpenses.length === 0) && (!allProducts || allProducts.length === 0)) {
        toast.error('No financial data found.');
        return;
      }

      const headers = ['Date', 'Type', 'Description', 'Category/Customer', 'Amount'];
      
      const incomes = (allVisits || []).map((v: any) => [
        format(new Date(v.visit_date), 'yyyy-MM-dd HH:mm'),
        'Income',
        `"Visit - ${v.customer?.name || 'Walk-in'}"`,
        `"Services & Products"`,
        v.grand_total || 0
      ]);
      
      const outgoings = (allExpenses || []).map((e: any) => [
        format(new Date(e.date), 'yyyy-MM-dd'),
        'Expense',
        `"${e.title || e.category}"`,
        `"${e.category}"`,
        e.amount || 0
      ]);

      const inventory = (allProducts || []).filter(p => (p.purchased_quantity || 0) > 0).map((p: any) => [
        format(new Date(p.created_at || new Date()), 'yyyy-MM-dd'),
        'Expense',
        `"Inventory Purchase - ${p.name}"`,
        `"Inventory"`,
        (p.purchased_quantity || 0) * (p.purchase_price || 0)
      ]);
      
      const allTx = [...incomes, ...outgoings, ...inventory].sort((a, b) => new Date(b[0] as string).getTime() - new Date(a[0] as string).getTime());
      
      const csvContent = [headers.join(','), ...allTx.map(r => r.join(','))].join('\n');
      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const link = document.createElement('a');
      link.href = URL.createObjectURL(blob);
      link.setAttribute('download', `finance_export_${format(new Date(), 'yyyy-MM-dd')}.csv`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      toast.success('Finance CSV exported!');
    } catch (err) {
      console.error(err);
      toast.error('Failed to export finance data');
    }
  };

  return (
    <div className="space-y-6 pb-10">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-4xl font-light tracking-tight text-white">Accounts Overview</h2>
          <p className="text-white/60 font-light mt-1 tracking-wide">Financial summary, P&L, and expense tracking.</p>
        </div>
        <div className="flex flex-wrap gap-3 items-center">
          <div className="flex items-center gap-2 bg-black/40 px-3 py-2 border border-white/10 shadow-sm rounded-lg">
            <Calendar className="w-4 h-4 text-white/60" />
            <input 
              type="date" 
              value={startDate}
              onChange={e => setStartDate(e.target.value)}
              className="bg-transparent text-sm text-white outline-none font-medium"
            />
            <span className="text-white/60 mx-1">to</span>
            <input 
              type="date" 
              value={endDate}
              onChange={e => setEndDate(e.target.value)}
              className="bg-transparent text-sm text-white outline-none font-medium"
            />
          </div>

          <button onClick={exportCustomerCSV} className="btn-secondary flex items-center bg-black/40 border-white/10 shadow-sm">
            <Download className="w-4 h-4 mr-2" /> Customers CSV
          </button>
          <button onClick={exportFinanceCSV} className="btn-primary flex items-center shadow-sm">
            <Download className="w-4 h-4 mr-2" /> Finance CSV
          </button>
        </div>
      </div>

      {isLoading ? (
        <div className="p-12 text-center text-white/60">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
          Loading accounts data...
        </div>
      ) : (
        <>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <div className="glass-card p-6 flex flex-col justify-center border border-white/10 bg-black/40">
              <div className="flex justify-between items-start">
                <h3 className="text-xs font-bold uppercase tracking-widest text-white/60">Total Revenue</h3>
                <div className="bg-success/10 p-2 rounded-lg border border-success/20"><ArrowUpRight className="h-5 w-5 text-success" /></div>
              </div>
              <div className="mt-4 flex items-center gap-2">
                <span className="text-4xl font-light text-white flex items-center tracking-tight"><IndianRupee className="w-6 h-6 mr-1 text-white/60" />{totalRevenue.toLocaleString()}</span>
              </div>
            </div>
            
            <div className="glass-card p-6 flex flex-col justify-center border border-danger/20 bg-danger/5">
              <div className="flex justify-between items-start">
                <h3 className="text-xs font-bold uppercase tracking-widest text-danger">Operating Expenses</h3>
                <div className="bg-danger/10 p-2 rounded-lg border border-danger/20"><ArrowDownRight className="h-5 w-5 text-danger" /></div>
              </div>
              <div className="mt-4 flex items-center gap-2">
                <span className="text-4xl font-light text-danger flex items-center tracking-tight"><IndianRupee className="w-6 h-6 mr-1 text-danger" />{totalExpenses.toLocaleString()}</span>
              </div>
            </div>

            <div className="glass-card p-6 flex flex-col justify-center border border-primary/20 bg-primary/5 relative overflow-hidden">
              <div className="absolute top-0 right-0 p-4 opacity-[0.03]">
                 <Package className="w-24 h-24 text-primary" />
              </div>
              <div className="relative z-10">
                <div className="flex justify-between items-start">
                  <h3 className="text-xs font-bold uppercase tracking-widest text-primary">Inventory Purchased</h3>
                  <div className="bg-primary/10 p-2 rounded-lg border border-primary/20"><Package className="h-5 w-5 text-primary" /></div>
                </div>
                <div className="mt-4 flex items-center gap-2">
                  <span className="text-4xl font-light text-primary flex items-center tracking-tight"><IndianRupee className="w-6 h-6 mr-1 text-primary/50" />{totalInventoryPurchasedCost.toLocaleString()}</span>
                </div>
                <p className="text-xs font-light mt-2 text-primary/70">Lifetime product cost</p>
              </div>
            </div>

            <div className="glass-card p-6 relative overflow-hidden flex flex-col justify-center group border border-white/10 bg-black/40">
              <div className="absolute top-0 right-0 p-4 opacity-[0.03] group-hover:scale-110 transition-transform duration-500">
                 <IndianRupee className="w-24 h-24 text-white" />
              </div>
              <div className="relative z-10">
                <div className="flex justify-between items-start">
                  <h3 className="text-xs font-bold uppercase tracking-widest text-white/60">Net Profit</h3>
                </div>
                <div className="mt-4 flex items-center gap-2">
                  <span className={`text-4xl font-light tracking-tight flex items-center ${netProfit >= 0 ? 'text-success' : 'text-danger'}`}>
                    <IndianRupee className={`w-6 h-6 mr-1 ${netProfit >= 0 ? 'text-success/50' : 'text-danger/50'}`} />{netProfit.toLocaleString()}
                  </span>
                </div>
                <p className="text-xs font-light mt-2 text-white/60 italic">Rev - (Op. Exp + Inventory)</p>
              </div>
            </div>
          </div>

          <div className="grid lg:grid-cols-2 gap-6">
            
            {/* Pie Chart */}
            <div className="glass-card p-6 border border-white/10 bg-black/40">
              <h3 className="text-xl font-light text-white mb-6 tracking-tight">Expense Breakdown</h3>
              {expenseData.length === 0 ? (
                <div className="h-[300px] flex items-center justify-center text-white/60 text-sm italic font-light">
                  No expenses recorded for this period.
                </div>
              ) : (
                <div className="h-[300px] w-full relative">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={expenseData}
                        cx="50%"
                        cy="50%"
                        innerRadius={60}
                        outerRadius={100}
                        paddingAngle={5}
                        dataKey="value"
                      >
                        {expenseData.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} stroke="transparent" />
                        ))}
                      </Pie>
                      <RechartsTooltip 
                        formatter={(value: any) => `₹${value}`} 
                        contentStyle={{ backgroundColor: 'rgba(0,0,0,0.8)', borderColor: 'rgba(255,255,255,0.1)', borderRadius: '12px', color: '#fff', boxShadow: '0 4px 15px rgba(0, 0, 0, 0.5)', backdropFilter: 'blur(10px)' }}
                        itemStyle={{ color: '#fff' }}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              )}
            </div>

            {/* Recent Transactions List */}
            <div className="glass-card p-6 flex flex-col h-full max-h-[420px] border border-white/10 bg-black/40">
              <div className="flex justify-between items-center mb-6 shrink-0">
                <h3 className="text-xl font-light text-white tracking-tight">Recent Transactions</h3>
                <span className="text-xs font-bold px-3 py-1.5 bg-black/40 text-white border border-white/10 rounded-lg shadow-sm">Period</span>
              </div>
              
              <div className="space-y-4 overflow-y-auto custom-scrollbar pr-2 flex-1">
                {recentTransactions.length === 0 ? (
                  <p className="text-sm text-center text-white/60 italic font-light mt-10">No transactions found.</p>
                ) : (
                  recentTransactions.map(tx => (
                    <div key={`${tx.type}-${tx.id}`} className="flex justify-between items-center pb-4 border-b border-white/10 last:border-0 last:pb-0 group">
                      <div>
                        <p className="font-medium text-base text-white">{tx.title}</p>
                        <p className="text-xs font-light tracking-wide text-white/60 mt-1 uppercase">{format(tx.date, 'dd MMM yyyy, hh:mm a')}</p>
                      </div>
                      <span className={`font-bold text-sm px-3 py-1 rounded-lg border ${tx.type === 'income' ? 'text-success bg-success/10 border-success/20' : 'text-danger bg-danger/10 border-danger/20'}`}>
                        {tx.type === 'income' ? '+' : '-'}₹{tx.amount.toLocaleString()}
                      </span>
                    </div>
                  ))
                )}
              </div>
            </div>

          </div>
        </>
      )}
    </div>
  );
}


