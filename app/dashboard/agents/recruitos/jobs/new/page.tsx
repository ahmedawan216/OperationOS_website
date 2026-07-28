"use client";

import { useActionState } from "react";
import Link from "next/link";

import {
  createJob,
  type CreateJobState,
} from "@/app/actions/create-job";

const initialState: CreateJobState = {
  success: false,
};

export default function NewJobPage() {
  const [state, formAction, isPending] =
    useActionState<CreateJobState, FormData>(
      createJob,
      initialState
    );

  return (
    <main className="min-h-screen bg-bg px-5 pb-20 pt-28 sm:px-8">
      <div className="mx-auto max-w-wrap">
        <Link
          href="/dashboard/agents/recruitos/jobs"
          className="mb-10 inline-flex items-center gap-2 text-[13px] text-ink-dim transition-colors hover:text-ink"
        >
          <span>←</span>
          Back to Jobs
        </Link>

        <div className="mb-12 max-w-[700px]">
          <p className="mb-4 font-mono text-[11px] tracking-[0.08em] text-accent">
            RECRUITOS / JOBS
          </p>

          <h1 className="font-display text-[clamp(36px,5vw,64px)] font-semibold leading-[1.05] tracking-[-0.025em] text-ink">
            Create a job.
          </h1>

          <p className="mt-5 text-[15px] leading-[1.7] text-ink-dim">
            Add the job description RecruitOS will use
            when evaluating candidates.
          </p>
        </div>

        <section className="max-w-[720px]">
          <div className="rounded-xl border border-border p-6 sm:p-8">
            <form action={formAction}>
              <div>
                <label
                  htmlFor="title"
                  className="mb-2 block text-sm font-medium text-ink"
                >
                  Job title
                </label>

                <input
                  id="title"
                  name="title"
                  type="text"
                  required
                  placeholder="Senior Backend Engineer"
                  className="w-full rounded-lg border border-border bg-transparent px-4 py-3 text-sm text-ink outline-none placeholder:text-ink-dim focus:border-accent"
                />
              </div>

              <div className="mt-6">
                <label
                  htmlFor="description"
                  className="mb-2 block text-sm font-medium text-ink"
                >
                  Job description
                </label>

                <textarea
                  id="description"
                  name="description"
                  required
                  rows={12}
                  placeholder="We're looking for a backend engineer with..."
                  className="w-full resize-y rounded-lg border border-border bg-transparent px-4 py-3 text-sm leading-[1.6] text-ink outline-none placeholder:text-ink-dim focus:border-accent"
                />
              </div>

              <button
                type="submit"
                disabled={isPending}
                className="mt-6 rounded-lg bg-accent px-5 py-3 text-sm font-medium text-bg transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {isPending
                  ? "Creating job..."
                  : "Create job"}
              </button>
            </form>

            {state.error && (
              <p
                role="alert"
                className="mt-5 text-sm text-red-400"
              >
                {state.error}
              </p>
            )}

            {state.success && state.jobId && (
              <div className="mt-6 border-t border-border pt-6">
                <p className="text-sm font-medium text-ink">
                  Job created successfully.
                </p>

                <p className="mt-2 text-xs text-ink-dim">
                  Your job is ready for candidate analysis.
                </p>

                <div className="mt-5 flex flex-wrap gap-3">
                  <Link
                    href={`/dashboard/agents/recruitos/jobs/${state.jobId}`}
                    className="rounded-lg bg-accent px-5 py-3 text-sm font-medium text-bg transition-opacity hover:opacity-90"
                  >
                    View job
                  </Link>

                  <Link
                    href="/dashboard/agents/recruitos/jobs"
                    className="rounded-lg border border-border px-5 py-3 text-sm font-medium text-ink transition-colors hover:border-accent hover:text-accent"
                  >
                    All jobs
                  </Link>
                </div>
              </div>
            )}
          </div>
        </section>
      </div>
    </main>
  );
}