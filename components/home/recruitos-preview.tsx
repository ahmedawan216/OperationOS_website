import Image from "next/image";

export function RecruitOSPreview() {
  return (
    <section className="mx-auto max-w-7xl px-6 py-32">
      <div className="mx-auto max-w-3xl text-center">
        <p className="mb-4 text-xs uppercase tracking-[0.35em] text-ink-dim">
          PRODUCT PREVIEW
        </p>

        <h2 className="text-4xl font-semibold tracking-tight text-ink sm:text-5xl">
          Meet your first AI employee.
        </h2>

        <p className="mt-6 text-lg leading-8 text-ink-dim">
          RecruitOS analyzes resumes, scores candidates, explains every hiring
          decision, and helps you identify the strongest applicants in minutes.
        </p>
      </div>

      <div className="mt-16 overflow-hidden rounded-3xl border border-border bg-surface shadow-2xl">
        <Image
          src="/images/recruitos-preview-2.png"
          alt="RecruitOS Dashboard"
          width={1600}
          height={900}
          className="w-full"
          priority
        />
      </div>

      <div className="mt-16 grid gap-6 md:grid-cols-3">
        <div className="rounded-2xl border border-border bg-surface p-6">
          <div className="mb-4 text-3xl">📄</div>
          <h3 className="mb-2 text-xl font-semibold text-ink">
            Upload resumes
          </h3>
          <p className="text-ink-dim">
            Upload resumes in seconds and let RecruitOS extract candidate data automatically.
          </p>
        </div>

        <div className="rounded-2xl border border-border bg-surface p-6">
          <div className="mb-4 text-3xl">🧠</div>
          <h3 className="mb-2 text-xl font-semibold text-ink">
            AI Analysis
          </h3>
          <p className="text-ink-dim">
            Evaluate skills, experience, strengths, weaknesses, and job fit instantly.
          </p>
        </div>

        <div className="rounded-2xl border border-border bg-surface p-6">
          <div className="mb-4 text-3xl">✅</div>
          <h3 className="mb-2 text-xl font-semibold text-ink">
            Hire confidently
          </h3>
          <p className="text-ink-dim">
            Make faster hiring decisions with clear AI recommendations and reasoning.
          </p>
        </div>
      </div>
    </section>
  );
}