import type { FeedbackFormValues } from "@/lib/validation";

export interface SubmitFeedbackResult {
  success: true;
}

export async function submitFeedback(
  values: FeedbackFormValues
): Promise<SubmitFeedbackResult> {
  const res = await fetch("/api/feedback", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(values),
  });

  if (!res.ok) {
    throw new Error("Couldn't send your feedback. Please try again.");
  }

  return { success: true };
}