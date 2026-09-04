"use client";

import {
  Analytics,
  type BeforeSendEvent as WebAnalyticsEvent,
} from "@vercel/analytics/next";
import { SpeedInsights } from "@vercel/speed-insights/next";

function removeQueryAndHash(urlValue: string): string | null {
  try {
    const url = new URL(urlValue);
    return `${url.origin}${url.pathname}`;
  } catch {
    return null;
  }
}

function sanitizeWebAnalyticsEvent(event: WebAnalyticsEvent): WebAnalyticsEvent | null {
  const url = removeQueryAndHash(event.url);
  return url ? { ...event, url } : null;
}

function sanitizeSpeedInsightsEvent(event: { type: "vital"; url: string; route?: string }) {
  const url = removeQueryAndHash(event.url);
  return url ? { ...event, url } : null;
}

export function VercelAnalytics() {
  return (
    <>
      <Analytics beforeSend={sanitizeWebAnalyticsEvent} />
      <SpeedInsights beforeSend={sanitizeSpeedInsightsEvent} />
    </>
  );
}
