"use client";

import { useState, useTransition } from "react";
import Link from "next/link";

import {
  updateRecruiterStatus,
  type RecruiterStatus,
} from "@/app/actions/update-recruiter-status";

type Candidate = {
  id: string;
  resume_id: string;
  recommendation: "interview" | "maybe" | "reject";
  match_score: number;
  confidence_level: "low" | "medium" | "high";
  summary: string;
  recruiter_status: RecruiterStatus | null;
};

type CandidatePipelineProps = {
  candidates: Candidate[];
  jobId: string;
};

const statusLabels: Record<
  RecruiterStatus,
  string
> = {
  new: "New",
  reviewing: "Reviewing",
  interview: "Interview",
  rejected: "Rejected",
  hired: "Hired",
  maybe: "Maybe",
};

const statusColors: Record<
  RecruiterStatus,
  string
> = {
  new: "border-border text-ink-dim",
  reviewing: "border-yellow-400/30 text-yellow-400",
  interview: "border-green-400/30 text-green-400",
  rejected: "border-red-400/30 text-red-400",
  hired: "border-accent/30 text-accent",
  maybe: "border-yellow-400/30 text-yellow-400",
};

function getRecommendationLabel(
  recommendation: Candidate["recommendation"]
) {
  if (recommendation === "interview") {
    return "Interview";
  }

  if (recommendation === "maybe") {
    return "Maybe";
  }

  return "Reject";
}

function getRecommendationColor(
  recommendation: Candidate["recommendation"]
) {
  if (recommendation === "interview") {
    return "text-green-400";
  }

  if (recommendation === "maybe") {
    return "text-yellow-400";
  }

  return "text-red-400";
}

