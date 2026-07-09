const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');

const repos = ['TENS11', 'WOW/WOW-Salon-Admin', 'VJ-hair-salon'];

async function run() {
  for (const repo of repos) {
    const env = fs.readFileSync('c:/$$$/' + repo + '/.env', 'utf-8');
    const url = env.match(/VITE_SUPABASE_URL=(.*)/)[1].trim();
    const anon = env.match(/VITE_SUPABASE_ANON_KEY=(.*)/)[1].trim();
    const supabase = createClient(url, anon);

    console.log('Processing', repo);
    
    // Also, we want to fix Khyati directly if we can't find her via 'is null'
    // First let's update everything that is null to its created_at date
    let { data } = await supabase.from('customers').select('id, created_at').is('updated_at', null);
    if(data) {
      console.log('Updating', data.length, 'records for', repo, 'to created_at');
      for (const row of data) {
        await supabase.from('customers').update({ updated_at: row.created_at }).eq('id', row.id);
      }
    }
    
    // Now, find Khyati explicitly and set her updated_at to NOW
    let { data: khyatiData } = await supabase.from('customers').select('id, name, updated_at, created_at').ilike('name', '%khyat%');
    if(khyatiData && khyatiData.length > 0) {
      console.log('Found Khyati in', repo);
      for (const k of khyatiData) {
        await supabase.from('customers').update({ updated_at: new Date().toISOString() }).eq('id', k.id);
        console.log('Updated Khyati to current time!');
      }
    }
  }
  console.log('Done!');
}
run();
