"use client";

import {
  useActionState,
  useEffect,
} from "react";

import {
  uploadResume,
  type UploadState,
} from "@/app/upload/actions";

type UploadResumeFormProps = {
  jobId?: string;
  onUploadSuccess: (resumeId: string) => void;
};

const initialState: UploadState = {
  success: false,
};

export default function UploadResumeForm({
  jobId,
  onUploadSuccess,
}: UploadResumeFormProps) {
  const [state, formAction, isPending] =
    useActionState<UploadState, FormData>(
      uploadResume,
      initialState
    );

  useEffect(() => {
    if (
      state.success &&
      state.resumeId
    ) {
      onUploadSuccess(state.resumeId);
    }
  }, [
    state.success,
    state.resumeId,
    onUploadSuccess,
  ]);

  return (
    <div className="mt-8 rounded-xl border border-border p-6 sm:p-8">
      <form action={formAction}>
        <div>
          <label
            htmlFor="resume"
            className="mb-2 block text-sm font-medium text-ink"
          >
            Candidate resume
          </label>

          <input
            id="resume"
            name="resume"
            type="file"
            accept="application/pdf"
            required
            disabled={isPending}
            className="block w-full cursor-pointer rounded-lg border border-border bg-transparent px-4 py-3 text-sm text-ink file:mr-4 file:rounded-md file:border-0 file:bg-accent file:px-4 file:py-2 file:text-sm file:font-medium file:text-bg disabled:cursor-not-allowed disabled:opacity-50"
          />

          <p className="mt-3 text-xs leading-[1.6] text-ink-dim">
            Upload the candidate&apos;s resume as a PDF.
          </p>
        </div>

        {!jobId && (
          <p
            role="alert"
            className="mt-5 text-sm text-red-400"
          >
            No job selected. Please return to a job
            and start the analysis from there.
          </p>
        )}

        {state.error && (
          <p
            role="alert"
            className="mt-5 text-sm text-red-400"
          >
            {state.error}
          </p>
        )}

        {state.success &&
          state.extractionStatus ===
            "failed" && (
            <p
              role="alert"
              className="mt-5 text-sm text-yellow-400"
            >
              The resume was uploaded, but readable
              text could not be extracted from it.
            </p>
          )}

        {state.success &&
          state.resumeId && (
            <p className="mt-5 text-sm text-green-400">
              Resume uploaded successfully.
            </p>
          )}

        <button
          type="submit"
          disabled={
            isPending || !jobId
          }
          className="mt-6 rounded-lg bg-accent px-5 py-3 text-sm font-medium text-bg transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {isPending
            ? "Uploading resume..."
            : "Upload resume"}
        </button>
      </form>
    </div>
  );
}