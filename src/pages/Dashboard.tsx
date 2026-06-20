import React, { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { 
  IndianRupee, 
  Users, 
  PackageOpen, 
  TrendingUp,
  AlertTriangle,
  Gift
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
  const [customers, setCustomers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [
        { data: visitsData },
        { data: expensesData },
        { data: productsData },
        { data: customersData }
      ] = await Promise.all([
        supabase.from('customer_visits').select('*').eq('is_deleted', false).order('visit_date', { ascending: false }),
        supabase.from('expenses').select('*').eq('is_deleted', false).order('date', { ascending: false }),
        supabase.from('products').select('*').eq('is_deleted', false),
        supabase.from('customers').select('id, created_at, name, dob, phone').eq('is_deleted', false)
      ]);

      setVisits(visitsData || []);
      setExpenses(expensesData || []);
      setProducts(productsData || []);
      setCustomers(customersData || []);
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
      .on('postgres_changes', { event: '*', schema: 'public', table: 'customers' }, fetchData)
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  // --- Birthdays Today ---
  const today = new Date();
  const todayDate = today.getDate();
  const todayMonth = today.getMonth() + 1;

  const birthdayCustomers = customers.filter(c => {
    if (!c.dob) return false;
    const parts = c.dob.split('-');
    if (parts.length === 3) {
      const year = Number(parts[0]);
      const month = Number(parts[1]);
      const day = Number(parts[2]);
      return day === todayDate && month === todayMonth;
    }
    return false;
  });

  useEffect(() => {
    if (birthdayCustomers.length > 0) {
      const hasPlayed = sessionStorage.getItem('birthday_sound_played');
      if (!hasPlayed) {
        try {
          const audio = new Audio('/chime.mp3');
          audio.volume = 0.3; // Low volume, premium feel
          audio.play().catch(e => console.log('Audio autoplay blocked by browser', e));
          sessionStorage.setItem('birthday_sound_played', 'true');
        } catch (e) {
          console.error(e);
        }
      }
    }
  }, [birthdayCustomers.length]);

  // --- Row 1: Metrics ---
  const todayVisits = visits.filter(v => v.visit_date && isSameDay(new Date(v.visit_date), today));
  const uniqueCustomerIds = new Set(todayVisits.map(v => v.customer_id).filter(Boolean));
  const todayCustomersCount = uniqueCustomerIds.size;
  
  const todayRevenue = todayVisits.reduce((sum, v) => sum + (Number(v.grand_total) || 0), 0);
  
  const todayExpensesItems = expenses.filter(exp => exp.date && isSameDay(new Date(exp.date), today));
  const todayExpensesAmount = todayExpensesItems.reduce((sum, exp) => sum + (Number(exp.amount) || 0), 0);
  const todayProfit = todayRevenue - todayExpensesAmount;

  // --- Lifetime Metrics ---
  const lifetimeCustomersCount = customers.length;
  const lifetimeRevenue = visits.reduce((sum, v) => sum + (Number(v.grand_total) || 0), 0);
  const lifetimeExpensesAmount = expenses.reduce((sum, exp) => sum + (Number(exp.amount) || 0), 0);
  const lifetimeProfit = lifetimeRevenue - lifetimeExpensesAmount;

  // --- Low Stock Products ---
  const lowStockProducts = products.filter(p => (Number(p.current_stock) || 0) <= 5).slice(0, 10);

  const StatCard = ({ title, todayValue, lifetimeValue, lifetimeLabel, icon: Icon, colorClass }: any) => (
    <motion.div
      variants={itemVariants}
      className="glass-card p-5 flex flex-col justify-between relative overflow-hidden group"
      style={{ border: '1px solid rgba(212,175,55,0.1)' }}
    >
      {/* Decorative gold glow */}
      <div
        className="absolute -right-10 -top-10 w-40 h-40 rounded-full pointer-events-none transition-all duration-500"
        style={{ background: 'radial-gradient(circle, rgba(212,175,55,0.03) 0%, transparent 70%)' }}
      />
      
      <div className="flex justify-between items-start mb-4 relative z-10">
        <div
          className="p-3 rounded-2xl shadow-sm backdrop-blur-md"
          style={{ background: 'rgba(212,175,55,0.08)', border: '1px solid rgba(212,175,55,0.15)' }}
        >
          <Icon className="w-5 h-5" style={{ color: '#D4AF37' }} />
        </div>
      </div>
      <div className="relative z-10">
        <h3 className="text-[11px] font-bold mb-2 tracking-[0.2em] uppercase" style={{ color: 'rgba(212,175,55,0.6)' }}>{title}</h3>
        <p className="heading-display text-5xl font-light text-white tracking-tight mb-3">{todayValue}</p>
        
        <div className="flex items-center justify-between pt-3" style={{ borderTop: '1px solid rgba(212,175,55,0.08)' }}>
          <span className="text-[10px] uppercase tracking-widest" style={{ color: 'rgba(212,175,55,0.35)' }}>{lifetimeLabel || 'Lifetime'}</span>
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
        <h1 className="heading-display text-5xl mb-4 leading-none">
          Dashboard
        </h1>
        <p className="text-sm font-medium tracking-widest uppercase" style={{ color: 'rgba(212,175,55,0.4)' }}>
          Executive Overview &bull; {today.toLocaleDateString('en-US', { month: 'long', day: 'numeric' })}
        </p>
      </div>

      {loading ? (
         <div className="flex justify-center items-center h-64">
           <div className="animate-spin rounded-full h-8 w-8 border-b-2" style={{ borderColor: '#D4AF37' }}></div>
         </div>
      ) : (
        <>
          {/* Birthday Notifications */}
          {birthdayCustomers.length > 0 && (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-8">
              {birthdayCustomers.map(customer => (
                <motion.div
                  key={customer.id}
                  variants={itemVariants}
                  className="glass-card p-5 relative overflow-hidden group"
                  style={{ border: '1px solid rgba(212,175,55,0.2)', background: 'rgba(212,175,55,0.04)' }}
                >
                  <div className="absolute top-0 right-0 w-32 h-32 rounded-full blur-2xl" style={{ background: 'rgba(212,175,55,0.06)' }}></div>
                  <div className="relative z-10 flex items-start gap-4">
                    <div
                      className="p-3 rounded-2xl shadow-sm backdrop-blur-md"
                      style={{ background: 'rgba(212,175,55,0.1)', border: '1px solid rgba(212,175,55,0.2)' }}
                    >
                      <Gift className="w-6 h-6" style={{ color: '#D4AF37' }} />
                    </div>
                    <div className="flex-1">
                      <h3 className="heading-display text-2xl font-light text-white">{customer.name}</h3>
                      <p className="text-[11px] tracking-[0.2em] uppercase mt-1 font-bold" style={{ color: 'rgba(212,175,55,0.6)' }}>Birthday Today</p>
                      
                      <button 
                        onClick={() => window.open(`https://wa.me/${customer.phone?.replace(/\D/g,'')}?text=${encodeURIComponent(`Happy Birthday ${customer.name}! Wishing you a wonderful day from TENS11 Salon!`)}`, '_blank')}
                        className="mt-4 w-full py-2 rounded-xl font-bold text-xs transition-all shadow-sm flex justify-center items-center gap-2"
                        style={{
                          background: 'rgba(212,175,55,0.15)',
                          color: '#D4AF37',
                          border: '1px solid rgba(212,175,55,0.25)',
                        }}
                        onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = 'rgba(212,175,55,0.25)'; }}
                        onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'rgba(212,175,55,0.15)'; }}
                      >
                        Send Wish
                      </button>
                    </div>
                  </div>
                </motion.div>
              ))}
            </div>
          )}

          {/* Key Daily Metrics */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <StatCard 
              title="Today's Revenue" 
              todayValue={`Rs. ${todayRevenue.toLocaleString()}`}
              lifetimeValue={`Rs. ${lifetimeRevenue.toLocaleString()}`}
              icon={IndianRupee} 
            />
            <StatCard 
              title="Today's Profit" 
              todayValue={`Rs. ${todayProfit.toLocaleString()}`}
              lifetimeValue={`Rs. ${lifetimeProfit.toLocaleString()}`}
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
              todayValue={`Rs. ${todayExpensesAmount.toLocaleString()}`}
              lifetimeValue={`Rs. ${lifetimeExpensesAmount.toLocaleString()}`}
              icon={IndianRupee} 
            />
          </div>

          {/* Low Stock Alerts */}
          <motion.div
            variants={itemVariants}
            className="glass-card p-5 flex flex-col min-h-[300px] mt-6 relative overflow-hidden"
            style={{ border: '1px solid rgba(207,102,121,0.1)' }}
          >
            <div className="absolute top-0 right-0 w-[500px] h-[500px] rounded-full blur-[100px] pointer-events-none" style={{ background: 'rgba(207,102,121,0.02)' }}></div>
            
            <div className="flex justify-between items-center mb-5 shrink-0 pb-4 relative z-10" style={{ borderBottom: '1px solid rgba(212,175,55,0.06)' }}>
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-xl" style={{ background: 'rgba(207,102,121,0.08)', border: '1px solid rgba(207,102,121,0.15)' }}>
                  <AlertTriangle className="w-4 h-4" style={{ color: '#CF6679' }} />
                </div>
                <h3
                  className="text-xl font-light tracking-tight text-white"
                  style={{ fontFamily: "'Cinzel', serif" }}
                >
                  Low Stock Alerts
                </h3>
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
                    <div
                      key={product.id}
                      className="flex flex-col p-4 rounded-xl backdrop-blur-md transition-all"
                      style={{
                        background: 'rgba(207,102,121,0.04)',
                        border: '1px solid rgba(207,102,121,0.1)',
                      }}
                      onMouseEnter={e => {
                        (e.currentTarget as HTMLElement).style.background = 'rgba(207,102,121,0.06)';
                        (e.currentTarget as HTMLElement).style.borderColor = 'rgba(207,102,121,0.2)';
                      }}
                      onMouseLeave={e => {
                        (e.currentTarget as HTMLElement).style.background = 'rgba(207,102,121,0.04)';
                        (e.currentTarget as HTMLElement).style.borderColor = 'rgba(207,102,121,0.1)';
                      }}
                    >
                      <p className="text-base font-medium text-white truncate">{product.name}</p>
                      <div className="flex justify-between items-end mt-4">
                        <div>
                          <p className="text-[9px] text-white/40 uppercase tracking-[0.1em] mb-1">Threshold</p>
                          <p className="text-xs font-semibold text-white/70">5</p>
                        </div>
                        <div className="text-right">
                          <p className="text-[9px] uppercase tracking-[0.1em] font-bold mb-1" style={{ color: '#CF6679' }}>Current Stock</p>
                          <p className="text-xl font-light" style={{ color: '#CF6679' }}>{product.current_stock || 0}</p>
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
