"use client";

import { useEffect, useId, useRef, useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { TrackedLink } from "@/components/analytics/tracked-link";

export function MobileNav() {
  const [open, setOpen] = useState(false);
  const menuId = useId();
  const toggleRef = useRef<HTMLButtonElement>(null);
  const firstLinkRef = useRef<HTMLAnchorElement>(null);

  useEffect(() => {
    if (!open) return;
    firstLinkRef.current?.focus();
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setOpen(false);
        toggleRef.current?.focus();
      }
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [open]);

  useEffect(() => {
    document.body.style.overflow = open ? "hidden" : "";
    return () => { document.body.style.overflow = ""; };
  }, [open]);

  const closeMenu = () => setOpen(false);

  return (
    <div>
      <Button ref={toggleRef} type="button" variant="quiet" size="sm" className="relative z-[140] h-11 w-11 px-0" aria-expanded={open} aria-controls={menuId} aria-label={open ? "Close menu" : "Open menu"} onClick={() => setOpen((value) => !value)}>
        <span className="relative block h-5 w-5" aria-hidden="true">
          <span className={`absolute left-0 top-1/2 block h-[1.5px] w-5 bg-ink transition-transform ${open ? "rotate-45" : "-translate-y-[6px]"}`} />
          <span className={`absolute left-0 top-1/2 block h-[1.5px] w-5 bg-ink transition-opacity ${open ? "opacity-0" : "opacity-100"}`} />
          <span className={`absolute left-0 top-1/2 block h-[1.5px] w-5 bg-ink transition-transform ${open ? "-rotate-45" : "translate-y-[6px]"}`} />
        </span>
      </Button>
      {open && (
        <>
          <button type="button" aria-label="Close navigation" className="fixed inset-0 z-[120] cursor-default bg-ink/20 backdrop-blur-sm" onClick={closeMenu} />
          <nav id={menuId} aria-label="Mobile navigation" className="fixed inset-x-0 top-[72px] z-[130] max-h-[calc(100dvh-72px)] overflow-y-auto border-b border-border bg-bg px-5 py-6 shadow-panel sm:px-8">
            <p className="type-meta mb-2 font-semibold uppercase text-ink-faint">Products</p>
            <Link ref={firstLinkRef} href="/recruitos" onClick={closeMenu} className="block min-h-11 rounded-md bg-surface px-4 py-3 ring-1 ring-border transition-colors hover:bg-surface-2 focus-visible:outline-none">
              <span className="block text-base font-semibold text-ink">RecruitOS</span>
              <span className="mt-1 block text-sm leading-5 text-ink-dim">AI-assisted recruiting workflows for clearer candidate decisions.</span>
            </Link>
            <Link href="/solutions" onClick={closeMenu} className="mt-3 flex min-h-11 items-center rounded-md px-4 text-sm font-semibold text-ink transition-colors hover:bg-surface-2 focus-visible:outline-none">
              Solutions
            </Link>
            <Link href="/pricing" onClick={closeMenu} className="mt-3 flex min-h-11 items-center rounded-md px-4 text-sm font-semibold text-ink transition-colors hover:bg-surface-2 focus-visible:outline-none">
              Pricing
            </Link>
            <Link href="/guidelines" onClick={closeMenu} className="mt-3 flex min-h-11 items-center rounded-md px-4 text-sm font-semibold text-ink transition-colors hover:bg-surface-2 focus-visible:outline-none">
              Guidelines
            </Link>
            <Link href="/blog" onClick={closeMenu} className="mt-3 flex min-h-11 items-center rounded-md px-4 text-sm font-semibold text-ink transition-colors hover:bg-surface-2 focus-visible:outline-none">
              Blog
            </Link>
            <Button asChild className="mt-5 w-full"><TrackedLink href="/recruitos#waitlist" eventName="recruitos_cta_clicked" eventProperties={{ product: "recruitos", location: "header", action: "join_waitlist" }} onClick={closeMenu}>Get started</TrackedLink></Button>
          </nav>
        </>
      )}
    </div>
  );
}
