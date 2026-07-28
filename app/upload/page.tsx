"use client";

import { useActionState, useState } from "react";
import { uploadResume, type UploadState } from "./actions";
import { analyzeResume } from "@/app/actions/analyze-resume";

const initialState: UploadState = {
  success: false,
};

export default function UploadPage() {
  const [state, formAction, isPending] = useActionState<
    UploadState,
    FormData
  >(uploadResume, initialState);

  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysisError, setAnalysisError] = useState<string | null>(null);

  async function handleAnalyze() {
    if (!state.resumeId) return;

    setIsAnalyzing(true);
    setAnalysisError(null);

    const result = await analyzeResume(state.resumeId);

    if (!result.success) {
      setAnalysisError(result.error ?? null);
    }

    setIsAnalyzing(false);
  }

  return (
    <main>
      <form action={formAction}>
        <input
          type="file"
          name="resume"
          accept="application/pdf"
          required
        />

        <button type="submit" disabled={isPending}>
          {isPending ? "Uploading..." : "Upload Resume"}
        </button>

        {state.error && <p role="alert">{state.error}</p>}

        {state.success && (
          <p>Resume uploaded successfully!</p>
        )}
      </form>

      {state.success && state.resumeId && (
        <button
          type="button"
          onClick={handleAnalyze}
          disabled={isAnalyzing}
        >
          {isAnalyzing ? "Analyzing with AI..." : "Analyze with AI"}
        </button>
      )}

      {analysisError && (
        <p role="alert">{analysisError}</p>
      )}
    </main>
  );
}