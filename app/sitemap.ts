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
      path: "/blog",
      lastModified: "2026-08-08",
      changeFrequency: "weekly" as const,
      priority: 0.8,
    },
    {
      path: "/ai-resume-screening",
      lastModified: "2026-08-06",
      changeFrequency: "monthly" as const,
      priority: 0.9,
    },
    {
      path: "/privacy",
      lastModified: "2026-08-08",
      changeFrequency: "yearly" as const,
      priority: 0.5,
    },
  ];

  return routes.map((route) => ({
    url: `${siteConfig.url}${route.path}`,
    lastModified: route.lastModified,
    changeFrequency: route.changeFrequency,
    priority: route.priority,
  }));
}