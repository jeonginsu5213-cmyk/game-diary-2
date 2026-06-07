require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function run() {
  console.log('🔍 5월 27일 이후 데이터 조회 중...');
  
  // 5월 27일 이후의 세션 가져오기
  const { data: sessions } = await supabase
    .from('sessions')
    .select('*, session_games(*, comments(*)), screenshots(*)')
    .gte('start_time', '2026-05-26T15:00:00Z') // UTC 기준 27일 00:00 근처
    .order('start_time', { ascending: true });

  if (!sessions || sessions.length === 0) {
    console.log('데이터를 찾을 수 없습니다.');
    return;
  }

  sessions.forEach(s => {
    console.log(`\n==============================================`);
    console.log(`📅 Session: ${s.title} (ID: ${s.id})`);
    console.log(`   Start: ${s.start_time}`);
    console.log(`   Games count: ${s.session_games.length}`);
    
    // 게임별 정보
    const gameMap = {};
    s.session_games.forEach(g => {
      const key = g.title;
      if (!gameMap[key]) gameMap[key] = [];
      gameMap[key].push(g);
    });

    Object.entries(gameMap).forEach(([title, games]) => {
      console.log(`   🎮 Game: ${title} (${games.length} entries)`);
      games.forEach(g => {
        console.log(`      - ID: ${g.id}, Start: ${g.start_time}`);
        if (g.comments.length > 0) {
          console.log(`        💬 Comments (${g.comments.length}):`);
          g.comments.forEach(c => console.log(`           - [${c.created_at}] ${c.content}`));
        }
      });
    });

    console.log(`   📸 Screenshots count: ${s.screenshots.length}`);
    const shotMap = {};
    s.screenshots.forEach(sh => {
        if (!shotMap[sh.url]) shotMap[sh.url] = [];
        shotMap[sh.url].push(sh);
    });
    Object.entries(shotMap).forEach(([url, shots]) => {
        if(shots.length > 1) {
            console.log(`      ⚠️ Duplicate URL found! count: ${shots.length}`);
        }
    });
  });
}
run();
