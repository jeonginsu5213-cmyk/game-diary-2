require('dotenv').config();
const admin = require('firebase-admin');
const { createClient } = require('@supabase/supabase-js');

const serviceAccount = require('../game-diary-bot/serviceAccountKey.json');
if (!admin.apps.length) admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
const db = admin.firestore();

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function run() {
  console.log('🧹 기존 스크린샷 데이터 초기화...');
  await supabase.from('screenshots').delete().neq('id', '00000000-0000-0000-0000-000000000000'); // 전체 삭제
  
  console.log('📥 Firebase에서 스크린샷 원본 데이터 다시 가져오기...');
  const sessionsSnapshot = await db.collection('sessions').get();
  
  let shotsCount = 0;
  for (const doc of sessionsSnapshot.docs) {
    const data = doc.data();
    const sessionId = doc.id;
    const displayNames = data.displayNames || {};
    
    if (data.screenshots && Array.isArray(data.screenshots)) {
      for (const shot of data.screenshots) {
        const originalUid = Object.keys(displayNames).find(key => displayNames[key] === shot.user);
        const finalUid = originalUid || shot.user;
        
        await supabase.from('screenshots').insert({
          session_id: sessionId,
          game_title: shot.gameTitle || null,
          url: shot.url, // Firebase URL
          uploader_id: finalUid,
          comment: shot.comment || '',
          created_at: shot.createdAt || data.startTime?.toDate?.() || new Date().toISOString()
        });
        shotsCount++;
      }
    }
  }
  console.log(`✅ Firebase 스크린샷 ${shotsCount}개 복구 완료.`);
}

run();
