import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/src/lib/auth";
import {
  createOpaqueToken,
  getMobileAppLinkUrl,
  getServiceClient,
  hashSecret,
} from "@/src/lib/mobile-session";

function errorResponse(message: string, status = 400) {
  return NextResponse.json({ error: message }, { status });
}

export async function GET(request: NextRequest) {
  const requestId = request.nextUrl.searchParams.get("request_id");
  const state = request.nextUrl.searchParams.get("state");

  if (!requestId || !state || state.length > 4096) {
    return errorResponse("Invalid mobile sign-in request");
  }

  const webSession = await getServerSession(authOptions);
  const userId = (webSession?.user as { id?: string } | undefined)?.id;

  if (!userId) {
    const signInUrl = new URL("/auth/signin", request.nextUrl.origin);
    signInUrl.searchParams.set("callbackUrl", request.nextUrl.toString());
    return NextResponse.redirect(signInUrl);
  }

  const appLinkUrl = getMobileAppLinkUrl();
  const supabase = getServiceClient();

  if (!appLinkUrl || !supabase) {
    return errorResponse("Mobile app link is not configured", 500);
  }

  const stateHash = hashSecret(state);
  const { data: authRequest, error } = await supabase
    .from("mobile_auth_requests")
    .select("id, expires_at, authorization_code_hash")
    .eq("id", requestId)
    .eq("state_hash", stateHash)
    .maybeSingle();

  if (error || !authRequest || new Date(authRequest.expires_at).getTime() <= Date.now()) {
    return errorResponse("Mobile sign-in request has expired");
  }

  if (authRequest.authorization_code_hash) {
    return errorResponse("Mobile sign-in request was already completed", 409);
  }

  const authorizationCode = createOpaqueToken("mcode");
  const { data: updatedRequest, error: updateError } = await supabase
    .from("mobile_auth_requests")
    .update({
      user_id: userId,
      authorization_code_hash: hashSecret(authorizationCode),
      completed_at: new Date().toISOString(),
    })
    .eq("id", requestId)
    .eq("state_hash", stateHash)
    .is("authorization_code_hash", null)
    .select("id")
    .maybeSingle();

  if (updateError || !updatedRequest) {
    console.error("Failed to complete mobile sign-in request:", updateError?.message);
    return errorResponse("Failed to complete mobile sign-in", 500);
  }

  const callbackUrl = new URL("/mobile/auth/callback", appLinkUrl);
  callbackUrl.searchParams.set("code", authorizationCode);
  callbackUrl.searchParams.set("state", state);

  return NextResponse.redirect(callbackUrl);
}
