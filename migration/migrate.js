require('dotenv').config();
const admin = require('firebase-admin');
const { createClient } = require('@supabase/supabase-js');

const serviceAccount = require('../game-diary-bot/serviceAccountKey.json');
admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});
const db = admin.firestore();

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

// 사용자 본인의 ID들
const MY_ORIGINAL_ID = '304609934245363713';
const MY_INSU_ID = 'insu6446';

/**
 * 특정 서버나 조건에 따라 유저 ID를 변환하는 헬퍼 함수
 */
async function migrate() {
  console.log('🚀 데이터 무결성 복구 및 정밀 마이그레이션 시작 (ID 통합 버전)...');

  try {
    const sessionsSnapshot = await db.collection('sessions').get();
    console.log(`📊 발견된 세션: ${sessionsSnapshot.size}개`);

    for (const doc of sessionsSnapshot.docs) {
      const data = doc.data();
      const sessionId = doc.id;
      const guildName = data.guildName || 'Unknown Server';

      console.log(`\n--- 세션 처리 중: ${data.sessionTitle || sessionId} (${guildName}) ---`);

      // 1. 유저 프로필 및 서버별 프로필 처리
      const displayNames = data.displayNames || {};
      const profileImages = data.profileImages || {};
      for (const [uid, name] of Object.entries(displayNames)) {
        // ID 통합: 이제 맵핑 없이 원본 UID를 사용합니다.
        const originalId = uid; 
        
        // 공통 프로필 업데이트 (최신 닉네임/아바타로 유지될 수 있음)
        await supabase.from('profiles').upsert({
          id: originalId,
          display_name: name,
          avatar_url: profileImages[uid] || null,
          updated_at: new Date().toISOString()
        });

        // 서버별 프로필 저장 (서버마다 다른 닉네임 유지)
        await supabase.from('server_profiles').upsert({
          user_id: originalId,
          guild_name: guildName,
          nickname: name,
          avatar_url: profileImages[uid] || null
        });
      }

      // 2. 세션 삽입
      const sessionData = {
        id: sessionId,
        start_time: data.startTime?.toDate?.() || data.startTime || new Date().toISOString(),
        end_time: data.endTime?.toDate?.() || data.endTime || new Date().toISOString(),
        channel_name: data.channelName || 'unknown',
        title: data.sessionTitle || `Session ${sessionId}`,
        guild_name: guildName,
        guild_icon: data.guildIcon || null,
        total_duration_min: data.totalDurationMin || 0
      };

      await supabase.from('sessions').upsert(sessionData);

      // 2.5 참여자별 통화 시간 처리
      if (data.participantLogs) {
        for (const [uid, logs] of Object.entries(data.participantLogs)) {
          let totalMs = 0;
          if (Array.isArray(logs)) {
            logs.forEach((log) => {
              const start = log.joinTime?.seconds ? log.joinTime.seconds * 1000 : (log.joinTime ? new Date(log.joinTime).getTime() : null);
              const end = log.leaveTime?.seconds ? log.leaveTime.seconds * 1000 : (log.leaveTime ? new Date(log.leaveTime).getTime() : (data.endTime?.seconds ? data.endTime.seconds * 1000 : new Date().getTime()));
              if (start && end) totalMs += (end - start);
            });
          }
          const durationMin = Math.max(1, Math.round(totalMs / 60000));
          await supabase.from('session_participants').upsert({
            session_id: sessionId,
            user_id: uid, // 통합된 원본 ID 사용
            duration_min: durationMin
          });
        }
      }
      
      // 3. 게임 정보 삽입
      if (data.games && Array.isArray(data.games)) {
        for (const game of data.games) {
          const gameData = {
            session_id: sessionId,
            title: game.title,
            icon_url: game.iconURL || null,
            play_time_min: game.playTimeMin || 0,
            start_time: game.startTime?.toDate?.() || game.startTime || sessionData.start_time,
            end_time: game.endTime?.toDate?.() || game.endTime || sessionData.end_time
          };

          const { data: insertedGame, error: gameError } = await supabase
            .from('session_games')
            .upsert(gameData, { onConflict: 'session_id, title, start_time' })
            .select()
            .single();

          if (gameError) {
            console.error(`❌ 게임(${game.title}) 삽입/업데이트 실패:`, gameError.message);
            continue;
          }

          // 4. 유저별 플레이 시간
          if (game.playerPlayTimes) {
            for (const [uid, time] of Object.entries(game.playerPlayTimes)) {
              await supabase.from('session_game_players').upsert({
                game_id: insertedGame.id,
                user_id: uid,
                play_time_min: time
              });
            }
          }

          // 5. 댓글 삽입
          if (game.comments && Array.isArray(game.comments)) {
            for (const comment of game.comments) {
              await supabase.from('comments').upsert({
                game_id: insertedGame.id,
                user_id: comment.userId,
                content: comment.text || '',
                is_checklist: comment.isChecklist || false,
                created_at: comment.createdAt || new Date().toISOString(),
                reactions: comment.reactions || {},
                replies: comment.replies || []
              }, { onConflict: 'game_id, user_id, content, created_at' });
            }
          }
        }
      }

      // 6. 스크린샷 삽입
      if (data.screenshots && Array.isArray(data.screenshots)) {
        for (const shot of data.screenshots) {
          const originalUid = Object.keys(displayNames).find(key => displayNames[key] === shot.user);
          const finalUid = originalUid || shot.user;
          
          await supabase.from('screenshots').upsert({
            session_id: sessionId,
            game_title: shot.gameTitle || null,
            url: shot.url,
            uploader_id: finalUid,
            comment: shot.comment || '',
            created_at: shot.createdAt || new Date().toISOString()
          }, { onConflict: 'session_id, url' });
        }
      }
    }

    console.log('\n✨ 데이터 통합 복구 및 마이그레이션이 완료되었습니다.');
  } catch (error) {
    console.error('❌ 오류 발생:', error);
  }
}

migrate();
