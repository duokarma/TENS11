import { createClient } from '@supabase/supabase-js'

const supabaseUrl = 
  (typeof import.meta !== 'undefined' && import.meta?.env?.VITE_SUPABASE_URL) ||
  process?.env?.VITE_SUPABASE_URL ||
  'https://fqdrgsbljplhfgjzvaoq.supabase.co';

const supabaseAnonKey = 
  (typeof import.meta !== 'undefined' && import.meta?.env?.VITE_SUPABASE_ANON_KEY) ||
  process?.env?.VITE_SUPABASE_ANON_KEY ||
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZxZHJnc2JsanBsaGZnanp2YW9xIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4MTg4MDQzNiwiZXhwIjoyMDk3NDU2NDM2fQ.QhX0v4Qc7AO2IzNwarBcbW3HjFELrL45ldB2WcFaK_Q';

if (!supabaseUrl) {
  throw new Error('Missing environment variable: VITE_SUPABASE_URL. Please check your .env file.')
}

if (!supabaseAnonKey) {
  throw new Error('Missing environment variable: VITE_SUPABASE_ANON_KEY. Please check your .env file.')
}

export const supabase = createClient(
  supabaseUrl,
  supabaseAnonKey
)