import { NextRequest, NextResponse } from "next/server";
import {
  getMobileSession,
  getServiceClient,
  mobileOptionsResponse,
  withMobileCors,
} from "@/src/lib/mobile-session";

export const dynamic = "force-dynamic";

type RouteContext = {
  params: Promise<{ sessionId: string; gameId: string }>;
};

export async function OPTIONS(request: Request) {
  return mobileOptionsResponse(request);
}

export async function POST(request: NextRequest, context: RouteContext) {
  const mobileSession = await getMobileSession(request);
  if (!mobileSession) {
    return withMobileCors(NextResponse.json({ error: "Unauthorized" }, { status: 401 }), request);
  }

  const { sessionId, gameId } = await context.params;
  if (!sessionId || sessionId.length > 200 || !gameId || gameId.length > 200) {
    return withMobileCors(NextResponse.json({ error: "Invalid diary or game id" }, { status: 400 }), request);
  }

  let content = "";
  let isChecklist = false;
  try {
    const body = await request.json() as { content?: unknown; isChecklist?: unknown };
    content = typeof body.content === "string" ? body.content.trim() : "";
    isChecklist = body.isChecklist === true;
  } catch {
    return withMobileCors(NextResponse.json({ error: "Invalid request body" }, { status: 400 }), request);
  }

  if (!content) {
    return withMobileCors(NextResponse.json({ error: "Comment content is required" }, { status: 400 }), request);
  }
  if (content.length > 500) {
    return withMobileCors(NextResponse.json({ error: "Comments can be up to 500 characters" }, { status: 400 }), request);
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
    console.error("Failed to verify mobile diary membership for comment:", participantError.message);
    return withMobileCors(
      NextResponse.json({ error: "Failed to add comment" }, { status: 500 }),
      request,
    );
  }
  if (!participant || participant.is_deleted === true) {
    return withMobileCors(NextResponse.json({ error: "Session not found" }, { status: 404 }), request);
  }

  const { data: game, error: gameError } = await supabase
    .from("session_games")
    .select("id")
    .eq("id", gameId)
    .eq("session_id", sessionId)
    .maybeSingle();

  if (gameError) {
    console.error("Failed to verify mobile game for comment:", gameError.message);
    return withMobileCors(
      NextResponse.json({ error: "Failed to add comment" }, { status: 500 }),
      request,
    );
  }
  if (!game) {
    return withMobileCors(NextResponse.json({ error: "Game not found" }, { status: 404 }), request);
  }

  const { data: comment, error: commentError } = await supabase
    .from("comments")
    .insert({
      game_id: game.id,
      user_id: mobileSession.userId,
      content,
      is_checklist: isChecklist,
    })
    .select("id, user_id, content, is_checklist, created_at")
    .single();

  if (commentError || !comment) {
    console.error("Failed to add mobile game comment:", commentError?.message || "No comment returned");
    return withMobileCors(
      NextResponse.json({ error: "Failed to add comment" }, { status: 500 }),
      request,
    );
  }

  return withMobileCors(NextResponse.json({ comment }), request);
}
