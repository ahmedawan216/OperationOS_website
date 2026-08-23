"use server";

import { requireAuthenticatedUser } from "@/lib/supabase/auth";
import { supabaseAdmin } from "@/lib/supabase/admin";
import OpenAI from "openai";
import { z } from "zod";

const groq = new OpenAI({
  apiKey: process.env.GROQ_API_KEY,
  baseURL: "https://api.groq.com/openai/v1",
});

const analysisSchema = z.object({
  recommendation: z.enum(["interview", "maybe", "reject"]),
  matchScore: z.number().min(0).max(100),
  summary: z.string(),
  whyStrongMatch: z.string(),
  matchingSkills: z.array(z.string()),
  missingSkills: z.array(z.string()),
  yearsRelevantExperience: z.number().min(0),
  potentialConcerns: z.array(z.string()),
  confidence: z.enum(["low", "medium", "high"]),
  reasoning: z.string(),
});

export async function analyzeResume(resumeId: string, jobId: string) {
  try {
    const user = await requireAuthenticatedUser();

    if (!resumeId) return { success: false, error: "No resume ID was provided." };
    if (!jobId) return { success: false, error: "No job ID was provided." };
    if (!process.env.GROQ_API_KEY) {
      return { success: false, error: "RecruitOS is not configured correctly." };
    }

    const { data: resume, error: resumeError } = await supabaseAdmin
      .from("resumes")
      .select("id, extracted_text, extraction_error, status")
      .eq("id", resumeId)
      .eq("user_id", user.id)
      .single();

    if (resumeError || !resume) {
      console.error("Resume fetch error:", resumeError);
      return { success: false, error: "Resume not found." };
    }

    if (resume.status !== "success" || !resume.extracted_text?.trim()) {
      return {
        success: false,
        error: resume.extraction_error || "This resume has no extracted text to analyze.",
      };
    }

    const { data: job, error: jobError } = await supabaseAdmin
      .from("jobs")
      .select("id, title, description, status")
      .eq("id", jobId)
      .eq("user_id", user.id)
      .single();

    if (jobError || !job) {
      console.error("Job fetch error:", jobError);
      return { success: false, error: "Job not found." };
    }

    const completion = await groq.chat.completions.create({
      model: "llama-3.3-70b-versatile",
      response_format: { type: "json_object" },
      temperature: 0.2,
      messages: [
        {
          role: "system",
          content: `You are RecruitOS, an experienced technical recruiting and hiring assistant.

Evaluate a candidate's resume against the provided job description.
Use ONLY information actually present in the resume. Do not invent experience, skills, education, certifications, or achievements.

Return ONLY valid JSON with exactly these fields:
{
  "recommendation": "interview" | "maybe" | "reject",
  "matchScore": number,
  "summary": string,
  "whyStrongMatch": string,
  "matchingSkills": string[],
  "missingSkills": string[],
  "yearsRelevantExperience": number,
  "potentialConcerns": string[],
  "confidence": "low" | "medium" | "high",
  "reasoning": string
}`,
        },
        {
          role: "user",
          content: `JOB TITLE:\n${job.title}\n\nJOB DESCRIPTION:\n${job.description}\n\nCANDIDATE RESUME:\n${resume.extracted_text}\n\nAnalyze the candidate against THIS job.`,
        },
      ],
    });

    const content = completion.choices[0]?.message?.content;
    if (!content) return { success: false, error: "RecruitOS returned an empty response." };

    let parsedResponse: unknown;
    try {
      parsedResponse = JSON.parse(content);
    } catch (error) {
      console.error("Groq JSON parse error:", error);
      return { success: false, error: "RecruitOS returned an invalid analysis response." };
    }

    const validation = analysisSchema.safeParse(parsedResponse);
    if (!validation.success) {
      console.error("Groq response validation error:", validation.error.flatten());
      return { success: false, error: "RecruitOS returned an unexpected analysis format." };
    }

    const analysis = validation.data;
    const analysisData = {
      user_id: user.id,
      resume_id: resumeId,
      job_id: jobId,
      job_description_text: job.description,
      status: "success",
      error_message: null,
      recommendation: analysis.recommendation,
      match_score: Math.round(analysis.matchScore),
      confidence_level: analysis.confidence,
      summary: analysis.summary,
      why_strong_match: analysis.whyStrongMatch,
      matching_skills: analysis.matchingSkills,
      missing_skills: analysis.missingSkills,
      potential_concerns: analysis.potentialConcerns,
      years_relevant_experience: analysis.yearsRelevantExperience,
      reasoning: analysis.reasoning,
      model: "llama-3.3-70b-versatile",
      raw_response: analysis,
    };

    const { data: existingAnalysis, error: existingAnalysisError } = await supabaseAdmin
      .from("resume_analyses")
      .select("id")
      .eq("resume_id", resumeId)
      .eq("job_id", jobId)
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (existingAnalysisError) {
      console.error("Existing analysis lookup error:", existingAnalysisError);
      return { success: false, error: "Failed to check for an existing analysis." };
    }

    if (existingAnalysis) {
      const { error } = await supabaseAdmin
        .from("resume_analyses")
        .update(analysisData)
        .eq("id", existingAnalysis.id)
        .eq("user_id", user.id);
      if (error) {
        console.error("Resume analysis update error:", error);
        return { success: false, error: "Failed to update AI analysis." };
      }
    } else {
      const { error } = await supabaseAdmin
        .from("resume_analyses")
        .insert(analysisData);
      if (error) {
        console.error("Resume analysis insert error:", error);
        return { success: false, error: "Failed to save AI analysis." };
      }
    }

    return { success: true, resumeId, jobId };
  } catch (error) {
    if (error instanceof Error && error.message === "AUTH_REQUIRED") {
      return { success: false, error: "Please sign in to analyze a resume." };
    }

    console.error("Unexpected RecruitOS analysis error:", error);
    return { success: false, error: "Something went wrong while analyzing the resume." };
  }
}
