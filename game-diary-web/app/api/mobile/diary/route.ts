import { NextRequest, NextResponse } from "next/server";
import {
  getMobileSession,
  getServiceClient,
  mobileOptionsResponse,
  withMobileCors,
} from "@/src/lib/mobile-session";

export const dynamic = "force-dynamic";

type Cursor = {
  id: string;
  startTime: string;
};

function parseCursor(value: string | null): Cursor | null {
  if (!value) {
    return null;
  }

  try {
    const decoded = JSON.parse(Buffer.from(value, "base64url").toString("utf8"));
    if (
      typeof decoded?.id !== "string" ||
      typeof decoded?.startTime !== "string" ||
      Number.isNaN(new Date(decoded.startTime).getTime())
    ) {
      return null;
    }
    return decoded;
  } catch {
    return null;
  }
}

function serializeCursor(session: { id: string; start_time: string }) {
  return Buffer.from(
    JSON.stringify({ id: session.id, startTime: session.start_time }),
    "utf8",
  ).toString("base64url");
}

export async function OPTIONS(request: Request) {
  return mobileOptionsResponse(request);
}

export async function GET(request: NextRequest) {
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

  const requestedLimit = Number(request.nextUrl.searchParams.get("limit") || "20");
  const limit = Number.isInteger(requestedLimit) ? Math.min(Math.max(requestedLimit, 1), 50) : 20;
  const rawCursor = request.nextUrl.searchParams.get("cursor");
  const cursor = parseCursor(rawCursor);

  if (rawCursor && !cursor) {
    return withMobileCors(
      NextResponse.json({ error: "Invalid cursor" }, { status: 400 }),
      request,
    );
  }

  const { data: participantRows, error: participantError } = await supabase
    .from("session_participants")
    .select("session_id, is_deleted")
    .eq("user_id", mobileSession.userId);

  if (participantError) {
    console.error("Failed to fetch mobile diary participants:", participantError.message);
    return withMobileCors(
      NextResponse.json({ error: "Failed to fetch diary sessions" }, { status: 500 }),
      request,
    );
  }

  const sessionIds = (participantRows || [])
    .filter((participant) => participant.is_deleted !== true)
    .map((participant) => participant.session_id);

  if (sessionIds.length === 0) {
    return withMobileCors(NextResponse.json({ items: [], nextCursor: null }), request);
  }

  let query = supabase
    .from("sessions")
    .select(
      "id, title, start_time, end_time, channel_name, guild_name, guild_icon, total_duration_min, session_games(title, icon_url), screenshots(url, created_at), session_participants(user_id)",
    )
    .in("id", sessionIds)
    .order("start_time", { ascending: false })
    .order("id", { ascending: false })
    .limit(limit + 1);

  if (cursor) {
    query = query.or(
      `start_time.lt.${cursor.startTime},and(start_time.eq.${cursor.startTime},id.lt.${cursor.id})`,
    );
  }

  const { data: sessions, error: sessionError } = await query;
  if (sessionError) {
    console.error("Failed to fetch mobile diary sessions:", sessionError.message);
    return withMobileCors(
      NextResponse.json({ error: "Failed to fetch diary sessions" }, { status: 500 }),
      request,
    );
  }

  const hasNextPage = (sessions || []).length > limit;
  const page = (sessions || []).slice(0, limit);
  const lastSession = page.at(-1);

  const items = page.map((session) => {
    const screenshots = [...(session.screenshots || [])].sort(
      (left, right) => new Date(right.created_at).getTime() - new Date(left.created_at).getTime(),
    );

    return {
      id: session.id,
      title: session.title,
      startTime: session.start_time,
      endTime: session.end_time,
      channelName: session.channel_name,
      guildName: session.guild_name,
      guildIcon: session.guild_icon,
      totalDurationMin: session.total_duration_min,
      games: (session.session_games || []).map((game) => ({
        title: game.title,
        iconUrl: game.icon_url,
      })),
      participantCount: session.session_participants?.length || 0,
      coverImageUrl: screenshots[0]?.url || null,
      screenshotCount: screenshots.length,
    };
  });

  return withMobileCors(
    NextResponse.json({
      items,
      nextCursor: hasNextPage && lastSession ? serializeCursor(lastSession) : null,
    }),
    request,
  );
}
