"use server";

import { requireAuthenticatedUser } from "@/lib/supabase/auth";
import { supabaseAdmin } from "@/lib/supabase/admin";

export type CreateJobState = { success: boolean; error?: string; jobId?: string };

export async function createJob(_prevState: CreateJobState, formData: FormData): Promise<CreateJobState> {
  try {
    const user = await requireAuthenticatedUser();
    const title = formData.get("title");
    const description = formData.get("description");
    if (typeof title !== "string" || !title.trim()) return { success: false, error: "Please enter a job title." };
    if (typeof description !== "string" || !description.trim()) return { success: false, error: "Please enter a job description." };

    const { data: job, error } = await supabaseAdmin.from("jobs").insert({ user_id: user.id, title: title.trim(), description: description.trim(), status: "open", lifecycle_status: "open" }).select("id").single();
    if (error || !job) {
      console.error("Supabase job creation error:", error);
      return { success: false, error: "Failed to create the job." };
    }
    return { success: true, jobId: job.id };
  } catch (error) {
    if (error instanceof Error && error.message === "AUTH_REQUIRED") return { success: false, error: "Please sign in to create a job." };
    console.error("Unexpected job creation error:", error);
    return { success: false, error: "Something went wrong while creating the job." };
  }
}
