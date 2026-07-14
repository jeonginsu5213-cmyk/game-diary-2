const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../game-diary-web/.env.local') });
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error("❌ Supabase URL or Service Role Key is missing! Check env variables.");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function setSecrets() {
  console.log("🔒 Setting up NextAuth Secret in public.private_secrets table...");
  const nextAuthSecret = process.env.NEXTAUTH_SECRET;

  if (!nextAuthSecret) {
    console.warn("⚠️ NEXTAUTH_SECRET is not set in env. Default local key will be used for local development.");
    return;
  }

  const { error } = await supabase
    .from('private_secrets')
    .upsert({
      key: 'nextauth_secret',
      value: nextAuthSecret
    });

  if (error) {
    console.error("❌ Failed to upsert nextauth_secret in private_secrets table:", error.message);
  } else {
    console.log("✅ Successfully stored nextauth_secret in private_secrets table!");
  }
}

setSecrets();
