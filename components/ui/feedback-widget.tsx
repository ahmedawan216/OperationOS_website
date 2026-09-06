"use client";

import { useState } from "react";
import dynamic from "next/dynamic";
import { MessageCircle } from "lucide-react";

import { trackEvent } from "@/lib/analytics";

const FeedbackModal = dynamic(
  () => import("@/components/ui/feedback-modal").then((module) => module.FeedbackModal),
  { ssr: false },
);

/**
 * Global floating feedback trigger. The form and dialog dependencies load
 * only after the first interaction, then stay mounted so close animations
 * and form state continue to work normally.
 */
export function FeedbackWidget() {
  const [open, setOpen] = useState(false);
  const [hasOpened, setHasOpened] = useState(false);

  return (
    <>
      <button
        type="button"
        onClick={() => {
          trackEvent("feedback_opened", { location: "global" });
          setHasOpened(true);
          setOpen(true);
        }}
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-label="Share feedback"
        className="fixed bottom-5 right-5 z-[120] flex h-14 w-14 items-center justify-center rounded-full bg-ink text-bg shadow-[0_0_0_1px_var(--color-border),0_8px_28px_-6px_var(--color-accent-dim)] transition-[box-shadow,transform] duration-200 ease-out-expo hover:scale-[1.08] hover:shadow-[0_0_0_1px_var(--color-accent-dim),0_10px_34px_-4px_var(--color-accent-dim)] active:scale-[0.94] motion-reduce:transform-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-bg sm:bottom-8 sm:right-8"
      >
        <MessageCircle className="h-6 w-6" aria-hidden="true" />
      </button>

      {hasOpened && <FeedbackModal open={open} onOpenChange={setOpen} />}
    </>
  );
}
