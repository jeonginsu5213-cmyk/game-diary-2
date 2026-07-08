import { NextResponse } from "next/server";
import { getApps, initializeApp, cert } from "firebase-admin/app";
import { getMessaging } from "firebase-admin/messaging";
import { createClient } from "@supabase/supabase-js";

export const dynamic = "force-dynamic";

// Firebase Admin SDK 초기화 (중복 초기화 방지)
if (!getApps().length) {
  try {
    const rawKey = process.env.FIREBASE_PRIVATE_KEY;
    const privateKey = rawKey 
      ? rawKey.replace(/^"|"$/g, "").replace(/\\n/g, "\n") 
      : undefined;

    if (!privateKey) {
      console.warn("⚠️ Firebase private key is missing. FCM notifications will be skipped.");
    } else {
      initializeApp({
        credential: cert({
          projectId: process.env.FIREBASE_PROJECT_ID || process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
          clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
          privateKey: privateKey,
        }),
      });
      console.log("Firebase Admin SDK initialized successfully.");
    }
  } catch (error) {
    console.error("Firebase Admin init error:", error);
  }
}

// FCM 전송 공통 함수
async function sendFcmNotification(token: string, title: string, body: string, data?: any) {
  try {
    if (!getApps().length) {
      console.warn("⚠️ Cannot send FCM: Firebase app is not initialized.");
      return false;
    }
    const message = {
      notification: { title, body },
      token: token,
      data: data || {},
      webpush: {
        headers: {
          Urgency: "high",
        },
        notification: {
          icon: "/favicon.ico",
          badge: "/favicon.ico",
          requireInteraction: true,
        },
      },
    };
    const response = await getMessaging().send(message);
    console.log("FCM push sent successfully:", response);
    return true;
  } catch (error) {
    console.error("FCM push send failed:", error);
    return false;
  }
}

