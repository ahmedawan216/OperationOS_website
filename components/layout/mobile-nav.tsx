"use client";

import { useEffect, useId, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { navLinks } from "@/lib/data";
import { DURATIONS, EASE_OUT_EXPO } from "@/lib/motion";
import { signOut } from "@/app/auth/actions";
import { Button } from "@/components/ui/button";

const dashboardLinks = [
  { label: "Overview", href: "/dashboard" },
  { label: "RecruitOS", href: "/dashboard/agents/recruitos" },
  { label: "Jobs", href: "/dashboard/agents/recruitos/jobs" },
  { label: "Candidates", href: "/dashboard/agents/recruitos/candidates" },
];

export function MobileNav({ isAuthenticated = false, dashboard = false }: { isAuthenticated?: boolean; dashboard?: boolean }) {
  const [open, setOpen] = useState(false);
  const menuId = useId();
  const toggleRef = useRef<HTMLButtonElement>(null);
  const links = dashboard ? dashboardLinks : navLinks;

  const close = (returnFocus: boolean) => {
    setOpen(false);
    if (returnFocus) toggleRef.current?.focus();
  };

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (event: KeyboardEvent) => { if (event.key === "Escape") close(true); };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [open]);

  useEffect(() => {
    document.body.style.overflow = open ? "hidden" : "";
    return () => { document.body.style.overflow = ""; };
  }, [open]);

  return <div className="sm:hidden">
    <Button ref={toggleRef} type="button" variant="ghost" size="sm" className="relative h-9 w-9 border-0 p-0" aria-expanded={open} aria-controls={menuId} aria-label={open ? "Close menu" : "Open menu"} onClick={() => setOpen((prev) => !prev)}>
      <span className="relative block h-3.5 w-5" aria-hidden="true">
        <motion.span className="absolute left-0 right-0 h-[1.5px] bg-ink" animate={open ? { top: "6px", rotate: 45 } : { top: "0px", rotate: 0 }} transition={{ duration: DURATIONS.menuIcon, ease: EASE_OUT_EXPO }} />
        <motion.span className="absolute left-0 right-0 top-1.5 h-[1.5px] bg-ink" animate={{ opacity: open ? 0 : 1 }} transition={{ duration: DURATIONS.menuIconFade }} />
        <motion.span className="absolute left-0 right-0 h-[1.5px] bg-ink" animate={open ? { top: "6px", rotate: -45 } : { top: "12px", rotate: 0 }} transition={{ duration: DURATIONS.menuIcon, ease: EASE_OUT_EXPO }} />
      </span>
    </Button>

    <AnimatePresence>
      {open && <motion.nav id={menuId} aria-label={dashboard ? "Dashboard mobile navigation" : "Mobile"} initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} transition={{ duration: DURATIONS.menuPanel, ease: EASE_OUT_EXPO }} className="fixed inset-x-0 top-16 z-40 max-h-[calc(100dvh-4rem)] overflow-y-auto border-b border-border bg-bg/[0.98] px-5 py-4 shadow-panel">
        {dashboard && <div className="mb-3 border-b border-border pb-3"><p className="font-mono text-[10px] tracking-[0.08em] text-accent">RECRUITOS WORKSPACE</p><p className="mt-1 text-xs text-ink-dim">Recruiting command center</p></div>}
        <div className="space-y-1">
          {links.map((link) => <a key={link.href} href={link.href} onClick={() => close(false)} className="block rounded-lg px-3 py-3 text-sm text-ink-dim transition-colors hover:bg-ink/[0.04] hover:text-ink focus-visible:text-ink">{link.label}</a>)}
        </div>
        {isAuthenticated ? (
          <form action={signOut} className="mt-3 border-t border-border pt-3"><button type="submit" onClick={() => close(false)} className="block w-full rounded-lg px-3 py-3 text-left text-sm text-ink transition-colors hover:bg-ink/[0.04] hover:text-ink">Sign out</button></form>
        ) : (
          <div className="mt-3 border-t border-border pt-3"><a href="/sign-in" onClick={() => close(false)} className="block rounded-lg px-3 py-3 text-sm text-ink">Sign in</a><a href="/sign-up" onClick={() => close(false)} className="block rounded-lg px-3 py-3 text-sm text-accent">Create an account</a></div>
        )}
      </motion.nav>}
    </AnimatePresence>
  </div>;
}
