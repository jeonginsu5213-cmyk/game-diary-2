import crypto from "crypto";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { getServerSession } from "next-auth";
import { authOptions } from "@/src/lib/auth";

const ACCESS_TOKEN_TTL_MS = 15 * 60 * 1000;
const REFRESH_TOKEN_TTL_MS = 30 * 24 * 60 * 60 * 1000;
const MOBILE_AUTH_REQUEST_TTL_MS = 10 * 60 * 1000;
const defaultMobileOrigins = new Set([
  "capacitor://localhost",
  "http://localhost",
  "https://localhost",
]);

export type MobilePlatform = "ios" | "android";

export type MobileSession = {
  id: string;
  userId: string;
  platform: MobilePlatform;
  accessExpiresAt: string;
};

export function getServiceClient(): SupabaseClient | null {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceRoleKey) {
    return null;
  }

  return createClient(supabaseUrl, serviceRoleKey);
}

export function createOpaqueToken(prefix: string) {
  return `${prefix}_${crypto.randomBytes(32).toString("base64url")}`;
}

export function hashSecret(value: string) {
  return crypto.createHash("sha256").update(value).digest("hex");
}

export function isMobilePlatform(value: unknown): value is MobilePlatform {
  return value === "ios" || value === "android";
}

export function getWebAppUrl(request: Request) {
  const configuredUrl = process.env.NEXTAUTH_URL;

  if (configuredUrl) {
    return new URL(configuredUrl);
  }

  if (process.env.NODE_ENV === "production") {
    return null;
  }

  return new URL(new URL(request.url).origin);
}

export function getMobileAppLinkUrl() {
  const configuredUrl = process.env.MOBILE_APP_LINK_BASE_URL;

  if (!configuredUrl) {
    return null;
  }

  try {
    const url = new URL(configuredUrl);
    if (process.env.NODE_ENV === "production" && url.protocol !== "https:") {
      return null;
    }
    return url;
  } catch {
    return null;
  }
}

function getAllowedMobileOrigins() {
  const configuredOrigins = process.env.MOBILE_APP_ORIGINS
    ?.split(",")
    .map((origin) => origin.trim())
    .filter(Boolean) || [];

  return new Set([...defaultMobileOrigins, ...configuredOrigins]);
}

export function withMobileCors(response: Response, request: Request) {
  const origin = request.headers.get("origin");

  if (origin && getAllowedMobileOrigins().has(origin)) {
    response.headers.set("Access-Control-Allow-Origin", origin);
    response.headers.set("Access-Control-Allow-Headers", "Authorization, Content-Type");
    response.headers.set("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS");
    response.headers.set("Vary", "Origin");
  }

  return response;
}

export function mobileOptionsResponse(request: Request) {
  return withMobileCors(new Response(null, { status: 204 }), request);
}

export async function createMobileSession(
  supabase: SupabaseClient,
  userId: string,
  platform: MobilePlatform,
) {
  const accessToken = createOpaqueToken("macc");
  const refreshToken = createOpaqueToken("mref");
  const accessExpiresAt = new Date(Date.now() + ACCESS_TOKEN_TTL_MS).toISOString();
  const refreshExpiresAt = new Date(Date.now() + REFRESH_TOKEN_TTL_MS).toISOString();

  const { error } = await supabase.from("mobile_sessions").insert({
    user_id: userId,
    platform,
    access_token_hash: hashSecret(accessToken),
    refresh_token_hash: hashSecret(refreshToken),
    access_expires_at: accessExpiresAt,
    refresh_expires_at: refreshExpiresAt,
  });

  if (error) {
    throw new Error("Failed to create mobile session");
  }

  return {
    accessToken,
    refreshToken,
    accessExpiresAt,
    refreshExpiresAt,
  };
}

export async function getMobileSession(request: Request): Promise<MobileSession | null> {
  const authorization = request.headers.get("authorization");

  if (!authorization?.startsWith("Bearer ")) {
    return null;
  }

  const accessToken = authorization.slice("Bearer ".length);
  if (!accessToken.startsWith("macc_") || accessToken.length > 4096) {
    return null;
  }

  const supabase = getServiceClient();
  if (!supabase) {
    return null;
  }

  const { data, error } = await supabase
    .from("mobile_sessions")
    .select("id, user_id, platform, access_expires_at")
    .eq("access_token_hash", hashSecret(accessToken))
    .is("revoked_at", null)
    .gt("access_expires_at", new Date().toISOString())
    .maybeSingle();

  if (error || !data || !isMobilePlatform(data.platform)) {
    return null;
  }

  return {
    id: data.id,
    userId: data.user_id,
    platform: data.platform,
    accessExpiresAt: data.access_expires_at,
  };
}

export async function getAuthenticatedUserId(request: Request) {
  const mobileSession = await getMobileSession(request);
  if (mobileSession) {
    return mobileSession.userId;
  }

  const webSession = await getServerSession(authOptions);
  return (webSession?.user as { id?: string } | undefined)?.id || null;
}

export { MOBILE_AUTH_REQUEST_TTL_MS };
