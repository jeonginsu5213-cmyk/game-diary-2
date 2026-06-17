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

    // comments 테이블의 UPDATE 이벤트만 감지
    if (table !== "comments" || type !== "UPDATE" || !record || !old_record) {
      return NextResponse.json({ message: "Ignored event type or table" }, { status: 200 });
    }

    const commentId = record.id;
    const recipientId = record.user_id; // 댓글 원작자

    // 2. 답글(replies) 추가 이벤트 분석
    const oldReplies = old_record.replies || [];
    const newReplies = record.replies || [];

    if (newReplies.length > oldReplies.length) {
      const newReply = newReplies[newReplies.length - 1]; // 가장 최근 추가된 답글
      const senderId = newReply.userId;

      // 본인이 단 답글은 알림 제외
      if (recipientId !== senderId) {
        // 수신 유저 프로필 및 FCM 토큰 조회
        const { data: recipientProfile } = await supabase
          .from("profiles")
          .select("fcm_token, display_name")
          .eq("id", recipientId)
          .single();

        const { data: senderProfile } = await supabase
          .from("profiles")
          .select("display_name")
          .eq("id", senderId)
          .single();

        const senderName = senderProfile?.display_name || "알 수 없음";

        if (recipientProfile?.fcm_token) {
          const title = "💬 새 답글 알림";
          const body = `${senderName}님이 내 댓글에 답글을 남겼습니다: "${newReply.text}"`;
          const redirectUrl = `/diary?id=${record.game_id || ""}&view=diary`;

          // Vercel 타임아웃 방지를 위해 동기 대기 없이 백그라운드 비동기로 FCM 전송
          // 또한 인앱 알림용 notifications 테이블에도 기록 저장
          Promise.allSettled([
            sendFcmNotification(recipientProfile.fcm_token, title, body, { url: redirectUrl }),
            supabase.from("notifications").insert({
              recipient_id: recipientId,
              sender_id: senderId,
              type: "reply",
              source_id: commentId,
              content: body,
            })
          ]).then((results) => {
            console.log("FCM & notification logging processes settled:", results);
          });
        }
      }
    }

    // 3. 이모지 반응(reactions) 변경 이벤트 분석
    const oldReactions = old_record.reactions || {};
    const newReactions = record.reactions || {};

    // 추가된 반응 식별
    let addedReactionEmoji = "";
    let reactionSenderId = "";

    for (const [emoji, users] of Object.entries(newReactions)) {
      const oldUsers = oldReactions[emoji] || [];
      const newUsers = users as string[];
      
      if (newUsers.length > oldUsers.length) {
        // 새로 반응을 추가한 유저 목록 필터링
        const newlyAddedUser = newUsers.find(u => !oldUsers.includes(u));
        if (newlyAddedUser) {
          addedReactionEmoji = emoji;
          reactionSenderId = newlyAddedUser;
          break;
        }
      }
    }

    // 새 반응이 감지되었고, 수신자(원작자)가 반응 전송자와 다른 경우
    if (addedReactionEmoji && reactionSenderId && recipientId !== reactionSenderId) {
      // 수신 유저 FCM 토큰 및 프로필 조회
      const { data: recipientProfile } = await supabase
        .from("profiles")
        .select("fcm_token")
        .eq("id", recipientId)
        .single();

      const { data: senderProfile } = await supabase
        .from("profiles")
        .select("display_name")
        .eq("id", reactionSenderId)
        .single();

      const senderName = senderProfile?.display_name || "알 수 없음";

      if (recipientProfile?.fcm_token) {
        const title = `${addedReactionEmoji} 새 반응 알림`;
        const body = `${senderName}님이 내 댓글에 이모지 반응(${addedReactionEmoji})을 남겼습니다.`;
        const redirectUrl = `/diary?id=${record.game_id || ""}&view=diary`;

        // 비동기 처리
        Promise.allSettled([
          sendFcmNotification(recipientProfile.fcm_token, title, body, { url: redirectUrl }),
          supabase.from("notifications").insert({
            recipient_id: recipientId,
            sender_id: reactionSenderId,
            type: "reaction",
            source_id: commentId,
            content: body,
          })
        ]).then((results) => {
          console.log("FCM Reaction & notification logging processes settled:", results);
        });
      }
    }

    return NextResponse.json({ success: true }, { status: 200 });
  } catch (error: any) {
    console.error("Webhook route error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
