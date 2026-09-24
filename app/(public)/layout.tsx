import { Footer } from "@/components/layout/footer";
import { Header } from "@/components/layout/header";
import { PostHogProvider } from "@/components/providers/posthog-provider";
import { VercelAnalytics } from "@/components/providers/vercel-analytics";
import { JsonLd } from "@/components/seo/json-ld";
import { FeedbackWidget } from "@/components/ui/feedback-widget";

export default function PublicLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
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
    </>
  );
}
