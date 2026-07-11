import { z } from "zod";

/**
 * Feedback form schema. Name and email are genuinely optional (people
 * should be able to send anonymous feedback); feedback itself is the only
 * required field, with a floor high enough to filter out empty/junk
 * submissions without being annoying about it.
 */
export const feedbackFormSchema = z.object({
  name: z
    .string()
    .trim()
    .max(80, "Keep your name under 80 characters.")
    .optional(),
  // `z.union([z.literal(""), ...])` (rather than plain `.optional()`) is
  // what lets an empty string pass validation while still enforcing a
  // real email format for anything the person actually types.
  email: z
    .union([
      z.literal(""),
      z.string().trim().email("Enter a valid email address."),
    ])
    .optional(),
  feedback: z
    .string()
    .trim()
    .min(10, "Give us a bit more detail — 10 characters minimum.")
    .max(2000, "Keep your feedback under 2000 characters."),
});

export type FeedbackFormValues = z.infer<typeof feedbackFormSchema>;
