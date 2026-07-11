"use client";

import { navLinks } from "@/lib/data";
import { cn } from "@/lib/utils";
import { useScrolled } from "@/hooks/use-scrolled";
import { Button } from "@/components/ui/button";
import { Logo } from "@/components/ui/logo";
import { MobileNav } from "@/components/layout/mobile-nav";

export function Header() {
  const scrolled = useScrolled(20);

  return (
    <header
      className={cn(
        "fixed inset-x-0 top-0 z-[100] border-b border-transparent transition-[background-color,border-color] duration-400 ease-out-expo",
        scrolled && "border-border bg-bg/[0.82] backdrop-blur-md backdrop-saturate-[140%]"
      )}
    >
      <nav
        aria-label="Primary"
        className="mx-auto flex h-16 max-w-wrap items-center justify-between px-5 sm:px-8"
      >
        <Logo />

        <div className="hidden items-center gap-[30px] sm:flex">
          {navLinks.map((link) => (
            <a
              key={link.href}
              href={link.href}
              className="text-[13.5px] text-ink-dim transition-colors duration-200 ease-out-expo hover:text-ink"
            >
              {link.label}
            </a>
          ))}
        </div>

        <div className="flex items-center gap-4">
          <Button asChild variant="ghost" className="hidden sm:inline-flex">
            <a href="#waitlist">Join waitlist</a>
          </Button>
          <MobileNav />
        </div>
      </nav>
    </header>
  );
}
