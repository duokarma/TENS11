import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Search, AlertTriangle, CheckCircle, Save, Database, ShieldAlert } from 'lucide-react';
import { supabase } from '../lib/supabase';
import toast from 'react-hot-toast';

interface AuditModalProps {
  isOpen: boolean;
  onClose: () => void;
  onComplete: () => void;
}

interface AuditRecord {
  id: string;
  visit_date: string;
  customerName: string;
  customerPhone: string;
  oldOriginalTotal: number;
  newOriginalTotal: number;
  oldGrandTotal: number;
  newGrandTotal: number;
  status: 'pending' | 'fixed' | 'error';
  errorMsg?: string;
}

export default function AuditModal({ isOpen, onClose, onComplete }: AuditModalProps) {
  const [isAuditing, setIsAuditing] = useState(false);
  const [isFixing, setIsFixing] = useState(false);
  const [records, setRecords] = useState<AuditRecord[]>([]);
  const [auditComplete, setAuditComplete] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setRecords([]);
      setAuditComplete(false);
    }
  }, [isOpen]);

  const runAudit = async () => {
    setIsAuditing(true);
    setRecords([]);
    setAuditComplete(false);

    try {
      const { data: visits, error } = await supabase
        .from('customer_visits')
        .select(`
          id,
          visit_date,
          original_total,
          grand_total,
          discount_amount,
          customer_id,
          customer:customer_id (name, phone),
          visit_services(price),
          visit_products(quantity, price)
        `)
        .eq('is_deleted', false);

      if (error) throw error;

      const mismatched: AuditRecord[] = [];

      for (const visit of visits || []) {
        let trueServiceTotal = 0;
        if (visit.visit_services) {
          visit.visit_services.forEach((vs: any) => {
            trueServiceTotal += Number(vs.price || 0);
          });
        }

        let trueProductTotal = 0;
        if (visit.visit_products) {
          visit.visit_products.forEach((vp: any) => {
            trueProductTotal += Number(vp.quantity || 1) * Number(vp.price || 0);
          });
        }

        const trueOriginalTotal = trueServiceTotal + trueProductTotal;
        const oldOriginalTotal = Number(visit.original_total || 0);
        const oldGrandTotal = Number(visit.grand_total || 0);
        const oldDiscountAmount = Number(visit.discount_amount || 0);

        // Calculate expected grand total based on the true original total minus any recorded discount
        const expectedGrandTotal = trueOriginalTotal - oldDiscountAmount;

        // If there's a discrepancy, flag it
        if (
          Math.abs(oldOriginalTotal - trueOriginalTotal) > 0.01 ||
          Math.abs(oldGrandTotal - expectedGrandTotal) > 0.01
        ) {
          mismatched.push({
            id: visit.id,
            visit_date: visit.visit_date,
            customerName: visit.customer?.name || 'Unknown',
            customerPhone: visit.customer?.phone || 'Unknown',
            oldOriginalTotal,
            newOriginalTotal: trueOriginalTotal,
            oldGrandTotal,
            newGrandTotal: expectedGrandTotal,
            status: 'pending'
          });
        }
      }

      setRecords(mismatched);
      setAuditComplete(true);
      if (mismatched.length === 0) {
        toast.success("Audit complete! No mismatched invoices found.", {
          style: { background: 'var(--gold)', color: '#0A0A0A', fontWeight: 'bold' }
        });
      } else {
        toast('Audit complete. Found mismatches.', { icon: '⚠️' });
      }

    } catch (err: any) {
      console.error(err);
      toast.error(err.message || 'Failed to run audit');
    } finally {
      setIsAuditing(false);
    }
  };

  const fixAll = async () => {
    if (!window.confirm(`Are you sure you want to repair ${records.length} invoices? This action cannot be undone.`)) return;
    
    setIsFixing(true);
    let successCount = 0;

    for (let i = 0; i < records.length; i++) {
      const rec = records[i];
      if (rec.status === 'fixed') continue;

      try {
        // Update visit totals
        const { error: visitErr } = await supabase
          .from('customer_visits')
          .update({
            original_total: rec.newOriginalTotal,
            grand_total: rec.newGrandTotal
          })
          .eq('id', rec.id);
        
        if (visitErr) throw visitErr;

        const updatedRecords = [...records];
        updatedRecords[i].status = 'fixed';
        setRecords(updatedRecords);
        successCount++;
      } catch (err: any) {
        const updatedRecords = [...records];
        updatedRecords[i].status = 'error';
        updatedRecords[i].errorMsg = err.message;
        setRecords(updatedRecords);
      }
    }

    setIsFixing(false);
    toast.success(`Successfully repaired ${successCount} invoices.`);
    if (successCount === records.length) {
      setTimeout(() => {
        onComplete();
        onClose();
      }, 1500);
    }
  };

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="absolute inset-0 bg-black/60 backdrop-blur-sm"
          onClick={onClose}
        />
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 20 }}
          className="relative w-full max-w-5xl rounded-3xl overflow-hidden flex flex-col max-h-[90vh]"
          style={{
            background: 'rgba(17,17,17,0.95)',
            border: '1px solid rgba(200, 157, 60,0.15)',
            boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5), 0 0 30px rgba(200, 157, 60,0.05)'
          }}
        >
          {/* Header */}
          <div className="flex items-center justify-between p-6 border-b border-white/5 bg-white/[0.02]">
            <div className="flex items-center gap-4">
              <div className="p-3 bg-[var(--gold)]/10 rounded-xl border border-[var(--gold)]/20">
                <Database className="w-6 h-6 text-[var(--gold)]" />
              </div>
              <div>
                <h2 className="text-xl font-light text-white tracking-wide">Historical Data Audit</h2>
                <p className="text-xs text-white/40 tracking-wider uppercase mt-1">Scan & Repair System Discrepancies</p>
              </div>
            </div>
            <button onClick={onClose} className="p-2 rounded-xl hover:bg-white/5 transition-colors text-white/40 hover:text-white">
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Content */}
          <div className="p-6 flex-1 overflow-y-auto">
            <div className="mb-6 p-4 rounded-xl border border-[var(--gold)]/20 bg-[var(--gold)]/5 flex gap-4">
              <ShieldAlert className="w-6 h-6 text-[var(--gold)] shrink-0" />
              <div>
                <h3 className="text-sm font-semibold text-[var(--gold)] mb-1">System-Wide Consistency Check</h3>
                <p className="text-xs text-white/60 leading-relaxed">
                  This tool scans all historical invoices to ensure the final database <code className="bg-black/50 px-1 rounded">grand_total</code> perfectly matches the sum of the original line items minus any applied discounts. If discrepancies are found (e.g. PDF reads ₹340 but Dashboard reads ₹338), you can repair them here.
                </p>
              </div>
            </div>

            {!auditComplete && !isAuditing && (
              <div className="flex flex-col items-center justify-center py-20 text-center">
                <Search className="w-12 h-12 text-white/20 mb-4" />
                <h3 className="text-lg text-white mb-2 font-light tracking-wide">Ready to Scan Database</h3>
                <p className="text-sm text-white/40 mb-6">Click the button below to analyze all records.</p>
                <button
                  onClick={runAudit}
                  className="btn-primary flex items-center px-8 py-3"
                  style={{ background: 'var(--gold)', color: '#0A0A0A' }}
                >
                  <Search className="w-4 h-4 mr-2" />
                  Run Full Database Audit
                </button>
              </div>
            )}

            {isAuditing && (
              <div className="flex flex-col items-center justify-center py-20">
                <div className="w-12 h-12 border-4 border-[var(--gold)]/30 border-t-[var(--gold)] rounded-full animate-spin mb-4" />
                <h3 className="text-white tracking-wide animate-pulse">Scanning Historical Records...</h3>
              </div>
            )}

            {auditComplete && (
              <div className="space-y-4">
                <div className="flex justify-between items-center mb-2">
                  <h3 className="text-lg font-light text-white">
                    {records.length > 0 ? (
                      <span className="text-rose-400">Found {records.length} Discrepanc{records.length === 1 ? 'y' : 'ies'}</span>
                    ) : (
                      <span className="text-emerald-400">All Records 100% Consistent</span>
                    )}
                  </h3>
                  {records.length > 0 && (
                    <button
                      onClick={fixAll}
                      disabled={isFixing || records.every(r => r.status === 'fixed')}
                      className="btn-primary flex items-center bg-rose-500/20 hover:bg-rose-500/30 text-rose-300 border-rose-500/30"
                    >
                      {isFixing ? (
                        <div className="w-4 h-4 border-2 border-rose-300/30 border-t-rose-300 rounded-full animate-spin mr-2" />
                      ) : (
                        <Save className="w-4 h-4 mr-2" />
                      )}
                      Fix All Records
                    </button>
                  )}
                </div>

                {records.length > 0 && (
                  <div className="overflow-x-auto rounded-2xl border border-white/10">
                    <table className="w-full text-left border-collapse">
                      <thead>
                        <tr className="border-b border-white/10 bg-white/5 text-[10px] uppercase tracking-wider text-white/40">
                          <th className="p-4 font-semibold">Date</th>
                          <th className="p-4 font-semibold">Customer</th>
                          <th className="p-4 font-semibold">Stored Total</th>
                          <th className="p-4 font-semibold">Expected Total</th>
                          <th className="p-4 font-semibold">Status</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-white/5">
                        {records.map((rec) => (
                          <tr key={rec.id} className="hover:bg-white/[0.02]">
                            <td className="p-4 text-xs text-white/60">
                              {new Date(rec.visit_date).toLocaleDateString()}
                            </td>
                            <td className="p-4 text-sm text-white">
                              <div>{rec.customerName}</div>
                              <div className="text-[10px] text-white/30">{rec.customerPhone}</div>
                            </td>
                            <td className="p-4">
                              <span className="text-sm text-white/50 line-through mr-2">₹{rec.oldGrandTotal}</span>
                            </td>
                            <td className="p-4">
                              <span className="text-sm font-semibold text-emerald-400">₹{rec.newGrandTotal}</span>
                            </td>
                            <td className="p-4">
                              {rec.status === 'pending' && <span className="px-2 py-1 rounded bg-white/10 text-white/60 text-xs">Pending</span>}
                              {rec.status === 'fixed' && <span className="px-2 py-1 rounded bg-emerald-500/20 text-emerald-400 text-xs flex items-center w-max"><CheckCircle className="w-3 h-3 mr-1" /> Fixed</span>}
                              {rec.status === 'error' && <span className="px-2 py-1 rounded bg-rose-500/20 text-rose-400 text-xs">{rec.errorMsg}</span>}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            )}
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
