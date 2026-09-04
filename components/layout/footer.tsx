import Link from "next/link";
import { siteConfig } from "@/lib/site-config";
import { Logo } from "@/components/ui/logo";

export function Footer() {
  const year = new Date().getFullYear();
  return (
    <footer className="border-t border-border bg-bg-secondary">
      <div className="container-standard py-12 sm:py-14">
        <div className="grid gap-10 sm:grid-cols-[1fr_auto_auto] sm:items-start sm:gap-12">
          <div>
            <Logo />
            <p className="mt-4 max-w-sm text-sm leading-6 text-ink-dim">Practical software for important work, designed to stay clear as your team moves faster.</p>
          </div>
          <nav aria-labelledby="footer-products-heading">
            <h2 id="footer-products-heading" className="type-meta font-semibold uppercase text-ink-faint">Products</h2>
            <Link className="mt-3 inline-flex min-h-11 items-center text-sm font-medium text-ink underline-offset-4 hover:text-accent hover:underline" href="/recruitos">RecruitOS</Link>
          </nav>
          <nav aria-labelledby="footer-resources-heading">
            <h2 id="footer-resources-heading" className="type-meta font-semibold uppercase text-ink-faint">Resources</h2>
            <div className="mt-3 flex flex-col items-start">
              <Link className="inline-flex min-h-11 items-center text-sm font-medium text-ink underline-offset-4 hover:text-accent hover:underline" href="/pricing">Pricing</Link>
              <Link className="inline-flex min-h-11 items-center text-sm font-medium text-ink underline-offset-4 hover:text-accent hover:underline" href="/guidelines">Guidelines</Link>
              <Link className="inline-flex min-h-11 items-center text-sm font-medium text-ink underline-offset-4 hover:text-accent hover:underline" href="/blog">Blog</Link>
            </div>
          </nav>
        </div>
        <div className="mt-10 flex flex-col gap-3 border-t border-border pt-6 text-sm text-ink-dim sm:flex-row sm:items-center sm:justify-between">
          <a className="w-fit underline decoration-border-strong underline-offset-4 hover:text-accent hover:decoration-accent" href="mailto:operationos.org@gmail.com">operationos.org@gmail.com</a>
          <p>© {year} {siteConfig.name}</p>
        </div>
      </div>
    </footer>
  );
}
