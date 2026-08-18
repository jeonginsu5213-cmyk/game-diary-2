import { NextResponse } from "next/server";
import {
  createMobileSession,
  getServiceClient,
  isMobilePlatform,
  mobileOptionsResponse,
  withMobileCors,
} from "@/src/lib/mobile-session";

type DiscordProfile = {
  id?: string;
  username?: string;
  global_name?: string | null;
  avatar?: string | null;
};

function getAvatarUrl(profile: Required<Pick<DiscordProfile, "id" | "username">> & DiscordProfile) {
  if (profile.avatar) {
    const format = profile.avatar.startsWith("a_") ? "gif" : "png";
    return `https://cdn.discordapp.com/avatars/${profile.id}/${profile.avatar}.${format}?size=512`;
  }

  const defaultAvatarNumber = (BigInt(profile.id) >> BigInt(22)) % BigInt(6);
  return `https://cdn.discordapp.com/embed/avatars/${defaultAvatarNumber}.png`;
}

export async function OPTIONS(request: Request) {
  return mobileOptionsResponse(request);
}

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const code = body?.code;
  const codeVerifier = body?.codeVerifier;
  const redirectUri = body?.redirectUri;
  const platform = body?.platform;
  const clientId = process.env.DISCORD_CLIENT_ID;
  const clientSecret = process.env.DISCORD_CLIENT_SECRET;

  const expectedRedirectUri = clientId ? `discord-${clientId}:/authorize/callback` : null;
  if (
    typeof code !== "string" ||
    typeof codeVerifier !== "string" ||
    typeof redirectUri !== "string" ||
    !isMobilePlatform(platform) ||
    platform !== "ios" ||
    code.length === 0 ||
    code.length > 4096 ||
    codeVerifier.length < 43 ||
    codeVerifier.length > 128 ||
    redirectUri !== expectedRedirectUri
  ) {
    return withMobileCors(
      NextResponse.json({ error: "Invalid Discord mobile authorization response" }, { status: 400 }),
      request,
    );
  }

  if (!clientId || !clientSecret) {
    return withMobileCors(
      NextResponse.json({ error: "Server configuration error" }, { status: 500 }),
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

  const tokenResponse = await fetch("https://discord.com/api/oauth2/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      grant_type: "authorization_code",
      code,
      redirect_uri: redirectUri,
      code_verifier: codeVerifier,
    }),
  }).catch(() => null);

  const token = await tokenResponse?.json().catch(() => null) as { access_token?: unknown } | null;
  if (!tokenResponse?.ok || typeof token?.access_token !== "string") {
    return withMobileCors(
      NextResponse.json({ error: "Discord authorization code is invalid or expired" }, { status: 401 }),
      request,
    );
  }

  const profileResponse = await fetch("https://discord.com/api/users/@me", {
    headers: { Authorization: `Bearer ${token.access_token}` },
  }).catch(() => null);
  const profile = await profileResponse?.json().catch(() => null) as DiscordProfile | null;
  if (
    !profileResponse?.ok ||
    !profile ||
    typeof profile.id !== "string" ||
    !/^\d+$/.test(profile.id) ||
    typeof profile.username !== "string"
  ) {
    return withMobileCors(
      NextResponse.json({ error: "Discord profile could not be verified" }, { status: 401 }),
      request,
    );
  }

  const user = {
    id: profile.id,
    display_name: profile.global_name || profile.username,
    avatar_url: getAvatarUrl(profile as Required<Pick<DiscordProfile, "id" | "username">> & DiscordProfile),
  };

  const { error: profileError } = await supabase.from("profiles").upsert({
    ...user,
    has_logged_in: true,
    updated_at: new Date().toISOString(),
  });
  if (profileError) {
    console.error("Failed to update Discord mobile profile:", profileError);
    return withMobileCors(
      NextResponse.json({ error: "Failed to update profile" }, { status: 500 }),
      request,
    );
  }

  try {
    const mobileSession = await createMobileSession(supabase, user.id, platform);
    return withMobileCors(NextResponse.json({ ...mobileSession, user }), request);
  } catch (error) {
    console.error("Failed to create Discord mobile session:", error);
    return withMobileCors(
      NextResponse.json({ error: "Failed to create mobile session" }, { status: 500 }),
      request,
    );
  }
}
