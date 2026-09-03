/**
 * Single source of truth for site-wide identity/SEO facts. Consumed by
 * `app/layout.tsx` (metadata + JSON-LD), `app/sitemap.ts`, `app/robots.ts`,
 * and the footer.
 *
 * `url` reads from `NEXT_PUBLIC_SITE_URL` first so preview/staging
 * deployments (e.g. Vercel preview URLs) get correct canonical/OG URLs
 * without editing source — falls back to the production domain.
 */
export const siteConfig = {
  name: "OperationOS.org",
  url: process.env.NEXT_PUBLIC_SITE_URL ?? "https://operationos.org",
  title: "OperationOS.org | Focused Software for Operational Work",
  /** Kept under ~160 characters so it doesn't get truncated on the SERP. */
  description:
    "OperationOS builds focused software products for operational work. RecruitOS helps hiring teams review candidates and keep hiring workflows organized.",
  ogImagePath: "/opengraph-image",
} as const;
