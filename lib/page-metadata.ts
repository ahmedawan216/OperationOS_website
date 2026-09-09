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
          url: "/brand/operationos-avatar-light-1024.png",
          width: 1024,
          height: 1024,
          alt: "OperationOS H1 mark",
        },
      ],
    },
    twitter: {
      card: "summary",
      title: `${title} | OperationOS.org`,
      description,
      images: ["/brand/operationos-avatar-light-1024.png"],
    },
  };
}
