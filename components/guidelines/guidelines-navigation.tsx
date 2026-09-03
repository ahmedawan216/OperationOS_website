"use client";

import { useEffect, useId, useRef, useState } from "react";
import Link from "next/link";
import { ChevronDown } from "lucide-react";
import { usePathname } from "next/navigation";

import { guidelinesGroups, guidelinesPages } from "@/lib/guidelines";
import { cn } from "@/lib/utils";

function NavigationLinks({ onNavigate }: { onNavigate?: () => void }) {
  const pathname = usePathname();

  return (
    <div className="space-y-7">
      {guidelinesGroups.map((group) => (
        <div key={group.label}>
          <p className="type-meta mb-2 font-mono font-medium uppercase text-ink-faint">{group.label}</p>
          <ul className="space-y-1">
            {group.items.map((item) => {
              const active = pathname === item.href;
              return (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    aria-current={active ? "page" : undefined}
                    onClick={onNavigate}
                    className={cn(
                      "flex min-h-11 items-center rounded-md border-l-2 px-3 text-sm transition-colors focus-visible:outline-none",
                      active
                        ? "border-accent bg-accent-soft font-semibold text-ink"
                        : "border-transparent font-medium text-ink-dim hover:bg-surface-2 hover:text-ink",
                    )}
                  >
                    {item.title}
                  </Link>
                </li>
              );
            })}
          </ul>
        </div>
      ))}
    </div>
  );
}

export function GuidelinesNavigation() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const navigationId = useId();
  const buttonRef = useRef<HTMLButtonElement>(null);
  const currentPage = guidelinesPages.find((page) => page.href === pathname);

  useEffect(() => setOpen(false), [pathname]);

  useEffect(() => {
    if (!open) return;
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setOpen(false);
        buttonRef.current?.focus();
      }
    };
    document.addEventListener("keydown", closeOnEscape);
    return () => document.removeEventListener("keydown", closeOnEscape);
  }, [open]);

  return (
    <>
      <div className="border-b border-border bg-bg-secondary py-4 lg:hidden">
        <div>
          <button
            ref={buttonRef}
            type="button"
            aria-expanded={open}
            aria-controls={navigationId}
            onClick={() => setOpen((value) => !value)}
            className="flex min-h-11 w-full items-center justify-between rounded-md border border-border-strong bg-surface px-4 text-left focus-visible:outline-none"
          >
            <span>
              <span className="block text-xs font-medium text-ink-faint">Guidelines</span>
              <span className="mt-0.5 block text-sm font-semibold text-ink">{currentPage?.title ?? "Browse sections"}</span>
            </span>
            <ChevronDown className={cn("h-4 w-4 text-ink-dim transition-transform", open && "rotate-180")} aria-hidden="true" />
          </button>
          {open && (
            <nav id={navigationId} aria-label="Guidelines" className="mt-3 rounded-md border border-border bg-surface p-4 shadow-lift">
              <NavigationLinks onNavigate={() => setOpen(false)} />
            </nav>
          )}
        </div>
      </div>

      <aside className="hidden lg:block">
        <nav aria-label="Guidelines" className="sticky top-24 py-12">
          <Link href="/guidelines" className="mb-8 inline-flex min-h-11 items-center font-display text-lg font-semibold text-ink underline-offset-4 hover:text-accent hover:underline">
            OperationOS Guidelines
          </Link>
          <NavigationLinks />
        </nav>
      </aside>
    </>
  );
}
