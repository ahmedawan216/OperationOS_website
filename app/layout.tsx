import type { Metadata, Viewport } from "next";
import { IBM_Plex_Mono, Inter, Space_Grotesk } from "next/font/google";
import { Analytics } from "@vercel/analytics/next";
import { SpeedInsights } from "@vercel/speed-insights/next";
import { PostHogProvider } from "@/components/providers/posthog-provider";
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
    template: "%s | OperationOS.org",
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
    title: "OperationOS.org — The Operating System for AI Employees",
    description:
      "OperationOS helps businesses automate work with AI employees. RecruitOS is our first AI hiring employee that screens resumes, matches candidates, and accelerates recruitment.",
    url: "https://operationos.org/",
    siteName: "OperationOS.org",
    images: [
      {
        url: "https://operationos.org/images/og-image-v2.png",
        width: 1200,
        height: 630,
        alt: "OperationOS.org — The Operating System for AI Employees",
      },
    ],
    type: "website",
  },

  twitter: {
    card: "summary_large_image",
    title: "OperationOS.org — The Operating System for AI Employees",
    description:
      "OperationOS helps businesses automate work with AI employees.",
    images: ["https://operationos.org/images/og-image-v2.png"],
  },

  icons: {
    icon: "https://operationos.org/favicon.svg",
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
      <body>
        <a
          href="#main-content"
          className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-50 focus:rounded-md focus:bg-white focus:px-4 focus:py-2 focus:text-black"
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
        <Analytics />
        <SpeedInsights />
      </body>
    </html>
  );
}
