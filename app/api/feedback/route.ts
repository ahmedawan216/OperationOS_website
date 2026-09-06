import { NextResponse } from "next/server";

import { feedbackSupabase } from "@/lib/supabase/feedback";
import { feedbackFormSchema } from "@/lib/validation";

const maxRequestBytes = 8 * 1024;

function errorResponse(error: string, status: number) {
  return NextResponse.json(
    { success: false, error },
    { status, headers: { "Cache-Control": "no-store" } },
  );
}

async function readRequestBody(req: Request): Promise<string | null> {
  if (!req.body) return "";

  const reader = req.body.getReader();
  const decoder = new TextDecoder();
  let receivedBytes = 0;
  let body = "";

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    receivedBytes += value.byteLength;
    if (receivedBytes > maxRequestBytes) {
      await reader.cancel();
      return null;
    }

    body += decoder.decode(value, { stream: true });
  }

  return body + decoder.decode();
}

export async function POST(req: Request) {
  try {
    const contentType = req.headers
      .get("content-type")
      ?.split(";", 1)
      .at(0)
      ?.trim()
      .toLowerCase();
    if (contentType !== "application/json") {
      return errorResponse("Send feedback as JSON.", 415);
    }

    const declaredLength = Number(req.headers.get("content-length"));
    if (Number.isFinite(declaredLength) && declaredLength > maxRequestBytes) {
      return errorResponse("Feedback request is too large.", 413);
    }

    const rawBody = await readRequestBody(req);
    if (rawBody === null) {
      return errorResponse("Feedback request is too large.", 413);
    }

    let payload: unknown;
    try {
      payload = JSON.parse(rawBody);
    } catch {
      return errorResponse("Send a valid feedback request.", 400);
    }

    const parsed = feedbackFormSchema.safeParse(payload);
    if (!parsed.success) {
      return errorResponse("Check the feedback fields and try again.", 400);
    }

    const { name, email, feedback } = parsed.data;
    const safeName = name || null;
    const safeEmail = email ? email.toLowerCase() : null;

    const { error } = await feedbackSupabase.from("feedback").insert([{
      name: safeName,
      email: safeEmail,
      feedback,
      page: "landing",
    }]);

    if (error) throw error;

    return NextResponse.json(
      { success: true },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    console.error("Feedback submission error:", error);
    return errorResponse("Unable to submit feedback right now.", 500);
  }
}
