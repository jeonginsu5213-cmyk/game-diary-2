require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function checkData() {
  const { data, error } = await supabase
    .from('sessions')
    .select('id, title, start_time')
    .limit(5);

  if (error) {
    console.error('❌ 데이터 조회 실패:', error.message);
  } else {
    console.log('✅ 최신 세션 데이터 (최대 5개):');
    console.table(data);
  }
}

checkData();