export default function CandidatePipeline({
  candidates,
  jobId,
}: CandidatePipelineProps) {
  const [isPending, startTransition] =
    useTransition();

  const [filter, setFilter] = useState<
    "all" | RecruiterStatus
  >("all");

  const [error, setError] = useState<
    string | null
  >(null);

  const filteredCandidates =
    filter === "all"
      ? candidates
      : candidates.filter(
          (candidate) =>
            (candidate.recruiter_status ?? "new") ===
            filter
        );

  function handleStatusChange(
    analysisId: string,
    status: RecruiterStatus
  ) {
    setError(null);

    startTransition(async () => {
      const result =
        await updateRecruiterStatus(
          analysisId,
          status
        );

      if (!result.success) {
        setError(
          result.error ??
            "Failed to update candidate status."
        );

        return;
      }

      window.location.reload();
    });
  }

  return (
    <section className="mt-5 rounded-xl border border-border p-6 sm:p-8">
      <div className="flex flex-col gap-5 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="font-mono text-[11px] tracking-[0.08em] text-accent">
            CANDIDATE PIPELINE
          </p>

          <h2 className="mt-3 font-display text-2xl font-semibold text-ink">
            Candidates
          </h2>

          <p className="mt-2 text-sm leading-[1.6] text-ink-dim">
            Review candidates analyzed for this
            position and manage their recruiting
            status.
          </p>
        </div>

        <Link
          href={`/dashboard/agents/recruitos/analyze?jobId=${jobId}`}
          className="inline-flex w-fit rounded-lg bg-accent px-5 py-3 text-sm font-medium text-bg transition-opacity hover:opacity-90"
        >
          Analyze candidate
        </Link>
      </div>

      {/* Filters */}

      <div className="mt-8 flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => setFilter("all")}
          className={`rounded-lg border px-4 py-2 text-xs font-medium transition-colors ${
            filter === "all"
              ? "border-accent text-accent"
              : "border-border text-ink-dim hover:border-accent hover:text-accent"
          }`}
        >
          All ({candidates.length})
        </button>

        {(
          [
            "new",
            "reviewing",
            "interview",
            "rejected",
            "hired",
          ] as RecruiterStatus[]
        ).map((status) => {
          const count = candidates.filter(
            (candidate) =>
              (candidate.recruiter_status ?? "new") ===
              status
          ).length;

          return (
            <button
              key={status}
              type="button"
              onClick={() => setFilter(status)}
              className={`rounded-lg border px-4 py-2 text-xs font-medium transition-colors ${
                filter === status
                  ? statusColors[status]
                  : "border-border text-ink-dim hover:border-accent hover:text-accent"
              }`}
            >
              {statusLabels[status]} ({count})
            </button>
          );
        })}
      </div>

      {error && (
        <p
          role="alert"
          className="mt-5 text-sm text-red-400"
        >
          {error}
        </p>
      )}

      {/* Empty state */}

      {filteredCandidates.length === 0 && (
        <div className="mt-8 rounded-lg border border-border p-8 text-center">
          {candidates.length === 0 ? (
            <>
              <p className="text-sm font-medium text-ink">
                No candidates yet.
              </p>

              <p className="mt-2 text-sm text-ink-dim">
                Analyze a candidate to start building
                your pipeline.
              </p>

              <Link
                href={`/dashboard/agents/recruitos/analyze?jobId=${jobId}`}
                className="mt-5 inline-flex rounded-lg bg-accent px-5 py-3 text-sm font-medium text-bg"
              >
                Analyze first candidate
              </Link>
            </>
          ) : (
            <>
              <p className="text-sm font-medium text-ink">
                No candidates in this stage.
              </p>

              <p className="mt-2 text-sm text-ink-dim">
                Try selecting a different status filter.
              </p>
            </>
          )}
        </div>
      )}

      {/* Candidate list */}

      <div className="mt-8 space-y-4">
        {filteredCandidates.map(
          (candidate) => {
            const recruiterStatus =
              candidate.recruiter_status ?? "new";

            return (
              <div
                key={candidate.id}
                className="rounded-lg border border-border p-5 sm:p-6"
              >
                <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-3">
                      <span
                        className={`font-mono text-2xl font-semibold ${
                          candidate.match_score >= 75
                            ? "text-green-400"
                            : candidate.match_score >= 50
                              ? "text-yellow-400"
                              : "text-red-400"
                        }`}
                      >
                        {candidate.match_score}
                      </span>

                      <span className="text-xs text-ink-dim">
                        / 100 match
                      </span>

                      <span
                        className={`text-xs font-medium ${getRecommendationColor(
                          candidate.recommendation
                        )}`}
                      >
                        {getRecommendationLabel(
                          candidate.recommendation
                        )}
                      </span>

                      <span
                        className={`rounded-full border px-3 py-1 text-[10px] font-medium uppercase tracking-[0.08em] ${
                          statusColors[
                            recruiterStatus
                          ]
                        }`}
                      >
                        {
                          statusLabels[
                            recruiterStatus
                          ]
                        }
                      </span>
                    </div>

                    <p className="mt-4 text-sm leading-[1.7] text-ink-dim">
                      {candidate.summary}
                    </p>

                    <p className="mt-3 text-xs text-ink-dim">
                      Confidence:{" "}
                      <span className="capitalize text-ink">
                        {
                          candidate.confidence_level
                        }
                      </span>
                    </p>
                  </div>

                  <div className="flex flex-wrap gap-3 lg:shrink-0">
                    <Link
                      href={`/dashboard/agents/recruitos/analyze/${candidate.resume_id}?jobId=${jobId}`}
                      className="rounded-lg border border-border px-4 py-2.5 text-xs font-medium text-ink transition-colors hover:border-accent hover:text-accent"
                    >
                      View analysis
                    </Link>

                    <select
                      value={recruiterStatus}
                      disabled={isPending}
                      onChange={(event) =>
                        handleStatusChange(
                          candidate.id,
                          event.target
                            .value as RecruiterStatus
                        )
                      }
                      className="rounded-lg border border-border bg-bg px-4 py-2.5 text-xs text-ink outline-none focus:border-accent disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      {(
                        [
                          "new",
                          "reviewing",
                          "interview",
                          "rejected",
                          "hired",
                        ] as RecruiterStatus[]
                      ).map((status) => (
                        <option
                          key={status}
                          value={status}
                        >
                          {statusLabels[status]}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              </div>
            );
          }
        )}
      </div>
    </section>
  );
}