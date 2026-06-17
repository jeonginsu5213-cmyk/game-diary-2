"use client";

import { useEffect } from "react";
import { useSession } from "next-auth/react";
import { requestFcmToken } from "@/src/lib/firebase";
import { supabase } from "@/src/lib/supabase";

export default function FcmTokenManager() {
  const { data: session, status } = useSession();

  useEffect(() => {
    const syncFcmToken = async () => {
      // 1. 유저 세션이 있고 인증되었는지 확인
      const userId = (session?.user as any)?.id;
      if (status !== "authenticated" || !userId || !supabase) return;

      try {
        // 2. FCM 토큰 발급 및 브라우저 알림 권한 획득
        const token = await requestFcmToken();
        if (!token) return;

        console.log("FCM Token acquired:", token);

        // 3. 현재 프로필 조회하여 저장된 토큰이 같은지 확인 (불필요한 DB 쓰기 방지)
        const { data: profile } = await supabase
          .from("profiles")
          .select("fcm_token")
          .eq("id", userId)
          .single();

        if (profile?.fcm_token !== token) {
          // 4. 새로운 토큰이거나 변경되었을 경우 Supabase 업데이트
          const { error } = await supabase
            .from("profiles")
            .update({ fcm_token: token })
            .eq("id", userId);

          if (error) {
            console.error("Failed to update FCM token in profiles:", error.message);
          } else {
            console.log("Successfully synced FCM token to Supabase.");
          }
        }
      } catch (error) {
        console.error("Error syncing FCM token:", error);
      }
    };

    // 알림 토큰 갱신은 사용자 로그인 완료 시점에 1회 진행
    if (status === "authenticated") {
      // 브라우저 로딩 대기 후 안전하게 처리
      const timer = setTimeout(() => {
        syncFcmToken();
      }, 1000);
      return () => clearTimeout(timer);
    }
  }, [session, status]);

  return null;
}
