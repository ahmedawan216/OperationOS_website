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
        "@type": "Organization",
        "@id": `${siteConfig.url}/#organization`,
        name: siteConfig.name,
        url: siteConfig.url,
        logo: `${siteConfig.url}/favicon.svg`,
        description: siteConfig.description,
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
