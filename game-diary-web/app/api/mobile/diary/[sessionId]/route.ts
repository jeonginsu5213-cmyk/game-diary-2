import { NextRequest, NextResponse } from "next/server";
import {
  getMobileSession,
  getServiceClient,
  mobileOptionsResponse,
  withMobileCors,
} from "@/src/lib/mobile-session";

export const dynamic = "force-dynamic";

type RouteContext = {
  params: Promise<{ sessionId: string }>;
};

export async function OPTIONS(request: Request) {
  return mobileOptionsResponse(request);
}

export async function GET(request: NextRequest, context: RouteContext) {
  const mobileSession = await getMobileSession(request);
  if (!mobileSession) {
    return withMobileCors(NextResponse.json({ error: "Unauthorized" }, { status: 401 }), request);
  }

  const { sessionId } = await context.params;
  if (!sessionId || sessionId.length > 200) {
    return withMobileCors(NextResponse.json({ error: "Invalid session id" }, { status: 400 }), request);
  }

  const supabase = getServiceClient();
  if (!supabase) {
    return withMobileCors(
      NextResponse.json({ error: "Server configuration error" }, { status: 500 }),
      request,
    );
  }

  const { data: participant, error: participantError } = await supabase
    .from("session_participants")
    .select("session_id, is_deleted")
    .eq("session_id", sessionId)
    .eq("user_id", mobileSession.userId)
    .maybeSingle();

  if (participantError) {
    console.error("Failed to verify mobile diary membership:", participantError.message);
    return withMobileCors(
      NextResponse.json({ error: "Failed to verify session access" }, { status: 500 }),
      request,
    );
  }

  if (!participant || participant.is_deleted === true) {
    return withMobileCors(NextResponse.json({ error: "Session not found" }, { status: 404 }), request);
  }

  const { data: session, error: sessionError } = await supabase
    .from("sessions")
    .select(
      "id, title, start_time, end_time, channel_name, guild_name, guild_icon, total_duration_min, session_games(id, title, icon_url, play_time_min, start_time, end_time, comments(id, user_id, content, is_checklist, reactions, replies, created_at), session_game_players(user_id, play_time_min)), screenshots(id, url, uploader_id, game_title, comment, created_at), session_participants(user_id, duration_min), goals(id, guild_id, game_name, creator_id, title, is_achieved, created_at)",
    )
    .eq("id", sessionId)
    .maybeSingle();

  if (sessionError) {
    console.error("Failed to fetch mobile diary detail:", sessionError.message);
    return withMobileCors(
      NextResponse.json({ error: "Failed to fetch diary session" }, { status: 500 }),
      request,
    );
  }

  if (!session) {
    return withMobileCors(NextResponse.json({ error: "Session not found" }, { status: 404 }), request);
  }

  const profileIds = new Set<string>();
  for (const participantRow of session.session_participants || []) {
    profileIds.add(participantRow.user_id);
  }
  for (const screenshot of session.screenshots || []) {
    if (screenshot.uploader_id) profileIds.add(screenshot.uploader_id);
  }
  for (const game of session.session_games || []) {
    for (const comment of game.comments || []) {
      profileIds.add(comment.user_id);
    }
  }

  const { data: profiles, error: profileError } = profileIds.size
    ? await supabase
        .from("profiles")
        .select("id, display_name, avatar_url")
        .in("id", [...profileIds])
    : { data: [], error: null };

  if (profileError) {
    console.error("Failed to fetch mobile diary profiles:", profileError.message);
    return withMobileCors(
      NextResponse.json({ error: "Failed to fetch diary profiles" }, { status: 500 }),
      request,
    );
  }

  return withMobileCors(
    NextResponse.json({
      session: {
        id: session.id,
        title: session.title,
        startTime: session.start_time,
        endTime: session.end_time,
        channelName: session.channel_name,
        guildName: session.guild_name,
        guildIcon: session.guild_icon,
        totalDurationMin: session.total_duration_min,
        games: session.session_games || [],
        screenshots: session.screenshots || [],
        participants: session.session_participants || [],
        goals: session.goals || [],
      },
      profiles: profiles || [],
    }),
    request,
  );
}
