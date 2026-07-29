"use server";

import { supabaseAdmin } from "@/lib/supabase/admin";
import {
  extractText,
  getDocumentProxy,
} from "unpdf";

export type UploadState = {
  success: boolean;
  error?: string;
  extractionStatus?: "success" | "failed";
  resumeId?: string;
};

export async function uploadResume(
  prevState: UploadState,
  formData: FormData
): Promise<UploadState> {
  try {
    const file = formData.get("resume");

    if (!(file instanceof File)) {
      return {
        success: false,
        error: "Please select a PDF file.",
      };
    }

    if (file.type !== "application/pdf") {
      return {
        success: false,
        error: "Please upload a PDF file.",
      };
    }

    if (file.size === 0) {
      return {
        success: false,
        error: "The uploaded file is empty.",
      };
    }

    const storagePath = `${crypto.randomUUID()}.pdf`;
    const fileBuffer = await file.arrayBuffer();

    // --------------------------------------------------
    // 1. Upload PDF to Supabase Storage
    // --------------------------------------------------

    const { error: uploadError } =
      await supabaseAdmin.storage
        .from("resumes")
        .upload(storagePath, fileBuffer, {
          contentType: "application/pdf",
          upsert: false,
        });

    if (uploadError) {
      console.error(
        "Supabase Storage upload error:",
        uploadError
      );

      return {
        success: false,
        error:
          "Upload failed. Please check your Supabase Storage bucket.",
      };
    }

    // --------------------------------------------------
    // 2. Extract text from PDF
    // --------------------------------------------------

    let extractedText = "";

    let extractionStatus:
      | "success"
      | "failed" = "success";

    let extractionError: string | null = null;

    try {
      const pdf = await getDocumentProxy(
        new Uint8Array(fileBuffer)
      );

      const { text } = await extractText(pdf, {
        mergePages: true,
      });

      extractedText = text.trim();

      if (!extractedText) {
        extractionStatus = "failed";
        extractionError =
          "No text could be extracted from this PDF.";
      }
    } catch (error) {
      extractionStatus = "failed";

      extractionError =
        error instanceof Error
          ? error.message
          : "Unknown PDF extraction error.";

      console.error(
        "PDF extraction error:",
        error
      );
    }

    // --------------------------------------------------
    // 3. Save resume record
    // --------------------------------------------------

    const {
      data: resume,
      error: dbError,
    } = await supabaseAdmin
      .from("resumes")
      .insert({
        original_filename: file.name,
        storage_path: storagePath,
        extracted_text:
          extractedText || null,
        extraction_error:
          extractionError,
        status: extractionStatus,
      })
      .select("id")
      .single();

    if (dbError || !resume) {
      console.error(
        "Supabase resume insert error:",
        dbError
      );

      await supabaseAdmin.storage
        .from("resumes")
        .remove([storagePath]);

      return {
        success: false,
        error:
          "Failed to save the resume record.",
      };
    }

    // --------------------------------------------------
    // 4. Return result
    // --------------------------------------------------

    return {
      success: true,
      extractionStatus,
      resumeId: resume.id,
    };
  } catch (error) {
    console.error(
      "Unexpected resume upload error:",
      error
    );

    return {
      success: false,
      error:
        error instanceof Error
          ? error.message
          : "Something went wrong while uploading the resume.",
    };
  }
}