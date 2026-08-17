import { NextRequest, NextResponse } from "next/server";
import NextAuth, { type RequestInternal } from "next-auth";
import { authOptions } from "@/src/lib/auth";
import {
  getServiceClient,
  getWebAppUrl,
  hashSecret,
} from "@/src/lib/mobile-session";

function errorResponse(message: string, status = 400) {
  return NextResponse.json({ error: message }, { status });
}

type HeaderValue = string | number | string[] | undefined;

async function runNextAuth(request: RequestInternal) {
  const headers = new Map<string, HeaderValue>();
  let status = 200;
  let body: unknown;
  const response = {
    status(code: number) {
      status = code;
      return response;
    },
    getHeader(name: string) {
      return headers.get(name.toLowerCase());
    },
    setHeader(name: string, value: HeaderValue) {
      headers.set(name.toLowerCase(), value);
      return response;
    },
    send(value: unknown) {
      body = value;
      return response;
    },
    json(value: unknown) {
      body = value;
      return response;
    },
    end() {
      return response;
    },
  };

  await NextAuth(authOptions)(request as never, response as never);

  return { status, body, headers };
}

function getSetCookies(headers: Map<string, HeaderValue>) {
  const value = headers.get("set-cookie");
  if (Array.isArray(value)) {
    return value;
  }
  return typeof value === "string" ? [value] : [];
}

function getNextAuthCookies(headers: Map<string, HeaderValue>) {
  return Object.fromEntries(
    getSetCookies(headers).map((cookie) => {
      const entry = cookie.split(";", 1)[0];
      const separator = entry.indexOf("=");
      const name = entry.slice(0, separator);
      const value = entry.slice(separator + 1);

      try {
        return [name, decodeURIComponent(value)];
      } catch {
        return [name, value];
      }
    }),
  );
}

export async function GET(request: NextRequest) {
  const requestId = request.nextUrl.searchParams.get("request_id");
  const state = request.nextUrl.searchParams.get("state");

  if (!requestId || !state || state.length > 4096) {
    return errorResponse("Invalid mobile sign-in request");
  }

  const webAppUrl = getWebAppUrl(request);
  const supabase = getServiceClient();

  if (!webAppUrl || !supabase) {
    return errorResponse("Server configuration error", 500);
  }

  const { data: authRequest, error } = await supabase
    .from("mobile_auth_requests")
    .select("id, expires_at, authorization_code_hash")
    .eq("id", requestId)
    .eq("state_hash", hashSecret(state))
    .maybeSingle();

  if (
    error ||
    !authRequest ||
    authRequest.authorization_code_hash ||
    new Date(authRequest.expires_at).getTime() <= Date.now()
  ) {
    return errorResponse("Invalid or expired mobile sign-in request");
  }

  const completeUrl = new URL("/api/mobile/auth/complete", webAppUrl);
  completeUrl.searchParams.set("request_id", requestId);
  completeUrl.searchParams.set("state", state);

  const headers = {
    host: webAppUrl.host,
    "x-forwarded-host": webAppUrl.host,
    "x-forwarded-proto": webAppUrl.protocol.slice(0, -1),
  };
  const csrf = await runNextAuth({
    action: "csrf",
    method: "GET",
    origin: webAppUrl.origin,
    headers,
    query: { nextauth: ["csrf"] },
    cookies: {},
  });
  const csrfBody = csrf.body as { csrfToken?: unknown } | null;
  const csrfToken = csrfBody?.csrfToken;

  if (typeof csrfToken !== "string") {
    return errorResponse("Failed to initialize mobile sign-in", 500);
  }

  const csrfCookies = getNextAuthCookies(csrf.headers);
  const signIn = await runNextAuth({
    action: "signin",
    providerId: "discord",
    method: "POST",
    origin: webAppUrl.origin,
    headers,
    query: { nextauth: ["signin", "discord"] },
    cookies: csrfCookies,
    body: { csrfToken, callbackUrl: completeUrl.toString() },
  });
  const redirectUrl = signIn.headers.get("location");

  if (signIn.status !== 302 || typeof redirectUrl !== "string") {
    return errorResponse("Failed to start Discord sign-in", 500);
  }

  const response = NextResponse.redirect(redirectUrl);
  for (const cookie of [...getSetCookies(csrf.headers), ...getSetCookies(signIn.headers)]) {
    response.headers.append("Set-Cookie", cookie);
  }
  return response;
}
