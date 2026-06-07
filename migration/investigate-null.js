require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function run() {
  const { data: shots } = await supabase.from('screenshots').select('id, game_title, url');
  console.log('Total shots in DB:', shots.length);
  shots.forEach(s => {
    if(s.game_title === null || s.game_title === undefined) {
        console.log(`[NULL TITLE] ID: ${s.id}`);
    } else if (s.game_title === 'null') {
        console.log(`[STRING "null" TITLE] ID: ${s.id}`);
    }
  });
}
run();
