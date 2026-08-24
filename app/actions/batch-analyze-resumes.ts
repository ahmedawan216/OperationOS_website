"use server";

import { requireAuthenticatedUser } from "@/lib/supabase/auth";
import { analyzeResume } from "@/app/actions/analyze-resume";
import { uploadResume, type UploadState } from "@/app/upload/actions";

export type BatchItemResult = {
  name: string;
  success: boolean;
  error?: string;
  resumeId?: string;
  candidateId?: string;
};

export async function batchAnalyzeResumes(jobId: string, files: File[]): Promise<BatchItemResult[]> {
  await requireAuthenticatedUser();
  if (!jobId) return files.map((file) => ({ name: file.name, success: false, error: "No job was selected." }));

  const limitedFiles = files.slice(0, 25);
  const results: BatchItemResult[] = [];

  for (const file of limitedFiles) {
    try {
      const uploadForm = new FormData();
      uploadForm.set("resume", file);
      const uploadResult: UploadState = await uploadResume({ success: false }, uploadForm);
      if (!uploadResult.success || !uploadResult.resumeId) {
        results.push({ name: file.name, success: false, error: uploadResult.error ?? "Upload failed." });
        continue;
      }

      const analysisResult = await analyzeResume(uploadResult.resumeId, jobId);
      results.push({
        name: file.name,
        success: analysisResult.success,
        error: analysisResult.success ? undefined : analysisResult.error,
        resumeId: uploadResult.resumeId,
        candidateId: uploadResult.candidateId,
      });
    } catch (error) {
      console.error("Batch resume processing error:", error);
      results.push({ name: file.name, success: false, error: "This resume could not be processed." });
    }
  }

  return results;
}
