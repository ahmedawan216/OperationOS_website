"use client";

import { useId, useState, type FormEvent } from "react";
import { Check } from "lucide-react";

import { supabase } from "@/lib/supabase";
import { Section } from "@/components/layout/section";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

type FormError = {
  field: "name" | "email" | "form";
  message: string;
};

export function Waitlist() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState<FormError | null>(null);
  const [loading, setLoading] = useState(false);
  const nameId = useId();
  const emailId = useId();
  const errorId = useId();

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    const trimmedName = name.trim();
    const trimmedEmail = email.trim();
    const isValidEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmedEmail);

    if (!trimmedName) {
      setError({ field: "name", message: "Enter your name to continue." });
      return;
    }

    if (!isValidEmail) {
      setError({ field: "email", message: "Enter a valid work email to continue." });
      return;
    }

    setError(null);
    setLoading(true);

    try {
      const { error: databaseError } = await supabase.from("waitlist").insert([
        { name: trimmedName, email: trimmedEmail },
      ]);

      if (databaseError) {
        if (databaseError.code === "23505") {
          throw new Error("You are already on the waitlist. We will be in touch when a spot opens up.");
        }
        throw new Error("Something went wrong. Please try again.");
      }

      const response = await fetch("/api/waitlist", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: trimmedName, email: trimmedEmail }),
      });

      if (!response.ok) throw new Error("We could not send the confirmation email. Please try again.");

      setSubmitted(true);
      setName("");
      setEmail("");
    } catch (submissionError) {
      setError({
        field: "form",
        message:
          submissionError instanceof Error
            ? submissionError.message
            : "Something went wrong. Please try again.",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Section id="waitlist">
      <div className="overflow-hidden rounded-lg border border-border-strong bg-surface">
        <div className="grid lg:grid-cols-[0.9fr_1.1fr]">
          <div className="bg-accent px-6 py-10 text-white sm:px-10 sm:py-12 lg:px-12 lg:py-14">
            <p className="type-meta font-mono font-medium uppercase text-white/70">Get started with RecruitOS</p>
            <h2 className="type-h2 mt-5 font-display font-semibold text-white">
              Bring a clearer workflow to candidate review.
            </h2>
            <p className="mt-5 max-w-lg text-base leading-7 text-white/80">
              Share your details to receive updates when RecruitOS access becomes available.
            </p>
          </div>

          <div className="px-6 py-10 sm:px-10 sm:py-12 lg:px-12 lg:py-14">
            {submitted ? (
              <div role="status" aria-live="polite" className="flex min-h-[220px] flex-col justify-center">
                <span className="flex h-11 w-11 items-center justify-center rounded-full bg-accent-soft text-success">
                  <Check className="h-5 w-5" aria-hidden="true" />
                </span>
                <h3 className="mt-5 font-display text-2xl font-semibold text-ink">You are on the list.</h3>
                <p className="mt-2 text-sm leading-6 text-ink-dim">We will be in touch when RecruitOS access becomes available.</p>
              </div>
            ) : (
              <form onSubmit={handleSubmit} noValidate>
                <h3 className="font-display text-xl font-semibold text-ink">Request access</h3>
                <p className="mt-2 text-sm leading-6 text-ink-dim">Tell us where to send RecruitOS access updates.</p>

                <div className="mt-7 grid gap-5">
                  <div>
                    <label htmlFor={nameId} className="text-sm font-semibold text-ink">Name</label>
                    <Input id={nameId} type="text" autoComplete="name" value={name} disabled={loading} onChange={(event) => setName(event.target.value)} aria-invalid={error?.field === "name"} aria-describedby={error?.field === "name" ? errorId : undefined} className="mt-2 min-h-11 rounded-md border border-border-strong bg-bg px-3 font-sans" required />
                  </div>
                  <div>
                    <label htmlFor={emailId} className="text-sm font-semibold text-ink">Work email</label>
                    <Input id={emailId} type="email" inputMode="email" autoComplete="email" value={email} disabled={loading} onChange={(event) => setEmail(event.target.value)} aria-invalid={error?.field === "email"} aria-describedby={error?.field === "email" ? errorId : undefined} className="mt-2 min-h-11 rounded-md border border-border-strong bg-bg px-3 font-sans" required />
                  </div>
                </div>

                {error && <p id={errorId} role="alert" className="mt-4 text-sm font-medium text-danger">{error.message}</p>}

                <Button type="submit" className="mt-6 w-full sm:w-auto" disabled={loading}>
                  {loading ? "Requesting access..." : "Join the waitlist"}
                </Button>
              </form>
            )}
          </div>
        </div>
      </div>
    </Section>
  );
}
