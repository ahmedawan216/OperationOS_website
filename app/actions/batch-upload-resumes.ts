"use server";

import { requireAuthenticatedUser } from "@/lib/supabase/auth";
import { uploadResume, type UploadState } from "@/app/upload/actions";

export type BatchUploadResult = {
  name: string;
  success: boolean;
  error?: string;
  resumeId?: string;
  candidateId?: string;
};

const MAX_RESUMES = 25;

/**
 * Upload and extract resumes for a job, one file at a time from the UI.
 * Analysis is intentionally separate so recruiters can choose which
 * successfully processed candidates to send to RecruitOS.
 */
export async function batchUploadResumes(jobId: string, files: File[]): Promise<BatchUploadResult[]> {
  await requireAuthenticatedUser();

  if (!jobId) {
    return files.map((file) => ({
      name: file.name,
      success: false,
      error: "No job was selected.",
    }));
  }

  const limitedFiles = files.slice(0, MAX_RESUMES);
  const results: BatchUploadResult[] = [];

  for (const file of limitedFiles) {
    try {
      const uploadForm = new FormData();
      uploadForm.set("resume", file);
      uploadForm.set("jobId", jobId);

      const uploadResult: UploadState = await uploadResume({ success: false }, uploadForm);

      if (!uploadResult.success || !uploadResult.resumeId) {
        results.push({
          name: file.name,
          success: false,
          error: uploadResult.error ?? "Upload failed.",
        });
        continue;
      }

      if (uploadResult.extractionStatus !== "success") {
        results.push({
          name: file.name,
          success: false,
          error: uploadResult.error ?? "Resume text extraction failed.",
          resumeId: uploadResult.resumeId,
          candidateId: uploadResult.candidateId,
        });
        continue;
      }

      results.push({
        name: file.name,
        success: true,
        resumeId: uploadResult.resumeId,
        candidateId: uploadResult.candidateId,
        error: uploadResult.candidateWarning,
      });
    } catch (error) {
      console.error("Batch resume upload error:", error);
      results.push({
        name: file.name,
        success: false,
        error: "This resume could not be processed.",
      });
    }
  }

  return results;
}
