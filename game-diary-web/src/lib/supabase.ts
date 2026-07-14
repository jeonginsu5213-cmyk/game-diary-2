import { createClient } from '@supabase/supabase-js';
import { getSession } from 'next-auth/react';

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

// Custom fetch wrapper to automatically inject user ID and HMAC signature headers on the client side
const customFetch = async (input: RequestInfo | URL, init?: RequestInit) => {
  if (typeof window !== 'undefined') {
    try {
      const session: any = await getSession();
      if (session?.user?.id && session?.user?.signature) {
        init = init || {};
        const headers = new Headers(init.headers);
        headers.set('x-user-id', session.user.id);
        headers.set('x-signature', session.user.signature);
        init.headers = headers;
      }
    } catch (e) {
      console.error("Error retrieving session in customFetch:", e);
    }
  }
  return fetch(input, init);
};

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  global: {
    fetch: customFetch,
  },
});

export const supabaseService = typeof window === 'undefined'
  ? createClient(supabaseUrl, process.env.SUPABASE_SERVICE_ROLE_KEY || '')
  : null as any;
