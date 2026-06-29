import React, { useState, useEffect, useMemo } from 'react';
import { supabase } from '../lib/supabase';
import {
  CalendarCheck, Plus, X, Trash2, Check, RotateCcw,
  MessageCircle, Search, Clock, User, Scissors, ChevronDown,
  CalendarDays, CheckCircle2, XCircle, Loader2
} from 'lucide-react';
import { format, isToday, isFuture, startOfMonth, endOfMonth, parseISO, isSameDay } from 'date-fns';
import toast from 'react-hot-toast';
import { serviceService } from '../lib/serviceService';
import type { SalonService } from '../lib/serviceService';

type AppointmentStatus = 'scheduled' | 'checked_in' | 'cancelled';

interface Appointment {
  id: string;
  customer_name: string;
  customer_phone: string;
  appointment_date: string;
  notes: string;
  status: AppointmentStatus;
  staff_id: string | null;
  converted_visit_id: string | null;
  staff?: { name: string } | null;
  appointment_services?: { service_id: number; service_name: string; price: number }[];
}

const statusConfig: Record<AppointmentStatus, { label: string; color: string; bg: string; border: string }> = {
  scheduled: { label: 'Scheduled', color: '#60a5fa', bg: 'rgba(96,165,250,0.1)', border: 'rgba(96,165,250,0.3)' },
  checked_in: { label: 'Checked In', color: '#34d399', bg: 'rgba(52,211,153,0.1)', border: 'rgba(52,211,153,0.3)' },
  cancelled: { label: 'Cancelled', color: '#6b7280', bg: 'rgba(107,114,128,0.08)', border: 'rgba(107,114,128,0.2)' },
};

