"use server";

import { requireAuthenticatedUser } from "@/lib/supabase/auth";
import { supabaseAdmin } from "@/lib/supabase/admin";

export type RecruiterStatus =
  | "new"
  | "reviewing"
  | "interview"
  | "maybe"
  | "rejected"
  | "hired";

const validStatuses: RecruiterStatus[] = [
  "new",
  "reviewing",
  "interview",
  "maybe",
  "rejected",
  "hired",
];

export async function updateRecruiterStatus(
  analysisId: string,
  status: RecruiterStatus
) {
  try {
    const user = await requireAuthenticatedUser();

    if (!analysisId) return { success: false, error: "No analysis ID was provided." };
    if (!validStatuses.includes(status)) return { success: false, error: "Invalid recruiter status." };

    const { data: analysis, error: fetchError } = await supabaseAdmin
      .from("resume_analyses")
      .select("id")
      .eq("id", analysisId)
      .eq("user_id", user.id)
      .single();

    if (fetchError || !analysis) {
      console.error("Resume analysis lookup error:", fetchError);
      return { success: false, error: "Analysis not found." };
    }

    const { error: updateError } = await supabaseAdmin
      .from("resume_analyses")
      .update({ recruiter_status: status })
      .eq("id", analysisId)
      .eq("user_id", user.id);

    if (updateError) {
      console.error("Recruiter status update error:", updateError);
      return { success: false, error: "Failed to update recruiter status." };
    }

    return { success: true, status };
  } catch (error) {
    if (error instanceof Error && error.message === "AUTH_REQUIRED") {
      return { success: false, error: "Please sign in to update candidate status." };
    }

    console.error("Unexpected recruiter status error:", error);
    return { success: false, error: "Something went wrong while updating recruiter status." };
  }
}
