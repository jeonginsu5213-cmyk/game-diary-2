import { NextResponse } from "next/server";
import {
  MOBILE_AUTH_REQUEST_TTL_MS,
  createOpaqueToken,
  getServiceClient,
  getWebAppUrl,
  hashSecret,
  isMobilePlatform,
  mobileOptionsResponse,
  withMobileCors,
} from "@/src/lib/mobile-session";

export async function OPTIONS(request: Request) {
  return mobileOptionsResponse(request);
}

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const platform = body?.platform;

  if (!isMobilePlatform(platform)) {
    return withMobileCors(
      NextResponse.json({ error: "platform must be ios or android" }, { status: 400 }),
      request,
    );
  }

  const webAppUrl = getWebAppUrl(request);
  const supabase = getServiceClient();

  if (!webAppUrl || !supabase) {
    return withMobileCors(
      NextResponse.json({ error: "Server configuration error" }, { status: 500 }),
      request,
    );
  }

  const requestId = crypto.randomUUID();
  const state = createOpaqueToken("mstate");
  const expiresAt = new Date(Date.now() + MOBILE_AUTH_REQUEST_TTL_MS).toISOString();

  const { error } = await supabase.from("mobile_auth_requests").insert({
    id: requestId,
    platform,
    state_hash: hashSecret(state),
    expires_at: expiresAt,
  });

  if (error) {
    console.error("Failed to create mobile auth request:", error.message);
    return withMobileCors(
      NextResponse.json({ error: "Failed to start mobile sign-in" }, { status: 500 }),
      request,
    );
  }

  const authorizationUrl = new URL("/api/mobile/auth/authorize", webAppUrl);
  authorizationUrl.searchParams.set("request_id", requestId);
  authorizationUrl.searchParams.set("state", state);

  return withMobileCors(
    NextResponse.json({
      requestId,
      state,
      authorizationUrl: authorizationUrl.toString(),
      expiresAt,
    }),
    request,
  );
}
