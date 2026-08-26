"use client";

import { useState, useTransition } from "react";
import { addCandidateNote } from "@/app/actions/candidate-notes";

export default function CandidateNoteForm({ candidateId }: { candidateId: string }) {
  const [content, setContent] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function submit() {
    setError(null);
    startTransition(async () => {
      const result = await addCandidateNote(candidateId, content, `/dashboard/agents/recruitos/candidates/${candidateId}`);
      if (!result.success) return setError(result.error ?? "Could not save note.");
      setContent("");
      window.location.reload();
    });
  }

  return <div><textarea value={content} onChange={(event) => setContent(event.target.value)} rows={4} maxLength={5000} placeholder="Add a private recruiter note..." className="w-full resize-y rounded-lg border border-border bg-transparent px-4 py-3 text-sm leading-[1.6] text-ink outline-none placeholder:text-ink-dim focus:border-accent" /><div className="mt-3 flex items-center justify-between gap-4"><p className="text-xs text-red-400">{error}</p><button type="button" disabled={pending || !content.trim()} onClick={submit} className="rounded-lg bg-accent px-5 py-2.5 text-sm font-medium text-bg disabled:cursor-not-allowed disabled:opacity-50">{pending ? "Saving..." : "Add note"}</button></div></div>;
}
