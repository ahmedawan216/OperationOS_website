import type { Metadata, Viewport } from "next";
import { IBM_Plex_Mono, Inter, Space_Grotesk } from "next/font/google";

import { Analytics } from "@vercel/analytics/next";
import { SpeedInsights } from "@vercel/speed-insights/next";
import { siteConfig } from "@/lib/site-config";
import { Footer } from "@/components/layout/footer";
import { Header } from "@/components/layout/header";
import { JsonLd } from "@/components/seo/json-ld";
import { FeedbackWidget } from "@/components/ui/feedback-widget";

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
    template: "%s — OperationOS.ai",
  },
  description: siteConfig.description,
  applicationName: siteConfig.name,
  keywords: [
    "OperationOS",
    "AI employees",
    "RecruitOS",
    "AI recruiting software",
    "AI agents for business",
    "multi-agent operating system",
    "AI hiring platform",
  ],
  authors: [{ name: siteConfig.name }],
  creator: siteConfig.name,
  publisher: siteConfig.name,
  alternates: {
    canonical: "/",
  },
  openGraph: {
    type: "website",
    url: siteConfig.url,
    siteName: siteConfig.name,
    title: siteConfig.title,
    description: siteConfig.description,
    locale: "en_US",
    // NOTE: no `images` array here on purpose — `app/opengraph-image.tsx`
    // is a Next.js file-convention route that already injects the right
    // og:image (and twitter:image, below) automatically. Also declaring
    // it here would emit duplicate <meta> tags for the same image.
  },
  twitter: {
    card: "summary_large_image",
    title: siteConfig.title,
    description: siteConfig.description,
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-image-preview": "large",
      "max-snippet": -1,
    },
  },
  icons: {
    icon: "/favicon.svg",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#08090c",
  colorScheme: "dark",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${spaceGrotesk.variable} ${inter.variable} ${ibmPlexMono.variable}`}
    >
      <body className="font-sans">
        <noscript>
          <style>{`.js-reveal { opacity: 1 !important; transform: none !important; }`}</style>
        </noscript>
        <JsonLd />
        <a
          href="#main-content"
          className="fixed left-3 top-3 z-[200] -translate-y-16 rounded-md bg-ink px-4 py-2 text-sm font-medium text-bg transition-transform duration-200 focus:translate-y-0"
        >
          Skip to content
        </a>
        <Header />
        <main id="main-content">{children}</main>
        <Footer />
        <FeedbackWidget />
        <Analytics />
        <SpeedInsights />
      </body>
    </html>
  );
}
