import { siteConfig } from "@/lib/site-config";

/**
 * Organization + WebSite structured data (schema.org via JSON-LD). Purely
 * additive for search engines — improves SERP presentation eligibility
 * (sitelinks search box, knowledge panel signals) and costs nothing at
 * runtime since it's server-rendered as static JSON.
 *
 * Safe to use `dangerouslySetInnerHTML` here: the payload is built entirely
 * from our own static `siteConfig` constants, never from user input.
 */
export function JsonLd() {
  const json = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "SoftwareApplication",
        name: "RecruitOS",
        applicationCategory: "BusinessApplication",
        operatingSystem: "Web",

        description:
          "RecruitOS is AI-assisted recruiting software that helps hiring teams review candidates against job requirements and organize hiring workflows.",

        url: `${siteConfig.url}/recruitos`,

        creator: {
          "@id": `${siteConfig.url}/#organization`,
        },
      },
      {
        "@type": "WebSite",
        "@id": `${siteConfig.url}/#website`,
        url: siteConfig.url,
        name: siteConfig.name,
        publisher: { "@id": `${siteConfig.url}/#organization` },
      },
    ],
  };

  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(json) }}
    />
  );
}
