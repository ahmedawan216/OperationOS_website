"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";
import { useScrolled } from "@/hooks/use-scrolled";
import { Button } from "@/components/ui/button";
import { Logo } from "@/components/ui/logo";
import { MobileNav } from "@/components/layout/mobile-nav";

export function HeaderClient() {
  const [productsOpen, setProductsOpen] = useState(false);
  const productsRef = useRef<HTMLDivElement>(null);
  const productsButtonRef = useRef<HTMLButtonElement>(null);
  const scrolled = useScrolled(12);

  useEffect(() => {
    if (!productsOpen) return;
    const close = (event: MouseEvent) => {
      if (!productsRef.current?.contains(event.target as Node)) setProductsOpen(false);
    };
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setProductsOpen(false);
        productsButtonRef.current?.focus();
      }
    };
    document.addEventListener("mousedown", close);
    document.addEventListener("keydown", closeOnEscape);
    return () => {
      document.removeEventListener("mousedown", close);
      document.removeEventListener("keydown", closeOnEscape);
    };
  }, [productsOpen]);

  return (
    <header className={cn("fixed inset-x-0 top-0 z-[100] border-b border-transparent bg-bg/95 transition-[background-color,border-color,box-shadow] duration-200", scrolled && "border-border bg-bg/90 shadow-[0_1px_0_rgba(24,26,31,0.03)] backdrop-blur-lg")}>
      <nav aria-label="Primary" className="container-wide flex h-[72px] items-center gap-6">
        <Logo />
        <div className="hidden flex-1 items-center justify-center gap-1 lg:flex">
          <div ref={productsRef} className="relative">
            <button ref={productsButtonRef} type="button" aria-expanded={productsOpen} aria-haspopup="true" aria-controls="products-navigation" onClick={() => setProductsOpen((value) => !value)} className="flex min-h-11 items-center gap-1.5 rounded-md px-3 text-sm font-medium text-ink-dim transition-colors hover:bg-surface-2 hover:text-ink focus-visible:outline-none">
              Products
              <ChevronDown className={cn("h-4 w-4 transition-transform", productsOpen && "rotate-180")} aria-hidden="true" />
            </button>
            {productsOpen && (
              <div id="products-navigation" aria-label="Products" className="absolute left-0 top-[calc(100%+8px)] w-[320px] rounded-lg border border-border bg-surface p-2 shadow-panel">
                <Link href="/recruitos" onClick={() => setProductsOpen(false)} className="block rounded-md px-4 py-3 transition-colors hover:bg-surface-2 focus-visible:outline-none">
                  <span className="block text-sm font-semibold text-ink">RecruitOS</span>
                  <span className="mt-1 block text-sm leading-5 text-ink-dim">Review, compare, and understand candidates with AI-assisted recruiting workflows.</span>
                </Link>
              </div>
            )}
          </div>
          <Link href="/guidelines" className="flex min-h-11 items-center rounded-md px-3 text-sm font-medium text-ink-dim transition-colors hover:bg-surface-2 hover:text-ink focus-visible:outline-none">
            Guidelines
          </Link>
          <Link href="/blog" className="flex min-h-11 items-center rounded-md px-3 text-sm font-medium text-ink-dim transition-colors hover:bg-surface-2 hover:text-ink focus-visible:outline-none">
            Blog
          </Link>
        </div>
        <div className="ml-auto hidden shrink-0 items-center gap-2 lg:flex">
          <Button asChild size="sm"><Link href="/recruitos#waitlist">Get started</Link></Button>
        </div>
        <div className="ml-auto lg:hidden"><MobileNav /></div>
      </nav>
    </header>
  );
}
