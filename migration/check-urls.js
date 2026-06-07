require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function run() {
  const { data: shots } = await supabase.from('screenshots').select('url');
  let fbCount = 0;
  let sbCount = 0;
  shots.forEach(s => {
    if (s.url.includes('firebasestorage')) fbCount++;
    else if (s.url.includes('supabase.co')) sbCount++;
  });
  console.log('Firebase URLs remaining:', fbCount);
  console.log('Supabase URLs remaining:', sbCount);
}
run();
