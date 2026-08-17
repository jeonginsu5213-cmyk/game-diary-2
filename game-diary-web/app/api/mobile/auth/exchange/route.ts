import { NextResponse } from "next/server";
import {
  createMobileSession,
  getServiceClient,
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
  const code = body?.code;
  const state = body?.state;

  if (
    typeof code !== "string" ||
    typeof state !== "string" ||
    !code.startsWith("mcode_") ||
    !state.startsWith("mstate_") ||
    code.length > 4096 ||
    state.length > 4096
  ) {
    return withMobileCors(
      NextResponse.json({ error: "Invalid mobile authorization code" }, { status: 400 }),
      request,
    );
  }

  const supabase = getServiceClient();
  if (!supabase) {
    return withMobileCors(
      NextResponse.json({ error: "Server configuration error" }, { status: 500 }),
      request,
    );
  }

  const { data: authRequest, error } = await supabase
    .from("mobile_auth_requests")
    .select("id, user_id, platform, expires_at, consumed_at")
    .eq("authorization_code_hash", hashSecret(code))
    .eq("state_hash", hashSecret(state))
    .maybeSingle();

  if (
    error ||
    !authRequest ||
    !authRequest.user_id ||
    authRequest.consumed_at ||
    new Date(authRequest.expires_at).getTime() <= Date.now() ||
    !isMobilePlatform(authRequest.platform)
  ) {
    return withMobileCors(
      NextResponse.json({ error: "Mobile authorization code is invalid or expired" }, { status: 401 }),
      request,
    );
  }

  const { data: consumedRequest, error: consumeError } = await supabase
    .from("mobile_auth_requests")
    .update({ consumed_at: new Date().toISOString() })
    .eq("id", authRequest.id)
    .is("consumed_at", null)
    .select("id")
    .maybeSingle();

  if (consumeError || !consumedRequest) {
    return withMobileCors(
      NextResponse.json({ error: "Mobile authorization code has already been used" }, { status: 409 }),
      request,
    );
  }

  try {
    const mobileSession = await createMobileSession(
      supabase,
      authRequest.user_id,
      authRequest.platform,
    );
    const { data: profile } = await supabase
      .from("profiles")
      .select("id, display_name, avatar_url")
      .eq("id", authRequest.user_id)
      .maybeSingle();

    return withMobileCors(
      NextResponse.json({
        ...mobileSession,
        user: profile || { id: authRequest.user_id },
      }),
      request,
    );
  } catch (sessionError) {
    console.error("Failed to create mobile session:", sessionError);
    return withMobileCors(
      NextResponse.json({ error: "Failed to create mobile session" }, { status: 500 }),
      request,
    );
  }
}
