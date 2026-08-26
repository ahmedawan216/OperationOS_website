"use server";

import { revalidatePath } from "next/cache";
import { requireAuthenticatedUser } from "@/lib/supabase/auth";
import { supabaseAdmin } from "@/lib/supabase/admin";

export async function deleteJob(jobId: string) {
  try {
    const user = await requireAuthenticatedUser();
    if (!jobId) return { success: false, error: "No job ID was provided." };

    const { data: job, error: jobError } = await supabaseAdmin
      .from("jobs")
      .select("id")
      .eq("id", jobId)
      .eq("user_id", user.id)
      .maybeSingle();

    if (jobError || !job) {
      if (jobError) console.error("Delete job lookup error:", jobError);
      return { success: false, error: "Job not found." };
    }

    // Analyses are job-specific and are not guaranteed to cascade from the
    // legacy jobs table, so remove them explicitly before deleting the job.
    const { error: analysisError } = await supabaseAdmin
      .from("resume_analyses")
      .delete()
      .eq("job_id", jobId)
      .eq("user_id", user.id);

    if (analysisError) {
      console.error("Delete job analyses error:", analysisError);
      return { success: false, error: "Could not remove the job's candidate analyses." };
    }

    // The V2 match table also cascades from jobs, but deleting explicitly keeps
    // this action deterministic across existing database environments.
    const { error: matchError } = await supabaseAdmin
      .from("candidate_job_matches")
      .delete()
      .eq("job_id", jobId)
      .eq("user_id", user.id);

    if (matchError) {
      console.error("Delete job candidate matches error:", matchError);
      return { success: false, error: "Could not remove the job's candidate pipeline." };
    }

    const { error: deleteError } = await supabaseAdmin
      .from("jobs")
      .delete()
      .eq("id", jobId)
      .eq("user_id", user.id);

    if (deleteError) {
      console.error("Delete job error:", deleteError);
      return { success: false, error: "Could not delete this job." };
    }

    revalidatePath("/dashboard/agents/recruitos/jobs");
    revalidatePath("/dashboard/agents/recruitos");
    return { success: true };
  } catch (error) {
    if (error instanceof Error && error.message === "AUTH_REQUIRED") {
      return { success: false, error: "Please sign in to delete this job." };
    }
    console.error("Unexpected delete job error:", error);
    return { success: false, error: "Something went wrong while deleting this job." };
  }
}
