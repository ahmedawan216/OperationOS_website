"use client";
 
import { useEffect, useState } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { AnimatePresence, motion } from "framer-motion";
import { AlertCircle, Check, Loader2, X } from "lucide-react";
import { useForm } from "react-hook-form";
 
import { cn } from "@/lib/utils";
import { DURATIONS, EASE_OUT_EXPO } from "@/lib/motion";
import { submitFeedback } from "@/lib/submit-feedback";
import { feedbackFormSchema, type FeedbackFormValues } from "@/lib/validation";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogOverlay,
  DialogPortal,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
 
type Status = "idle" | "submitting" | "success" | "error";
 
interface FeedbackModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}
 
/**
 * The feedback dialog itself — controlled (`open`/`onOpenChange`) so it's
 * a plain, reusable, testable component regardless of what triggers it.
 * Mounted today by `<FeedbackWidget>`, but nothing here depends on that.
 *
 * `DialogOverlay`/`DialogContent` are rendered with `asChild forceMount`
 * inside `<AnimatePresence>`, gated on our own `open` boolean rather than
 * Radix's internal presence handling — this is what lets a real Framer
 * Motion exit animation play instead of the dialog just vanishing.
 *
 * IMPORTANT: `DialogTitle`/`DialogDescription` are rendered exactly once,
 * *outside* the success/form branch — only their text swaps based on
 * `status`. Previously each branch had its own `<DialogTitle>`, which
 * meant React unmounted/remounted a *different* Title element whenever
 * `status` changed, instead of updating one stable one. That remount
 * could race with Radix's "did a Title register on this Content" check,
 * producing a console warning ("DialogContent requires a DialogTitle")
 * even though a title was technically present in both branches.
 */
