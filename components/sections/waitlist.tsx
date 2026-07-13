"use client";

import { supabase } from "@/lib/supabase";
import { useId, useState, type FormEvent } from "react";
import { Check } from "lucide-react";

import { Section } from "@/components/layout/section";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Reveal } from "@/components/ui/reveal";
import { SectionHeading } from "@/components/ui/section-heading";

export function Waitlist() {
  const [email, setEmail] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const inputId = useId();

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
  event.preventDefault();

  const trimmed = email.trim();
  const isValid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed);

  if (!isValid) {
    setError("Enter a valid work email to continue.");
    return;
  }

  setError(null);
  setLoading(true);

  try {
    const { error } = await supabase
      .from("waitlist")
      .insert([{ email: trimmed }]);

    if (error) {
      if (error.code === "23505") {
        throw new Error(
          "You're already on the waitlist. We'll be in touch when a spot opens up."
        );
      }

      throw new Error("Something went wrong. Please try again.");
    }

    const response = await fetch("/api/waitlist", {
  method: "POST",
  headers: {
    "Content-Type": "application/json",
  },
  body: JSON.stringify({
    email: trimmed,
  }),
});

if (!response.ok) {
  throw new Error("Failed to send confirmation email.");
}

    setSubmitted(true);
    setEmail("");
  } catch (err) {
    setError(
      err instanceof Error
        ? err.message
        : "Something went wrong. Please try again."
    );
  } finally {
    setLoading(false);
  }

  setEmail("");
  setSubmitted(true);
};

  return (
    <Section id="waitlist" className="text-center">
      <div className="mx-auto max-w-[560px]">
        <Reveal>
          <SectionHeading
            eyebrow="Early access"
            title="Get RecruitOS before your competitors do."
            description="We’re onboarding a limited number of teams each month. Join the waitlist and we’ll reach out when a seat opens up."
          />
        </Reveal>

        <Reveal delay={0.1}>
          <div className="rounded-xl border border-border bg-surface px-5 py-5 text-left sm:px-7 sm:py-7">
            <div
              className="mb-5 flex items-center gap-2 font-mono text-[11px] text-ink-dim"
              aria-hidden="true"
            >
              <span className="h-2 w-2 rounded-full bg-border-strong" />
              <span className="h-2 w-2 rounded-full bg-border-strong" />
              <span className="h-2 w-2 rounded-full bg-border-strong" />
              <span className="ml-2">waitlist.sh</span>
            </div>

            {submitted ? (
              <p
                role="status"
                aria-live="polite"
                className="flex items-center gap-2.5 font-mono text-[13.5px] text-success"
              >
                <Check className="h-4 w-4" aria-hidden="true" />
                You&rsquo;re on the list — we&rsquo;ll be in touch.
              </p>
            ) : (
              <form onSubmit={handleSubmit} noValidate>
                <label
                  htmlFor={inputId}
                  className="mb-2 flex items-center gap-2 font-mono text-[13.5px] text-ink-dim"
                >
                  <span className="text-accent" aria-hidden="true">
                    $
                  </span>
                  join --email
                </label>
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
                  <Input
                    id={inputId}
                    type="email"
                    inputMode="email"
                    autoComplete="email"
                    placeholder="you@company.com"
                    value={email}
                    disabled={loading}
                    onChange={(event) => setEmail(event.target.value)}
                    aria-invalid={Boolean(error)}
                    aria-describedby={error ? `${inputId}-error` : undefined}
                    required
                  />
                  <Button type="submit" variant="terminal" size="sm" className="sm:shrink-0" disabled={loading}>
                    {loading ? "Joining..." : "run →"}
                  </Button>
                </div>
                {error && (
                  <p
                    id={`${inputId}-error`}
                    role="alert"
                    className="mt-2.5 font-mono text-xs text-danger"
                  >
                    {error}
                  </p>
                )}
              </form>
            )}
          </div>
        </Reveal>
      </div>
    </Section>
  );
}
