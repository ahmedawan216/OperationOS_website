"use client";

import { signOut } from "@/app/auth/actions";
import { navLinks } from "@/lib/data";
import { cn } from "@/lib/utils";
import { useScrolled } from "@/hooks/use-scrolled";
import { Button } from "@/components/ui/button";
import { Logo } from "@/components/ui/logo";
import { MobileNav } from "@/components/layout/mobile-nav";

const dashboardLinks = [
  { label: "Overview", href: "/dashboard" },
  { label: "RecruitOS", href: "/dashboard/agents/recruitos" },
  { label: "Jobs", href: "/dashboard/agents/recruitos/jobs" },
  { label: "Candidates", href: "/dashboard/agents/recruitos/candidates" },
];

export function HeaderClient({
  isAuthenticated,
  email,
  dashboard = false,
}: {
  isAuthenticated: boolean;
  email?: string;
  dashboard?: boolean;
}) {
  const scrolled = useScrolled(20);
  const links = dashboard ? dashboardLinks : navLinks;

  return (
    <header className={cn("fixed inset-x-0 top-0 z-[100] border-b border-transparent transition-[background-color,border-color] duration-400 ease-out-expo", scrolled && "border-border bg-bg/[0.88] backdrop-blur-md backdrop-saturate-[140%]")}>
      <nav aria-label={dashboard ? "Dashboard" : "Primary"} className="mx-auto flex h-16 max-w-wrap items-center justify-between px-4 sm:px-6 lg:px-8">
        <div className="flex min-w-0 items-center gap-5">
          <Logo />
          {dashboard && <span className="hidden h-5 w-px bg-border sm:block" aria-hidden="true" />}
          {dashboard && <span className="hidden font-mono text-[10px] tracking-[0.08em] text-accent sm:block">RECRUITOS</span>}
        </div>

        <div className="hidden items-center gap-1 sm:flex">
          {links.map((link) => (
            <a key={link.href} href={link.href} className="rounded-md px-3 py-2 text-[13px] text-ink-dim transition-colors duration-200 ease-out-expo hover:bg-ink/[0.04] hover:text-ink focus-visible:text-ink">
              {link.label}
            </a>
          ))}
        </div>

        <div className="flex items-center gap-2 sm:gap-3">
          {isAuthenticated && dashboard && email && <span className="hidden max-w-[180px] truncate text-xs text-ink-dim lg:block" title={email}>{email}</span>}
          {isAuthenticated ? (
            <form action={signOut} className="hidden sm:block">
              <Button type="submit" variant="ghost" size="sm">Sign out</Button>
            </form>
          ) : (
            <Button asChild variant="ghost" size="sm" className="hidden sm:inline-flex"><a href="/sign-in">Sign in</a></Button>
          )}
          <MobileNav isAuthenticated={isAuthenticated} dashboard={dashboard} />
        </div>
      </nav>
    </header>
  );
}
