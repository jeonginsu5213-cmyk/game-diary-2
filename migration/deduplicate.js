require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function run() {
  console.log('🔍 중복 데이터 조사를 시작합니다...');

  // 1. 게임 중복 체크 및 삭제
  const { data: games } = await supabase.from('session_games').select('id, session_id, title, start_time');
  const gameMap = {};
  const gameDups = [];
  games.forEach(g => {
    const key = `${g.session_id}-${g.title}-${new Date(g.start_time).toISOString()}`;
    if (gameMap[key]) gameDups.push(g.id);
    else gameMap[key] = true;
  });
  
  if (gameDups.length > 0) {
    console.log(`🗑️ 게임 중복 ${gameDups.length}개 삭제 중...`);
    for (const id of gameDups) {
      await supabase.from('session_games').delete().eq('id', id);
    }
  }

  // 2. 댓글 중복 체크 및 삭제
  const { data: comments } = await supabase.from('comments').select('id, game_id, user_id, content, created_at');
  const commentMap = {};
  const commentDups = [];
  comments.forEach(c => {
    const key = `${c.game_id}-${c.user_id}-${c.content}-${new Date(c.created_at).toISOString()}`;
    if (commentMap[key]) commentDups.push(c.id);
    else commentMap[key] = true;
  });

  if (commentDups.length > 0) {
    console.log(`🗑️ 댓글 중복 ${commentDups.length}개 삭제 중...`);
    for (const id of commentDups) {
      await supabase.from('comments').delete().eq('id', id);
    }
  }

  // 3. 스크린샷 중복 체크 및 삭제
  const { data: shots } = await supabase.from('screenshots').select('id, session_id, url');
  const shotMap = {};
  const shotDups = [];
  shots.forEach(s => {
    const key = `${s.session_id}-${s.url}`;
    if (shotMap[key]) shotDups.push(s.id);
    else shotMap[key] = true;
  });

  if (shotDups.length > 0) {
    console.log(`🗑️ 스크린샷 중복 ${shotDups.length}개 삭제 중...`);
    for (const id of shotDups) {
      await supabase.from('screenshots').delete().eq('id', id);
    }
  }

  console.log('✨ 중복 제거 작업이 완료되었습니다.');
}

run();
