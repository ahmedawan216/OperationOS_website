import type { Metadata, Viewport } from "next";
import { IBM_Plex_Mono, Inter, Space_Grotesk } from "next/font/google";

import { Analytics } from "@vercel/analytics/next";
import { SpeedInsights } from "@vercel/speed-insights/next";
import { PostHogProvider } from "@/components/providers/posthog-provider";
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
    template: "%s | OperationOS.ai",
  },

  description: siteConfig.description,

  keywords: [
    "AI employees",
    "AI workforce",
    "AI recruiting",
    "AI hiring",
    "RecruitOS",
    "resume screening",
    "candidate matching",
    "AI recruitment software",
    "AI HR software",
    "LLM recruiting",
    "AI automation",
  ],

  alternates: {
    canonical: "/",
  },

  openGraph: {
    title: siteConfig.title,
    description: siteConfig.description,
    url: siteConfig.url,
    siteName: siteConfig.name,
    locale: "en_US",
    type: "website",

    images: [
      {
        url: "/images/recruitos-preview-2.png",
        width: 1600,
        height: 900,
        alt: "RecruitOS Dashboard",
      },
    ],
  },

  twitter: {
    card: "summary_large_image",
    title: siteConfig.title,
    description: siteConfig.description,
    images: ["/images/recruitos-preview-2.png"],
  },

  robots: {
    index: true,
    follow: true,

    googleBot: {
      index: true,
      follow: true,
      "max-image-preview": "large",
      "max-video-preview": -1,
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
      data-scroll-behavior="smooth"
      className={`${spaceGrotesk.variable} ${inter.variable} ${ibmPlexMono.variable}`}
    >
      <body className="font-sans">
        <PostHogProvider>
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
        </PostHogProvider>
      </body>
    </html>
  );
}
