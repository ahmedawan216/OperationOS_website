"use server";

import { revalidatePath } from "next/cache";
import { requireAuthenticatedUser } from "@/lib/supabase/auth";
import { supabaseAdmin } from "@/lib/supabase/admin";

export async function deleteResumeAnalysis(analysisId: string) {
  try {
    const user = await requireAuthenticatedUser();
    if (!analysisId) return { success: false, error: "No analysis ID was provided." };

    const { data: analysis, error: lookupError } = await supabaseAdmin
      .from("resume_analyses")
      .select("id, candidate_id, job_id")
      .eq("id", analysisId)
      .eq("user_id", user.id)
      .maybeSingle();

    if (lookupError || !analysis) {
      if (lookupError) console.error("Delete analysis lookup error:", lookupError);
      return { success: false, error: "Analysis not found." };
    }

    const { error: deleteError } = await supabaseAdmin
      .from("resume_analyses")
      .delete()
      .eq("id", analysisId)
      .eq("user_id", user.id);

    if (deleteError) {
      console.error("Delete analysis error:", deleteError);
      return { success: false, error: "Could not delete this analysis." };
    }

    if (analysis.candidate_id && analysis.job_id) {
      const { data: match } = await supabaseAdmin
        .from("candidate_job_matches")
        .select("id, latest_analysis_id")
        .eq("candidate_id", analysis.candidate_id)
        .eq("job_id", analysis.job_id)
        .eq("user_id", user.id)
        .maybeSingle();

      if (match?.latest_analysis_id === analysisId) {
        const { error: matchError } = await supabaseAdmin
          .from("candidate_job_matches")
          .delete()
          .eq("id", match.id)
          .eq("user_id", user.id);

        if (matchError) {
          console.error("Delete analysis candidate match error:", matchError);
          return { success: false, error: "Analysis was deleted, but its pipeline entry could not be removed." };
        }
      }
    }

    revalidatePath("/dashboard/agents/recruitos/jobs");
    revalidatePath("/dashboard/agents/recruitos/candidates");
    if (analysis.job_id) revalidatePath(`/dashboard/agents/recruitos/jobs/${analysis.job_id}`);
    if (analysis.candidate_id) revalidatePath(`/dashboard/agents/recruitos/candidates/${analysis.candidate_id}`);

    return { success: true, jobId: analysis.job_id, candidateId: analysis.candidate_id };
  } catch (error) {
    if (error instanceof Error && error.message === "AUTH_REQUIRED") {
      return { success: false, error: "Please sign in to delete this analysis." };
    }
    console.error("Unexpected delete analysis error:", error);
    return { success: false, error: "Something went wrong while deleting the analysis." };
  }
}
