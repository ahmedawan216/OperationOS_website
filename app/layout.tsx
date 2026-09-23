import type { Metadata, Viewport } from "next";
import { IBM_Plex_Mono, Inter, Space_Grotesk } from "next/font/google";
import { siteConfig } from "@/lib/site-config";

import "./globals.css";

const spaceGrotesk = Space_Grotesk({
  subsets: ["latin"],
  weight: ["500", "600", "700"],
  variable: "--font-display",
  display: "swap",
});

const inter = Inter({
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  variable: "--font-body",
  display: "swap",
});

const ibmPlexMono = IBM_Plex_Mono({
  subsets: ["latin"],
  weight: ["400", "500"],
  variable: "--font-mono",
  display: "swap",
});

export const metadata: Metadata = {
  metadataBase: new URL(siteConfig.url),

  title: {
    default: siteConfig.title,
    template: "%s | OperationOS.org",
  },

  description: siteConfig.description,

  alternates: {
    canonical: "/",
  },

  openGraph: {
    title: siteConfig.title,
    description:
      "OperationOS builds focused software products for operational work. RecruitOS helps hiring teams review candidates and keep hiring workflows organized.",
    url: "/",
    siteName: siteConfig.name,
    images: [
      {
        url: "/brand/operationos-avatar-light-1024.png",
        width: 1024,
        height: 1024,
        alt: "OperationOS H1 mark",
      },
    ],
    type: "website",
  },

  twitter: {
    card: "summary",
    title: siteConfig.title,
    description:
      "OperationOS builds focused software products for clear, efficient operational work.",
    images: ["/brand/operationos-avatar-light-1024.png"],
  },

  icons: {
    icon: [
      {
        url: "/brand/operationos-h1-mark-black.svg",
        type: "image/svg+xml",
        media: "(prefers-color-scheme: light)",
      },
      {
        url: "/brand/operationos-h1-mark-white.svg",
        type: "image/svg+xml",
        media: "(prefers-color-scheme: dark)",
      },
    ],
    apple: "/apple-icon.png",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#f7f6f2",
  colorScheme: "light",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      data-scroll-behavior="smooth"
      className={`${spaceGrotesk.variable} ${inter.variable} ${ibmPlexMono.variable}`}
    >
      <body>{children}</body>
    </html>
  );
}
