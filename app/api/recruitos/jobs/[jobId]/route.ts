import { NextResponse } from "next/server";

import { getAuthenticatedUser } from "@/lib/supabase/auth";
import { supabaseAdmin } from "@/lib/supabase/admin";

type RouteContext = { params: Promise<{ jobId: string }> };

export async function GET(_request: Request, { params }: RouteContext) {
  try {
    const user = await getAuthenticatedUser();
    if (!user) return NextResponse.json({ error: "Unauthorized." }, { status: 401 });

    const { jobId } = await params;
    if (!jobId) return NextResponse.json({ error: "Job ID is required." }, { status: 400 });

    const { data: job, error } = await supabaseAdmin
      .from("jobs")
      .select("id, title, description, status")
      .eq("id", jobId)
      .eq("user_id", user.id)
      .single();

    if (error || !job) {
      if (error) console.error("Supabase job fetch error:", error);
      return NextResponse.json({ error: "Job not found." }, { status: 404 });
    }

    return NextResponse.json({ job });
  } catch (error) {
    console.error("Unexpected job API error:", error);
    return NextResponse.json({ error: "Something went wrong while loading the job." }, { status: 500 });
  }
}
