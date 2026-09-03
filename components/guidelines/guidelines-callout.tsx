import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

interface GuidelinesCalloutProps {
  label?: "Note" | "Important" | "Decision";
  children: ReactNode;
}

export function GuidelinesCallout({ label = "Note", children }: GuidelinesCalloutProps) {
  return (
    <aside className={cn("my-8 border-l-2 border-accent bg-accent-soft px-5 py-4", label === "Decision" && "border-ink bg-bg-secondary")}>
      <p className="type-meta font-mono font-medium uppercase text-ink">{label}</p>
      <div className="mt-2 text-sm leading-6 text-ink-dim">{children}</div>
    </aside>
  );
}
