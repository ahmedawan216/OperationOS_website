"use server";

import { revalidatePath } from "next/cache";
import { requireAuthenticatedUser } from "@/lib/supabase/auth";
import { supabaseAdmin } from "@/lib/supabase/admin";

export type EditableAnalysis = {
  recommendation: "interview" | "maybe" | "reject";
  matchScore: number;
  confidence: "low" | "medium" | "high";
  summary: string;
  whyStrongMatch: string;
  matchingSkills: string[];
  missingSkills: string[];
  yearsRelevantExperience: number;
  potentialConcerns: string[];
  reasoning: string;
};

export async function updateResumeAnalysis(analysisId: string, input: EditableAnalysis) {
  const user = await requireAuthenticatedUser();
  if (!analysisId) return { success: false, error: "No analysis ID was provided." };

  const matchScore = Math.max(0, Math.min(100, Math.round(Number(input.matchScore))));
  const years = Math.max(0, Number(input.yearsRelevantExperience) || 0);
  const cleanList = (items: string[]) => items.map((item) => item.trim()).filter(Boolean);

  const { data: analysis, error: lookupError } = await supabaseAdmin
    .from("resume_analyses")
    .select("id, candidate_id, resume_id, job_id")
    .eq("id", analysisId)
    .eq("user_id", user.id)
    .single();
  if (lookupError || !analysis) {
    console.error("Resume analysis lookup error:", lookupError);
    return { success: false, error: "Analysis not found." };
  }

  const matchingSkills = cleanList(input.matchingSkills);
  const missingSkills = cleanList(input.missingSkills);
  const potentialConcerns = cleanList(input.potentialConcerns);
  const summary = input.summary.trim();
  const whyStrongMatch = input.whyStrongMatch.trim();
  const reasoning = input.reasoning.trim();

  const { error: analysisUpdateError } = await supabaseAdmin
    .from("resume_analyses")
    .update({
      recommendation: input.recommendation,
      match_score: matchScore,
      confidence_level: input.confidence,
      summary,
      why_strong_match: whyStrongMatch,
      matching_skills: matchingSkills,
      missing_skills: missingSkills,
      years_relevant_experience: years,
      potential_concerns: potentialConcerns,
      reasoning,
      raw_response: {
        recommendation: input.recommendation,
        matchScore,
        summary,
        whyStrongMatch,
        matchingSkills,
        missingSkills,
        yearsRelevantExperience: years,
        potentialConcerns,
        confidence: input.confidence,
        reasoning,
        editedByRecruiter: true,
      },
    })
    .eq("id", analysisId)
    .eq("user_id", user.id);

  if (analysisUpdateError) {
    console.error("Resume analysis update error:", analysisUpdateError);
    return { success: false, error: "Could not save the analysis edits." };
  }

  if (analysis.candidate_id && analysis.job_id) {
    const { error: matchUpdateError } = await supabaseAdmin
      .from("candidate_job_matches")
      .update({
        match_score: matchScore,
        recommendation: input.recommendation,
        latest_analysis_id: analysis.id,
        updated_at: new Date().toISOString(),
      })
      .eq("candidate_id", analysis.candidate_id)
      .eq("job_id", analysis.job_id)
      .eq("user_id", user.id);

    if (matchUpdateError) {
      console.error("Candidate job match update error:", matchUpdateError);
      return { success: false, error: "The analysis was saved, but the candidate match could not be updated." };
    }
  }

  revalidatePath(`/dashboard/agents/recruitos/analyze/${analysis.resume_id}`);
  revalidatePath(`/dashboard/agents/recruitos/candidates/${analysis.candidate_id}`);
  revalidatePath(`/dashboard/agents/recruitos/jobs/${analysis.job_id}`);

  return { success: true };
}