export function FeedbackModal({ open, onOpenChange }: FeedbackModalProps) {
  const [status, setStatus] = useState<Status>("idle");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
 
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<FeedbackFormValues>({
    resolver: zodResolver(feedbackFormSchema),
    defaultValues: { name: "", email: "", feedback: "" },
  });
 
  // Start from a clean slate every time the modal is reopened — wait for
  // the exit animation to finish first so the reset isn't visible.
  useEffect(() => {
    if (open) return;
    const timeout = setTimeout(() => {
      setStatus("idle");
      setErrorMessage(null);
      reset();
    }, DURATIONS.menuPanel * 1000);
    return () => clearTimeout(timeout);
  }, [open, reset]);
 
  const isSubmitting = status === "submitting";
  const isSuccess = status === "success";
 
  const onSubmit = async (values: FeedbackFormValues) => {
    setStatus("submitting");
    setErrorMessage(null);
    try {
      await submitFeedback(values);
      setStatus("success");
    } catch (err) {
      setStatus("error");
      setErrorMessage(
        err instanceof Error ? err.message : "Something went wrong. Please try again."
      );
    }
  };
 
  const handleClose = () => {
    if (isSubmitting) return;
    onOpenChange(false);
  };
 
  return (
    <Dialog
    open={open}
    onOpenChange={(value) => {
            if (isSubmitting && !value) return;
            onOpenChange(value);
          }}
        >
      <AnimatePresence>
        {open && (
          <DialogPortal forceMount>
            <DialogOverlay asChild forceMount>
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: DURATIONS.menuPanel, ease: EASE_OUT_EXPO }}
              />
            </DialogOverlay>
 
            <DialogContent
              forceMount
              aria-labelledby="feedback-modal-title"
              aria-describedby="feedback-modal-description"
              onEscapeKeyDown={(event) => {
                if (isSubmitting) event.preventDefault();
              }}
              onPointerDownOutside={(event) => {
                if (isSubmitting) event.preventDefault();
              }}
            >
              <motion.div
                initial={{ opacity: 0, scale: 0.96, y: 8 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.96, y: 8 }}
                transition={{ duration: DURATIONS.menuPanel, ease: EASE_OUT_EXPO }}
                className="relative"
              >
                <DialogClose
                  aria-label="Close"
                  disabled={isSubmitting}
                  className="absolute right-0 top-0 rounded-md p-1 text-ink-dim transition-colors duration-200 ease-out-expo hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-surface disabled:pointer-events-none disabled:opacity-40"
                >
                  <X className="h-4 w-4" aria-hidden="true" />
                </DialogClose>
 
                {/* Single, stable Title/Description — only the text
                    changes with `status`, the elements themselves never
                    unmount/remount between branches. */}
                <div
                  className={cn(
                    "flex flex-col gap-1.5",
                    isSuccess ? "mb-4 items-center text-center" : "mb-6 pr-6 text-left"
                  )}
                >
                  {isSuccess && (
                    <span className="mb-2 flex h-11 w-11 items-center justify-center rounded-full border border-accent-dim bg-accent-soft">
                      <Check className="h-5 w-5 text-success" aria-hidden="true" />
                    </span>
                  )}
                  <DialogTitle id="feedback-modal-title">
                    {isSuccess ? "Thanks for the feedback!" : "Share your feedback"}
                  </DialogTitle>
                  <DialogDescription id="feedback-modal-description">
                    {isSuccess
                      ? "We read every note — this genuinely helps us build a better OperationOS."
                      : "We\u2019re building OperationOS together. Tell us what confused you, what you liked, or what you\u2019d improve."}
                  </DialogDescription>
                </div>
 
                {isSuccess ? (
                  <div
                    role="status"
                    aria-live="polite"
                    className="flex flex-col items-center text-center"
                  >
                    <Button type="button" size="default" onClick={() => onOpenChange(false)}>
                      Done
                    </Button>
                  </div>
                ) : (
                  <form
                    onSubmit={handleSubmit(onSubmit)}
                    noValidate
                    className="flex flex-col gap-5"
                  >
                    <div className="flex flex-col gap-1.5">
                      <Label htmlFor="feedback-name">
                        Name <span className="normal-case text-ink-faint">(optional)</span>
                      </Label>
                      <Input
                        id="feedback-name"
                        autoComplete="name"
                        placeholder="Jane Doe"
                        aria-invalid={Boolean(errors.name)}
                        aria-describedby={errors.name ? "feedback-name-error" : undefined}
                        {...register("name")}
                        disabled={isSubmitting}
                      />
                      {errors.name && (
                        <p id="feedback-name-error" role="alert" className="font-mono text-xs text-danger">
                          {errors.name.message}
                        </p>
                      )}
                    </div>
 
                    <div className="flex flex-col gap-1.5">
                      <Label htmlFor="feedback-email">
                        Email <span className="normal-case text-ink-faint">(optional)</span>
                      </Label>
                      <Input
                        id="feedback-email"
                        type="email"
                        inputMode="email"
                        autoComplete="email"
                        placeholder="you@company.com"
                        aria-invalid={Boolean(errors.email)}
                        aria-describedby={errors.email ? "feedback-email-error" : undefined}
                        {...register("email")}
                        disabled={isSubmitting}
                      />
                      {errors.email && (
                        <p id="feedback-email-error" role="alert" className="font-mono text-xs text-danger">
                          {errors.email.message}
                        </p>
                      )}
                    </div>
 
                    <div className="flex flex-col gap-1.5">
                      <Label htmlFor="feedback-message">Feedback</Label>
                      <Textarea
                        id="feedback-message"
                        rows={4}
                        placeholder="What worked, what didn't, what you'd love to see..."
                        aria-invalid={Boolean(errors.feedback)}
                        aria-describedby={errors.feedback ? "feedback-message-error" : undefined}
                        {...register("feedback")}
                        disabled={isSubmitting}
                      />
                      {errors.feedback && (
                        <p id="feedback-message-error" role="alert" className="font-mono text-xs text-danger">
                          {errors.feedback.message}
                        </p>
                      )}
                    </div>
 
                    {status === "error" && (
                      <p role="alert" className="flex items-start gap-2 font-mono text-xs text-danger">
                        <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                        {errorMessage}
                      </p>
                    )}
 
                    <div className="mt-1 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
                      <Button
                        type="button"
                        variant="ghost"
                        size="default"
                        onClick={handleClose}
                        disabled={isSubmitting}
                      >
                        Cancel
                      </Button>
                      <Button
                        type="submit"
                        size="default"
                        disabled={isSubmitting}
                        className="min-w-[112px]"
                      >
                        {isSubmitting ? (
                          <>
                            <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                            Sending…
                          </>
                        ) : (
                          "Submit"
                        )}
                      </Button>
                    </div>
                  </form>
                )}
              </motion.div>
            </DialogContent>
          </DialogPortal>
        )}
      </AnimatePresence>
    </Dialog>
  );
}
 