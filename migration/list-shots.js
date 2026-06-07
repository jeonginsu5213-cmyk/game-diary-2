require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function run() {
  const { data: shots } = await supabase.from('screenshots').select('id, session_id, uploader_id, game_title, created_at, url').order('created_at', { ascending: true });
  
  console.log('Total remaining shots:', shots.length);

  // 세션별로 모아서 출력
  const sessionGroups = {};
  shots.forEach(s => {
    if (!sessionGroups[s.session_id]) sessionGroups[s.session_id] = [];
    sessionGroups[s.session_id].push(s);
  });

  for (const [sid, items] of Object.entries(sessionGroups)) {
    console.log(`\nSession: ${sid}`);
    items.forEach(item => {
      console.log(`  - [${item.created_at}] Game: ${item.game_title}, Uploader: ${item.uploader_id}, ID: ${item.id}`);
    });
  }
}
run();
