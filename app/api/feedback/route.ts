import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { posthog } from "@/lib/posthog";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SECRET_KEY!
);

export async function POST(req: Request) {
  try {
    const { name, email, feedback } = await req.json();

    const { error } = await supabase.from("feedback").insert([
      {
        name,
        email,
        feedback,
        page: "landing",
      },
    ]);

    if (error) throw error;

    posthog.capture({
      distinctId: email || "anonymous",
      event: "feedback_submitted",
      properties: {
        has_email: !!email,
        has_name: !!name,
      },
    });

    await posthog.shutdown();

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error(err);

    return NextResponse.json(
      { success: false },
      { status: 500 }
    );
  }
}