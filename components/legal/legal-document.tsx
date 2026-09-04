import Link from "next/link";
import type { ReactNode } from "react";

interface LegalDocumentProps {
  eyebrow: string;
  title: string;
  description: string;
  children: ReactNode;
}

export function LegalDocument({
  eyebrow,
  title,
  description,
  children,
}: LegalDocumentProps) {
  return (
    <article className="pt-[72px]">
      <header className="border-b border-border">
        <div className="container-reading py-14 sm:py-18 lg:py-20">
          <p className="type-meta font-mono font-medium uppercase text-accent">{eyebrow}</p>
          <h1 className="type-h1 mt-5 font-display font-semibold text-ink">{title}</h1>
          <p className="type-body-lg mt-5 text-ink-dim">{description}</p>
          <p className="mt-6 font-mono text-xs uppercase tracking-[0.08em] text-ink-faint">
            Effective September 4, 2026
          </p>
        </div>
      </header>
      <div className="container-reading py-14 sm:py-18 lg:py-20">
        <div className="mb-10 border-l-2 border-accent bg-accent-soft px-5 py-4 text-sm leading-6 text-ink-dim">
          This is a baseline document for the current public website and should receive professional legal review before it is relied on as final legal guidance.
        </div>
        <div className="guidelines-prose">{children}</div>
        <nav aria-label="Legal pages" className="mt-14 flex flex-wrap gap-x-6 gap-y-2 border-t border-border pt-6 text-sm font-medium">
          <Link className="min-h-11 py-3 text-accent hover:text-accent-hover hover:underline" href="/privacy">Privacy Policy</Link>
          <Link className="min-h-11 py-3 text-accent hover:text-accent-hover hover:underline" href="/terms">Terms of Use</Link>
          <Link className="min-h-11 py-3 text-accent hover:text-accent-hover hover:underline" href="/contact">Contact OperationOS</Link>
        </nav>
      </div>
    </article>
  );
}
