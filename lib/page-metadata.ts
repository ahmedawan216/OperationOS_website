import type { Metadata } from "next";

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
      title: `${title} | OperationOS.org`,
      description,
      url: path,
      siteName: "OperationOS.org",
      type: "website",
      images: [
        {
          url: "/images/og-image-v2.png",
          width: 1200,
          height: 630,
          alt: "OperationOS focused software for operational work",
        },
      ],
    },
    twitter: {
      card: "summary_large_image",
      title: `${title} | OperationOS.org`,
      description,
      images: ["/images/og-image-v2.png"],
    },
  };
}
