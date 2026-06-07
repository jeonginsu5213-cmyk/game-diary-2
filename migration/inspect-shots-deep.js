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
    // URL 대신 생성 시간, 세션, 작성자, 코멘트 등을 조합하여 중복 체크
    const timeApprox = new Date(s.created_at).getTime() / 1000; // 초 단위까지
    const timeRounded = Math.floor(timeApprox / 10) * 10; // 10초 단위로 그룹화
    const key = `${s.session_id}-${s.uploader_id}-${s.game_title}-${timeRounded}`;
    
    if (!groups[key]) groups[key] = [];
    groups[key].push(s);
  });

  const dups = [];
  Object.entries(groups).forEach(([key, items]) => {
    if (items.length > 1) {
      console.log(`\nDuplicate group found for key: ${key}`);
      items.forEach(item => {
        console.log(`  - ID: ${item.id}, URL: ${item.url.substring(0, 70)}...`);
      });
      // 첫 번째 항목은 남기고 나머지는 삭제 리스트에 추가
      for (let i = 1; i < items.length; i++) {
        dups.push(items[i].id);
      }
    }
  });
  
  if (dups.length > 0) {
    console.log(`\n🗑️ Deleting ${dups.length} duplicate screenshots...`);
    await supabase.from('screenshots').delete().in('id', dups);
    console.log('✅ Done.');
  } else {
    console.log('✅ No duplicates found.');
  }
}

run();
