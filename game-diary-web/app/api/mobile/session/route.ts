import { NextResponse } from "next/server";
import {
  getMobileSession,
  getServiceClient,
  mobileOptionsResponse,
  withMobileCors,
} from "@/src/lib/mobile-session";

export async function OPTIONS(request: Request) {
  return mobileOptionsResponse(request);
}

export async function GET(request: Request) {
  const mobileSession = await getMobileSession(request);
  if (!mobileSession) {
    return withMobileCors(NextResponse.json({ error: "Unauthorized" }, { status: 401 }), request);
  }

  const supabase = getServiceClient();
  if (!supabase) {
    return withMobileCors(
      NextResponse.json({ error: "Server configuration error" }, { status: 500 }),
      request,
    );
  }

  const { data: profile, error } = await supabase
    .from("profiles")
    .select("id, display_name, avatar_url")
    .eq("id", mobileSession.userId)
    .maybeSingle();

  if (error || !profile) {
    return withMobileCors(NextResponse.json({ error: "Profile not found" }, { status: 404 }), request);
  }

  return withMobileCors(
    NextResponse.json({
      user: profile,
      accessExpiresAt: mobileSession.accessExpiresAt,
      platform: mobileSession.platform,
    }),
    request,
  );
}

export async function DELETE(request: Request) {
  const mobileSession = await getMobileSession(request);
  if (!mobileSession) {
    return withMobileCors(NextResponse.json({ error: "Unauthorized" }, { status: 401 }), request);
  }

  const supabase = getServiceClient();
  if (!supabase) {
    return withMobileCors(
      NextResponse.json({ error: "Server configuration error" }, { status: 500 }),
      request,
    );
  }

  const { error } = await supabase
    .from("mobile_sessions")
    .update({ revoked_at: new Date().toISOString() })
    .eq("id", mobileSession.id)
    .is("revoked_at", null);

  if (error) {
    return withMobileCors(NextResponse.json({ error: "Failed to sign out" }, { status: 500 }), request);
  }

  return withMobileCors(NextResponse.json({ success: true }), request);
}
