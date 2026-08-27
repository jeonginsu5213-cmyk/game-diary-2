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
  let replaceChecklistCommentId = "";
  try {
    const body = await request.json() as { content?: unknown; isChecklist?: unknown; replaceChecklistCommentId?: unknown };
    content = typeof body.content === "string" ? body.content.trim() : "";
    isChecklist = body.isChecklist === true;
    replaceChecklistCommentId = typeof body.replaceChecklistCommentId === "string" ? body.replaceChecklistCommentId : "";
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

  let replacedChecklistCommentId: string | null = null;

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

  const { data: game, error: gameError } = gameResult;

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

  if (isChecklist) {
    const { data: existingChecklistComment, error: existingChecklistCommentError } = await supabase
      .from("comments")
      .select("id")
      .eq("game_id", game.id)
      .eq("user_id", mobileSession.userId)
      .eq("is_checklist", true)
      .maybeSingle();

    if (existingChecklistCommentError) {
      console.error("Failed to check existing mobile checklist comment:", existingChecklistCommentError.message);
      return withMobileCors(
        NextResponse.json({ error: "Failed to add comment" }, { status: 500 }),
        request,
      );
    }
    if (existingChecklistComment && existingChecklistComment.id !== replaceChecklistCommentId) {
      return withMobileCors(
        NextResponse.json({ error: "A checklist comment already exists" }, { status: 409 }),
        request,
      );
    }
    if (existingChecklistComment) {
      const { error: unpinError } = await supabase
        .from("comments")
        .update({ is_checklist: false })
        .eq("id", existingChecklistComment.id)
        .eq("game_id", game.id)
        .eq("user_id", mobileSession.userId)
        .eq("is_checklist", true);

      if (unpinError) {
        console.error("Failed to replace mobile checklist comment:", unpinError.message);
        return withMobileCors(
          NextResponse.json({ error: "Failed to replace checklist comment" }, { status: 500 }),
          request,
        );
      }
      replacedChecklistCommentId = existingChecklistComment.id;
    }
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
    if (replacedChecklistCommentId) {
      const { error: restoreError } = await supabase
        .from("comments")
        .update({ is_checklist: true })
        .eq("id", replacedChecklistCommentId)
        .eq("game_id", game.id)
        .eq("user_id", mobileSession.userId);
      if (restoreError) {
        console.error("Failed to restore mobile checklist comment:", restoreError.message);
      }
    }
    console.error("Failed to add mobile game comment:", commentError?.message || "No comment returned");
    return withMobileCors(
      NextResponse.json({ error: "Failed to add comment" }, { status: 500 }),
      request,
    );
  }

  return withMobileCors(NextResponse.json({ comment }), request);
}

export async function PATCH(request: NextRequest, context: RouteContext) {
  const mobileSession = await getMobileSession(request);
  if (!mobileSession) {
    return withMobileCors(NextResponse.json({ error: "Unauthorized" }, { status: 401 }), request);
  }

  const { sessionId, gameId } = await context.params;
  if (!sessionId || sessionId.length > 200 || !gameId || gameId.length > 200) {
    return withMobileCors(NextResponse.json({ error: "Invalid diary or game id" }, { status: 400 }), request);
  }

  let commentId = "";
  let content = "";
  let isChecklist: boolean | undefined;
  try {
    const body = await request.json() as { commentId?: unknown; content?: unknown; isChecklist?: unknown };
    commentId = typeof body.commentId === "string" ? body.commentId : "";
    content = typeof body.content === "string" ? body.content.trim() : "";
    isChecklist = typeof body.isChecklist === "boolean" ? body.isChecklist : undefined;
  } catch {
    return withMobileCors(NextResponse.json({ error: "Invalid request body" }, { status: 400 }), request);
  }

  if (!commentId || commentId.length > 200 || !content || content.length > 500) {
    return withMobileCors(NextResponse.json({ error: "Invalid checklist comment" }, { status: 400 }), request);
  }

  const supabase = getServiceClient();
  if (!supabase) {
    return withMobileCors(
      NextResponse.json({ error: "Server configuration error" }, { status: 500 }),
      request,
    );
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
    console.error("Failed to verify mobile checklist comment update:", participantError?.message || gameError?.message);
    return withMobileCors(NextResponse.json({ error: "Failed to update comment" }, { status: 500 }), request);
  }
  if (!participant || participant.is_deleted === true) {
    return withMobileCors(NextResponse.json({ error: "Session not found" }, { status: 404 }), request);
  }
  if (!game) {
    return withMobileCors(NextResponse.json({ error: "Game not found" }, { status: 404 }), request);
  }

  const { data: comment, error: commentError } = await supabase
    .from("comments")
    .update(isChecklist === undefined ? { content } : { content, is_checklist: isChecklist })
    .eq("id", commentId)
    .eq("game_id", game.id)
    .eq("user_id", mobileSession.userId)
    .eq("is_checklist", true)
    .select("id, user_id, content, is_checklist, created_at")
    .maybeSingle();

  if (commentError) {
    console.error("Failed to update mobile checklist comment:", commentError.message);
    return withMobileCors(NextResponse.json({ error: "Failed to update comment" }, { status: 500 }), request);
  }
  if (!comment) {
    return withMobileCors(NextResponse.json({ error: "Checklist comment not found" }, { status: 404 }), request);
  }

  return withMobileCors(NextResponse.json({ comment }), request);
}
