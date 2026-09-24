import { siteConfig } from "@/lib/site-config";

/**
 * Stable company and website identities shared across public pages.
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
        name: siteConfig.organizationName,
        url: siteConfig.url,
        logo: `${siteConfig.url}${siteConfig.logoPath}`,
        description: siteConfig.description,
        sameAs: ["https://www.linkedin.com/company/operationos/"],
      },
      {
        "@type": "WebSite",
        "@id": `${siteConfig.url}/#website`,
        url: siteConfig.url,
        name: siteConfig.name,
        publisher: { "@id": `${siteConfig.url}/#organization` },
        about: { "@id": `${siteConfig.url}/#organization` },
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

/** The company bridge describes the real application without claiming a rating or offer. */
export function RecruitOSJsonLd() {
  const json = {
    "@context": "https://schema.org",
    "@type": "SoftwareApplication",
    "@id": "https://recruitos.operationos.org/#softwareapplication",
    name: "RecruitOS",
    description:
      "An AI-powered recruiting workspace for analyzing resumes against roles, comparing candidates, and organizing recruiting work while people make hiring decisions.",
    url: "https://recruitos.operationos.org/",
    mainEntityOfPage: `${siteConfig.url}/recruitos`,
    publisher: { "@id": `${siteConfig.url}/#organization` },
    creator: { "@id": `${siteConfig.url}/#organization` },
    applicationCategory: "BusinessApplication",
  };

  return <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(json) }} />;
}
