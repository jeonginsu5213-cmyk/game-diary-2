require('dotenv').config();
const admin = require('firebase-admin');
const { createClient } = require('@supabase/supabase-js');

const serviceAccount = require('../game-diary-bot/serviceAccountKey.json');
if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
  });
}
const db = admin.firestore();

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function recoverRecent() {
  console.log('🚀 최근 누락된 데이터 복구 시작 (5월 27일 이후)...');

  try {
    // 2026년 5월 27일 00:00:00 KST (또는 서버 시간에 맞춰 적절히 설정)
    // Timestamp 생성 (초, 나노초)
    const targetDate = new Date('2026-05-27T00:00:00Z'); 
    const targetTimestamp = admin.firestore.Timestamp.fromDate(targetDate);

    // 5월 27일 이후의 데이터만 가져오기
    const sessionsSnapshot = await db.collection('sessions')
        .where('startTime', '>=', targetTimestamp)
        .get();

    console.log(`📊 5월 27일 이후 작성된 세션: ${sessionsSnapshot.size}개 발견`);

    for (const doc of sessionsSnapshot.docs) {
      const data = doc.data();
      const sessionId = doc.id;
      const guildName = data.guildName || 'Unknown Server';

      console.log(`\n--- 복구 중: ${data.sessionTitle || sessionId} (${guildName}) ---`);

      // 1. 유저 프로필 및 서버별 프로필 처리
      const displayNames = data.displayNames || {};
      const profileImages = data.profileImages || {};
      for (const [uid, name] of Object.entries(displayNames)) {
        await supabase.from('profiles').upsert({
          id: uid,
          display_name: name,
          avatar_url: profileImages[uid] || null,
          updated_at: new Date().toISOString()
        });

        await supabase.from('server_profiles').upsert({
          user_id: uid,
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
            user_id: uid,
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

          let { data: existingGame } = await supabase
            .from('session_games')
            .select('id')
            .eq('session_id', sessionId)
            .eq('title', game.title)
            .eq('start_time', gameData.start_time)
            .maybeSingle();

          let insertedGame;
          if (existingGame) {
            const { data: updatedGame, error: updateError } = await supabase
              .from('session_games')
              .update(gameData)
              .eq('id', existingGame.id)
              .select()
              .single();
            if (updateError) {
              console.error(`❌ 게임(${game.title}) 업데이트 실패:`, updateError.message);
              continue;
            }
            insertedGame = updatedGame;
          } else {
            const { data: newGame, error: insertError } = await supabase
              .from('session_games')
              .insert(gameData)
              .select()
              .single();
            if (insertError) {
              console.error(`❌ 게임(${game.title}) 삽입 실패:`, insertError.message);
              continue;
            }
            insertedGame = newGame;
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
              const commentData = {
                game_id: insertedGame.id,
                user_id: comment.userId,
                content: comment.text || '',
                is_checklist: comment.isChecklist || false,
                created_at: comment.createdAt || new Date().toISOString(),
                reactions: comment.reactions || {},
                replies: comment.replies || []
              };

              let { data: existingComment } = await supabase
                .from('comments')
                .select('id')
                .eq('game_id', insertedGame.id)
                .eq('user_id', commentData.user_id)
                .eq('content', commentData.content)
                .eq('created_at', commentData.created_at)
                .maybeSingle();

              if (existingComment) {
                await supabase.from('comments').update(commentData).eq('id', existingComment.id);
              } else {
                await supabase.from('comments').insert(commentData);
              }
            }
          }
        }
      }

      // 6. 스크린샷 삽입
      if (data.screenshots && Array.isArray(data.screenshots)) {
        for (const shot of data.screenshots) {
          const originalUid = Object.keys(displayNames).find(key => displayNames[key] === shot.user);
          const finalUid = originalUid || shot.user;
          
          const shotData = {
            session_id: sessionId,
            game_title: shot.gameTitle || null,
            url: shot.url,
            uploader_id: finalUid,
            comment: shot.comment || '',
            created_at: shot.createdAt || new Date().toISOString()
          };

          let { data: existingShot } = await supabase
            .from('screenshots')
            .select('id')
            .eq('session_id', sessionId)
            .eq('url', shot.url)
            .maybeSingle();

          if (existingShot) {
            await supabase.from('screenshots').update(shotData).eq('id', existingShot.id);
          } else {
            await supabase.from('screenshots').insert(shotData);
          }
        }
      }
    }

    console.log('\n✨ 최근 누락된 데이터 복구가 완료되었습니다.');
  } catch (error) {
    console.error('❌ 오류 발생:', error);
  }
}

recoverRecent();
