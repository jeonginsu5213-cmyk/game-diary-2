import { randomUUID } from "crypto";
import { NextRequest, NextResponse } from "next/server";
import {
  getMobileSession,
  getServiceClient,
  mobileOptionsResponse,
  withMobileCors,
} from "@/src/lib/mobile-session";

export const dynamic = "force-dynamic";

type RouteContext = {
  params: Promise<{ sessionId: string; gameId: string; commentId: string }>;
};

type CommentReply = {
  id: string;
  userId: string;
  text: string;
  createdAt: string;
  reactions: Record<string, never>;
};

export async function OPTIONS(request: Request) {
  return mobileOptionsResponse(request);
}

export async function POST(request: NextRequest, context: RouteContext) {
  const mobileSession = await getMobileSession(request);
  if (!mobileSession) {
    return withMobileCors(NextResponse.json({ error: "Unauthorized" }, { status: 401 }), request);
  }

  const { sessionId, gameId, commentId } = await context.params;
  if (!sessionId || sessionId.length > 200 || !gameId || gameId.length > 200 || !commentId || commentId.length > 200) {
    return withMobileCors(NextResponse.json({ error: "Invalid diary, game, or comment id" }, { status: 400 }), request);
  }

  let content = "";
  try {
    const body = await request.json() as { content?: unknown };
    content = typeof body.content === "string" ? body.content.trim() : "";
  } catch {
    return withMobileCors(NextResponse.json({ error: "Invalid request body" }, { status: 400 }), request);
  }
  if (!content || content.length > 500) {
    return withMobileCors(NextResponse.json({ error: "Replies must be between 1 and 500 characters" }, { status: 400 }), request);
  }

  const supabase = getServiceClient();
  if (!supabase) {
    return withMobileCors(NextResponse.json({ error: "Server configuration error" }, { status: 500 }), request);
  }

  const [participantResult, gameResult] = await Promise.all([
    supabase
      .from("session_participants")
      .select("session_id, is_deleted")
      .eq("session_id", sessionId)
      .eq("user_id", mobileSession.userId)
      .maybeSingle(),
    supabase
      .from("session_games")
      .select("id")
      .eq("id", gameId)
      .eq("session_id", sessionId)
      .maybeSingle(),
  ]);
  const { data: participant, error: participantError } = participantResult;
  const { data: game, error: gameError } = gameResult;
  if (participantError || gameError) {
    console.error("Failed to verify mobile reply request:", participantError?.message || gameError?.message);
    return withMobileCors(NextResponse.json({ error: "Failed to add reply" }, { status: 500 }), request);
  }
  if (!participant || participant.is_deleted === true) {
    return withMobileCors(NextResponse.json({ error: "Session not found" }, { status: 404 }), request);
  }
  if (!game) {
    return withMobileCors(NextResponse.json({ error: "Game not found" }, { status: 404 }), request);
  }

  const { data: parentComment, error: parentCommentError } = await supabase
    .from("comments")
    .select("id, replies")
    .eq("id", commentId)
    .eq("game_id", game.id)
    .eq("is_checklist", false)
    .maybeSingle();
  if (parentCommentError) {
    console.error("Failed to load mobile reply parent:", parentCommentError.message);
    return withMobileCors(NextResponse.json({ error: "Failed to add reply" }, { status: 500 }), request);
  }
  if (!parentComment) {
    return withMobileCors(NextResponse.json({ error: "Parent comment not found" }, { status: 404 }), request);
  }

  const reply: CommentReply = {
    id: randomUUID(),
    userId: mobileSession.userId,
    text: content,
    createdAt: new Date().toISOString(),
    reactions: {},
  };
  const replies = Array.isArray(parentComment.replies) ? parentComment.replies : [];
  const { error: updateError } = await supabase
    .from("comments")
    .update({ replies: [...replies, reply] })
    .eq("id", parentComment.id)
    .eq("game_id", game.id);
  if (updateError) {
    console.error("Failed to add mobile reply:", updateError.message);
    return withMobileCors(NextResponse.json({ error: "Failed to add reply" }, { status: 500 }), request);
  }

  return withMobileCors(NextResponse.json({ reply }), request);
}
