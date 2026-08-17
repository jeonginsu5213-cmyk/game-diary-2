import { NextResponse } from "next/server";
import {
  createOpaqueToken,
  getServiceClient,
  hashSecret,
  mobileOptionsResponse,
  withMobileCors,
} from "@/src/lib/mobile-session";

const ACCESS_TOKEN_TTL_MS = 15 * 60 * 1000;
const REFRESH_TOKEN_TTL_MS = 30 * 24 * 60 * 60 * 1000;

export async function OPTIONS(request: Request) {
  return mobileOptionsResponse(request);
}

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const refreshToken = body?.refreshToken;

  if (
    typeof refreshToken !== "string" ||
    !refreshToken.startsWith("mref_") ||
    refreshToken.length > 4096
  ) {
    return withMobileCors(
      NextResponse.json({ error: "Invalid refresh token" }, { status: 400 }),
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

  const refreshTokenHash = hashSecret(refreshToken);
  const { data: session, error } = await supabase
    .from("mobile_sessions")
    .select("id, user_id, refresh_expires_at")
    .eq("refresh_token_hash", refreshTokenHash)
    .is("revoked_at", null)
    .gt("refresh_expires_at", new Date().toISOString())
    .maybeSingle();

  if (error || !session) {
    return withMobileCors(
      NextResponse.json({ error: "Refresh token is invalid or expired" }, { status: 401 }),
      request,
    );
  }

  const accessToken = createOpaqueToken("macc");
  const nextRefreshToken = createOpaqueToken("mref");
  const accessExpiresAt = new Date(Date.now() + ACCESS_TOKEN_TTL_MS).toISOString();
  const refreshExpiresAt = new Date(Date.now() + REFRESH_TOKEN_TTL_MS).toISOString();

  const { data: updatedSession, error: updateError } = await supabase
    .from("mobile_sessions")
    .update({
      access_token_hash: hashSecret(accessToken),
      refresh_token_hash: hashSecret(nextRefreshToken),
      access_expires_at: accessExpiresAt,
      refresh_expires_at: refreshExpiresAt,
      updated_at: new Date().toISOString(),
    })
    .eq("id", session.id)
    .eq("refresh_token_hash", refreshTokenHash)
    .select("id")
    .maybeSingle();

  if (updateError || !updatedSession) {
    return withMobileCors(
      NextResponse.json({ error: "Refresh token has already been used" }, { status: 409 }),
      request,
    );
  }

  return withMobileCors(
    NextResponse.json({
      accessToken,
      refreshToken: nextRefreshToken,
      accessExpiresAt,
      refreshExpiresAt,
      userId: session.user_id,
    }),
    request,
  );
}
