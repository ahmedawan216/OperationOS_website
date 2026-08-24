"use server";

import OpenAI from "openai";
import { requireAuthenticatedUser } from "@/lib/supabase/auth";
import { supabaseAdmin } from "@/lib/supabase/admin";

const groq = new OpenAI({ apiKey: process.env.GROQ_API_KEY, baseURL: "https://api.groq.com/openai/v1" });

export async function generateRecruiterSummary() {
  try {
    const user = await requireAuthenticatedUser();
    const [{ data: matches }, { count: activeJobs }] = await Promise.all([
      supabaseAdmin.from("candidate_job_matches").select("match_score, recommendation, recruiter_status, candidates ( full_name, email ), jobs ( title )").eq("user_id", user.id).order("match_score", { ascending: false, nullsFirst: false }).limit(50),
      supabaseAdmin.from("jobs").select("id", { count: "exact", head: true }).eq("user_id", user.id).eq("lifecycle_status", "open"),
    ]);

    const rows = matches ?? [];
    if (!rows.length) return { success: true, summary: "No candidates have been analyzed yet. Create a job and upload resumes to start building your recruiting workspace." };

    const counts = {
      candidates: rows.length,
      strong: rows.filter((row) => (row.match_score ?? 0) >= 75).length,
      possible: rows.filter((row) => (row.match_score ?? 0) >= 50 && (row.match_score ?? 0) < 75).length,
      weak: rows.filter((row) => (row.match_score ?? 0) < 50).length,
      review: rows.filter((row) => row.recruiter_status === "new" || row.recruiter_status === "reviewing").length,
      interviews: rows.filter((row) => row.recruiter_status === "interview").length,
    };

    if (!process.env.GROQ_API_KEY) return { success: true, summary: `${counts.candidates} candidates analyzed across ${activeJobs ?? 0} active jobs. ${counts.strong} strong matches and ${counts.review} candidates need review.` };

    const context = rows.slice(0, 20).map((row) => {
      const candidate = Array.isArray(row.candidates) ? row.candidates[0] : row.candidates;
      const job = Array.isArray(row.jobs) ? row.jobs[0] : row.jobs;
      return `${candidate?.full_name || candidate?.email || "Candidate"} | job=${job?.title || "Job"} | score=${row.match_score ?? "unknown"} | recommendation=${row.recommendation ?? "pending"} | status=${row.recruiter_status}`;
    }).join("\n");

    const completion = await groq.chat.completions.create({
      model: "llama-3.3-70b-versatile",
      temperature: 0.2,
      messages: [
        { role: "system", content: "You are a recruiting operations assistant. Summarize only the supplied recruiting data. Do not invent facts or make hiring decisions. Produce 2-4 concise sentences focused on what needs recruiter attention." },
        { role: "user", content: `Workspace counts: ${JSON.stringify(counts)}. Active jobs: ${activeJobs ?? 0}. Candidate matches:\n${context}` },
      ],
    });
    const summary = completion.choices[0]?.message?.content?.trim();
    return { success: true, summary: summary || `${counts.candidates} candidates analyzed. ${counts.strong} strong matches and ${counts.review} candidates need review.` };
  } catch (error) {
    if (error instanceof Error && error.message === "AUTH_REQUIRED") return { success: false, error: "Please sign in to view your recruiter summary." };
    console.error("Recruiter summary error:", error);
    return { success: false, error: "Recruiter summary is temporarily unavailable." };
  }
}
