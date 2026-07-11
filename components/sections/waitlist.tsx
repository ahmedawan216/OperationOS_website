"use client";

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
  const inputId = useId();

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    const trimmed = email.trim();
    const isValid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed);

    if (!isValid) {
      setError("Enter a valid work email to continue.");
      return;
    }

    setError(null);
    // NOTE: wire this up to your waitlist provider (e.g. a route handler
    // under app/api/waitlist or a third-party form endpoint) before launch.
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
                    onChange={(event) => setEmail(event.target.value)}
                    aria-invalid={Boolean(error)}
                    aria-describedby={error ? `${inputId}-error` : undefined}
                    required
                  />
                  <Button type="submit" variant="terminal" size="sm" className="sm:shrink-0">
                    run →
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
