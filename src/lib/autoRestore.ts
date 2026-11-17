import { supabase } from './supabase';

export async function runAutoRestores() {
  if (typeof window === 'undefined') return;

  // Restore Shridha Padwal: ₹700 on 16 Nov 2026
  if (!localStorage.getItem('shridha_restored_700_v1')) {
    try {
      // 1. Find Shridha by phone 9265361956 or name
      let { data: cust } = await supabase
        .from('customers')
        .select('*')
        .eq('phone', '9265361956')
        .maybeSingle();

      if (!cust) {
        const { data: byName } = await supabase
          .from('customers')
          .select('*')
          .ilike('name', '%Shridha%')
          .maybeSingle();
        cust = byName;
      }

      if (cust) {
        // Check for any visit for her
        const { data: visits } = await supabase
          .from('customer_visits')
          .select('*')
          .eq('customer_id', cust.id);

        const deletedVisit = visits?.find((v: any) => v.is_deleted);
        const activeVisit = visits?.find((v: any) => !v.is_deleted && Number(v.grand_total) === 700);

        let visitId: string | undefined;

        if (activeVisit) {
          visitId = activeVisit.id;
          await supabase
            .from('customer_visits')
            .update({ visit_date: '2026-11-16T14:00:00Z' })
            .eq('id', visitId);
        } else if (deletedVisit) {
          await supabase
            .from('customer_visits')
            .update({
              is_deleted: false,
              visit_date: '2026-11-16T14:00:00Z',
              service_total: 700,
              product_total: 0,
              original_total: 700,
              grand_total: 700,
              discount_amount: 0,
              payment_method: 'Cash'
            })
            .eq('id', deletedVisit.id);
          visitId = deletedVisit.id;
        } else {
          const { data: newV } = await supabase
            .from('customer_visits')
            .insert([{
              customer_id: cust.id,
              visit_date: '2026-11-16T14:00:00Z',
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
          if (newV) visitId = newV.id;
        }

        // Add service record if missing
        if (visitId) {
          const { data: svcs } = await supabase
            .from('visit_services')
            .select('id')
            .eq('visit_id', visitId);

          if (!svcs || svcs.length === 0) {
            await supabase.from('visit_services').insert([{
              visit_id: visitId,
              service_name: 'Salon Service',
              price: 700
            }]);
          }
        }

        // Update customer amount_paid to 700
        await supabase
          .from('customers')
          .update({
            amount_paid: 700,
            updated_at: new Date().toISOString()
          })
          .eq('id', cust.id);

        localStorage.setItem('shridha_restored_700_v1', 'true');
        console.log('✅ Successfully restored Shridha Padwal (₹700, 16 Nov 2026)');
      }
    } catch (err) {
      console.error('Error in runAutoRestores:', err);
    }
  }
}
