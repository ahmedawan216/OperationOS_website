"use server";

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
    if (!analysisId) {
      return {
        success: false,
        error: "No analysis ID was provided.",
      };
    }

    if (!validStatuses.includes(status)) {
      return {
        success: false,
        error: "Invalid recruiter status.",
      };
    }

    const {
      data: analysis,
      error: fetchError,
    } = await supabaseAdmin
      .from("resume_analyses")
      .select("id")
      .eq("id", analysisId)
      .single();

    if (fetchError || !analysis) {
      console.error(
        "Resume analysis lookup error:",
        fetchError
      );

      return {
        success: false,
        error: "Analysis not found.",
      };
    }

    const {
      error: updateError,
    } = await supabaseAdmin
      .from("resume_analyses")
      .update({
        recruiter_status: status,
      })
      .eq("id", analysisId);

    if (updateError) {
      console.error(
        "Recruiter status update error:",
        updateError
      );

      return {
        success: false,
        error:
          "Failed to update recruiter status.",
      };
    }

    return {
      success: true,
      status,
    };
  } catch (error) {
    console.error(
      "Unexpected recruiter status error:",
      error
    );

    return {
      success: false,
      error:
        error instanceof Error
          ? error.message
          : "Something went wrong while updating the recruiter status.",
    };
  }
}