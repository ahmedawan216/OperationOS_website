"use client";

import posthog from "posthog-js";

const attributionKey = "operationos_campaign_attribution";
const utmKeys = ["utm_source", "utm_medium", "utm_campaign", "utm_content", "utm_term"] as const;

type UtmKey = (typeof utmKeys)[number];
type Attribution = Partial<Record<UtmKey, string>>;

export interface AnalyticsProperties {
  recruitos_cta_clicked: {
    product: "recruitos";
    location: "header" | "homepage" | "solutions" | "pricing" | "recruitos";
    action: "explore_product" | "view_pricing";
  };
  recruitos_access_clicked: {
    product: "recruitos";
    source_page: "homepage" | "recruitos" | "pricing" | "solutions" | "contact" | "blog" | "guidelines" | "header";
    cta_location: string;
    destination: "sign_up" | "sign_in";
  };
  feedback_opened: { location: "global" };
  feedback_submitted: { location: "global" };
}

export type AnalyticsEventName = keyof AnalyticsProperties;

function sanitizeAttribution(value: string | null): string | undefined {
  if (!value) return undefined;
  const sanitized = value.trim().slice(0, 100).replace(/[^a-zA-Z0-9._~ -]/g, "");
  return sanitized || undefined;
}

export function captureCampaignAttribution(search: string): void {
  try {
    const params = new URLSearchParams(search);
    const attribution: Attribution = {};

    for (const key of utmKeys) {
      const value = sanitizeAttribution(params.get(key));
      if (value) attribution[key] = value;
    }

    if (Object.keys(attribution).length > 0) {
      sessionStorage.setItem(attributionKey, JSON.stringify(attribution));
    }
  } catch {
    // Attribution is optional and must never interrupt the visitor journey.
  }
}

function getCampaignAttribution(): Attribution {
  try {
    const stored = sessionStorage.getItem(attributionKey);
    if (!stored) return {};
    const parsed = JSON.parse(stored) as Record<string, unknown>;
    const attribution: Attribution = {};

    for (const key of utmKeys) {
      const value = typeof parsed[key] === "string" ? sanitizeAttribution(parsed[key]) : undefined;
      if (value) attribution[key] = value;
    }

    return attribution;
  } catch {
    return {};
  }
}

export function trackEvent<EventName extends AnalyticsEventName>(
  eventName: EventName,
  properties: AnalyticsProperties[EventName],
): void {
  try {
    if (!process.env.NEXT_PUBLIC_POSTHOG_KEY) return;
    posthog.capture(eventName, { ...properties, ...getCampaignAttribution() });
  } catch {
    // Analytics failures must never block navigation or form behavior.
  }
}
