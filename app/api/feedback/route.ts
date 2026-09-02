import { NextResponse } from "next/server";

import { posthog } from "@/lib/posthog";
import { feedbackSupabase } from "@/lib/supabase/feedback";

export async function POST(req: Request) {
  try {
    const { name, email, feedback } = await req.json();

    if (typeof feedback !== "string" || !feedback.trim()) {
      return NextResponse.json({ success: false, error: "Feedback is required." }, { status: 400 });
    }

    const safeName = typeof name === "string" ? name.trim() : null;
    const safeEmail = typeof email === "string" ? email.trim().toLowerCase() : null;

    const { error } = await feedbackSupabase.from("feedback").insert([{
      name: safeName,
      email: safeEmail,
      feedback: feedback.trim(),
      page: "landing",
    }]);

    if (error) throw error;

    await posthog.capture({
      distinctId: safeEmail || "anonymous",
      event: "feedback_submitted",
      properties: { has_email: !!safeEmail, has_name: !!safeName },
    });
    await posthog.shutdown();

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Feedback submission error:", error);
    return NextResponse.json({ success: false, error: "Unable to submit feedback right now." }, { status: 500 });
  }
}
