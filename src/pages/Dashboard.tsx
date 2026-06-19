import React, { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { 
  IndianRupee, 
  Users, 
  PackageOpen, 
  TrendingUp,
  AlertTriangle
} from 'lucide-react';
import { isSameDay } from 'date-fns';
import { motion } from 'framer-motion';
import type { Variants } from 'framer-motion';

const containerVariants: Variants = {
  hidden: { opacity: 0 },
  show: {
    opacity: 1,
    transition: { staggerChildren: 0.1 }
  }
};

const itemVariants: Variants = {
  hidden: { opacity: 0, y: 20 },
  show: { opacity: 1, y: 0, transition: { type: 'spring', stiffness: 300, damping: 24 } }
};

export default function Dashboard() {
  const [visits, setVisits] = useState<any[]>([]);
  const [expenses, setExpenses] = useState<any[]>([]);
  const [products, setProducts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [
        { data: visitsData },
        { data: expensesData },
        { data: productsData }
      ] = await Promise.all([
        supabase.from('customer_visits').select('*').eq('is_deleted', false).order('visit_date', { ascending: false }),
        supabase.from('expenses').select('*').eq('is_deleted', false).order('date', { ascending: false }),
        supabase.from('products').select('*').eq('is_deleted', false)
      ]);

      setVisits(visitsData || []);
      setExpenses(expensesData || []);
      setProducts(productsData || []);
    } catch (err) {
      console.error('Error fetching dashboard data:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();

    const channel = supabase
      .channel('dashboard-updates')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'customer_visits' }, fetchData)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'expenses' }, fetchData)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'products' }, fetchData)
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const today = new Date();

  // --- Row 1: Metrics ---
  const todayVisits = visits.filter(v => v.visit_date && isSameDay(new Date(v.visit_date), today));
  const uniqueCustomerIds = new Set(todayVisits.map(v => v.customer_id).filter(Boolean));
  const todayCustomersCount = uniqueCustomerIds.size;
  
  const todayRevenue = todayVisits.reduce((sum, v) => sum + (Number(v.grand_total) || 0), 0);
  
  const todayExpensesItems = expenses.filter(exp => exp.date && isSameDay(new Date(exp.date), today));
  const todayExpensesAmount = todayExpensesItems.reduce((sum, exp) => sum + (Number(exp.amount) || 0), 0);
  const todayProfit = todayRevenue - todayExpensesAmount;

  // --- Lifetime Metrics ---
  const allUniqueCustomerIds = new Set(visits.map(v => v.customer_id).filter(Boolean));
  const lifetimeCustomersCount = allUniqueCustomerIds.size;
  const lifetimeRevenue = visits.reduce((sum, v) => sum + (Number(v.grand_total) || 0), 0);
  const lifetimeExpensesAmount = expenses.reduce((sum, exp) => sum + (Number(exp.amount) || 0), 0);
  const lifetimeProfit = lifetimeRevenue - lifetimeExpensesAmount;

  // --- Low Stock Products ---
  const lowStockProducts = products.filter(p => (Number(p.current_stock) || 0) <= 5).slice(0, 10);

  const StatCard = ({ title, todayValue, lifetimeValue, lifetimeLabel, icon: Icon, colorClass }: any) => (
    <motion.div variants={itemVariants} className="glass-card p-5 flex flex-col justify-between relative overflow-hidden group">
      {/* Decorative background glow */}
      <div className="absolute -right-10 -top-10 w-40 h-40 bg-black/40/[0.02] rounded-full blur-3xl group-hover:bg-black/40/[0.04] transition-all duration-500"></div>
      
      <div className="flex justify-between items-start mb-4 relative z-10">
        <div className="p-3 rounded-2xl bg-black/40/[0.03] border border-white/5 shadow-sm backdrop-blur-md">
          <Icon className="w-5 h-5 text-white/60" />
        </div>
      </div>
      <div className="relative z-10">
        <h3 className="text-white/40 text-[10px] font-bold mb-2 tracking-[0.2em] uppercase">{title}</h3>
        <p className="text-4xl font-serif text-white tracking-tight mb-3">{todayValue}</p>
        
        <div className="flex items-center justify-between border-t border-white/5 pt-3">
          <span className="text-[10px] text-white/40 uppercase tracking-widest">{lifetimeLabel || 'Lifetime'}</span>
          <span className="text-sm font-light text-white/70">{lifetimeValue}</span>
        </div>
      </div>
    </motion.div>
  );

  return (
    <motion.div 
      className="space-y-12 pb-16 max-w-[1400px] mx-auto px-4"
      variants={containerVariants}
      initial="hidden"
      animate="show"
    >
      <div className="mb-12 mt-6">
        <h1 className="text-6xl font-serif text-white tracking-tight mb-4">Dashboard</h1>
        <p className="text-white/40 text-sm font-medium tracking-widest uppercase">Executive Overview • {today.toLocaleDateString('en-US', { month: 'long', day: 'numeric' })}</p>
      </div>

      {loading ? (
         <div className="flex justify-center items-center h-64">
           <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-white"></div>
         </div>
      ) : (
        <>
          {/* Key Daily Metrics */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <StatCard 
              title="Today's Revenue" 
              todayValue={`₹${todayRevenue.toLocaleString()}`}
              lifetimeValue={`₹${lifetimeRevenue.toLocaleString()}`}
              icon={IndianRupee} 
            />
            <StatCard 
              title="Today's Profit" 
              todayValue={`₹${todayProfit.toLocaleString()}`}
              lifetimeValue={`₹${lifetimeProfit.toLocaleString()}`}
              icon={TrendingUp} 
            />
            <StatCard 
              title="Customers (Today)" 
              todayValue={todayCustomersCount.toString()}
              lifetimeValue={lifetimeCustomersCount.toString()}
              lifetimeLabel="Total Customers"
              icon={Users} 
            />
            <StatCard 
              title="Today's Expenses" 
              todayValue={`₹${todayExpensesAmount.toLocaleString()}`}
              lifetimeValue={`₹${lifetimeExpensesAmount.toLocaleString()}`}
              icon={IndianRupee} 
            />
          </div>

          {/* Low Stock Alerts */}
          <motion.div variants={itemVariants} className="glass-card p-5 flex flex-col min-h-[300px] mt-6 relative overflow-hidden">
            <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-danger/[0.02] rounded-full blur-[100px] pointer-events-none"></div>
            
            <div className="flex justify-between items-center mb-5 shrink-0 border-b border-white/5 pb-4 relative z-10">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-xl bg-danger/10 border border-danger/20">
                  <AlertTriangle className="w-4 h-4 text-danger" />
                </div>
                <h3 className="text-xl font-light tracking-tight text-white">Low Stock Alerts</h3>
              </div>
            </div>
            
            <div className="space-y-3 overflow-y-auto custom-scrollbar pr-2 flex-1 relative z-10">
              {lowStockProducts.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-full text-white/40 mt-6">
                  <PackageOpen className="w-10 h-10 mb-3 opacity-30" />
                  <p className="text-xs font-medium tracking-wide uppercase">Inventory levels optimal</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                  {lowStockProducts.map(product => (
                    <div key={product.id} className="flex flex-col p-4 rounded-xl bg-danger/[0.03] border border-danger/10 backdrop-blur-md transition-all hover:bg-danger/[0.05] hover:border-danger/30">
                      <p className="text-base font-medium text-white truncate">{product.name}</p>
                      <div className="flex justify-between items-end mt-4">
                        <div>
                          <p className="text-[9px] text-white/40 uppercase tracking-[0.1em] mb-1">Threshold</p>
                          <p className="text-xs font-semibold text-white/70">5</p>
                        </div>
                        <div className="text-right">
                          <p className="text-[9px] text-danger uppercase tracking-[0.1em] font-bold mb-1">Current Stock</p>
                          <p className="text-xl font-light text-danger">{product.current_stock || 0}</p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </motion.div>
        </>
      )}
    </motion.div>
  );
}
