"use client";

import { useEffect, useId, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";

import { navLinks } from "@/lib/data";
import { DURATIONS, EASE_OUT_EXPO } from "@/lib/motion";
import { Button } from "@/components/ui/button";

/**
 * Mobile equivalent of `.nav-links` + `.nav-toggle`. Shown only below the
 * `sm` breakpoint (the desktop <Header> renders its own inline nav links
 * above that).
 *
 * Keyboard behavior follows the ARIA APG "disclosure" pattern: the toggle
 * button controls visibility via `aria-expanded`, and closed content is
 * unmounted (via `AnimatePresence`) so it's never in the tab order. On
 * top of that baseline, closing via Escape or a link click returns focus
 * to the toggle button so keyboard users don't lose their place.
 */
export function MobileNav() {
  const [open, setOpen] = useState(false);
  const menuId = useId();
  const toggleRef = useRef<HTMLButtonElement>(null);

  const close = (returnFocus: boolean) => {
    setOpen(false);
    if (returnFocus) toggleRef.current?.focus();
  };

  useEffect(() => {
    if (!open) return;

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") close(true);
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [open]);

  // Prevent background scroll while the mobile menu is open.
  useEffect(() => {
    document.body.style.overflow = open ? "hidden" : "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [open]);

  return (
    <div className="sm:hidden">
      <Button
        ref={toggleRef}
        type="button"
        variant="ghost"
        size="sm"
        className="relative h-8 w-8 border-0 p-0"
        aria-expanded={open}
        aria-controls={menuId}
        aria-label={open ? "Close menu" : "Open menu"}
        onClick={() => setOpen((prev) => !prev)}
      >
        <span className="relative block h-3.5 w-5" aria-hidden="true">
          <motion.span
            className="absolute left-0 right-0 h-[1.5px] bg-ink"
            animate={open ? { top: "6px", rotate: 45 } : { top: "0px", rotate: 0 }}
            transition={{ duration: DURATIONS.menuIcon, ease: EASE_OUT_EXPO }}
          />
          <motion.span
            className="absolute left-0 right-0 top-1.5 h-[1.5px] bg-ink"
            animate={{ opacity: open ? 0 : 1 }}
            transition={{ duration: DURATIONS.menuIconFade }}
          />
          <motion.span
            className="absolute left-0 right-0 h-[1.5px] bg-ink"
            animate={open ? { top: "6px", rotate: -45 } : { top: "12px", rotate: 0 }}
            transition={{ duration: DURATIONS.menuIcon, ease: EASE_OUT_EXPO }}
          />
        </span>
      </Button>

      <AnimatePresence>
        {open && (
          <motion.nav
            id={menuId}
            aria-label="Mobile"
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: DURATIONS.menuPanel, ease: EASE_OUT_EXPO }}
            className="fixed inset-x-0 top-16 z-40 flex flex-col gap-1 border-b border-border bg-bg/[0.98] px-5 py-[22px]"
          >
            {navLinks.map((link) => (
              <a
                key={link.href}
                href={link.href}
                onClick={() => close(false)}
                className="py-2 text-[13.5px] text-ink-dim transition-colors duration-200 ease-out-expo hover:text-ink"
              >
                {link.label}
              </a>
            ))}
          </motion.nav>
        )}
      </AnimatePresence>
    </div>
  );
}
