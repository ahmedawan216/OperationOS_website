import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "OperationOS Blog | AI Employees, Product Updates & Automation",
  description:
    "Insights on AI employees, automation, RecruitOS, future OperationOS products, and the future of AI-powered work.",
};

export default function BlogPage() {
  return (
    <main className="mx-auto max-w-4xl px-6 py-24">
      <h1 className="text-5xl font-bold tracking-tight">OperationOS Blog</h1>

      <p className="mt-6 text-lg text-muted-foreground">
        Articles about AI employees, automation, OperationOS products,
         company updates, and the future of work.
      </p>

      <div className="mt-16 rounded-xl border p-8">
        <h2 className="text-2xl font-semibold">Coming Soon 🚀</h2>

        <p className="mt-4 text-muted-foreground">
          We're preparing in-depth articles covering RecruitOS,
           future OperationOS products, AI employees, automation,
           product updates, and the future of intelligent work.
        </p>
      </div>
    </main>
  );
}