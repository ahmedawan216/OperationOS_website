"use server";

import { supabaseAdmin } from "@/lib/supabase/admin";

export type CreateJobState = {
  success: boolean;
  error?: string;
  jobId?: string;
};

export async function createJob(
  prevState: CreateJobState,
  formData: FormData
): Promise<CreateJobState> {
  try {
    const title = formData.get("title");
    const description = formData.get("description");

    if (typeof title !== "string" || !title.trim()) {
      return {
        success: false,
        error: "Please enter a job title.",
      };
    }

    if (
      typeof description !== "string" ||
      !description.trim()
    ) {
      return {
        success: false,
        error: "Please enter a job description.",
      };
    }

    const { data: job, error } = await supabaseAdmin
      .from("jobs")
      .insert({
        title: title.trim(),
        description: description.trim(),
        status: "open",
      })
      .select("id")
      .single();

    if (error || !job) {
      console.error(
        "Supabase job creation error:",
        error
      );

      return {
        success: false,
        error: "Failed to create the job.",
      };
    }

    return {
      success: true,
      jobId: job.id,
    };
  } catch (error) {
    console.error(
      "Unexpected job creation error:",
      error
    );

    return {
      success: false,
      error:
        error instanceof Error
          ? error.message
          : "Something went wrong while creating the job.",
    };
  }
}