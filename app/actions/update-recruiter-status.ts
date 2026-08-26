"use server";

import { requireAuthenticatedUser } from "@/lib/supabase/auth";
import { supabaseAdmin } from "@/lib/supabase/admin";

export type RecruiterStatus = "new" | "reviewing" | "shortlisted" | "interview" | "offer" | "hired" | "rejected";

const validStatuses: RecruiterStatus[] = ["new", "reviewing", "shortlisted", "interview", "offer", "hired", "rejected"];

export async function updateRecruiterStatus(analysisId: string, status: RecruiterStatus) {
  try {
    const user = await requireAuthenticatedUser();
    if (!analysisId) return { success: false, error: "No analysis ID was provided." };
    if (!validStatuses.includes(status)) return { success: false, error: "Invalid recruiter status." };

    const { data: analysis, error: fetchError } = await supabaseAdmin
      .from("resume_analyses")
      .select("id, candidate_id, job_id")
      .eq("id", analysisId)
      .eq("user_id", user.id)
      .single();
    if (fetchError || !analysis) {
      console.error("Resume analysis lookup error:", fetchError);
      return { success: false, error: "Analysis not found." };
    }

    if (analysis.candidate_id && analysis.job_id) {
      const { error: updateMatchError } = await supabaseAdmin
        .from("candidate_job_matches")
        .update({ recruiter_status: status, updated_at: new Date().toISOString() })
        .eq("candidate_id", analysis.candidate_id)
        .eq("job_id", analysis.job_id)
        .eq("user_id", user.id);
      if (updateMatchError) {
        console.error("Candidate match status update error:", updateMatchError);
        return { success: false, error: "Failed to update candidate status." };
      }

      await supabaseAdmin.from("candidate_activity").insert({
        user_id: user.id,
        candidate_id: analysis.candidate_id,
        job_id: analysis.job_id,
        type: "status_changed",
        metadata: { analysisId, status },
      });
    } else {
      const legacyStatus = status === "shortlisted" ? "reviewing" : status === "offer" ? "interview" : status === "new" ? "new" : status === "reviewing" ? "reviewing" : status;
      const { error: updateError } = await supabaseAdmin
        .from("resume_analyses")
        .update({ recruiter_status: legacyStatus })
        .eq("id", analysisId)
        .eq("user_id", user.id);
      if (updateError) {
        console.error("Legacy recruiter status update error:", updateError);
        return { success: false, error: "Failed to update candidate status." };
      }
    }

    return { success: true, status };
  } catch (error) {
    if (error instanceof Error && error.message === "AUTH_REQUIRED") return { success: false, error: "Please sign in to update candidate status." };
    console.error("Unexpected recruiter status error:", error);
    return { success: false, error: "Something went wrong while updating recruiter status." };
  }
}
