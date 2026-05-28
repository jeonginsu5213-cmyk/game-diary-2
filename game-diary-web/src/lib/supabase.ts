import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';

if (typeof window !== 'undefined') {
  console.log("🔍 Supabase Config Check:");
  console.log("URL exists:", !!supabaseUrl);
  console.log("Anon Key exists:", !!supabaseAnonKey);
  
  if (!supabaseUrl || !supabaseAnonKey) {
    console.error('❌ Supabase URL or Anon Key is missing! Please check Vercel Environment Variables.');
  }
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey);
