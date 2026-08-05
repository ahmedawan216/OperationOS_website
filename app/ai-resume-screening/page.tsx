import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "AI Resume Screening | Faster Candidate Screening with RecruitOS",
  description:
    "Learn how AI resume screening helps recruiters evaluate candidates faster, reduce manual work, and make more consistent hiring decisions with explainable AI.",
};

export default function AIResumeScreeningPage() {
  return (
    <main className="mx-auto max-w-4xl px-6 py-24">
      <article className="prose prose-neutral dark:prose-invert max-w-none">

        <h1>AI Resume Screening</h1>

        <p>
          AI resume screening helps recruiters review hundreds or even
          thousands of applications in minutes instead of days. Rather than
          relying only on keyword matching, modern AI can evaluate skills,
          experience, qualifications, and job relevance while providing clear
          explanations behind every recommendation.
        </p>

        <h2>Why companies use AI for resume screening</h2>

        <p>
          Hiring teams receive more applications than ever before. Reviewing
          every resume manually is time-consuming and often leads to inconsistent
          evaluations.
        </p>

        <p>
          AI helps recruiters spend less time sorting resumes and more time
          speaking with qualified candidates.
        </p>

        <ul>
          <li>Review thousands of resumes quickly</li>
          <li>Reduce repetitive manual work</li>
          <li>Rank candidates consistently</li>
          <li>Highlight relevant experience</li>
          <li>Provide transparent reasoning for every recommendation</li>
        </ul>

        <h2>How AI resume screening works</h2>

        <p>
          Modern AI recruiting systems analyze resumes against the job
          requirements instead of relying solely on keywords. They compare
          candidate experience, technical skills, education, certifications,
          achievements, and career progression to produce an overall assessment.
        </p>

        <p>
          The best AI systems also explain why a candidate was recommended,
          allowing recruiters to stay in complete control of hiring decisions.
        </p>

        <h2>Manual screening vs AI screening</h2>

        <table>
          <thead>
            <tr>
              <th>Manual Screening</th>
              <th>AI Resume Screening</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>Hours or days</td>
              <td>Minutes</td>
            </tr>
            <tr>
              <td>Can be inconsistent</td>
              <td>Consistent evaluation criteria</td>
            </tr>
            <tr>
              <td>Hard to review every resume equally</td>
              <td>Reviews every application</td>
            </tr>
            <tr>
              <td>Limited explanations</td>
              <td>Explainable recommendations</td>
            </tr>
          </tbody>
        </table>

        <h2>How RecruitOS helps</h2>

        <p>
          RecruitOS is OperationOS's AI recruiting employee. It screens resumes,
          ranks candidates, summarizes qualifications, and explains every
          recommendation so recruiters always understand why someone is a strong
          match.
        </p>

        <p>
          RecruitOS assists recruiters instead of replacing them, allowing
          hiring teams to make faster and better-informed decisions.
        </p>

        <h2>Frequently Asked Questions</h2>

        <h3>Can AI replace recruiters?</h3>

        <p>
          No. AI helps automate repetitive screening tasks, but recruiters make
          the final hiring decisions.
        </p>

        <h3>Does AI only look for keywords?</h3>

        <p>
          Modern AI evaluates context, experience, skills, and qualifications,
          not just keyword matches.
        </p>

        <h3>Is AI resume screening accurate?</h3>

        <p>
          When properly trained and configured, AI can significantly improve
          screening speed and consistency while helping recruiters identify the
          most relevant candidates.
        </p>

      </article>
    </main>
  );
}