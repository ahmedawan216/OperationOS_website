import type { ReactNode } from "react";
import Link from "next/link";
import { ArrowLeft, ArrowRight } from "lucide-react";

import { getGuidelinesNeighbors, type GuidelinesPath } from "@/lib/guidelines";

interface GuidelinesArticleProps {
  path: GuidelinesPath;
  eyebrow: string;
  title: string;
  description: string;
  children: ReactNode;
}

export function GuidelinesArticle({ path, eyebrow, title, description, children }: GuidelinesArticleProps) {
  const { previous, next } = getGuidelinesNeighbors(path);

  return (
    <article className="min-w-0 py-12 sm:py-16 lg:py-20">
      <nav aria-label="Breadcrumb" className="mb-8 flex items-center gap-2 text-sm text-ink-faint">
        <Link href="/guidelines" className="underline-offset-4 hover:text-accent hover:underline">Guidelines</Link>
        <span aria-hidden="true">/</span>
        <span aria-current="page">{eyebrow}</span>
      </nav>

      <header className="max-w-reading border-b border-border pb-10">
        <p className="type-meta font-mono font-medium uppercase text-accent">{eyebrow}</p>
        <h1 className="type-h1 mt-5 font-display font-semibold text-ink">{title}</h1>
        <p className="type-body-lg mt-6 text-ink-dim">{description}</p>
      </header>

      <div className="guidelines-prose max-w-reading py-10 sm:py-12">{children}</div>

      <nav aria-label="Previous and next Guidelines pages" className="grid max-w-reading gap-3 border-t border-border pt-8 sm:grid-cols-2">
        {previous ? (
          <Link href={previous.href} className="group rounded-md border border-border bg-surface p-4 transition-colors hover:border-border-strong hover:bg-surface-2">
            <span className="flex items-center gap-2 text-xs font-medium text-ink-faint"><ArrowLeft className="h-4 w-4" aria-hidden="true" /> Previous</span>
            <span className="mt-2 block font-semibold text-ink group-hover:text-accent">{previous.title}</span>
          </Link>
        ) : <span />}
        {next && (
          <Link href={next.href} className="group rounded-md border border-border bg-surface p-4 text-right transition-colors hover:border-border-strong hover:bg-surface-2">
            <span className="flex items-center justify-end gap-2 text-xs font-medium text-ink-faint">Next <ArrowRight className="h-4 w-4" aria-hidden="true" /></span>
            <span className="mt-2 block font-semibold text-ink group-hover:text-accent">{next.title}</span>
          </Link>
        )}
      </nav>
    </article>
  );
}
