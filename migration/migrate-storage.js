require('dotenv').config();
const admin = require('firebase-admin');
const { createClient } = require('@supabase/supabase-js');

// Firebase 초기화
const serviceAccount = require('../game-diary-bot/serviceAccountKey.json');
if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
  });
}
const db = admin.firestore();

// Supabase 초기화
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function downloadImage(url) {
  try {
    const response = await fetch(url);
    if (!response.ok) throw new Error(`Failed to fetch ${url}: ${response.statusText}`);
    const arrayBuffer = await response.arrayBuffer();
    return Buffer.from(arrayBuffer);
  } catch (e) {
    console.error(`  ⚠️ 다운로드 실패: ${url}`, e.message);
    return null;
  }
}

async function uploadToSupabase(buffer, bucketName, fileName) {
  try {
    const { data, error } = await supabase.storage
      .from(bucketName)
      .upload(fileName, buffer, {
        contentType: 'image/png',
        upsert: true
      });

    if (error) throw error;

    const { data: publicUrlData } = supabase.storage
      .from(bucketName)
      .getPublicUrl(fileName);

    return publicUrlData.publicUrl;
  } catch (e) {
    console.error(`  ⚠️ 업로드 실패: ${fileName}`, e.message);
    return null;
  }
}

async function migrateStorage() {
  console.log('🚀 Storage 마이그레이션 시작 (Native Fetch 활용)...');

  try {
    // 0. 버킷 생성 시도
    await supabase.storage.createBucket('screenshots', { public: true });
    await supabase.storage.createBucket('avatars', { public: true });
    console.log('✅ Storage 버킷 확인 완료.');

    // 1. 프로필 아바타 이전
    const { data: profiles } = await supabase.from('profiles').select('*');
    for (const profile of profiles) {
      if (profile.avatar_url && profile.avatar_url.includes('firebasestorage')) {
        console.log(`  🔄 아바타 이동 중: ${profile.display_name}`);
        const buffer = await downloadImage(profile.avatar_url);
        if (buffer) {
          const fileName = `avatars/${profile.id}.png`;
          const newUrl = await uploadToSupabase(buffer, 'avatars', fileName);
          if (newUrl) {
            await supabase.from('profiles').update({ avatar_url: newUrl }).eq('id', profile.id);
            console.log(`    ✅ 완료`);
          }
        }
      }
    }

    // 2. 스크린샷 이전
    const { data: screenshots } = await supabase.from('screenshots').select('*');
    console.log(`📸 총 ${screenshots.length}개의 스크린샷 검사 중...`);
    
    for (const shot of screenshots) {
      if (shot.url && shot.url.includes('firebasestorage')) {
        console.log(`  🔄 스크린샷 이동 중: ${shot.id}`);
        const buffer = await downloadImage(shot.url);
        if (buffer) {
          const fileName = `shots/${shot.id}.png`;
          const newUrl = await uploadToSupabase(buffer, 'screenshots', fileName);
          if (newUrl) {
            await supabase.from('screenshots').update({ url: newUrl }).eq('id', shot.id);
            console.log(`    ✅ 완료`);
          }
        }
      }
    }

    console.log('\n✨ 모든 이미지 자산이 Supabase로 성공적으로 이전되었습니다!');
  } catch (error) {
    console.error('❌ 오류 발생:', error);
  }
}

migrateStorage();
