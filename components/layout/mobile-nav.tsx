"use client";

import { useEffect, useId, useRef, useState } from "react";
import Link from "next/link";
import { navLinks } from "@/lib/data";
import { Button } from "@/components/ui/button";

export function MobileNav() {
  const [open, setOpen] = useState(false);
  const menuId = useId();
  const toggleRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;

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
    return () => {
      document.body.style.overflow = "";
    };
  }, [open]);

  function closeMenu() {
    setOpen(false);
  }

  return (
    <div className="lg:hidden">
      <Button
        ref={toggleRef}
        type="button"
        variant="ghost"
        size="sm"
        className="relative z-[140] h-10 w-10 border-0 p-0"
        aria-expanded={open}
        aria-controls={menuId}
        aria-label={open ? "Close menu" : "Open menu"}
        onClick={() => setOpen((value) => !value)}
      >
        <span className="relative block h-5 w-5" aria-hidden="true">
          <span className={`absolute left-0 top-1/2 block h-[1.5px] w-5 origin-center bg-ink transition-transform duration-200 ${open ? "rotate-45" : "-translate-y-[6px]"}`} />
          <span className={`absolute left-0 top-1/2 block h-[1.5px] w-5 bg-ink transition-opacity duration-150 ${open ? "opacity-0" : "opacity-100"}`} />
          <span className={`absolute left-0 top-1/2 block h-[1.5px] w-5 origin-center bg-ink transition-transform duration-200 ${open ? "-rotate-45" : "translate-y-[6px]"}`} />
        </span>
      </Button>

      {open && (
        <>
          <button
            type="button"
            aria-label="Close navigation"
            className="fixed inset-0 z-[120] cursor-default bg-black/80 backdrop-blur-md"
            onClick={closeMenu}
          />
          <nav
            id={menuId}
            aria-label="Mobile navigation"
            className="fixed inset-x-0 top-16 z-[130] max-h-[calc(100dvh-4rem)] overflow-y-auto border-b border-border bg-[#08090c] px-4 py-5 shadow-2xl sm:px-6"
          >
            <div className="space-y-1">
              {navLinks.map((link) => (
                <Link
                  key={link.href}
                  href={link.href}
                  onClick={closeMenu}
                  className="block rounded-lg px-3 py-3.5 text-sm font-medium text-ink transition-colors hover:bg-white/[0.06] hover:text-white focus-visible:bg-white/[0.06] focus-visible:text-white focus-visible:outline-none"
                >
                  {link.label}
                </Link>
              ))}
            </div>

            <div className="mt-4 border-t border-border pt-4">
              <Link href="/#waitlist" onClick={closeMenu} className="block rounded-lg px-3 py-3.5 text-sm font-medium text-accent hover:bg-accent/[0.08]">Join waitlist</Link>
            </div>
          </nav>
        </>
      )}
    </div>
  );
}
