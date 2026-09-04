import type { MetadataRoute } from "next";
import { siteConfig } from "@/lib/site-config";

export default function sitemap(): MetadataRoute.Sitemap {
  const routes = [
    {
      path: "",
      lastModified: "2026-08-08",
      changeFrequency: "weekly" as const,
      priority: 1,
    },
    {
      path: "/recruitos",
      lastModified: "2026-09-03",
      changeFrequency: "monthly" as const,
      priority: 0.9,
    },
    {
      path: "/pricing",
      lastModified: "2026-09-04",
      changeFrequency: "monthly" as const,
      priority: 0.8,
    },
    {
      path: "/guidelines",
      lastModified: "2026-09-03",
      changeFrequency: "monthly" as const,
      priority: 0.8,
    },
    {
      path: "/guidelines/getting-started",
      lastModified: "2026-09-03",
      changeFrequency: "monthly" as const,
      priority: 0.7,
    },
    {
      path: "/guidelines/recruitos",
      lastModified: "2026-09-03",
      changeFrequency: "monthly" as const,
      priority: 0.7,
    },
    {
      path: "/guidelines/concepts",
      lastModified: "2026-09-03",
      changeFrequency: "monthly" as const,
      priority: 0.7,
    },
    {
      path: "/guidelines/account-billing",
      lastModified: "2026-09-03",
      changeFrequency: "monthly" as const,
      priority: 0.6,
    },
    {
      path: "/guidelines/privacy-security",
      lastModified: "2026-09-03",
      changeFrequency: "monthly" as const,
      priority: 0.6,
    },
    {
      path: "/blog",
      lastModified: "2026-08-08",
      changeFrequency: "weekly" as const,
      priority: 0.8,
    },
    {
      path: "/blog/ai-resume-screening",
      lastModified: "2026-08-06",
      changeFrequency: "monthly" as const,
      priority: 0.9,
    },
  ];

  return routes.map((route) => ({
    url: `${siteConfig.url}${route.path}`,
    lastModified: route.lastModified,
    changeFrequency: route.changeFrequency,
    priority: route.priority,
  }));
}