export async function POST(request: Request) {
  try {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || "";
    
    if (!supabaseUrl || !supabaseServiceKey) {
      console.error("Supabase credentials are missing at runtime.");
      return NextResponse.json({ error: "Server Configuration Error" }, { status: 500 });
    }
    
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // 1. 보안 토큰 검증 (선택)
    const authHeader = request.headers.get("Authorization");
    const webhookSecret = process.env.SUPABASE_WEBHOOK_SECRET;
    
    if (webhookSecret && authHeader !== `Bearer ${webhookSecret}`) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const payload = await request.json();
    const { type, table, record, old_record } = payload;

    // 1. sessions 테이블의 INSERT 이벤트 감지 (일기 생성 알림)
    if (table === "sessions" && type === "INSERT" && record) {
      const sessionId = record.id;
      const sessionTitle = record.title || "새로운 일기";
      const guildName = record.guild_name || "";

      // 봇이 session_participants를 추가로 INSERT할 때까지 잠시 대기 (3초)
      await new Promise(resolve => setTimeout(resolve, 3000));

      // 해당 세션의 참여자 조회
      const { data: participants, error: partError } = await supabase
        .from("session_participants")
        .select("user_id")
        .eq("session_id", sessionId);

      if (partError) {
        console.error("Error fetching session participants:", partError);
      }

      if (participants && participants.length > 0) {
        const userIds = participants.map((p: any) => p.user_id);
        
        // 참여자들의 프로필 정보 및 알림 설정 조회
        const { data: profiles, error: profError } = await supabase
          .from("profiles")
          .select("id, fcm_token, display_name, push_enabled, diary_alert")
          .in("id", userIds);

        if (profError) {
          console.error("Error fetching profiles:", profError);
        }

        if (profiles && profiles.length > 0) {
          const title = "새 일기장 생성 알림";
          const body = `${guildName ? `[${guildName}] ` : ""}새로운 일기장이 생성되었습니다: "${sessionTitle}"`;
          const redirectUrl = `/diary?id=${sessionId}&view=diary`;

          const notificationPromises = profiles.map(async (profile: any) => {
            const isPushEnabled = profile.push_enabled ?? true;
            const isDiaryAlertEnabled = profile.diary_alert ?? true;

            if (!isPushEnabled || !isDiaryAlertEnabled) {
              return Promise.resolve(null);
            }

            // DB에 알림 추가
            const dbInsert = supabase.from("notifications").insert({
              recipient_id: profile.id,
              sender_id: null,
              type: "session_created",
              source_id: sessionId,
              content: body,
            }).then(({ error }) => {
              if (error) {
                console.error(`Failed to insert session_created notification for ${profile.id}:`, error.message);
              }
            });

            // FCM 푸시 발송
            const fcmSend = profile.fcm_token 
              ? sendFcmNotification(profile.fcm_token, title, body, { url: redirectUrl })
              : Promise.resolve(null);

            return Promise.allSettled([dbInsert, fcmSend]);
          });

          await Promise.allSettled(notificationPromises);
        }
      }

      return NextResponse.json({ success: true, message: "Session creation notification processed" }, { status: 200 });
    }

    // 2. comments 테이블 이벤트 감지 (INSERT 및 UPDATE)
    if (table === "comments") {
      if (type === "INSERT" && record) {
        // 새 댓글이 생성된 경우: 내가 포함되어 있는 일기장(세션)의 다른 참여자들에게 알림 발송
        const gameId = record.game_id;
        const senderId = record.user_id;
        const commentId = record.id;
        const commentContent = record.content || "";

        // 1. 게임 레코드에서 session_id 조회
        const { data: gameRecord, error: gameError } = await supabase
          .from("session_games")
          .select("session_id")
          .eq("id", gameId)
          .single();

        if (gameError || !gameRecord) {
          console.error("Error fetching game details for comment notification:", gameError);
          return NextResponse.json({ error: "Game not found" }, { status: 404 });
        }

        const sessionId = gameRecord.session_id;

        // 세션의 end_time 조회
        const { data: sessionRecord } = await supabase
          .from("sessions")
          .select("end_time")
          .eq("id", sessionId)
          .single();

        if (sessionRecord && sessionRecord.end_time) {
          const sessionEndTime = new Date(sessionRecord.end_time).getTime();
          const commentCreatedAt = new Date(record.created_at).getTime();
          
          // 디스코드 보이스 통화 도중 작성되어 봇이 마지막에 대량 삽입한 댓글인 경우 알림 대상에서 제외
          // 미세 시간 오차나 네트워크 지연을 감안해 10초(10000ms) 여유 마진 적용
          if (commentCreatedAt <= sessionEndTime + 10000) {
            console.log("[Webhook] 디스코드 채팅 수집 댓글 알림 제외:", record.id);
            return NextResponse.json({ success: true, message: "Discord call comment notification skipped" }, { status: 200 });
          }
        }

        // 2. 해당 세션의 참여자 목록 조회 (작성자 본인 제외)
        const { data: participants, error: partError } = await supabase
          .from("session_participants")
          .select("user_id")
          .eq("session_id", sessionId)
          .neq("user_id", senderId);

        if (partError) {
          console.error("Error fetching session participants for comment notification:", partError);
        }

        if (participants && participants.length > 0) {
          const userIds = participants.map((p: any) => p.user_id);

          // 3. 참여자들의 프로필 및 알림 설정 조회
          const { data: profiles, error: profError } = await supabase
            .from("profiles")
            .select("id, fcm_token, display_name, push_enabled, session_comment_alert")
            .in("id", userIds);

          if (profError) {
            console.error("Error fetching profiles for comment notification:", profError);
          }

          if (profiles && profiles.length > 0) {
            // 작성자 닉네임 구하기
            const { data: senderProfile } = await supabase
              .from("profiles")
              .select("display_name")
              .eq("id", senderId)
              .single();
            const senderName = senderProfile?.display_name || "알 수 없음";

            const title = "새 댓글 알림";
            const body = `${senderName}님이 댓글을 남겼습니다: "${commentContent}"`;
            const redirectUrl = `/diary?id=${sessionId}&view=diary`;

            const notificationPromises = profiles.map(async (profile: any) => {
              const isPushEnabled = profile.push_enabled ?? true;
              const isSessionCommentAlertEnabled = profile.session_comment_alert ?? true;

              if (!isPushEnabled || !isSessionCommentAlertEnabled) {
                return Promise.resolve(null);
              }

              // DB 알림 추가
              const dbInsert = supabase.from("notifications").insert({
                recipient_id: profile.id,
                sender_id: senderId,
                type: "session_comment",
                source_id: commentId,
                content: body,
              }).then(({ error }) => {
                if (error) {
                  console.error(`Failed to insert session_comment notification for ${profile.id}:`, error.message);
                }
              });

              // FCM 발송
              const fcmSend = profile.fcm_token
                ? sendFcmNotification(profile.fcm_token, title, body, { url: redirectUrl })
                : Promise.resolve(null);

              return Promise.allSettled([dbInsert, fcmSend]);
            });

            await Promise.allSettled(notificationPromises);
          }
        }

        return NextResponse.json({ success: true, message: "Comment creation notification processed" }, { status: 200 });
      }

      if (type === "UPDATE" && record && old_record) {
        const commentId = record.id;
        const recipientId = record.user_id; // 댓글 원작자

        // 답글(replies) 추가 이벤트 분석
        const oldReplies = old_record.replies || [];
        const newReplies = record.replies || [];

        if (newReplies.length > oldReplies.length) {
          const newReply = newReplies[newReplies.length - 1]; // 가장 최근 추가된 답글
          const senderId = newReply.userId;

          // 본인이 단 답글은 알림 제외
          if (recipientId !== senderId) {
            // 수신 유저 프로필 및 FCM 토큰, 알림 설정 조회
            const { data: recipientProfile } = await supabase
              .from("profiles")
              .select("fcm_token, display_name, push_enabled, reply_alert")
              .eq("id", recipientId)
              .single();

            const { data: senderProfile } = await supabase
              .from("profiles")
              .select("display_name")
              .eq("id", senderId)
              .single();

            const senderName = senderProfile?.display_name || "알 수 없음";
            const isPushEnabled = recipientProfile?.push_enabled ?? true;
            const isReplyAlertEnabled = recipientProfile?.reply_alert ?? true;

            if (isPushEnabled && isReplyAlertEnabled) {
              const title = "새 답글 알림";
              const body = `${senderName}님이 답글을 남겼습니다: "${newReply.text}"`;
              const redirectUrl = `/diary?id=${record.game_id || ""}&view=diary`;

              const dbInsert = supabase.from("notifications").insert({
                recipient_id: recipientId,
                sender_id: senderId,
                type: "reply",
                source_id: commentId,
                content: body,
              });

              const fcmSend = recipientProfile?.fcm_token 
                ? sendFcmNotification(recipientProfile.fcm_token, title, body, { url: redirectUrl })
                : Promise.resolve(null);

              const results = await Promise.allSettled([fcmSend, dbInsert]);
              console.log("FCM & notification logging processes settled:", results);
            }
          }
        }

        // 이모지 반응(reactions) 변경 이벤트 분석
        const oldReactions = old_record.reactions || {};
        const newReactions = record.reactions || {};

        // 추가된 반응 식별
        let addedReactionEmoji = "";
        let reactionSenderId = "";

        for (const [emoji, users] of Object.entries(newReactions)) {
          const oldUsers = oldReactions[emoji] || [];
          const newUsers = users as string[];
          
          if (newUsers.length > oldUsers.length) {
            const newlyAddedUser = newUsers.find(u => !oldUsers.includes(u));
            if (newlyAddedUser) {
              addedReactionEmoji = emoji;
              reactionSenderId = newlyAddedUser;
              break;
            }
          }
        }

        if (addedReactionEmoji && reactionSenderId && recipientId !== reactionSenderId) {
          const { data: recipientProfile } = await supabase
            .from("profiles")
            .select("fcm_token, push_enabled, reaction_alert")
            .eq("id", recipientId)
            .single();

          const { data: senderProfile } = await supabase
            .from("profiles")
            .select("display_name")
            .eq("id", reactionSenderId)
            .single();

          const senderName = senderProfile?.display_name || "알 수 없음";
          const isPushEnabled = recipientProfile?.push_enabled ?? true;
          const isReactionAlertEnabled = recipientProfile?.reaction_alert ?? true;

          if (isPushEnabled && isReactionAlertEnabled) {
            const title = "새 반응 알림";
            const body = `${senderName}님이 내 댓글에 반응(${addedReactionEmoji})을 남겼습니다.`;
            const redirectUrl = `/diary?id=${record.game_id || ""}&view=diary`;

            const dbInsert = supabase.from("notifications").insert({
              recipient_id: recipientId,
              sender_id: reactionSenderId,
              type: "reaction",
              source_id: commentId,
              content: body,
            });

            const fcmSend = recipientProfile?.fcm_token
              ? sendFcmNotification(recipientProfile.fcm_token, title, body, { url: redirectUrl })
              : Promise.resolve(null);

            const results = await Promise.allSettled([fcmSend, dbInsert]);
            console.log("FCM Reaction & notification logging processes settled:", results);
          }
        }

        return NextResponse.json({ success: true }, { status: 200 });
      }
    }

    return NextResponse.json({ success: true }, { status: 200 });
  } catch (error: any) {
    console.error("Webhook route error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
