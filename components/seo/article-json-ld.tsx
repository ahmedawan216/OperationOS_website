export function JsonLd() {
  const data = { "@context": "https://schema.org", "@type": "Article", headline: "AI Resume Screening: How It Works (Complete Guide for Recruiters in 2026)", mainEntityOfPage: "https://operationos.org/blog/ai-resume-screening", datePublished: "2026-08-06", author: { "@type": "Person", name: "Ahmed Awan" }, publisher: { "@id": "https://operationos.org/#organization" } };
  return <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(data).replace(/</g, "\\u003c") }} />;
}
