import type { Metadata, Viewport } from "next";
import { IBM_Plex_Mono, Inter, Space_Grotesk } from "next/font/google";
import { PostHogProvider } from "@/components/providers/posthog-provider";
import { VercelAnalytics } from "@/components/providers/vercel-analytics";
import { siteConfig } from "@/lib/site-config";
import { JsonLd } from "@/components/seo/json-ld";
import { FeedbackWidget } from "@/components/ui/feedback-widget";
import { Header } from "@/components/layout/header";
import { Footer } from "@/components/layout/footer";

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
    template: "%s | OperationOS",
  },

  description: siteConfig.description,

  alternates: {
    canonical: "/",
  },

  openGraph: {
    title: siteConfig.title,
    description: siteConfig.description,
    url: "/",
    siteName: siteConfig.name,
    images: [
      {
        url: siteConfig.logoPath,
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
    description: siteConfig.description,
    images: [siteConfig.logoPath],
  },

  icons: {
    icon: [
      { url: siteConfig.logoPath, type: "image/png", sizes: "1024x1024" },
      { url: "/brand/favicon-48.png", type: "image/png", sizes: "48x48" },
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
    shortcut: "/favicon.ico",
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
      <body>
        <a
          href="#main-content"
          className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[200] focus:rounded-md focus:bg-ink focus:px-4 focus:py-3 focus:text-bg focus:shadow-panel"
        >
          Skip to content
        </a>

        <Header />

        <PostHogProvider>
          <main id="main-content">{children}</main>
        </PostHogProvider>

        <Footer />

        <JsonLd />
        <FeedbackWidget />
        <VercelAnalytics />
      </body>
    </html>
  );
}
