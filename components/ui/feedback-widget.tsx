"use client";

import posthog from "posthog-js";
import { useState } from "react";
import { motion } from "framer-motion";
import { MessageCircle } from "lucide-react";

import { DURATIONS, EASE_OUT_EXPO } from "@/lib/motion";
import { FeedbackModal } from "@/components/ui/feedback-modal";

/**
 * Global floating feedback trigger. Mounted once in the root layout (see
 * `app/layout.tsx`) so it persists across every route, including the
 * 404/error pages. Owns the modal's open state and renders both the
 * button and <FeedbackModal> as a self-contained unit — mirroring how
 * <MobileNav> owns its own toggle + panel state.
 *
 * The entrance and hover/tap animations use two different transitions on
 * purpose: the mount fade+scale is slow and delayed (so it doesn't
 * compete with the hero's own entrance), while hover/tap use the fast
 * `DURATIONS.micro` — without that split, hover response would inherit
 * the slow entrance timing and feel sluggish.
 */
export function FeedbackWidget() {
  const [open, setOpen] = useState(false);

  return (
    <>
      <motion.button
        type="button"
        onClick={() => {
  posthog.capture("feedback_widget_opened");
  setOpen(true);
}}
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-label="Share feedback"
        className="fixed bottom-5 right-5 z-[120] flex h-14 w-14 items-center justify-center rounded-full bg-ink text-bg shadow-[0_0_0_1px_var(--color-border),0_8px_28px_-6px_var(--color-accent-dim)] transition-shadow duration-400 ease-out-expo hover:shadow-[0_0_0_1px_var(--color-accent-dim),0_10px_34px_-4px_var(--color-accent-dim)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-bg sm:bottom-8 sm:right-8"
        initial={{ opacity: 0, scale: 0 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: DURATIONS.reveal, ease: EASE_OUT_EXPO, delay: 0.8 }}
        whileHover={{ scale: 1.08, transition: { duration: DURATIONS.micro, ease: EASE_OUT_EXPO } }}
        whileTap={{ scale: 0.94, transition: { duration: DURATIONS.micro, ease: EASE_OUT_EXPO } }}
      >
        <MessageCircle className="h-6 w-6" aria-hidden="true" />
      </motion.button>

      <FeedbackModal open={open} onOpenChange={setOpen} />
    </>
  );
}
