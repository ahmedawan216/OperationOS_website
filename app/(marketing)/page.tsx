import Link from "next/link";

export default function MarketingPage() {
  return (
    <div className="min-h-screen bg-bg text-ink">
      {/* Hero */}
      <section className="mx-auto max-w-7xl px-6 pb-24 pt-36 sm:px-8 lg:px-12">
        <div className="max-w-4xl">
          <p className="mb-6 font-mono text-[11px] tracking-[0.12em] text-accent">
            OPERATIONOS
          </p>

          <h1 className="font-display text-[clamp(44px,7vw,88px)] font-semibold leading-[0.98] tracking-[-0.04em]">
            AI employees
            <br />
            for real work.
          </h1>

          <p className="mt-8 max-w-2xl text-[17px] leading-[1.7] text-ink-dim">
            OperationOS gives businesses AI employees that handle
            repetitive work, make decisions, and keep humans in control.
          </p>

          <div className="mt-10 flex flex-wrap gap-3">
            <a
              href="#waitlist"
              className="rounded-lg bg-ink px-5 py-3 text-sm font-medium text-bg transition-opacity hover:opacity-85"
            >
              Get early access
            </a>

            <Link
              href="/dashboard"
              className="rounded-lg border border-border px-5 py-3 text-sm text-ink-dim transition-colors hover:border-ink-dim hover:text-ink"
            >
              Explore OperationOS →
            </Link>
          </div>
        </div>
      </section>

      {/* RecruitOS */}
      <section className="border-y border-border">
        <div className="mx-auto grid max-w-7xl gap-12 px-6 py-24 sm:px-8 lg:grid-cols-2 lg:px-12">
          <div>
            <p className="mb-5 font-mono text-[11px] tracking-[0.1em] text-accent">
              EMPLOYEE 001
            </p>

            <h2 className="font-display text-4xl font-semibold tracking-[-0.03em] sm:text-5xl">
              Meet RecruitOS.
            </h2>

            <p className="mt-6 max-w-xl text-[16px] leading-[1.7] text-ink-dim">
              Your AI recruiting employee for resume analysis, candidate
              screening, and hiring decisions.
            </p>

            <Link
              href="/dashboard/agents/recruitos"
              className="mt-8 inline-flex text-sm text-ink transition-colors hover:text-accent"
            >
              Explore RecruitOS →
            </Link>
          </div>

          <div className="rounded-xl border border-border p-6">
            <div className="mb-8 flex items-center justify-between">
              <span className="font-mono text-xs text-accent">
                RECRUITOS
              </span>

              <span className="rounded-full border border-accent/20 bg-accent/[0.06] px-3 py-1 font-mono text-[10px] text-accent">
                ACTIVE
              </span>
            </div>

            <div className="space-y-3">
              <div className="rounded-lg border border-border p-4">
                <p className="text-sm font-medium">Analyze resumes</p>
                <p className="mt-1 text-xs text-ink-dim">
                  Understand candidate fit against a job.
                </p>
              </div>

              <div className="rounded-lg border border-border p-4">
                <p className="text-sm font-medium">Compare candidates</p>
                <p className="mt-1 text-xs text-ink-dim">
                  Review analyzed candidates in one workspace.
                </p>
              </div>

              <div className="rounded-lg border border-border p-4">
                <p className="text-sm font-medium">Manage hiring roles</p>
                <p className="mt-1 text-xs text-ink-dim">
                  Control which jobs RecruitOS works on.
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* How it works */}
      <section className="mx-auto max-w-7xl px-6 py-24 sm:px-8 lg:px-12">
        <p className="mb-5 font-mono text-[11px] tracking-[0.1em] text-ink-dim">
          HOW IT WORKS
        </p>

        <h2 className="max-w-2xl font-display text-4xl font-semibold tracking-[-0.03em] sm:text-5xl">
          Give your AI employees work.
          <br />
          Stay in control.
        </h2>

        <div className="mt-14 grid gap-4 md:grid-cols-3">
          <div className="rounded-xl border border-border p-6">
            <span className="font-mono text-sm text-accent">01</span>

            <h3 className="mt-8 font-display text-xl font-semibold">
              Assign work
            </h3>

            <p className="mt-3 text-sm leading-[1.7] text-ink-dim">
              Give an AI employee a specific business task and the
              information it needs.
            </p>
          </div>

          <div className="rounded-xl border border-border p-6">
            <span className="font-mono text-sm text-accent">02</span>

            <h3 className="mt-8 font-display text-xl font-semibold">
              Let it execute
            </h3>

            <p className="mt-3 text-sm leading-[1.7] text-ink-dim">
              The employee handles repetitive work and surfaces useful
              decisions and results.
            </p>
          </div>

          <div className="rounded-xl border border-border p-6">
            <span className="font-mono text-sm text-accent">03</span>

            <h3 className="mt-8 font-display text-xl font-semibold">
              Stay in control
            </h3>

            <p className="mt-3 text-sm leading-[1.7] text-ink-dim">
              Review activity, understand decisions, and keep humans in
              control of important actions.
            </p>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section
        id="waitlist"
        className="border-t border-border"
      >
        <div className="mx-auto max-w-4xl px-6 py-28 text-center sm:px-8">
          <p className="font-mono text-[11px] tracking-[0.1em] text-accent">
            EARLY ACCESS
          </p>

          <h2 className="mt-5 font-display text-4xl font-semibold tracking-[-0.03em] sm:text-6xl">
            Build your AI workforce.
          </h2>

          <p className="mx-auto mt-6 max-w-xl text-[16px] leading-[1.7] text-ink-dim">
            Join the early access list and be among the first businesses
            using OperationOS.
          </p>

          <div className="mt-8">
            <Link
              href="/#waitlist"
              className="inline-flex rounded-lg bg-ink px-6 py-3 text-sm font-medium text-bg transition-opacity hover:opacity-85"
            >
              Get early access →
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}