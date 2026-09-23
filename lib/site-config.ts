/**
 * Single source of truth for site-wide identity/SEO facts. Consumed by
 * `app/layout.tsx` (metadata + JSON-LD), `app/sitemap.ts`, `app/robots.ts`,
 * and the footer.
 *
 * `url` reads from `NEXT_PUBLIC_SITE_URL` first so preview/staging
 * deployments (e.g. Vercel preview URLs) get correct canonical/OG URLs
 * without editing source — falls back to the production domain.
 */
const siteUrl = (process.env.NEXT_PUBLIC_SITE_URL ?? "https://operationos.org").replace(/\/+$/, "");

export const siteConfig = {
  name: "OperationOS",
  organizationName: "OperationOS",
  url: siteUrl,
  title: "OperationOS | Focused Software for Operational Work",
  /** Kept under ~160 characters so it doesn't get truncated on the SERP. */
  description:
    "OperationOS is an AI and software company building focused intelligent products for real workflows. RecruitOS is its first live product.",
  logoPath: "/brand/operationos-avatar-light-1024.png",
} as const;

export const recruitosConfig = {
  appUrl: "https://recruitos.operationos.org",
  signUpUrl: "https://recruitos.operationos.org/sign-up",
  signInUrl: "https://recruitos.operationos.org/sign-in",
} as const;

export function getRecruitOSCheckoutUrl(plan: "standard" | "pro") {
  return `${recruitosConfig.appUrl}/checkout?plan=${plan}`;
}
