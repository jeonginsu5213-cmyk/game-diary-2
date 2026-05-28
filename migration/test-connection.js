require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function test() {
  console.log('🔗 Supabase 연결 테스트 중...');
  console.log('URL:', process.env.SUPABASE_URL);
  
  const { data, error } = await supabase.from('sessions').select('count', { count: 'exact', head: true });
  
  if (error) {
    console.error('❌ 연결 실패:', error.message);
    process.exit(1);
  } else {
    console.log('✅ 연결 성공! 테이블 접근 가능.');
    process.exit(0);
  }
}

test();
