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
  name: "OperationOS.ai",
  url: process.env.NEXT_PUBLIC_SITE_URL ?? "https://operationos.ai",
  title: "OperationOS.ai — The Operating System for AI Employees",
  /** Kept under ~160 characters so it doesn't get truncated on the SERP. */
  description:
    "OperationOS is the operating system for AI employees. RecruitOS, the first agent live today, screens and ranks candidates with full reasoning — under your control.",
  ogImagePath: "/opengraph-image",
} as const;
