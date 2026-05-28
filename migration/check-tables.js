require('dotenv').config();
const axios = require('axios');

async function check() {
  console.log('🔍 Supabase API에서 공개된 테이블 목록을 확인합니다...');
  try {
    const response = await axios.get(`${process.env.SUPABASE_URL}/rest/v1/`, {
      headers: {
        'apikey': process.env.SUPABASE_SERVICE_ROLE_KEY,
        'Authorization': `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY}`
      }
    });
    
    const tables = response.data.definitions ? Object.keys(response.data.definitions) : [];
    if (tables.length === 0) {
      console.log('⚠️ 공개된 테이블이 하나도 없습니다. SQL이 제대로 실행되지 않았거나 스키마 캐시 문제일 수 있습니다.');
    } else {
      console.log('✅ 발견된 테이블:', tables.join(', '));
    }
  } catch (error) {
    console.error('❌ API 요청 실패:', error.message);
  }
}

check();
