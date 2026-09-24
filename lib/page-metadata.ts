import type { Metadata } from "next";
import { siteConfig } from "@/lib/site-config";

export function createPageMetadata(
  title: string,
  description: string,
  path: string,
): Metadata {
  return {
    title,
    description,
    alternates: { canonical: path },
    openGraph: {
      title: `${title} | OperationOS`,
      description,
      url: path,
      siteName: siteConfig.name,
      type: "website",
      images: [
        {
          url: siteConfig.logoPath,
          width: 1024,
          height: 1024,
          alt: "OperationOS H1 mark",
        },
      ],
    },
    twitter: {
      card: "summary",
      title: `${title} | OperationOS`,
      description,
      images: [siteConfig.logoPath],
    },
  };
}
