import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { format, startOfMonth, endOfMonth, eachDayOfInterval, isSameDay, addMonths, subMonths } from 'date-fns';
import { ChevronLeft, ChevronRight, IndianRupee, Users, Package } from 'lucide-react';

export default function CalendarView() {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [visits, setVisits] = useState<any[]>([]);

  const fetchVisits = async () => {
    const { data, error } = await supabase.from('customer_visits').select(`
      *,
      customer:customer_id(name),
      staff:staff_id(name),
      visit_services(*),
      visit_products(*)
    `);
    if (!error && data) {
      setVisits(data);
    } else if (error) {
      console.error("Error fetching visits:", error);
    }
  };

  useEffect(() => {
    fetchVisits();
    
    const channel = supabase
      .channel('calendar-updates')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'customer_visits' }, fetchVisits)
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const monthStart = startOfMonth(currentDate);
  const monthEnd = endOfMonth(monthStart);
  
  const startDay = monthStart.getDay();
  const paddingDays = Array.from({ length: startDay }).fill(null);
  const daysInMonth = eachDayOfInterval({ start: monthStart, end: monthEnd });

  const nextMonth = () => setCurrentDate(addMonths(currentDate, 1));
  const prevMonth = () => setCurrentDate(subMonths(currentDate, 1));

  // Get visits for selected date
  const selectedDateVisits = visits.filter(v => v.visit_date && isSameDay(new Date(v.visit_date), selectedDate));
  const totalRevenue = selectedDateVisits.reduce((sum, v) => sum + (Number(v.grand_total) || 0), 0);
  const totalCustomers = selectedDateVisits.length;

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      <div>
        <h2 className="text-4xl font-light tracking-tight text-white">Customer Visit Calendar</h2>
        <p className="text-white/50 mt-2 font-light tracking-wide">View past visits and daily revenue.</p>
      </div>

      <div className="grid lg:grid-cols-3 gap-6 h-[calc(100vh-140px)] min-h-[600px]">
        {/* Calendar Grid */}
        <div className="lg:col-span-2 glass-card p-6 flex flex-col">
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-2xl font-light tracking-tight text-white">{format(currentDate, 'MMMM yyyy')}</h3>
            <div className="flex gap-2">
              <button onClick={prevMonth} className="p-2 rounded-full hover:bg-black/40/5 text-white/50 hover:text-white border border-transparent transition-colors"><ChevronLeft className="w-5 h-5"/></button>
              <button onClick={nextMonth} className="p-2 rounded-full hover:bg-black/40/5 text-white/50 hover:text-white border border-transparent transition-colors"><ChevronRight className="w-5 h-5"/></button>
            </div>
          </div>
          
          <div className="grid grid-cols-7 gap-2 text-center text-sm font-bold tracking-widest text-white/30 uppercase mb-4">
            <div>Su</div><div>Mo</div><div>Tu</div><div>We</div><div>Th</div><div>Fr</div><div>Sa</div>
          </div>
          
          <div className="grid grid-cols-7 gap-2 flex-1">
            {paddingDays.map((_, i) => (
              <div key={`pad-${i}`} className="rounded-xl bg-black/40/5 border border-transparent opacity-50"></div>
            ))}
            {daysInMonth.map((day, i) => {
              const dayVisits = visits.filter(v => v.visit_date && isSameDay(new Date(v.visit_date), day));
              const dayRevenue = dayVisits.reduce((sum, v) => sum + (Number(v.grand_total) || 0), 0);
              const isSelected = isSameDay(day, selectedDate);
              
              return (
                <div 
                  key={i} 
                  onClick={() => setSelectedDate(day)}
                  className={`rounded-xl border p-2 flex flex-col cursor-pointer transition-all duration-300 ${isSelected ? 'bg-white/10 border-white text-white shadow-[0_0_20px_rgba(255,255,255,0.1)] scale-[1.05]' : 'bg-black/40 border-white/10 hover:border-white/30 hover:bg-white/5'}`}
                >
                  <span className={`text-sm font-bold mb-1 ${isSelected ? 'text-white' : 'text-white/70'}`}>{format(day, 'd')}</span>
                  {dayVisits.length > 0 && (
                    <div className="text-xs space-y-1 mt-auto">
                      <div className={`font-semibold flex items-center ${isSelected ? 'text-green-400' : 'text-success'}`}>
                         ₹{dayRevenue.toLocaleString()}
                      </div>
                      <div className={`flex items-center ${isSelected ? 'text-white/90' : 'text-white/50'}`}>
                        <Users className="w-3 h-3 mr-1"/> {dayVisits.length}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Selected Date Details */}
        <div className="glass-card p-6 flex flex-col h-full overflow-hidden">
          <h3 className="text-xl font-light tracking-wide text-white mb-6 border-b border-white/10 pb-4">
            {format(selectedDate, 'dd MMMM yyyy')}
          </h3>
          
          <div className="grid grid-cols-2 gap-4 mb-6 shrink-0">
            <div className="bg-black/40/5 p-5 rounded-2xl border border-white/10">
              <p className="text-xs font-bold uppercase tracking-widest text-white/50 mb-2">Customers</p>
              <p className="text-3xl font-light text-white">{totalCustomers}</p>
            </div>
            <div className="bg-black/40/5 p-5 rounded-2xl border border-white/10">
              <p className="text-xs font-bold uppercase tracking-widest text-white/50 mb-2">Revenue</p>
              <p className="text-3xl font-light text-success flex items-center"><IndianRupee className="w-5 h-5 mr-1"/>{totalRevenue.toLocaleString()}</p>
            </div>
          </div>

          <div className="flex-1 overflow-y-auto custom-scrollbar pr-2 space-y-4">
            {selectedDateVisits.length === 0 ? (
              <div className="text-center text-white/50 py-10 flex flex-col items-center">
                <div className="w-16 h-16 rounded-full bg-black/40/5 border border-white/10 flex items-center justify-center mb-4">
                  <Users className="w-8 h-8 text-white/20" />
                </div>
                <p className="font-light tracking-wide">No visits on this date.</p>
              </div>
            ) : (
              selectedDateVisits.map((v, i) => (
                <div key={v.id || i} className="bg-black/40/5 rounded-2xl p-5 border border-white/10 hover:border-white/30 transition-all">
                  <div className="flex justify-between items-start mb-3">
                    <h4 className="font-medium text-white text-lg">{i + 1}. {v.customer?.name || 'Walk-in'}</h4>
                    <span className="font-bold text-success text-lg tracking-tight">₹{(v.grand_total || 0).toLocaleString()}</span>
                  </div>
                  <div className="text-sm text-white/60 space-y-2">
                    {v.visit_services?.map((svc: any, idx: number) => (
                      <div key={`svc-${idx}`} className="flex justify-between items-center bg-black/20 px-3 py-2 rounded-lg border border-white/5">
                        <span className="font-light text-white">{svc.service_name}</span>
                        <span className="text-white/80 font-medium">₹{svc.price}</span>
                      </div>
                    ))}
                    {v.visit_products?.map((prod: any, idx: number) => (
                      <div key={`prod-${idx}`} className="flex justify-between items-center bg-black/20 px-3 py-2 rounded-lg border border-white/5">
                        <span className="font-light text-white flex items-center">
                          <Package className="w-4 h-4 mr-2 text-white/40" /> 
                          {prod.product_name} (x{prod.quantity})
                        </span>
                        <span className="text-white/80 font-medium">₹{prod.price}</span>
                      </div>
                    ))}
                    <div className="pt-3 mt-3 border-t border-white/10 text-xs flex justify-between">
                      <span className="text-white/40 uppercase tracking-wider font-bold">Served by</span>
                      <span className="font-medium text-white">{v.staff?.name || 'Unknown'}</span>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
