require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function run() {
  const { data: shots } = await supabase.from('screenshots').select('*').order('created_at', { ascending: true });
  console.log('Total shots:', shots.length);
  
  const groups = {};
  shots.forEach(s => {
    // URL에서 토큰이나 쿼리 파라미터 제외하고 순수 경로만 비교하거나, 전체 URL 비교
    const pureUrl = s.url.split('?')[0];
    const key = `${s.session_id}-${pureUrl}`;
    if (!groups[key]) groups[key] = [];
    groups[key].push(s);
  });

  Object.entries(groups).forEach(([key, items]) => {
    if (items.length > 1) {
      console.log(`\nDuplicate group found for key: ${key}`);
      items.forEach(item => {
        console.log(`  - ID: ${item.id}, URL: ${item.url.substring(0, 50)}..., CreatedAt: ${item.created_at}`);
      });
    }
  });
}

run();
