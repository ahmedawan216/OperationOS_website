"use client";

import type { ReactNode } from "react";
import { motion, useReducedMotion } from "framer-motion";

import { DURATIONS, EASE_OUT_EXPO } from "@/lib/motion";
import { cn } from "@/lib/utils";

interface RevealProps {
  children: ReactNode;
  /** Additional delay before the reveal starts, in seconds. Used to stagger groups of elements. */
  delay?: number;
  /** Render as a different element (e.g. "section" or "li") when semantics require it. */
  as?: "div" | "section" | "li";
  className?: string;
}

/**
 * Scroll-triggered fade + rise for below-the-fold content, fired once per
 * element the first time it enters the viewport. (The Hero uses a plain
 * CSS animation instead — see `components/sections/hero.tsx` for why.)
 *
 * Falls back to a simple opacity fade with no motion when the user has
 * requested reduced motion. The `js-reveal` class is a progressive-
 * enhancement hook: if JavaScript never runs at all, a global `<noscript>`
 * rule in `app/layout.tsx` forces it back to fully visible instead of
 * leaving it stuck at Framer Motion's server-rendered `opacity: 0`.
 */
export function Reveal({ delay = 0, as = "div", className, children }: RevealProps) {
  const shouldReduceMotion = useReducedMotion();

  const animation = {
    initial: { opacity: 0, y: shouldReduceMotion ? 0 : 16 },
    whileInView: { opacity: 1, y: 0 },
    viewport: { once: true, amount: 0.15 },
    transition: {
      duration: shouldReduceMotion ? 0.01 : DURATIONS.reveal,
      ease: EASE_OUT_EXPO,
      delay,
    },
  };

  const mergedClassName = cn("js-reveal", className);

  if (as === "section") {
    return (
      <motion.section className={mergedClassName} {...animation}>
        {children}
      </motion.section>
    );
  }

  if (as === "li") {
    return (
      <motion.li className={mergedClassName} {...animation}>
        {children}
      </motion.li>
    );
  }

  return (
    <motion.div className={mergedClassName} {...animation}>
      {children}
    </motion.div>
  );
}
