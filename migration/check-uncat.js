require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function run() {
  const { data: shots } = await supabase.from('screenshots').select('id, game_title, url');
  let uncatCount = 0;
  shots.forEach(s => {
    if (!s.game_title || s.game_title.trim() === '') {
      uncatCount++;
      console.log(`- ID: ${s.id}, game_title: "${s.game_title}"`);
    }
  });
  console.log('Total uncategorized shots:', uncatCount);
}
run();
