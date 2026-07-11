import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

interface SectionProps {
  id?: string;
  children: ReactNode;
  className?: string;
}

/**
 * Shared outer section wrapper: consistent horizontal padding, max-width,
 * and vertical rhythm (`py-24`) across every content section below the
 * hero (which is intentionally bespoke — see `hero.tsx`).
 *
 * Centralizing this fixed a real inconsistency: `how-it-works.tsx` used
 * to carry an accidental `py-[30px]` top padding that no sibling section
 * shared — copy-paste drift rather than an intentional design choice.
 */
export function Section({ id, children, className }: SectionProps) {
  return (
    <section id={id} className={cn("px-5 py-24 sm:px-8", className)}>
      <div className="mx-auto max-w-wrap">{children}</div>
    </section>
  );
}
