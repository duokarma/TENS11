import React, { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  FileText, Download, FileSpreadsheet, Calendar, Search, 
  Filter, CheckCircle, ChevronDown, IndianRupee, Eye, RefreshCw, FileCode, Printer, Layers
} from 'lucide-react';
import toast from 'react-hot-toast';
import { format, subMonths } from 'date-fns';
import { supabase } from '../lib/supabase';
import { 
  fetchInvoicesForPeriod, 
  processInvoices, 
  calculateReportSummary,
  generateAllInvoicesCombinedPDF,
  generateSingleInvoicePDF,
  exportInvoiceRegisterExcel,
  generateGSTR1PDF,
  exportGSTR1Excel,
  exportGSTR1JSON,
  generateGSTR3BPDF,
  exportGSTR3BExcel,
  type ProcessedInvoice,
  type GSTReportSummary,
  SALON_INFO
} from '../lib/gstReportService';

export default function Reports() {
  const [filterMode, setFilterMode] = useState<'month' | 'fy' | 'custom'>('month');
  const [selectedMonth, setSelectedMonth] = useState<string>(format(new Date(), 'yyyy-MM'));
  const [selectedFY, setSelectedFY] = useState<string>('2026-27');
  const [startDate, setStartDate] = useState<string>(format(new Date(), 'yyyy-MM-01'));
  const [endDate, setEndDate] = useState<string>(format(new Date(), 'yyyy-MM-dd'));

  const [invoices, setInvoices] = useState<ProcessedInvoice[]>([]);
  const [summary, setSummary] = useState<GSTReportSummary | null>(null);
  const [expenses, setExpenses] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [activeTab, setActiveTab] = useState<'all' | 'b2b' | 'b2c'>('all');

  // Dropdown states
  const [showGstr1Menu, setShowGstr1Menu] = useState(false);
  const [showGstr3bMenu, setShowGstr3bMenu] = useState(false);
  const [downloadingAction, setDownloadingAction] = useState<string | null>(null);

  // ── Month options (Last 24 months) ──
  const monthOptions = useMemo(() => {
    const list = [];
    const now = new Date();
    for (let i = 0; i < 24; i++) {
      const d = subMonths(now, i);
      list.push({
        value: format(d, 'yyyy-MM'),
        label: format(d, 'MMMM yyyy')
      });
    }
    return list;
  }, []);

  // ── FY options ──
  const fyOptions = [
    { value: '2026-27', label: 'FY 2026-2027 (Apr 2026 - Mar 2027)', start: '2026-04-01', end: '2027-03-31' },
    { value: '2025-26', label: 'FY 2025-2026 (Apr 2025 - Mar 2026)', start: '2025-04-01', end: '2026-03-31' }
  ];

  // ── Derived period label ──
  const periodLabel = useMemo(() => {
    if (filterMode === 'month') {
      const opt = monthOptions.find(m => m.value === selectedMonth);
      return opt ? opt.label : selectedMonth;
    }
    if (filterMode === 'fy') {
      return `Financial Year ${selectedFY}`;
    }
    return `${format(new Date(startDate), 'dd MMM yyyy')} to ${format(new Date(endDate), 'dd MMM yyyy')}`;
  }, [filterMode, selectedMonth, selectedFY, startDate, endDate, monthOptions]);

  // ── Load Report Data ──
  const loadData = async () => {
    setIsLoading(true);
    try {
      let queryOptions: { month?: string; startDate?: string; endDate?: string } = {};

      if (filterMode === 'month') {
        queryOptions.month = selectedMonth;
      } else if (filterMode === 'fy') {
        const fy = fyOptions.find(f => f.value === selectedFY);
        if (fy) {
          queryOptions.startDate = fy.start;
          queryOptions.endDate = fy.end;
        }
      } else {
        queryOptions.startDate = startDate;
        queryOptions.endDate = endDate;
      }

      const [rawVisits, expRes] = await Promise.all([
        fetchInvoicesForPeriod(queryOptions),
        supabase.from('expenses').select('*').eq('is_deleted', false)
      ]);

      const processed = processInvoices(rawVisits);
      const summ = calculateReportSummary(processed);

      setInvoices(processed);
      setSummary(summ);
      setExpenses(expRes.data || []);
    } catch (err: any) {
      console.error(err);
      toast.error(err.message || 'Failed to load report data');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [filterMode, selectedMonth, selectedFY, startDate, endDate]);

  // Filtered by Search & Tab
  const filteredInvoices = useMemo(() => {
    return invoices.filter(inv => {
      const matchesSearch = 
        inv.customerName.toLowerCase().includes(searchTerm.toLowerCase()) ||
        inv.customerPhone.includes(searchTerm) ||
        inv.invoiceNumber.toLowerCase().includes(searchTerm.toLowerCase());

      if (!matchesSearch) return false;
      if (activeTab === 'b2b') return inv.isB2B;
      if (activeTab === 'b2c') return !inv.isB2B;
      return true;
    });
  }, [invoices, searchTerm, activeTab]);

  // ── Download Handlers ──
  const handleDownloadAllCombinedPDF = async () => {
    if (!summary || invoices.length === 0) {
      toast.error('No invoices found to download');
      return;
    }
    setDownloadingAction('combined_pdf');
    const toastId = toast.loading('Generating complete consolidated PDF for all invoices...');
    try {
      await generateAllInvoicesCombinedPDF({
        invoices,
        summary,
        periodLabel
      });
      toast.success('Combined Sales Invoices PDF generated!', { id: toastId });
    } catch (err: any) {
      toast.error(err.message || 'Failed to generate PDF', { id: toastId });
    } finally {
      setDownloadingAction(null);
    }
  };

  const handleDownloadInvoiceRegister = async () => {
    if (!summary || invoices.length === 0) {
      toast.error('No invoices found to export');
      return;
    }
    setDownloadingAction('excel_register');
    const toastId = toast.loading('Generating Excel sales register...');
    try {
      await exportInvoiceRegisterExcel({
        invoices,
        summary,
        periodLabel
      });
      toast.success('Sales Register Excel exported!', { id: toastId });
    } catch (err: any) {
      toast.error(err.message || 'Export failed', { id: toastId });
    } finally {
      setDownloadingAction(null);
    }
  };

  const handleDownloadGSTR1PDF = async () => {
    if (!summary || invoices.length === 0) {
      toast.error('No invoices found');
      return;
    }
    setShowGstr1Menu(false);
    const toastId = toast.loading('Generating GSTR-1 Summary PDF...');
    try {
      await generateGSTR1PDF({ invoices, summary, periodLabel });
      toast.success('GSTR-1 PDF generated!', { id: toastId });
    } catch (err: any) {
      toast.error(err.message || 'Error generating GSTR-1 PDF', { id: toastId });
    }
  };

  const handleDownloadGSTR1Excel = async () => {
    if (!summary || invoices.length === 0) {
      toast.error('No invoices found');
      return;
    }
    setShowGstr1Menu(false);
    const toastId = toast.loading('Generating GSTR-1 Offline Excel...');
    try {
      await exportGSTR1Excel({ invoices, summary, periodLabel });
      toast.success('GSTR-1 Excel downloaded!', { id: toastId });
    } catch (err: any) {
      toast.error(err.message || 'Error generating GSTR-1 Excel', { id: toastId });
    }
  };

  const handleDownloadGSTR1JSON = () => {
    if (!summary || invoices.length === 0) {
      toast.error('No invoices found');
      return;
    }
    setShowGstr1Menu(false);
    try {
      exportGSTR1JSON({
        invoices,
        summary,
        periodLabel,
        monthStr: filterMode === 'month' ? selectedMonth : 'all'
      });
      toast.success('GSTR-1 Portal JSON downloaded!');
    } catch (err: any) {
      toast.error(err.message || 'Error generating GSTR-1 JSON');
    }
  };

  const handleDownloadGSTR3BPDF = async () => {
    if (!summary) return;
    setShowGstr3bMenu(false);
    const toastId = toast.loading('Generating GSTR-3B Summary PDF...');
    try {
      await generateGSTR3BPDF({ summary, expenses, periodLabel });
      toast.success('GSTR-3B PDF generated!', { id: toastId });
    } catch (err: any) {
      toast.error(err.message || 'Error generating GSTR-3B PDF', { id: toastId });
    }
  };

  const handleDownloadGSTR3BExcel = async () => {
    if (!summary) return;
    setShowGstr3bMenu(false);
    const toastId = toast.loading('Generating GSTR-3B Excel...');
    try {
      await exportGSTR3BExcel({ summary, expenses, periodLabel });
      toast.success('GSTR-3B Excel downloaded!', { id: toastId });
    } catch (err: any) {
      toast.error(err.message || 'Error generating GSTR-3B Excel', { id: toastId });
    }
  };

  const handleDownloadSingleInvoice = async (invoice: ProcessedInvoice) => {
    const toastId = toast.loading(`Generating Invoice ${invoice.invoiceNumber}...`);
    try {
      await generateSingleInvoicePDF(invoice);
      toast.success('Invoice downloaded!', { id: toastId });
    } catch (err: any) {
      toast.error(err.message || 'Failed to download invoice', { id: toastId });
    }
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-16">
      
      {/* ── TOP HEADER ── */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-4xl text-white tracking-tight" style={{ fontFamily: "'Cinzel', serif", fontWeight: 400 }}>
            GST Reports & Invoices
          </h2>
          <p className="mt-1 font-light text-white/50 text-sm">
            Statutory CA GST returns, Consolidated Sales Invoice books, and GSTR-1 / GSTR-3B reconciliations.
          </p>
        </div>

        {/* GSTIN Badge */}
        <div className="glass-card px-4 py-2 border border-[#D4AF37]/30 flex items-center gap-3">
          <div className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse" />
          <div>
            <div className="text-[10px] text-white/40 uppercase tracking-widest font-semibold">Registered GSTIN (Gujarat)</div>
            <div className="text-sm font-mono font-bold text-[#D4AF37] tracking-wider">{SALON_INFO.gstin}</div>
          </div>
        </div>
      </div>

      {/* ── FILTER & DATE SELECTION PANEL ── */}
      <div className="glass-card p-5 border border-white/10 rounded-2xl flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-4">
        
        {/* Mode Selector */}
        <div className="flex items-center bg-black/40 border border-white/10 rounded-xl p-1 shrink-0">
          <button
            onClick={() => setFilterMode('month')}
            className={`px-4 py-2 text-xs font-semibold rounded-lg transition-all ${filterMode === 'month' ? 'bg-[#D4AF37] text-black shadow-lg shadow-[#D4AF37]/20 font-bold' : 'text-white/60 hover:text-white'}`}
          >
            Monthly Return
          </button>
          <button
            onClick={() => setFilterMode('fy')}
            className={`px-4 py-2 text-xs font-semibold rounded-lg transition-all ${filterMode === 'fy' ? 'bg-[#D4AF37] text-black shadow-lg shadow-[#D4AF37]/20 font-bold' : 'text-white/60 hover:text-white'}`}
          >
            Financial Year
          </button>
          <button
            onClick={() => setFilterMode('custom')}
            className={`px-4 py-2 text-xs font-semibold rounded-lg transition-all ${filterMode === 'custom' ? 'bg-[#D4AF37] text-black shadow-lg shadow-[#D4AF37]/20 font-bold' : 'text-white/60 hover:text-white'}`}
          >
            Custom Range
          </button>
        </div>

        {/* Selectors based on mode */}
        <div className="flex flex-wrap items-center gap-3 flex-1">
          {filterMode === 'month' && (
            <div className="flex items-center gap-2 bg-black/50 border border-white/15 px-3 py-2 rounded-xl text-sm">
              <Calendar className="w-4 h-4 text-[#D4AF37]" />
              <select
                value={selectedMonth}
                onChange={e => setSelectedMonth(e.target.value)}
                className="bg-transparent text-white outline-none cursor-pointer pr-4"
              >
                {monthOptions.map(m => (
                  <option key={m.value} value={m.value} className="bg-[#1a1a1a] text-white">
                    {m.label}
                  </option>
                ))}
              </select>
            </div>
          )}

          {filterMode === 'fy' && (
            <div className="flex items-center gap-2 bg-black/50 border border-white/15 px-3 py-2 rounded-xl text-sm">
              <Calendar className="w-4 h-4 text-[#D4AF37]" />
              <select
                value={selectedFY}
                onChange={e => setSelectedFY(e.target.value)}
                className="bg-transparent text-white outline-none cursor-pointer pr-4"
              >
                {fyOptions.map(f => (
                  <option key={f.value} value={f.value} className="bg-[#1a1a1a] text-white">
                    {f.label}
                  </option>
                ))}
              </select>
            </div>
          )}

          {filterMode === 'custom' && (
            <div className="flex items-center gap-2 flex-wrap">
              <div className="flex items-center gap-2 bg-black/50 border border-white/15 px-3 py-1.5 rounded-xl text-sm">
                <span className="text-white/40 text-xs">From:</span>
                <input
                  type="date"
                  value={startDate}
                  onChange={e => setStartDate(e.target.value)}
                  className="bg-transparent text-white outline-none text-xs"
                />
              </div>
              <div className="flex items-center gap-2 bg-black/50 border border-white/15 px-3 py-1.5 rounded-xl text-sm">
                <span className="text-white/40 text-xs">To:</span>
                <input
                  type="date"
                  value={endDate}
                  onChange={e => setEndDate(e.target.value)}
                  className="bg-transparent text-white outline-none text-xs"
                />
              </div>
            </div>
          )}

          <button
            onClick={loadData}
            disabled={isLoading}
            className="p-2 rounded-xl bg-white/5 hover:bg-white/10 text-white/70 hover:text-white transition-colors"
            title="Refresh Data"
          >
            <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin text-[#D4AF37]' : ''}`} />
          </button>
        </div>

        {/* Period Summary Indicator */}
        <div className="text-xs text-white/50 text-right">
          Active Scope: <span className="font-semibold text-white">{periodLabel}</span>
        </div>
      </div>

      {/* ── 7 METRIC CARDS ── */}
      {summary && (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-7 gap-3">
          
          <div className="glass-card p-4 rounded-xl border border-white/10 flex flex-col justify-between">
            <span className="text-[10px] uppercase tracking-wider text-white/40 font-bold">Total Invoices</span>
            <div className="mt-2 text-2xl font-light text-white">{summary.invoiceCount}</div>
            <span className="text-[10px] text-white/40 mt-1">{summary.totalItemsCount} total items</span>
          </div>

          <div className="glass-card p-4 rounded-xl border border-white/10 flex flex-col justify-between col-span-1 sm:col-span-1 lg:col-span-2">
            <span className="text-[10px] uppercase tracking-wider text-[#D4AF37] font-bold">Taxable Sales (₹)</span>
            <div className="mt-2 text-2xl font-light text-[#D4AF37]">
              ₹{summary.taxableSales.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
            </div>
            <span className="text-[10px] text-white/40 mt-1">Excluding GST (Statutory Base)</span>
          </div>

          <div className="glass-card p-4 rounded-xl border border-white/10 flex flex-col justify-between">
            <span className="text-[10px] uppercase tracking-wider text-blue-400 font-bold">CGST (2.5%)</span>
            <div className="mt-2 text-xl font-light text-blue-300">
              ₹{summary.cgstTotal.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
            </div>
            <span className="text-[10px] text-white/40 mt-1">Central Tax</span>
          </div>

          <div className="glass-card p-4 rounded-xl border border-white/10 flex flex-col justify-between">
            <span className="text-[10px] uppercase tracking-wider text-purple-400 font-bold">SGST (2.5%)</span>
            <div className="mt-2 text-xl font-light text-purple-300">
              ₹{summary.sgstTotal.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
            </div>
            <span className="text-[10px] text-white/40 mt-1">State / UT Tax</span>
          </div>

          <div className="glass-card p-4 rounded-xl border border-white/10 flex flex-col justify-between">
            <span className="text-[10px] uppercase tracking-wider text-amber-400 font-bold">Total GST (5%)</span>
            <div className="mt-2 text-xl font-light text-amber-300">
              ₹{summary.totalGst.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
            </div>
            <span className="text-[10px] text-white/40 mt-1">CGST + SGST</span>
          </div>

          <div className="glass-card p-4 rounded-xl border border-emerald-500/20 bg-emerald-500/[0.03] flex flex-col justify-between">
            <span className="text-[10px] uppercase tracking-wider text-emerald-400 font-bold">Total Sales (₹)</span>
            <div className="mt-2 text-2xl font-light text-emerald-300">
              ₹{summary.totalSalesValue.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
            </div>
            <span className="text-[10px] text-emerald-400/60 mt-1">Gross Bill Value</span>
          </div>

        </div>
      )}

      {/* ── REPORT ACTION BUTTONS (CORE REQUIREMENT) ── */}
      <div className="glass-card p-5 border border-white/10 rounded-2xl">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h3 className="text-lg font-light text-white tracking-wide flex items-center gap-2">
              <Download className="w-5 h-5 text-[#D4AF37]" />
              Statutory Export Suite
            </h3>
            <p className="text-xs text-white/40 mt-0.5">
              Instant CA-ready compliance downloads with complete item breakdowns and zero data loss.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">

            {/* 1. HIGHEST PRIORITY: ALL INVOICES SINGLE PDF */}
            <button
              onClick={handleDownloadAllCombinedPDF}
              disabled={isLoading || downloadingAction === 'combined_pdf'}
              className="px-4 py-2.5 rounded-xl bg-gradient-to-r from-[#D4AF37] to-[#E5C158] hover:from-[#E5C158] hover:to-[#D4AF37] text-black font-bold text-xs uppercase tracking-wider shadow-lg shadow-[#D4AF37]/20 flex items-center gap-2 transition-all transform active:scale-95 disabled:opacity-50"
            >
              {downloadingAction === 'combined_pdf' ? (
                <div className="w-4 h-4 border-2 border-black border-t-transparent rounded-full animate-spin" />
              ) : (
                <Printer className="w-4 h-4 text-black" />
              )}
              Download All Invoices — Single PDF
            </button>

            {/* 2. INVOICE REGISTER EXCEL */}
            <button
              onClick={handleDownloadInvoiceRegister}
              disabled={isLoading || downloadingAction === 'excel_register'}
              className="px-4 py-2.5 rounded-xl bg-emerald-600/20 hover:bg-emerald-600/30 text-emerald-300 border border-emerald-500/30 font-semibold text-xs tracking-wide flex items-center gap-2 transition-all disabled:opacity-50"
            >
              <FileSpreadsheet className="w-4 h-4 text-emerald-400" />
              Invoice Register (Excel)
            </button>

            {/* 3. GSTR-1 MENU */}
            <div className="relative">
              <button
                onClick={() => { setShowGstr1Menu(!showGstr1Menu); setShowGstr3bMenu(false); }}
                className="px-4 py-2.5 rounded-xl bg-blue-600/20 hover:bg-blue-600/30 text-blue-300 border border-blue-500/30 font-semibold text-xs tracking-wide flex items-center gap-2 transition-all"
              >
                <FileText className="w-4 h-4 text-blue-400" />
                GSTR-1 Reports
                <ChevronDown className={`w-3.5 h-3.5 transition-transform ${showGstr1Menu ? 'rotate-180' : ''}`} />
              </button>

              {showGstr1Menu && (
                <div className="absolute right-0 mt-2 w-56 glass-card border border-white/15 rounded-xl shadow-2xl py-1.5 z-50">
                  <button
                    onClick={handleDownloadGSTR1PDF}
                    className="w-full px-4 py-2 text-xs text-left text-white/80 hover:bg-white/10 hover:text-white flex items-center gap-2"
                  >
                    <FileText className="w-4 h-4 text-blue-400" />
                    GSTR-1 Summary PDF
                  </button>
                  <button
                    onClick={handleDownloadGSTR1Excel}
                    className="w-full px-4 py-2 text-xs text-left text-white/80 hover:bg-white/10 hover:text-white flex items-center gap-2"
                  >
                    <FileSpreadsheet className="w-4 h-4 text-emerald-400" />
                    GSTR-1 Offline Excel (Tables)
                  </button>
                  <button
                    onClick={handleDownloadGSTR1JSON}
                    className="w-full px-4 py-2 text-xs text-left text-white/80 hover:bg-white/10 hover:text-white flex items-center gap-2"
                  >
                    <FileCode className="w-4 h-4 text-amber-400" />
                    GST Portal JSON (Direct Upload)
                  </button>
                </div>
              )}
            </div>

            {/* 4. GSTR-3B MENU */}
            <div className="relative">
              <button
                onClick={() => { setShowGstr3bMenu(!showGstr3bMenu); setShowGstr1Menu(false); }}
                className="px-4 py-2.5 rounded-xl bg-purple-600/20 hover:bg-purple-600/30 text-purple-300 border border-purple-500/30 font-semibold text-xs tracking-wide flex items-center gap-2 transition-all"
              >
                <Layers className="w-4 h-4 text-purple-400" />
                GSTR-3B Return
                <ChevronDown className={`w-3.5 h-3.5 transition-transform ${showGstr3bMenu ? 'rotate-180' : ''}`} />
              </button>

              {showGstr3bMenu && (
                <div className="absolute right-0 mt-2 w-52 glass-card border border-white/15 rounded-xl shadow-2xl py-1.5 z-50">
                  <button
                    onClick={handleDownloadGSTR3BPDF}
                    className="w-full px-4 py-2 text-xs text-left text-white/80 hover:bg-white/10 hover:text-white flex items-center gap-2"
                  >
                    <FileText className="w-4 h-4 text-purple-400" />
                    GSTR-3B Summary PDF
                  </button>
                  <button
                    onClick={handleDownloadGSTR3BExcel}
                    className="w-full px-4 py-2 text-xs text-left text-white/80 hover:bg-white/10 hover:text-white flex items-center gap-2"
                  >
                    <FileSpreadsheet className="w-4 h-4 text-emerald-400" />
                    GSTR-3B Table Excel
                  </button>
                </div>
              )}
            </div>

          </div>
        </div>
      </div>

      {/* ── INVOICES TABLE WITH INDIVIDUAL DOWNLOAD ACTIONS ── */}
      <div className="glass-card rounded-2xl border border-white/10 overflow-hidden">
        
        {/* Table Controls */}
        <div className="p-4 border-b border-white/10 flex flex-col sm:flex-row items-center justify-between gap-3">
          
          <div className="flex items-center gap-2">
            <span className="text-sm font-semibold text-white">Eligible Invoices ({filteredInvoices.length})</span>
            <div className="flex items-center bg-black/40 border border-white/10 rounded-lg p-0.5 ml-2">
              <button
                onClick={() => setActiveTab('all')}
                className={`px-2.5 py-1 text-xs rounded-md ${activeTab === 'all' ? 'bg-white/15 text-white font-bold' : 'text-white/40'}`}
              >
                All
              </button>
              <button
                onClick={() => setActiveTab('b2b')}
                className={`px-2.5 py-1 text-xs rounded-md ${activeTab === 'b2b' ? 'bg-white/15 text-white font-bold' : 'text-white/40'}`}
              >
                B2B ({invoices.filter(i => i.isB2B).length})
              </button>
              <button
                onClick={() => setActiveTab('b2c')}
                className={`px-2.5 py-1 text-xs rounded-md ${activeTab === 'b2c' ? 'bg-white/15 text-white font-bold' : 'text-white/40'}`}
              >
                B2C ({invoices.filter(i => !i.isB2B).length})
              </button>
            </div>
          </div>

          {/* Search Bar */}
          <div className="relative w-full sm:w-64">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-white/40" />
            <input
              type="text"
              placeholder="Search invoice or customer..."
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              className="w-full bg-black/40 border border-white/15 pl-9 pr-3 py-1.5 rounded-xl text-xs text-white placeholder-white/40 outline-none focus:border-[#D4AF37]/50"
            />
          </div>
        </div>

        {/* Table Content */}
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-white/10 bg-white/[0.02] text-[11px] font-bold uppercase tracking-wider text-white/50">
                <th className="py-3 px-4">Invoice #</th>
                <th className="py-3 px-4">Date</th>
                <th className="py-3 px-4">Customer Name</th>
                <th className="py-3 px-4">Type</th>
                <th className="py-3 px-4 text-center">Items</th>
                <th className="py-3 px-4 text-right">Taxable (₹)</th>
                <th className="py-3 px-4 text-right">CGST (₹)</th>
                <th className="py-3 px-4 text-right">SGST (₹)</th>
                <th className="py-3 px-4 text-right">Total (₹)</th>
                <th className="py-3 px-4 text-center">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5 text-xs text-white/80">
              {isLoading ? (
                <tr>
                  <td colSpan={10} className="py-12 text-center text-white/40">
                    <div className="animate-spin w-6 h-6 border-2 border-[#D4AF37] border-t-transparent rounded-full mx-auto mb-2" />
                    Loading verified invoice data...
                  </td>
                </tr>
              ) : filteredInvoices.length === 0 ? (
                <tr>
                  <td colSpan={10} className="py-12 text-center text-white/40">
                    No invoices recorded for this period.
                  </td>
                </tr>
              ) : (
                filteredInvoices.map(inv => (
                  <tr key={inv.visitId} className="hover:bg-white/[0.03] transition-colors">
                    <td className="py-3 px-4 font-mono font-medium text-[#D4AF37]">
                      {inv.invoiceNumber}
                    </td>
                    <td className="py-3 px-4 text-white/60 whitespace-nowrap">
                      {inv.formattedDate}
                    </td>
                    <td className="py-3 px-4 font-medium text-white">
                      <div>{inv.customerName}</div>
                      {inv.customerPhone && <div className="text-[10px] text-white/40">{inv.customerPhone}</div>}
                    </td>
                    <td className="py-3 px-4">
                      {inv.isB2B ? (
                        <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-blue-500/20 text-blue-300 border border-blue-500/30">
                          B2B
                        </span>
                      ) : (
                        <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-white/10 text-white/70">
                          B2C
                        </span>
                      )}
                    </td>
                    <td className="py-3 px-4 text-center">
                      <span className="px-2 py-0.5 rounded-full bg-white/5 text-white/60 text-[11px]">
                        {inv.totalQty}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-right font-mono">
                      ₹{inv.taxableAmount.toFixed(2)}
                    </td>
                    <td className="py-3 px-4 text-right font-mono text-blue-400">
                      ₹{inv.cgst.toFixed(2)}
                    </td>
                    <td className="py-3 px-4 text-right font-mono text-purple-400">
                      ₹{inv.sgst.toFixed(2)}
                    </td>
                    <td className="py-3 px-4 text-right font-mono font-bold text-emerald-400">
                      ₹{inv.grandTotal.toFixed(2)}
                    </td>
                    <td className="py-3 px-4 text-center">
                      <button
                        onClick={() => handleDownloadSingleInvoice(inv)}
                        className="px-2.5 py-1 rounded-lg bg-white/5 hover:bg-[#D4AF37]/20 hover:text-[#D4AF37] border border-white/10 text-[11px] font-medium transition-colors flex items-center gap-1 mx-auto"
                        title="Download Individual Invoice PDF"
                      >
                        <Download className="w-3 h-3" />
                        PDF
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

      </div>

    </div>
  );
}
