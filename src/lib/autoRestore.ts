import { supabase } from './supabase';

export async function runAutoRestores() {
  if (typeof window === 'undefined') return;

  // Restore Shridha Padwal STRICTLY on 16 Nov 2026, never on 17 Nov
  if (!localStorage.getItem('shridha_strictly_nov16_v4')) {
    try {
      // 1. Find Shridha by phone 9265361956 or name
      const { data: custs } = await supabase
        .from('customers')
        .select('*')
        .or('phone.eq.9265361956,name.ilike.%Shridha%');

      const targetCusts = custs || [];
      if (targetCusts.length > 0) {
        // Update all matching Shridha customer records to amount_paid = 700
        for (const c of targetCusts) {
          await supabase
            .from('customers')
            .update({
              amount_paid: 700,
              is_deleted: false,
              updated_at: new Date().toISOString()
            })
            .eq('id', c.id);
        }

        const primaryCust = targetCusts[0];
        const custIds = targetCusts.map(c => c.id);

        // Fetch all visits for Shridha
        const { data: visits } = await supabase
          .from('customer_visits')
          .select('*')
          .in('customer_id', custIds);

        const allV = visits || [];

        if (allV.length > 0) {
          // Keep the first visit and explicitly set visit_date to 16 Nov 2026
          const keepId = allV[0].id;
          await supabase
            .from('customer_visits')
            .update({
              is_deleted: false,
              customer_id: primaryCust.id,
              visit_date: '2026-11-16T12:00:00Z',
              created_at: '2026-11-16T12:00:00Z',
              service_total: 700,
              product_total: 0,
              original_total: 700,
              grand_total: 700,
              discount_amount: 0,
              payment_method: 'Cash'
            })
            .eq('id', keepId);

          // Mark any extra visits as deleted so they don't appear anywhere else (especially on 17th)
          for (let i = 1; i < allV.length; i++) {
            await supabase
              .from('customer_visits')
              .update({ is_deleted: true })
              .eq('id', allV[i].id);
          }

          // Ensure service record
          const { data: svcs } = await supabase
            .from('visit_services')
            .select('id')
            .eq('visit_id', keepId);

          if (!svcs || svcs.length === 0) {
            await supabase.from('visit_services').insert([{
              visit_id: keepId,
              service_name: 'Salon Service',
              price: 700
            }]);
          }
        } else {
          // Insert fresh visit dated strictly 16 Nov 2026
          const { data: newV } = await supabase
            .from('customer_visits')
            .insert([{
              customer_id: primaryCust.id,
              visit_date: '2026-11-16T12:00:00Z',
              created_at: '2026-11-16T12:00:00Z',
              service_total: 700,
              product_total: 0,
              original_total: 700,
              grand_total: 700,
              discount_amount: 0,
              payment_method: 'Cash',
              is_deleted: false
            }])
            .select()
            .single();

          if (newV) {
            await supabase.from('visit_services').insert([{
              visit_id: newV.id,
              service_name: 'Salon Service',
              price: 700
            }]);
          }
        }

        localStorage.setItem('shridha_strictly_nov16_v4', 'true');
        console.log('✅ Shridha Padwal strictly placed on 16 Nov 2026 (₹700)');
      }
    } catch (err) {
      console.error('Error in runAutoRestores:', err);
    }
  }
}