export default function Appointments() {
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [services, setServices] = useState<SalonService[]>([]);
  const [staff, setStaff] = useState<any[]>([]);
  const [products, setProducts] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Modal state
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [repeatData, setRepeatData] = useState<Appointment | null>(null);

  // Form state
  const [form, setForm] = useState({
    customer_name: '',
    customer_phone: '',
    date: format(new Date(), 'yyyy-MM-dd'),
    time: '10:00',
    staff_id: '',
    notes: '',
  });
  const [formServices, setFormServices] = useState<{ serviceId: string }[]>([{ serviceId: '' }]);
  const [serviceSearch, setServiceSearch] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Check-in state
  const [checkingIn, setCheckingIn] = useState<string | null>(null);

  const fetchData = async () => {
    setIsLoading(true);
    try {
      const [apptRes, svcRes, stfRes, prodRes] = await Promise.all([
        supabase
          .from('appointments')
          .select('*, staff:staff_id(name), appointment_services(*)')
          .eq('is_deleted', false)
          .order('appointment_date', { ascending: true }),
        serviceService.getServices(),
        supabase.from('staff').select('*').eq('is_deleted', false),
        supabase.from('products').select('*').eq('is_deleted', false),
      ]);
      if (apptRes.data) setAppointments(apptRes.data as Appointment[]);
      setServices(svcRes);
      if (stfRes.data) setStaff(stfRes.data);
      if (prodRes.data) setProducts(prodRes.data);
    } catch (err) {
      toast.error('Failed to load appointments');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
    const channel = supabase
      .channel('appointments-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'appointments' }, fetchData)
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, []);

  // Grouped services for search
  const groupedServices = useMemo(() => {
    const q = serviceSearch.toLowerCase();
    return services.reduce((acc, svc) => {
      if (!q || svc.service_name.toLowerCase().includes(q) || (svc.category || '').toLowerCase().includes(q)) {
        const cat = svc.category || 'Other';
        if (!acc[cat]) acc[cat] = [];
        acc[cat].push(svc);
      }
      return acc;
    }, {} as Record<string, SalonService[]>);
  }, [services, serviceSearch]);

  // Stats
  const todayCount = appointments.filter(a => a.status === 'scheduled' && isToday(parseISO(a.appointment_date))).length;
  const upcomingCount = appointments.filter(a => a.status === 'scheduled' && isFuture(parseISO(a.appointment_date)) && !isToday(parseISO(a.appointment_date))).length;
  const monthStart = startOfMonth(new Date());
  const monthEnd = endOfMonth(new Date());
  const completedMonth = appointments.filter(a => {
    const d = parseISO(a.appointment_date);
    return a.status === 'checked_in' && d >= monthStart && d <= monthEnd;
  }).length;
  const cancelledCount = appointments.filter(a => a.status === 'cancelled').length;

  // Group appointments by date
  const grouped = useMemo(() => {
    const map: Record<string, Appointment[]> = {};
    [...appointments].sort((a, b) => new Date(a.appointment_date).getTime() - new Date(b.appointment_date).getTime())
      .forEach(appt => {
        const key = format(parseISO(appt.appointment_date), 'yyyy-MM-dd');
        if (!map[key]) map[key] = [];
        map[key].push(appt);
      });
    return map;
  }, [appointments]);

  const openAddModal = () => {
    setRepeatData(null);
    setForm({ customer_name: '', customer_phone: '', date: format(new Date(), 'yyyy-MM-dd'), time: '10:00', staff_id: '', notes: '' });
    setFormServices([{ serviceId: '' }]);
    setServiceSearch('');
    setIsModalOpen(true);
  };

  const openRepeatModal = (appt: Appointment) => {
    setRepeatData(appt);
    setForm({
      customer_name: appt.customer_name,
      customer_phone: appt.customer_phone,
      date: format(new Date(), 'yyyy-MM-dd'),
      time: format(parseISO(appt.appointment_date), 'HH:mm'),
      staff_id: appt.staff_id || '',
      notes: appt.notes || '',
    });
    const existingSvcs = (appt.appointment_services || []).map(s => ({ serviceId: s.service_id?.toString() || '' }));
    setFormServices(existingSvcs.length > 0 ? existingSvcs : [{ serviceId: '' }]);
    setServiceSearch('');
    setIsModalOpen(true);
  };

  const handleSubmit = async () => {
    if (!form.customer_name.trim()) { toast.error('Customer name is required'); return; }
    if (!form.date || !form.time) { toast.error('Date and time are required'); return; }
    const filledSvcs = formServices.filter(s => s.serviceId);
    setIsSubmitting(true);
    try {
      const appointmentDate = new Date(`${form.date}T${form.time}:00`);
      const { data: apptData, error: apptErr } = await supabase
        .from('appointments')
        .insert([{
          customer_name: form.customer_name.trim(),
          customer_phone: form.customer_phone.trim(),
          appointment_date: appointmentDate.toISOString(),
          notes: form.notes.trim(),
          staff_id: form.staff_id || null,
          status: 'scheduled',
        }])
        .select()
        .single();
      if (apptErr) throw apptErr;

      if (filledSvcs.length > 0) {
        const svcRows = filledSvcs.map(fs => {
          const s = services.find(x => x.id.toString() === fs.serviceId);
          return { appointment_id: apptData.id, service_id: s?.id, service_name: s?.service_name || '', price: Number(s?.price || 0) };
        });
        await supabase.from('appointment_services').insert(svcRows);
      }

      toast.success(`Appointment booked for ${form.customer_name}!`);
      setIsModalOpen(false);
      fetchData();
    } catch (err: any) {
      toast.error(err.message || 'Failed to create appointment');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCheckIn = async (appt: Appointment) => {
    setCheckingIn(appt.id);
    try {
      // 1. Find or create customer by phone
      let customerId: number | null = null;
      if (appt.customer_phone) {
        const { data: existing } = await supabase
          .from('customers')
          .select('id')
          .eq('phone', appt.customer_phone)
          .eq('is_deleted', false)
          .maybeSingle();
        if (existing) {
          customerId = existing.id;
        } else {
          const { data: newCust, error: custErr } = await supabase
            .from('customers')
            .insert([{ name: appt.customer_name, phone: appt.customer_phone }])
            .select()
            .single();
          if (custErr) throw custErr;
          customerId = newCust.id;
        }
      }

      const svcList = appt.appointment_services || [];
      const serviceTotal = svcList.reduce((sum, s) => sum + Number(s.price || 0), 0);
      const grandTotal = serviceTotal;

      const selectedStaff = staff.find(s => s.id?.toString() === appt.staff_id?.toString());
      const commissionRate = selectedStaff ? Number(selectedStaff.commission_rate || 10) : 10;
      const commissionAmount = serviceTotal * (commissionRate / 100);

      // 2. Create visit
      const { data: visitData, error: visitErr } = await supabase
        .from('customer_visits')
        .insert([{
          customer_id: customerId,
          service_total: serviceTotal,
          product_total: 0,
          grand_total: grandTotal,
          original_total: grandTotal,
          discount_amount: 0,
          staff_id: appt.staff_id,
        }])
        .select()
        .single();
      if (visitErr) throw visitErr;

      // 3. Insert visit_services
      if (svcList.length > 0) {
        await supabase.from('visit_services').insert(
          svcList.map(s => ({ visit_id: visitData.id, service_id: s.service_id, service_name: s.service_name, price: Number(s.price || 0) }))
        );
      }

      // 4. Commission
      if (appt.staff_id) {
        await supabase.from('staff_commissions').insert([{
          staff_id: appt.staff_id,
          visit_id: visitData.id,
          service_amount: serviceTotal,
          commission_amount: commissionAmount,
        }]);
      }

      // 5. Update customer amount_paid if linked
      if (customerId) {
        const { data: custData } = await supabase.from('customers').select('amount_paid, services_taken').eq('id', customerId).single();
        const existingPaid = Number(custData?.amount_paid || 0);
        const existingServices: string[] = custData?.services_taken || [];
        const newServices = Array.from(new Set([...existingServices, ...svcList.map(s => s.service_name)]));
        await supabase.from('customers').update({ amount_paid: existingPaid + grandTotal, services_taken: newServices }).eq('id', customerId);
      }

      // 6. Mark appointment checked in
      await supabase.from('appointments').update({ status: 'checked_in', converted_visit_id: visitData.id }).eq('id', appt.id);

      toast.success(`✅ Checked in! Visit recorded for ${appt.customer_name}`);
      fetchData();
    } catch (err: any) {
      toast.error(err.message || 'Check-in failed');
    } finally {
      setCheckingIn(null);
    }
  };

  const handleCancel = async (appt: Appointment) => {
    if (!window.confirm(`Cancel appointment for ${appt.customer_name}?`)) return;
    await supabase.from('appointments').update({ status: 'cancelled' }).eq('id', appt.id);
    toast.success('Appointment cancelled');
    fetchData();
  };

  const buildWhatsAppLink = (appt: Appointment) => {
    if (!appt.customer_phone) return '';
    const svcs = (appt.appointment_services || []).map(s => s.service_name).join(', ');
    const dateStr = format(parseISO(appt.appointment_date), 'dd MMM yyyy, hh:mm a');
    const staffName = appt.staff?.name || '';
    const msg = `Hello ${appt.customer_name}! 👋\n\nThis is a reminder for your appointment at TEN11 Salon:\n📅 Date: ${dateStr}\n✂️ Services: ${svcs || 'As discussed'}\n👤 Staff: ${staffName || 'Any available'}\n\nWe look forward to seeing you! 💫`;
    return `https://wa.me/${appt.customer_phone.replace(/\D/g, '')}?text=${encodeURIComponent(msg)}`;
  };

  const estimatedTotal = formServices.reduce((sum, fs) => {
    const s = services.find(x => x.id.toString() === fs.serviceId);
    return sum + Number(s?.price || 0);
  }, 0);

  return (
    <div className="space-y-8 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-4xl font-light tracking-tight text-white">Appointments</h2>
          <p className="text-white/50 mt-2 font-light tracking-wide">Manage pre-bookings and convert them to visits.</p>
        </div>
        <button onClick={openAddModal} className="btn-primary flex items-center">
          <Plus className="mr-2 h-4 w-4" /> New Appointment
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: "Today's Bookings", value: todayCount, color: '#60a5fa' },
          { label: 'Upcoming', value: upcomingCount, color: '#a78bfa' },
          { label: 'Completed (Month)', value: completedMonth, color: '#34d399' },
          { label: 'Cancelled', value: cancelledCount, color: '#6b7280' },
        ].map(stat => (
          <div key={stat.label} className="glass-card p-6">
            <p className="text-xs font-bold tracking-widest uppercase mb-3" style={{ color: stat.color }}>{stat.label}</p>
            <p className="text-4xl font-light text-white">{stat.value}</p>
          </div>
        ))}
      </div>

      {/* Appointments List */}
      {isLoading ? (
        <div className="glass-card p-16 text-center text-white/50">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-white mx-auto mb-4" />
          Loading appointments...
        </div>
      ) : Object.keys(grouped).length === 0 ? (
        <div className="glass-card p-16 text-center text-white/40">
          <CalendarCheck className="w-12 h-12 mx-auto mb-4 opacity-30" />
          <p className="font-light tracking-wide text-lg">No appointments yet.</p>
          <button onClick={openAddModal} className="btn-primary mt-6">+ New Appointment</button>
        </div>
      ) : (
        <div className="space-y-8">
          {Object.entries(grouped).map(([dateKey, appts]) => {
            const dateObj = parseISO(dateKey);
            const isDateToday = isToday(dateObj);
            return (
              <div key={dateKey}>
                <div className="flex items-center gap-3 mb-4">
                  <CalendarDays className="w-4 h-4" style={{ color: 'rgba(212,175,55,0.6)' }} />
                  <h3 className="text-sm font-bold tracking-widest uppercase" style={{ color: isDateToday ? '#D4AF37' : 'rgba(255,255,255,0.4)' }}>
                    {isDateToday ? "Today — " : ""}{format(dateObj, 'EEEE, dd MMMM yyyy')}
                  </h3>
                </div>
                <div className="space-y-3">
                  {appts.map(appt => {
                    const sc = statusConfig[appt.status];
                    const svcs = appt.appointment_services || [];
                    const total = svcs.reduce((s, x) => s + Number(x.price || 0), 0);
                    const isCheckingThisIn = checkingIn === appt.id;
                    const waLink = buildWhatsAppLink(appt);
                    return (
                      <div
                        key={appt.id}
                        className="glass-card p-5 flex flex-col md:flex-row md:items-center gap-4"
                        style={{ opacity: appt.status === 'cancelled' ? 0.55 : 1, borderColor: sc.border }}
                      >
                        {/* Time */}
                        <div className="shrink-0 w-20 text-center">
                          <Clock className="w-4 h-4 mx-auto mb-1 text-white/30" />
                          <span className="text-sm font-bold text-white">{format(parseISO(appt.appointment_date), 'hh:mm a')}</span>
                        </div>

                        {/* Info */}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-3 flex-wrap">
                            <span className="font-medium text-white text-lg">{appt.customer_name}</span>
                            <span
                              className="text-xs font-bold px-2.5 py-1 rounded-full border"
                              style={{ color: sc.color, background: sc.bg, borderColor: sc.border }}
                            >{sc.label}</span>
                          </div>
                          <div className="flex flex-wrap items-center gap-x-5 gap-y-1 mt-1.5 text-sm text-white/50">
                            {appt.customer_phone && <span className="flex items-center gap-1"><User className="w-3 h-3" />{appt.customer_phone}</span>}
                            {appt.staff?.name && <span className="flex items-center gap-1"><Scissors className="w-3 h-3" />{appt.staff.name}</span>}
                            {svcs.length > 0 && (
                              <span className="flex items-center gap-1">
                                {svcs.map(s => s.service_name).join(' · ')}
                              </span>
                            )}
                          </div>
                          {appt.notes && <p className="mt-1 text-xs text-white/35 italic">{appt.notes}</p>}
                        </div>

                        {/* Total */}
                        {total > 0 && (
                          <div className="shrink-0 text-right">
                            <p className="text-xs text-white/40 uppercase tracking-widest mb-0.5">Est. Total</p>
                            <p className="text-xl font-light text-white">₹{total.toLocaleString()}</p>
                          </div>
                        )}

                        {/* Actions */}
                        <div className="shrink-0 flex items-center gap-2 flex-wrap">
                          {appt.status === 'scheduled' && (
                            <>
                              <button
                                onClick={() => handleCheckIn(appt)}
                                disabled={isCheckingThisIn}
                                className="flex items-center gap-1.5 px-3 py-2 text-xs font-bold rounded-lg border transition-colors"
                                style={{ color: '#34d399', background: 'rgba(52,211,153,0.08)', borderColor: 'rgba(52,211,153,0.25)' }}
                              >
                                {isCheckingThisIn ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                                Check In
                              </button>
                              <button
                                onClick={() => handleCancel(appt)}
                                className="flex items-center gap-1.5 px-3 py-2 text-xs font-bold rounded-lg border border-danger/20 bg-danger/5 text-danger transition-colors hover:bg-danger/10"
                              >
                                <XCircle className="w-4 h-4" /> Cancel
                              </button>
                            </>
                          )}
                          {appt.status === 'checked_in' && (
                            <span className="flex items-center gap-1 text-xs text-emerald-400 font-bold">
                              <CheckCircle2 className="w-4 h-4" /> Done
                            </span>
                          )}
                          <button
                            onClick={() => openRepeatModal(appt)}
                            className="p-2 rounded-lg border border-white/10 text-white/50 hover:text-white hover:bg-white/5 transition-colors"
                            title="Repeat Booking"
                          >
                            <RotateCcw className="w-4 h-4" />
                          </button>
                          {waLink && (
                            <a
                              href={waLink}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="p-2 rounded-lg border border-[#25D366]/20 bg-[#25D366]/5 text-[#25D366] hover:bg-[#25D366]/15 transition-colors"
                              title="Send WhatsApp Reminder"
                            >
                              <MessageCircle className="w-4 h-4" />
                            </a>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* New / Repeat Appointment Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="glass-panel w-full max-w-lg flex flex-col animate-in zoom-in-95 duration-200 max-h-[90vh]">
            <div className="flex items-center justify-between p-6 border-b border-white/10 bg-black/40 rounded-t-2xl shrink-0">
              <div>
                <h3 className="text-xl font-light text-white flex items-center gap-2">
                  <CalendarCheck className="w-5 h-5 text-blue-400" />
                  {repeatData ? 'Repeat Booking' : 'New Appointment'}
                </h3>
                {repeatData && <p className="text-sm text-white/40 mt-1">Pre-filled from {repeatData.customer_name}'s last booking</p>}
              </div>
              <button onClick={() => setIsModalOpen(false)} className="p-2 hover:bg-black/5 rounded-full text-white/60 transition-colors">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 space-y-5 bg-black/60 overflow-y-auto custom-scrollbar flex-1">
              {/* Customer Info */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold tracking-widest text-white/60 uppercase mb-2">Customer Name *</label>
                  <input
                    type="text"
                    value={form.customer_name}
                    onChange={e => setForm(f => ({ ...f, customer_name: e.target.value }))}
                    className="glass-input w-full px-4 py-3"
                    placeholder="e.g. Priya Sharma"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold tracking-widest text-white/60 uppercase mb-2">Phone</label>
                  <input
                    type="tel"
                    value={form.customer_phone}
                    onChange={e => setForm(f => ({ ...f, customer_phone: e.target.value }))}
                    className="glass-input w-full px-4 py-3"
                    placeholder="9876543210"
                  />
                </div>
              </div>

              {/* Date & Time */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold tracking-widest text-white/60 uppercase mb-2">Date *</label>
                  <input
                    type="date"
                    value={form.date}
                    onChange={e => setForm(f => ({ ...f, date: e.target.value }))}
                    className="glass-input w-full px-4 py-3 bg-black/40"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold tracking-widest text-white/60 uppercase mb-2">Time *</label>
                  <input
                    type="time"
                    value={form.time}
                    onChange={e => setForm(f => ({ ...f, time: e.target.value }))}
                    className="glass-input w-full px-4 py-3 bg-black/40"
                  />
                </div>
              </div>

              {/* Staff */}
              <div>
                <label className="block text-xs font-bold tracking-widest text-white/60 uppercase mb-2">Staff Member</label>
                <select
                  value={form.staff_id}
                  onChange={e => setForm(f => ({ ...f, staff_id: e.target.value }))}
                  className="glass-input w-full px-4 py-3 appearance-none bg-black/40"
                >
                  <option value="">-- Any Staff --</option>
                  {staff.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                </select>
              </div>

              {/* Services with search */}
              <div>
                <div className="flex justify-between items-center mb-3">
                  <label className="text-xs font-bold tracking-widest text-white/60 uppercase flex items-center gap-1">
                    <Scissors className="w-3 h-3" /> Services
                  </label>
                  <button
                    type="button"
                    onClick={() => setFormServices([...formServices, { serviceId: '' }])}
                    className="text-xs font-bold text-white bg-black/5 hover:bg-black/10 border border-white/10 px-3 py-1.5 rounded-lg transition-colors"
                  >
                    + Add
                  </button>
                </div>

                {/* Search bar */}
                <div className="flex items-center bg-black/40 border border-white/10 rounded-xl px-3 py-2 mb-3 gap-2 focus-within:border-white/25 transition-colors">
                  <Search className="w-4 h-4 text-white/30 shrink-0" />
                  <input
                    type="text"
                    placeholder="Search services..."
                    value={serviceSearch}
                    onChange={e => setServiceSearch(e.target.value)}
                    className="bg-transparent outline-none text-sm text-white placeholder-white/30 flex-1"
                  />
                  {serviceSearch && (
                    <button onClick={() => setServiceSearch('')} className="text-white/30 hover:text-white transition-colors">
                      <X className="w-4 h-4" />
                    </button>
                  )}
                </div>

                <div className="space-y-2">
                  {formServices.map((fs, idx) => (
                    <div key={idx} className="flex items-center gap-2">
                      <select
                        value={fs.serviceId}
                        onChange={e => {
                          const updated = [...formServices];
                          updated[idx].serviceId = e.target.value;
                          setFormServices(updated);
                        }}
                        className="glass-input flex-1 px-4 py-3 appearance-none bg-black/40 text-sm"
                      >
                        <option value="">-- Select Service --</option>
                        {Object.entries(groupedServices).map(([cat, items]) => (
                          <optgroup key={cat} label={cat}>
                            {items.map(s => <option key={s.id} value={s.id}>{s.service_name} — ₹{s.price}</option>)}
                          </optgroup>
                        ))}
                      </select>
                      <button
                        type="button"
                        onClick={() => setFormServices(formServices.filter((_, i) => i !== idx))}
                        className="p-2.5 text-danger hover:bg-danger/20 rounded-xl bg-danger/10 border border-danger/20 shrink-0"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  ))}
                  {Object.keys(groupedServices).length === 0 && serviceSearch && (
                    <p className="text-sm text-white/30 italic text-center py-3">No services match "{serviceSearch}"</p>
                  )}
                </div>
              </div>

              {/* Notes */}
              <div>
                <label className="block text-xs font-bold tracking-widest text-white/60 uppercase mb-2">Notes (Optional)</label>
                <textarea
                  value={form.notes}
                  onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
                  className="glass-input w-full px-4 py-3 resize-none"
                  rows={2}
                  placeholder="Any special requests..."
                />
              </div>

              {/* Estimated total */}
              {estimatedTotal > 0 && (
                <div className="bg-black/20 p-4 rounded-xl border border-blue-400/20 flex justify-between items-center">
                  <span className="text-xs font-bold tracking-widest text-blue-400 uppercase">Estimated Total</span>
                  <span className="text-xl font-light text-white">₹{estimatedTotal.toLocaleString()}</span>
                </div>
              )}
            </div>

            <div className="p-6 border-t border-white/10 bg-black/40 rounded-b-2xl shrink-0 flex justify-end gap-3">
              <button type="button" onClick={() => setIsModalOpen(false)} className="btn-secondary" disabled={isSubmitting}>Cancel</button>
              <button
                type="button"
                onClick={handleSubmit}
                disabled={isSubmitting}
                className="btn-primary flex items-center gap-2 disabled:opacity-50"
              >
                {isSubmitting ? <><Loader2 className="w-4 h-4 animate-spin" /> Saving...</> : <><CalendarCheck className="w-4 h-4" /> Book Appointment</>}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
