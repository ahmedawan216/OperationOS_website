"use server";

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

export async function analyzeResume(
  resumeId: string,
  jobId: string
) {
  try {
    if (!resumeId) {
      return {
        success: false,
        error: "No resume ID was provided.",
      };
    }

    if (!jobId) {
      return {
        success: false,
        error: "No job ID was provided.",
      };
    }

    if (!process.env.GROQ_API_KEY) {
      return {
        success: false,
        error:
          "GROQ_API_KEY is missing from environment variables.",
      };
    }

    // --------------------------------------------------
    // 1. Fetch resume
    // --------------------------------------------------

    const {
      data: resume,
      error: resumeError,
    } = await supabaseAdmin
      .from("resumes")
      .select(
        "id, extracted_text, extraction_error, status"
      )
      .eq("id", resumeId)
      .single();

    if (resumeError || !resume) {
      console.error(
        "Resume fetch error:",
        resumeError
      );

      return {
        success: false,
        error: "Failed to load the resume.",
      };
    }

    if (
      resume.status !== "success" ||
      !resume.extracted_text?.trim()
    ) {
      return {
        success: false,
        error:
          resume.extraction_error ||
          "This resume has no extracted text to analyze.",
      };
    }

    // --------------------------------------------------
    // 2. Fetch selected job
    // --------------------------------------------------

    const {
      data: job,
      error: jobError,
    } = await supabaseAdmin
      .from("jobs")
      .select("id, title, description, status")
      .eq("id", jobId)
      .single();

    if (jobError || !job) {
      console.error(
        "Job fetch error:",
        jobError
      );

      return {
        success: false,
        error: "Failed to load the selected job.",
      };
    }

    // --------------------------------------------------
    // 3. Analyze resume against selected job
    // --------------------------------------------------

    const completion =
      await groq.chat.completions.create({
        model: "llama-3.3-70b-versatile",

        response_format: {
          type: "json_object",
        },

        temperature: 0.2,

        messages: [
          {
            role: "system",
            content: `
You are RecruitOS, an experienced technical recruiting and hiring assistant.

Evaluate a candidate's resume against the provided job description.

Use ONLY information actually present in the resume.
Do not invent experience, skills, education, certifications, or achievements.

matchingSkills:
- Skills explicitly mentioned in the resume.
- Must be relevant to the job.

missingSkills:
- Important requirements from the job description.
- Not clearly demonstrated in the resume.

yearsRelevantExperience:
- Estimate directly relevant professional experience.
- Use employment dates and descriptions when available.
- Count genuinely transferable experience.
- Do not count unrelated experience.
- Be conservative when dates are unclear.

matchScore:
90-100 = Exceptional match
75-89 = Strong match
60-74 = Moderate match
40-59 = Weak match
0-39 = Poor match

recommendation:
"interview" = strong match
"maybe" = meaningful potential with important gaps
"reject" = lacks most core requirements

confidence:
"high" = clear evidence
"medium" = some information unclear
"low" = limited information

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
}
            `.trim(),
          },
          {
            role: "user",
            content: `
JOB TITLE:

${job.title}

--------------------------------

JOB DESCRIPTION:

${job.description}

--------------------------------

CANDIDATE RESUME:

${resume.extracted_text}

--------------------------------

Analyze the candidate against THIS job.
            `.trim(),
          },
        ],
      });

    const content =
      completion.choices[0]?.message?.content;

    if (!content) {
      return {
        success: false,
        error: "Groq returned an empty response.",
      };
    }

    // --------------------------------------------------
    // 4. Parse AI response
    // --------------------------------------------------

    let parsedResponse: unknown;

    try {
      parsedResponse = JSON.parse(content);
    } catch (error) {
      console.error(
        "Groq JSON parse error:",
        error
      );

      console.error(
        "Groq raw response:",
        content
      );

      return {
        success: false,
        error:
          "RecruitOS returned an invalid analysis response.",
      };
    }

    // --------------------------------------------------
    // 5. Validate AI response
    // --------------------------------------------------

    const validation =
      analysisSchema.safeParse(
        parsedResponse
      );

    if (!validation.success) {
      console.error(
        "Groq response validation error:",
        validation.error.flatten()
      );

      return {
        success: false,
        error:
          "RecruitOS returned an analysis in an unexpected format.",
      };
    }

    const analysis = validation.data;

    // --------------------------------------------------
    // 6. Check existing analysis for THIS resume + job
    // --------------------------------------------------

    const {
      data: existingAnalysis,
      error: existingAnalysisError,
    } = await supabaseAdmin
      .from("resume_analyses")
      .select("id")
      .eq("resume_id", resumeId)
      .eq("job_id", jobId)
      .order("created_at", {
        ascending: false,
      })
      .limit(1)
      .maybeSingle();

    if (existingAnalysisError) {
      console.error(
        "Existing analysis lookup error:",
        existingAnalysisError
      );

      return {
        success: false,
        error:
          "Failed to check for an existing analysis.",
      };
    }

    const analysisData = {
      resume_id: resumeId,
      job_id: jobId,
      job_description_text:
        job.description,

      status: "success",

      error_message: null,

      recommendation:
        analysis.recommendation,

      match_score: Math.round(
        analysis.matchScore
      ),

      confidence_level:
        analysis.confidence,

      summary:
        analysis.summary,

      why_strong_match:
        analysis.whyStrongMatch,

      matching_skills:
        analysis.matchingSkills,

      missing_skills:
        analysis.missingSkills,

      potential_concerns:
        analysis.potentialConcerns,

      years_relevant_experience:
        analysis.yearsRelevantExperience,

      reasoning:
        analysis.reasoning,

      model:
        "llama-3.3-70b-versatile",

      raw_response:
        analysis,
    };

    // --------------------------------------------------
    // 7. Update or create analysis
    // --------------------------------------------------

    if (existingAnalysis) {
      const {
        error: updateError,
      } = await supabaseAdmin
        .from("resume_analyses")
        .update(analysisData)
        .eq(
          "id",
          existingAnalysis.id
        );

      if (updateError) {
        console.error(
          "Resume analysis update error:",
          updateError
        );

        return {
          success: false,
          error:
            "Failed to update AI analysis.",
        };
      }
    } else {
      const {
        error: insertError,
      } = await supabaseAdmin
        .from("resume_analyses")
        .insert(analysisData);

      if (insertError) {
        console.error(
          "Resume analysis insert error:",
          insertError
        );

        return {
          success: false,
          error:
            "Failed to save AI analysis.",
        };
      }
    }

    return {
      success: true,
      resumeId,
      jobId,
    };
  } catch (error) {
    console.error(
      "Unexpected RecruitOS analysis error:",
      error
    );

    return {
      success: false,
      error:
        error instanceof Error
          ? error.message
          : "Something went wrong while analyzing the resume.",
    };
  }
}
