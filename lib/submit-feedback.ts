import type { FeedbackFormValues } from "@/lib/validation";

export interface SubmitFeedbackResult {
  success: true;
}

/**
 * Placeholder for the real feedback endpoint — no backend is wired up yet.
 * Simulates network latency with `setTimeout()` so the modal's loading
 * state has something to show, and simulates an occasional failure so the
 * error state is actually reachable/verifiable during development rather
 * than being dead code.
 *
 * Swap the body for a real call before launch, e.g.:
 *
 *   const res = await fetch("/api/feedback", {
 *     method: "POST",
 *     headers: { "Content-Type": "application/json" },
 *     body: JSON.stringify(values),
 *   });
 *   if (!res.ok) throw new Error("Failed to send feedback.");
 *   return { success: true };
 *
 * The function signature is intentionally already shaped for that swap —
 * callers don't need to change.
 */
export async function submitFeedback(
  values: FeedbackFormValues
): Promise<SubmitFeedbackResult> {
  return new Promise((resolve, reject) => {
    setTimeout(() => {
      // No backend yet — log the payload so the shape is visible while
      // wiring up the real endpoint. Remove once `fetch(...)` replaces this.
      console.info("[submitFeedback] payload", values);

      // ~12% simulated failure rate, purely so the error UI is exercised
      // during development/demo. Remove once this calls a real endpoint —
      // real error handling should be driven by the actual response.
      const simulatedFailure = Math.random() < 0.12;

      if (simulatedFailure) {
        reject(new Error("Couldn't send your feedback. Please try again."));
        return;
      }

      resolve({ success: true });
    }, 1200);
  });
}
