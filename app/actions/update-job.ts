"use server";

import { revalidatePath } from "next/cache";
import { requireAuthenticatedUser } from "@/lib/supabase/auth";
import { supabaseAdmin } from "@/lib/supabase/admin";

export type JobLifecycleStatus = "draft" | "open" | "closed" | "archived";

export async function updateJob(jobId: string, input: { title?: string; description?: string; lifecycleStatus?: JobLifecycleStatus }) {
  const user = await requireAuthenticatedUser();
  if (!jobId) return { success: false, error: "Job not found." };
  const data: Record<string, string> = {};
  if (input.title !== undefined) {
    const title = input.title.trim();
    if (!title) return { success: false, error: "Job title cannot be empty." };
    data.title = title;
  }
  if (input.description !== undefined) {
    const description = input.description.trim();
    if (!description) return { success: false, error: "Job description cannot be empty." };
    data.description = description;
  }
  if (input.lifecycleStatus) {
    data.lifecycle_status = input.lifecycleStatus;
    data.status = input.lifecycleStatus === "open" ? "open" : input.lifecycleStatus;
  }

  const { data: job, error } = await supabaseAdmin.from("jobs").update(data).eq("id", jobId).eq("user_id", user.id).select("id").single();
  if (error || !job) {
    console.error("Job update error:", error);
    return { success: false, error: "Could not update this job." };
  }
  revalidatePath(`/dashboard/agents/recruitos/jobs/${jobId}`);
  revalidatePath("/dashboard/agents/recruitos/jobs");
  return { success: true };
}
