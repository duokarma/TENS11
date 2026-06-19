import React, { useState, useEffect } from 'react';
import { customerService } from '../lib/customerService';
import type { Customer } from '../types';
import { 
  Search, Plus, User, Scissors, Receipt, Package,
  Trash2, Edit2, X, Users, UserPlus, IndianRupee, TrendingUp, Calendar as CalendarIcon,
  ChevronLeft, ChevronRight, Download, MessageCircle, Star
} from 'lucide-react';
import { generateInvoicePDF } from '../lib/pdfGenerator';
import { format, isThisMonth } from 'date-fns';
import toast from 'react-hot-toast';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { supabase } from '../lib/supabase';
import { serviceService } from '../lib/serviceService';
import type { SalonService } from '../lib/serviceService';

const customerSchema = z.object({
  name: z.string().min(2, "Name is required"),
  phone: z.string().min(10, "Valid phone number is required"),
  dobDay: z.string().optional(),
  dobMonth: z.string().optional(),
  dobYear: z.string().optional()
});
type CustomerFormData = z.infer<typeof customerSchema>;

export default function Customers() {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [page, setPage] = useState(1);
  const limit = 10;
  
  const [services, setServices] = useState<SalonService[]>([]);
  const [staff, setStaff] = useState<any[]>([]);
  const [products, setProducts] = useState<any[]>([]);
  const [stats, setStats] = useState({ totalCustomers: 0, newThisMonth: 0, totalRevenue: 0, avgSpend: 0 });

  const groupedServices = services.reduce((acc, service) => {
    const category = service.category || 'Other';
    if (!acc[category]) acc[category] = [];
    acc[category].push(service);
    return acc;
  }, {} as Record<string, typeof services>);

  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  const [searchTerm, setSearchTerm] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(searchTerm), 500);
    return () => clearTimeout(timer);
  }, [searchTerm]);

  useEffect(() => {
    setPage(1);
  }, [debouncedSearch]);
  
  // Modals state
  const [isCustomerModalOpen, setIsCustomerModalOpen] = useState(false);
  const [customerToEdit, setCustomerToEdit] = useState<Customer | null>(null);
  const [customerServices, setCustomerServices] = useState<{serviceId: string}[]>([]);
  const [customerStaffId, setCustomerStaffId] = useState<string>('');
  
  const [selectedCustomerForHistory, setSelectedCustomerForHistory] = useState<number | null>(null);
  const [selectedHistory, setSelectedHistory] = useState<any[]>([]);
  const [selectedCustomerRewards, setSelectedCustomerRewards] = useState<{points: number, membership_tier: string} | null>(null);

  const [isVisitModalOpen, setIsVisitModalOpen] = useState(false);
  const [customerForVisit, setCustomerForVisit] = useState<Customer | null>(null);

  // Visit Form State
  const [visitServices, setVisitServices] = useState<{serviceId: string}[]>([]);
  const [visitProducts, setVisitProducts] = useState<{productId: string, quantity: number}[]>([]);
  const [visitStaffId, setVisitStaffId] = useState<string>('');

  const { register, handleSubmit, reset, formState: { errors, isSubmitting } } = useForm<CustomerFormData>({
    resolver: zodResolver(customerSchema)
  });

  const loadData = async () => {
    try {
      setIsLoading(true);
      const [custData, srvData, stfRes, prodRes, statsData] = await Promise.all([
        customerService.getCustomers({ page, limit, search: debouncedSearch }),
        serviceService.getServices(),
        supabase.from('staff').select('*'),
        supabase.from('products').select('*'),
        customerService.getCustomerStats()
      ]);
      setCustomers(custData.data);
      setTotalCount(custData.count);
      setStats(statsData);
      setServices(srvData);
      if (stfRes.data) setStaff(stfRes.data);
      if (prodRes.data) setProducts(prodRes.data);
      setError(null);
    } catch (err: any) {
      setError(err.message || 'Failed to load data');
      toast.error('Failed to load data');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [page, debouncedSearch]);

  useEffect(() => {
    const fetchHistory = async () => {
      if (selectedCustomerForHistory) {
        const [{ data: historyData }, { data: rewardsData }] = await Promise.all([
          supabase
            .from('customer_visits')
            .select('*, visit_services(*), visit_products(*)')
            .eq('customer_id', selectedCustomerForHistory)
            .eq('is_deleted', false)
            .order('visit_date', { ascending: false }),
          supabase
            .from('customer_rewards')
            .select('*')
            .eq('customer_id', selectedCustomerForHistory)
            .maybeSingle()
        ]);
        setSelectedHistory(historyData || []);
        setSelectedCustomerRewards(rewardsData || { points: 0, membership_tier: 'Standard' });
      }
    };
    fetchHistory();
  }, [selectedCustomerForHistory]);

  const openAddModal = () => {
    setCustomerToEdit(null);
    setCustomerServices([]);
    setCustomerStaffId('');
    reset({ name: '', phone: '', dobDay: '', dobMonth: '', dobYear: '' });
    setIsCustomerModalOpen(true);
  };

  const openEditModal = (customer: Customer) => {
    setCustomerToEdit(customer);
    const dateObj = customer.dob ? new Date(customer.dob) : null;
    
    // Match existing services by name
    const matchedServices = customer.services_taken 
      ? customer.services_taken.map(name => {
          const s = services.find(x => x.service_name === name);
          return s ? { serviceId: s.id } : null;
        }).filter(Boolean) as {serviceId: string}[]
      : [];
    setCustomerServices(matchedServices);

    reset({
      name: customer.name,
      phone: customer.phone,
      dobDay: dateObj ? format(dateObj, 'dd') : '',
      dobMonth: dateObj ? format(dateObj, 'MM') : '',
      dobYear: dateObj ? format(dateObj, 'yyyy') : ''
    });
    setIsCustomerModalOpen(true);
  };

  const onSubmitCustomer = async (data: CustomerFormData) => {
    try {
      const parsedDob = (data.dobYear && data.dobMonth && data.dobDay) 
        ? `${data.dobYear}-${data.dobMonth}-${data.dobDay}` 
        : undefined;

      if (!customerToEdit) {
        if (customerServices.length === 0) {
          toast.error("Please select at least one service.");
          return;
        }
        if (!customerStaffId) {
          toast.error("Please select a staff member.");
          return;
        }
      }

      let serviceTotal = 0;
      const parsedServices = customerServices.map(cs => {
        const s = services.find(x => x.id.toString() === cs.serviceId.toString());
        if (s) {
          serviceTotal += Number(s.price);
          return s.service_name;
        }
        return '';
      }).filter(Boolean);

      const parsedData: any = {
        name: data.name,
        phone: data.phone,
        dob: parsedDob,
        services_taken: parsedServices,
        amountPaid: serviceTotal
      };
      
      if (!customerToEdit && customerStaffId) {
        parsedData.staff_served = [staff.find(s => s.id.toString() === customerStaffId.toString())?.name || ''];
      }

      if (customerToEdit) {
        await customerService.updateCustomer(customerToEdit.id, parsedData);
        toast.success('Customer updated successfully');
      } else {
        const newCust = await customerService.addCustomer(parsedData);
        
        // --- Create Visit & Commission automatically ---
        const selectedStaffMember = staff.find(s => s.id.toString() === customerStaffId.toString());
        const commissionRate = selectedStaffMember ? Number(selectedStaffMember.commission_rate || 10) : 10;
        const commissionAmount = serviceTotal * (commissionRate / 100);
        
        const { data: visitData, error: visitErr } = await supabase.from('customer_visits').insert([{
          customer_id: newCust.id,
          service_total: serviceTotal,
          product_total: 0,
          grand_total: serviceTotal,
          staff_id: customerStaffId
        }]).select().single();

        if (visitErr) throw visitErr;

        const vServicesData = customerServices.map(cs => {
          const s = services.find(x => x.id.toString() === cs.serviceId.toString())!;
          return { service_id: s.id, service_name: s.service_name, price: Number(s.price) };
        });

        if (vServicesData.length > 0) {
          await supabase.from('visit_services').insert(
            vServicesData.map(vs => ({ visit_id: visitData.id, ...vs }))
          );
        }

        await supabase.from('staff_commissions').insert([{
          staff_id: customerStaffId,
          visit_id: visitData.id,
          service_amount: serviceTotal,
          commission_amount: commissionAmount
        }]);

        toast.success('Customer added and visit recorded successfully!');
      }
      setIsCustomerModalOpen(false);
      loadData();
    } catch (err: any) {
      toast.error(err.message || 'Failed to save customer');
    }
  };

  const handleDelete = async (id: number) => {
    if (!window.confirm('Are you sure you want to delete this customer? This action cannot be undone.')) return;
    try {
      await customerService.deleteCustomer(id);
      toast.success('Customer deleted successfully');
      loadData();
    } catch (err: any) {
      toast.error('Failed to delete customer');
    }
  };

  // --- Record Visit Logic ---
  const openVisitModal = (customer: Customer) => {
    setCustomerForVisit(customer);
    setVisitServices([]);
    setVisitProducts([]);
    setVisitStaffId('');
    setIsVisitModalOpen(true);
  };

  const submitVisit = async () => {
    if (!customerForVisit) return;
    if (visitServices.length === 0) {
      toast.error("Please select at least one service");
      return;
    }
    if (!visitStaffId) {
      toast.error("Please select a staff member");
      return;
    }

    try {
      // Calculate totals
      let serviceTotal = 0;
      const vServicesData = visitServices.map(vs => {
        const s = services.find(x => x.id.toString() === vs.serviceId.toString())!;
        serviceTotal += Number(s.price);
        return { service_id: s.id, service_name: s.service_name, price: Number(s.price) };
      });

      let productTotal = 0;
      const vProductsData = visitProducts.map(vp => {
        const p = products.find(x => x.id.toString() === vp.productId.toString())!;
        const linePrice = Number(p.selling_price || p.sellingPrice || 0) * vp.quantity;
        productTotal += linePrice;
        return { product_id: p.id, product_name: p.name, quantity: vp.quantity, price: linePrice };
      });

      const grandTotal = serviceTotal + productTotal;
      // Calculate dynamic commission
      const selectedStaffMember = staff.find(s => s.id.toString() === visitStaffId.toString());
      const commissionRate = selectedStaffMember ? Number(selectedStaffMember.commission_rate || 10) : 10;
      const commissionAmount = serviceTotal * (commissionRate / 100);

      // Insert Visit
      const { data: visitData, error: visitErr } = await supabase.from('customer_visits').insert([{
        customer_id: customerForVisit.id,
        service_total: serviceTotal,
        product_total: productTotal,
        grand_total: grandTotal,
        staff_id: visitStaffId
      }]).select().single();

      if (visitErr) throw visitErr;

      const visitId = visitData.id;

      // Insert Visit Services
      if (vServicesData.length > 0) {
        await supabase.from('visit_services').insert(
          vServicesData.map(vs => ({ visit_id: visitId, ...vs }))
        );
      }

      // Insert Visit Products and deduct inventory
      if (vProductsData.length > 0) {
        await supabase.from('visit_products').insert(
          vProductsData.map(vp => ({ visit_id: visitId, ...vp }))
        );
        for (const vp of vProductsData) {
          const p = products.find(x => x.id === vp.product_id)!;
          const newQty = (Number(p.stock_quantity || p.stockQuantity) || 0) - vp.quantity;
          await supabase.from('products').update({ stock_quantity: newQty }).eq('id', p.id);
        }
      }

      // Insert Commission
      await supabase.from('staff_commissions').insert([{
        staff_id: visitStaffId,
        visit_id: visitId,
        service_amount: serviceTotal,
        commission_amount: commissionAmount
      }]);

      // Update Customer arrays (services_taken, staff_served)
      const currentServices = customerForVisit.services_taken || [];
      const currentStaff = customerForVisit.staff_served || [];
      const newServices = [...new Set([...currentServices, ...vServicesData.map(vs => vs.service_name)])];
      const newStaffList = [...new Set([...currentStaff, staff.find(s => s.id.toString() === visitStaffId.toString())?.name || ''])].filter(Boolean);

      await customerService.updateCustomer(customerForVisit.id, {
        services_taken: newServices,
        staff_served: newStaffList
      });

      toast.success('Visit recorded successfully!');
      setIsVisitModalOpen(false);
      loadData();
    } catch (err: any) {
      console.error(err);
      toast.error('Failed to record visit');
    }
  };

  // Derived Data (no longer filtered locally)
  const selectedCustomer = customers.find(c => c.id === selectedCustomerForHistory);

  // We can't synchronously calculate total spend across 50k customers in UI for the table.
  // The 'amount_paid' field on customer table aggregates this on save, let's use it!
  const getCustomerTotalSpend = (customer: Customer) => {
    return customer.amountPaid || 0;
  };
  
  // Similarly, visit count isn't readily available without an RPC. 
  // For now we omit or leave as 'History' button. Let's omit the generic visit count in list for performance.


  return (
    <div className="space-y-8 relative max-w-7xl mx-auto">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-4xl font-light tracking-tight text-white">Customers</h2>
          <p className="text-white/50 mt-2 font-light tracking-wide">Manage your client relationships and view their history.</p>
        </div>
        <button 
          onClick={openAddModal}
          className="btn-primary"
        >
          <Plus className="mr-2 h-4 w-4" />
          Add Customer
        </button>
      </div>

      {/* Statistics Cards */}
      <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
        <div className="glass-card p-6">
          <div className="flex items-center">
            <div className="flex-shrink-0 bg-black/40/5 p-3 rounded-2xl border border-white/20">
              <Users className="h-6 w-6 text-white" />
            </div>
            <div className="ml-5 w-0 flex-1">
              <dl>
                <dt className="text-xs font-bold tracking-[0.1em] text-white/60 uppercase">Total Customers</dt>
                <dd className="text-3xl font-light text-white mt-1">{stats.totalCustomers}</dd>
              </dl>
            </div>
          </div>
        </div>
        <div className="glass-card p-6">
          <div className="flex items-center">
            <div className="flex-shrink-0 bg-black/40/5 p-3 rounded-2xl border border-white/20">
              <UserPlus className="h-6 w-6 text-white" />
            </div>
            <div className="ml-5 w-0 flex-1">
              <dl>
                <dt className="text-xs font-bold tracking-[0.1em] text-white/60 uppercase">New This Month</dt>
                <dd className="text-3xl font-light text-white mt-1">{stats.newThisMonth}</dd>
              </dl>
            </div>
          </div>
        </div>
        <div className="glass-card p-6">
          <div className="flex items-center">
            <div className="flex-shrink-0 bg-black/40/5 p-3 rounded-2xl border border-white/20">
              <IndianRupee className="h-6 w-6 text-white" />
            </div>
            <div className="ml-5 w-0 flex-1">
              <dl>
                <dt className="text-xs font-bold tracking-[0.1em] text-white/60 uppercase">Lifetime Revenue</dt>
                <dd className="text-3xl font-light text-white mt-1">₹{stats.totalRevenue.toLocaleString()}</dd>
              </dl>
            </div>
          </div>
        </div>
        <div className="glass-card p-6">
          <div className="flex items-center">
            <div className="flex-shrink-0 bg-black/40/5 p-3 rounded-2xl border border-white/20">
              <TrendingUp className="h-6 w-6 text-white" />
            </div>
            <div className="ml-5 w-0 flex-1">
              <dl>
                <dt className="text-xs font-bold tracking-[0.1em] text-white/60 uppercase">Average Spend</dt>
                <dd className="text-3xl font-light text-white mt-1">₹{Math.round(stats.avgSpend).toLocaleString()}</dd>
              </dl>
            </div>
          </div>
        </div>
      </div>

      {/* Search Bar */}
      <div className="flex items-center w-full max-w-md glass-panel px-4 py-3 focus-within:ring-1 focus-within:ring-white/30 transition-all">
        <Search className="h-5 w-5 text-white/40 mr-3" />
        <input
          type="text"
          placeholder="Search by name or phone..."
          className="bg-transparent outline-none w-full text-sm text-white placeholder-white/40"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
        />
      </div>

      {/* Table */}
      <div className="glass-card overflow-hidden">
        {isLoading ? (
          <div className="p-12 text-center text-white/50">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-white mx-auto mb-4"></div>
            Loading customers...
          </div>
        ) : error ? (
          <div className="p-12 text-center text-danger">
            <p>{error}</p>
            <button onClick={loadData} className="mt-4 text-sm font-semibold underline text-white">Try Again</button>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left text-white">
              <thead className="bg-black/40/5 text-white/60 text-xs uppercase font-bold tracking-wider border-b border-white/10">
                <tr>
                  <th className="px-6 py-5">Customer</th>
                  <th className="px-6 py-5">Contact</th>
                  <th className="px-6 py-5">Lifetime Spend</th>
                  <th className="px-6 py-5 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {customers.length === 0 && (
                  <tr>
                    <td colSpan={4} className="text-center py-16 text-white/60">
                      <User className="h-10 w-10 mx-auto mb-4 opacity-50" />
                      <p className="text-base font-light tracking-wide text-white">No customers found</p>
                    </td>
                  </tr>
                )}
                {customers.map((customer) => {
                  const initials = customer.name.split(' ').map((n: string) => n[0]).join('').substring(0, 2).toUpperCase();
                  
                  return (
                    <tr key={customer.id} className="hover:bg-black/40 transition-colors group">
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center gap-4">
                          <div className="h-11 w-11 rounded-full bg-primary/20 border border-primary/30 flex items-center justify-center text-primary-foreground font-bold text-sm shrink-0">
                            {initials}
                          </div>
                          <div>
                            <div className="font-medium text-white text-base">{customer.name}</div>
                            {customer.dob && <div className="text-xs text-white/60 mt-1 uppercase tracking-wide">DOB: {format(new Date(customer.dob), 'dd MMM yyyy')}</div>}
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-white/60 font-light">
                        <div className="flex items-center gap-2">
                          {customer.phone}
                          {customer.phone && (
                            <a 
                              href={`https://wa.me/${customer.phone.replace(/\D/g, '')}?text=${encodeURIComponent('Hello from WOW Salon!')}`}
                              target="_blank" 
                              rel="noopener noreferrer"
                              className="text-[#25D366] hover:text-[#128C7E] transition-colors bg-[#25D366]/10 p-1.5 rounded-lg"
                              title="Message on WhatsApp"
                            >
                              <MessageCircle className="w-4 h-4" />
                            </a>
                          )}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className="font-light text-white text-lg">
                          ₹{getCustomerTotalSpend(customer).toLocaleString()}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-right whitespace-nowrap">
                        <div className="flex items-center justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                          <button 
                            onClick={() => openVisitModal(customer)}
                            className="px-4 py-2 text-xs font-bold bg-[#F7E7CE] text-[#36454F] hover:bg-[#eadebe] rounded-xl transition-colors flex items-center shadow-sm"
                          >
                            <Plus className="w-3 h-3 mr-1.5" /> Record Visit
                          </button>
                          <button onClick={() => setSelectedCustomerForHistory(customer.id)} className="p-2 text-white hover:bg-black/5 rounded-xl transition-colors">
                            <CalendarIcon className="w-4 h-4" />
                          </button>
                          <button onClick={() => openEditModal(customer)} className="p-2 text-white/60 hover:bg-black/5 hover:text-white rounded-xl transition-colors">
                            <Edit2 className="w-4 h-4" />
                          </button>
                          <button onClick={() => handleDelete(customer.id)} className="p-2 text-danger hover:bg-danger/10 rounded-xl transition-colors">
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            
            {/* Pagination Controls */}
            {totalCount > limit && (
              <div className="flex items-center justify-between px-6 py-4 border-t border-white/10 bg-black/40">
                <div className="text-sm text-white/60">
                  Showing <span className="font-medium text-white">{((page - 1) * limit) + 1}</span> to <span className="font-medium text-white">{Math.min(page * limit, totalCount)}</span> of <span className="font-medium text-white">{totalCount}</span> customers
                </div>
                <div className="flex gap-2">
                  <button 
                    onClick={() => setPage(p => Math.max(1, p - 1))}
                    disabled={page === 1}
                    className="p-2 rounded-lg border border-white/10 bg-black/40 hover:bg-white/10 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                  >
                    <ChevronLeft className="w-5 h-5 text-white" />
                  </button>
                  <button 
                    onClick={() => setPage(p => p + 1)}
                    disabled={page * limit >= totalCount}
                    className="p-2 rounded-lg border border-white/10 bg-black/40 hover:bg-white/10 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                  >
                    <ChevronRight className="w-5 h-5 text-white" />
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Add/Edit Customer Modal (No Billing) */}
      {isCustomerModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="glass-panel w-full max-w-md flex flex-col animate-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between p-6 border-b border-white/10 bg-black/40 rounded-t-2xl">
              <h3 className="text-xl font-light tracking-tight text-white">{customerToEdit ? 'Edit Customer' : 'Add New Customer'}</h3>
              <button onClick={() => setIsCustomerModalOpen(false)} className="p-2 hover:bg-black/5 rounded-full text-white/60 transition-colors">
                <X className="w-5 h-5"/>
              </button>
            </div>
            <form onSubmit={handleSubmit(onSubmitCustomer)} className="flex flex-col flex-1">
              <div className="p-6 space-y-5 bg-black/60">
                <div>
                  <label className="block text-xs font-bold tracking-widest text-white/60 uppercase mb-2">Full Name *</label>
                  <input type="text" {...register("name")} className="glass-input w-full px-4 py-3" placeholder="e.g. Jane Doe" />
                  {errors.name && <p className="text-danger text-xs mt-1.5">{errors.name.message}</p>}
                </div>
                <div>
                  <label className="block text-xs font-bold tracking-widest text-white/60 uppercase mb-2">Phone Number *</label>
                  <input type="tel" {...register("phone")} className="glass-input w-full px-4 py-3" placeholder="e.g. 9876543210" />
                  {errors.phone && <p className="text-danger text-xs mt-1.5">{errors.phone.message}</p>}
                </div>
                <div>
                  <label className="block text-xs font-bold tracking-widest text-white/60 uppercase mb-2">Date of Birth</label>
                  <div className="grid grid-cols-3 gap-3">
                    <select {...register("dobDay")} className="glass-input w-full px-4 py-3 appearance-none cursor-pointer bg-black/40">
                      <option value="" className="text-white/60">Day</option>
                      {Array.from({length: 31}, (_, i) => i + 1).map(d => (
                        <option key={d} value={d.toString().padStart(2, '0')} className="text-white">{d}</option>
                      ))}
                    </select>
                    <select {...register("dobMonth")} className="glass-input w-full px-4 py-3 appearance-none cursor-pointer bg-black/40">
                      <option value="" className="text-white/60">Month</option>
                      {Array.from({length: 12}, (_, i) => i + 1).map(m => (
                        <option key={m} value={m.toString().padStart(2, '0')} className="text-white">
                          {format(new Date(2000, m - 1, 1), 'MMM')}
                        </option>
                      ))}
                    </select>
                    <select {...register("dobYear")} className="glass-input w-full px-4 py-3 appearance-none cursor-pointer bg-black/40">
                      <option value="" className="text-white/60">Year</option>
                      {Array.from({length: 100}, (_, i) => new Date().getFullYear() - i).map(y => (
                        <option key={y} value={y} className="text-white">{y}</option>
                      ))}
                    </select>
                  </div>
                </div>
                {!customerToEdit && (
                  <div>
                    <label className="block text-xs font-bold tracking-widest text-white/60 uppercase mb-3">Select Staff Member *</label>
                    <select 
                      value={customerStaffId} 
                      onChange={(e) => setCustomerStaffId(e.target.value)}
                      className="glass-input w-full px-4 py-3.5 appearance-none mb-2 bg-black/40"
                    >
                      <option value="" className="text-white/60">-- Choose Staff --</option>
                      {staff.map(s => <option key={s.id} value={s.id} className="text-white">{s.name || s.staff_name}</option>)}
                    </select>
                  </div>
                )}
                <div>
                  <div className="flex justify-between items-center mb-3">
                    <label className="block text-xs font-bold tracking-widest text-white/60 uppercase">Services Taken</label>
                    <button type="button" onClick={() => setCustomerServices([...customerServices, {serviceId: ''}])} className="text-xs font-bold text-white bg-black/5 hover:bg-black/10 border border-white/10 px-3 py-1.5 rounded-lg transition-colors">
                      + Add Service
                    </button>
                  </div>
                  {customerServices.length === 0 ? (
                    <div className="text-sm text-white/60/60 font-light italic p-6 bg-black/5 rounded-2xl border border-dashed border-white/10 text-center">No services added. Click above to add.</div>
                  ) : (
                    <div className="space-y-3">
                      {customerServices.map((cs, idx) => (
                        <div key={idx} className="flex items-center gap-3">
                          <select 
                            value={cs.serviceId} 
                            onChange={(e) => {
                              const newSvcs = [...customerServices];
                              newSvcs[idx].serviceId = e.target.value;
                              setCustomerServices(newSvcs);
                            }}
                            className="glass-input flex-1 px-4 py-3 appearance-none bg-black/40"
                          >
                            <option value="" className="text-white/60">-- Select Service --</option>
                            {Object.entries(groupedServices).map(([category, items]) => (
                              <optgroup key={category} label={category} className="text-white/60">
                                {items.map(s => <option key={s.id} value={s.id} className="text-white">{s.service_name} - ₹{s.price}</option>)}
                              </optgroup>
                            ))}
                          </select>
                          <button type="button" onClick={() => setCustomerServices(customerServices.filter((_, i) => i !== idx))} className="p-3 text-danger hover:bg-danger/20 rounded-xl bg-danger/10 border border-danger/20 transition-colors">
                            <Trash2 className="w-5 h-5" />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                  {customerServices.length > 0 && (
                    <div className="mt-4 bg-black/5 p-4 rounded-xl border border-white/10 flex justify-between items-center">
                      <span className="text-xs font-bold tracking-widest text-white/60 uppercase">Total Amount</span>
                      <span className="text-xl font-light text-white">
                        ₹{customerServices.reduce((sum, cs) => sum + Number(services.find(s => s.id.toString() === cs.serviceId.toString())?.price || 0), 0).toLocaleString()}
                      </span>
                    </div>
                  )}
                </div>
              </div>
              <div className="p-6 border-t border-white/10 bg-black/40 rounded-b-2xl flex justify-end gap-3">
                <button type="button" onClick={() => setIsCustomerModalOpen(false)} className="btn-secondary">Cancel</button>
                <button type="submit" disabled={isSubmitting} className="btn-primary disabled:opacity-50">
                  {customerToEdit ? 'Save Changes' : 'Add Customer'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Record Visit Modal */}
      {isVisitModalOpen && customerForVisit && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="glass-panel w-full max-w-2xl flex flex-col max-h-[90vh] animate-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between p-6 border-b border-white/10 shrink-0 bg-black/40 rounded-t-2xl">
              <div>
                <h3 className="text-2xl font-light tracking-tight text-white">Record Visit</h3>
                <p className="text-sm font-light text-white/60 mt-1 tracking-wide">for {customerForVisit.name}</p>
              </div>
              <button onClick={() => setIsVisitModalOpen(false)} className="p-2 hover:bg-black/5 rounded-full text-white/60 transition-colors">
                <X className="w-6 h-6"/>
              </button>
            </div>
            
            <div className="p-6 overflow-y-auto space-y-8 flex-1 custom-scrollbar bg-black/60">
              {/* Staff Selection */}
              <div>
                <label className="block text-xs font-bold tracking-widest text-white/60 uppercase mb-3">Select Staff Member *</label>
                <select 
                  value={visitStaffId} 
                  onChange={(e) => setVisitStaffId(e.target.value)}
                  className="glass-input w-full px-4 py-3.5 appearance-none bg-black/40"
                >
                  <option value="" className="text-white/60">-- Choose Staff --</option>
                  {staff.map(s => <option key={s.id} value={s.id} className="text-white">{s.name || s.staff_name}</option>)}
                </select>
              </div>

              {/* Services Selection */}
              <div>
                <div className="flex justify-between items-center mb-3">
                  <label className="block text-xs font-bold tracking-widest text-white/60 uppercase">Services Taken *</label>
                  <button onClick={() => setVisitServices([...visitServices, {serviceId: ''}])} className="text-xs font-bold text-white bg-black/5 hover:bg-black/10 border border-white/10 px-3 py-1.5 rounded-lg transition-colors">
                    + Add Service
                  </button>
                </div>
                {visitServices.length === 0 ? (
                  <div className="text-sm text-white/60/60 font-light italic p-6 bg-black/5 rounded-2xl border border-dashed border-white/10 text-center">No services added. Click above to add.</div>
                ) : (
                  <div className="space-y-3">
                    {visitServices.map((vs, idx) => (
                      <div key={idx} className="flex items-center gap-3">
                        <select 
                          value={vs.serviceId} 
                          onChange={(e) => {
                            const newSvcs = [...visitServices];
                            newSvcs[idx].serviceId = e.target.value;
                            setVisitServices(newSvcs);
                          }}
                          className="glass-input flex-1 px-4 py-3 appearance-none bg-black/40"
                        >
                          <option value="" className="text-white/60">-- Select Service --</option>
                          {Object.entries(groupedServices).map(([category, items]) => (
                            <optgroup key={category} label={category} className="text-white/60">
                              {items.map(s => <option key={s.id} value={s.id} className="text-white">{s.service_name} - ₹{s.price}</option>)}
                            </optgroup>
                          ))}
                        </select>
                        <button onClick={() => setVisitServices(visitServices.filter((_, i) => i !== idx))} className="p-3 text-danger hover:bg-danger/20 rounded-xl bg-danger/10 border border-danger/20 transition-colors">
                          <Trash2 className="w-5 h-5" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Products Selection */}
              <div>
                <div className="flex justify-between items-center mb-3">
                  <label className="block text-xs font-bold tracking-widest text-white/60 uppercase">Products Purchased</label>
                  <button onClick={() => setVisitProducts([...visitProducts, {productId: '', quantity: 1}])} className="text-xs font-bold text-white bg-black/5 hover:bg-black/10 border border-white/10 px-3 py-1.5 rounded-lg transition-colors">
                    + Add Product
                  </button>
                </div>
                {visitProducts.length > 0 && (
                  <div className="space-y-3">
                    {visitProducts.map((vp, idx) => (
                      <div key={idx} className="flex items-center gap-3">
                        <select 
                          value={vp.productId} 
                          onChange={(e) => {
                            const newProds = [...visitProducts];
                            newProds[idx].productId = e.target.value;
                            setVisitProducts(newProds);
                          }}
                          className="glass-input flex-1 px-4 py-3 appearance-none bg-black/40"
                        >
                          <option value="" className="text-white/60">-- Select Product --</option>
                          {products.map(p => <option key={p.id} value={p.id} className="text-white">{(p.name || '').substring(0,40)} - ₹{p.selling_price || p.sellingPrice || 0}</option>)}
                        </select>
                        <input 
                          type="number" 
                          min="1" 
                          value={vp.quantity} 
                          onChange={(e) => {
                            const newProds = [...visitProducts];
                            newProds[idx].quantity = parseInt(e.target.value) || 1;
                            setVisitProducts(newProds);
                          }}
                          className="glass-input w-24 px-3 py-3 text-center bg-black/40"
                        />
                        <button onClick={() => setVisitProducts(visitProducts.filter((_, i) => i !== idx))} className="p-3 text-danger hover:bg-danger/20 rounded-xl bg-danger/10 border border-danger/20 transition-colors">
                          <Trash2 className="w-5 h-5" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
              
              {/* Summary */}
              <div className="bg-primary/10 p-6 rounded-2xl border border-primary/20 backdrop-blur-md relative overflow-hidden">
                <div className="absolute top-0 right-0 w-32 h-32 bg-primary/20 rounded-full blur-2xl"></div>
                <div className="flex justify-between items-center text-sm font-bold text-white relative z-10">
                  <span className="tracking-wide uppercase text-white/60">Grand Total</span>
                  <span className="text-3xl font-light tracking-tight">
                    ₹{
                      visitServices.reduce((sum, vs) => sum + Number(services.find(s => s.id.toString() === vs.serviceId.toString())?.price || 0), 0) +
                      visitProducts.reduce((sum, vp) => sum + (Number(products.find(p => p.id.toString() === vp.productId.toString())?.selling_price || products.find(p => p.id.toString() === vp.productId.toString())?.sellingPrice || 0) * vp.quantity), 0)
                    }
                  </span>
                </div>
              </div>
            </div>

            <div className="p-6 border-t border-white/10 bg-black/40 rounded-b-2xl flex justify-end gap-3 shrink-0">
              <button onClick={() => setIsVisitModalOpen(false)} className="btn-secondary">Cancel</button>
              <button onClick={submitVisit} className="btn-primary">Save Visit</button>
            </div>
          </div>
        </div>
      )}

      {/* View Profile History Modal */}
      {selectedCustomerForHistory && selectedCustomer && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="glass-panel w-full max-w-3xl max-h-[90vh] flex flex-col overflow-hidden animate-in zoom-in-95 duration-200">
            <div className="flex items-start justify-between p-8 border-b border-white/10 bg-black/40 shrink-0">
              <div className="flex items-center gap-6">
                <div className="h-16 w-16 rounded-full bg-primary/20 border border-primary/30 flex items-center justify-center text-primary-foreground font-bold text-xl shrink-0 shadow-sm">
                  {selectedCustomer.name.split(' ').map((n: string) => n[0]).join('').substring(0, 2).toUpperCase()}
                </div>
                <div>
                  <h3 className="text-3xl font-light tracking-tight text-white">{selectedCustomer.name}</h3>
                  {selectedCustomerRewards && (
                    <div className="flex items-center gap-2 mt-2 mb-1">
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border ${selectedCustomerRewards.membership_tier === 'Gold' ? 'bg-[#FFDF00]/10 text-[#B8860B] border-[#FFDF00]/30' : selectedCustomerRewards.membership_tier === 'Silver' ? 'bg-slate-100 text-slate-600 border-slate-200' : 'bg-primary/5 text-primary border-primary/20'}`}>
                        <Star className="w-3 h-3 mr-1" /> {selectedCustomerRewards.membership_tier} Member
                      </span>
                      <span className="text-sm font-bold text-white/60">{selectedCustomerRewards.points} pts</span>
                    </div>
                  )}
                  <div className="flex flex-wrap gap-x-6 gap-y-1 mt-1 text-sm text-white/60 tracking-wide uppercase">
                    <span className="flex items-center"><User className="w-4 h-4 mr-2"/> {selectedCustomer.phone}</span>
                    {selectedCustomer.dob && <span>DOB: {format(new Date(selectedCustomer.dob), 'dd MMM yyyy')}</span>}
                    <span>Joined {format(new Date(selectedCustomer.createdAt), 'MMM yyyy')}</span>
                  </div>
                </div>
              </div>
              <button onClick={() => setSelectedCustomerForHistory(null)} className="p-2 hover:bg-black/5 rounded-full text-white/60 transition-colors">
                <X className="w-6 h-6"/>
              </button>
            </div>
            <div className="p-8 overflow-y-auto bg-black/60 flex-1 custom-scrollbar">
              <h4 className="text-xs font-bold tracking-[0.2em] text-white/60 uppercase mb-6 flex items-center">
                <Receipt className="w-4 h-4 mr-2" /> Visit History
              </h4>
              {selectedHistory.length === 0 ? (
                <div className="text-center py-12 text-white/60/60 bg-black/5 rounded-2xl border border-dashed border-white/10">
                  <CalendarIcon className="w-12 h-12 mx-auto mb-3 opacity-50" />
                  <p className="text-base font-light tracking-wide">No past visits recorded.</p>
                </div>
              ) : (
                <div className="space-y-6">
                  {selectedHistory.map((visit: any, index) => {
                    const servicesList = visit.visit_services || [];
                    const productsList = visit.visit_products || [];
                    
                    return (
                      <div key={visit.id} className="bg-black/40 p-6 rounded-2xl border border-white/10 shadow-sm flex flex-col md:flex-row gap-6 relative overflow-hidden group">
                        <div className="absolute top-0 left-0 w-1 h-full bg-primary/40 group-hover:bg-primary transition-colors"></div>
                        <div className="shrink-0 flex flex-col justify-center w-32 border-r border-white/10 pr-6">
                          <span className="text-xs font-bold tracking-widest text-white/60 uppercase mb-1">Date</span>
                          <span className="text-lg font-light text-white">{format(new Date(visit.visit_date), 'dd MMM')}</span>
                          <span className="text-sm text-white/60">{format(new Date(visit.visit_date), 'yyyy')}</span>
                        </div>
                        <div className="flex-1 min-w-0">
                          {servicesList.length > 0 && (
                            <div className="mb-4">
                              <span className="text-xs font-bold tracking-widest text-white/60 uppercase mb-2 flex items-center">
                                <Scissors className="w-3 h-3 mr-1" /> Services
                              </span>
                              <div className="flex flex-wrap gap-2">
                                {servicesList.map((vs: any, idx: number) => (
                                  <span key={idx} className="inline-flex items-center px-3 py-1 rounded-lg text-xs font-medium bg-black/5 text-white border border-white/10">
                                    {vs.service_name}
                                  </span>
                                ))}
                              </div>
                            </div>
                          )}
                          {productsList.length > 0 && (
                            <div>
                              <span className="text-xs font-bold tracking-widest text-white/60 uppercase mb-2 flex items-center">
                                <Package className="w-3 h-3 mr-1" /> Products
                              </span>
                              <div className="flex flex-wrap gap-2">
                                {productsList.map((vp: any, idx: number) => (
                                  <span key={idx} className="inline-flex items-center px-3 py-1 rounded-lg text-xs font-medium bg-black/5 text-white border border-white/10">
                                    {vp.quantity}x {vp.product_name}
                                  </span>
                                ))}
                              </div>
                            </div>
                          )}
                        </div>
                        <div className="shrink-0 flex flex-col justify-center items-end pl-6 border-l border-white/10 min-w-[120px] gap-3">
                          <div>
                            <span className="text-xs font-bold tracking-widest text-white/60 uppercase mb-1 block text-right">Total</span>
                            <span className="text-2xl font-light text-white">₹{visit.grand_total}</span>
                          </div>
                          <button
                            onClick={() => {
                              generateInvoicePDF({
                                invoiceNumber: visit.id.substring(0, 8).toUpperCase(),
                                date: visit.visit_date,
                                customerName: selectedCustomer.name,
                                customerPhone: selectedCustomer.phone,
                                services: servicesList.map((s: any) => ({ name: s.service_name, quantity: 1, price: s.price || 0, amount: s.price || 0 })),
                                products: productsList.map((p: any) => ({ name: p.product_name, quantity: p.quantity, price: p.price || 0, amount: (p.price || 0) * p.quantity })),
                                subtotal: visit.grand_total,
                                tax: 0,
                                discount: 0,
                                grandTotal: visit.grand_total
                              });
                            }}
                            className="text-xs font-bold px-3 py-1.5 bg-black/5 hover:bg-black/10 text-white rounded-lg border border-white/10 transition-colors flex items-center"
                          >
                            <Download className="w-3 h-3 mr-1" /> Invoice
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
