"use server";

import { requireAuthenticatedUser } from "@/lib/supabase/auth";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { extractCandidateProfile } from "@/lib/recruitos/candidate-extraction";
import { upsertCandidateFromProfile } from "@/lib/recruitos/candidates";
import { extractText, getDocumentProxy } from "unpdf";

export type UploadState = {
  success: boolean;
  error?: string;
  extractionStatus?: "success" | "failed";
  resumeId?: string;
  candidateId?: string;
  candidateWarning?: string;
};

export async function uploadResume(_prevState: UploadState, formData: FormData): Promise<UploadState> {
  try {
    const user = await requireAuthenticatedUser();
    const file = formData.get("resume");

    if (!(file instanceof File)) return { success: false, error: "Please select a PDF file." };
    if (file.type !== "application/pdf") return { success: false, error: "Please upload a PDF file." };
    if (file.size === 0) return { success: false, error: "The uploaded file is empty." };
    if (file.size > 10 * 1024 * 1024) return { success: false, error: "Please upload a PDF smaller than 10 MB." };

    const storagePath = `${user.id}/${crypto.randomUUID()}.pdf`;
    const fileBuffer = await file.arrayBuffer();

    const { error: uploadError } = await supabaseAdmin.storage.from("resumes").upload(storagePath, fileBuffer, {
      contentType: "application/pdf",
      upsert: false,
    });

    if (uploadError) {
      console.error("Supabase Storage upload error:", uploadError);
      return { success: false, error: "Upload failed. Please try again." };
    }

    let extractedText = "";
    let extractionStatus: "success" | "failed" = "success";
    let extractionError: string | null = null;

    try {
      const pdf = await getDocumentProxy(new Uint8Array(fileBuffer));
      const { text } = await extractText(pdf, { mergePages: true });
      extractedText = text.trim();
      if (!extractedText) {
        extractionStatus = "failed";
        extractionError = "No text could be extracted from this PDF.";
      }
    } catch (error) {
      extractionStatus = "failed";
      extractionError = error instanceof Error ? error.message : "Unknown PDF extraction error.";
      console.error("PDF extraction error:", error);
    }

    let candidateId: string | undefined;
    let candidateWarning: string | undefined;

    if (extractionStatus === "success" && extractedText) {
      try {
        const profile = await extractCandidateProfile(extractedText);
        candidateId = await upsertCandidateFromProfile(user.id, profile);
      } catch (error) {
        console.error("Candidate extraction error:", error);
        candidateWarning = "The resume was saved, but candidate profile extraction could not be completed yet.";
      }
    }

    const { data: resume, error: dbError } = await supabaseAdmin
      .from("resumes")
      .insert({
        user_id: user.id,
        candidate_id: candidateId ?? null,
        original_filename: file.name,
        storage_path: storagePath,
        extracted_text: extractedText || null,
        extraction_error: extractionError,
        status: extractionStatus,
        processing_status: extractionStatus === "success" ? "completed" : "failed",
        processing_error: extractionError,
      })
      .select("id")
      .single();

    if (dbError || !resume) {
      console.error("Supabase resume insert error:", dbError);
      await supabaseAdmin.storage.from("resumes").remove([storagePath]);
      return { success: false, error: "Failed to save the resume record." };
    }

    if (candidateId) {
      await supabaseAdmin.from("candidate_activity").insert({
        user_id: user.id,
        candidate_id: candidateId,
        type: "resume_uploaded",
        metadata: { resumeId: resume.id, filename: file.name },
      });
    }

    return {
      success: true,
      extractionStatus,
      resumeId: resume.id,
      candidateId,
      candidateWarning,
    };
  } catch (error) {
    if (error instanceof Error && error.message === "AUTH_REQUIRED") {
      return { success: false, error: "Please sign in to upload a resume." };
    }
    console.error("Unexpected resume upload error:", error);
    return { success: false, error: "Something went wrong while uploading the resume." };
  }
}
