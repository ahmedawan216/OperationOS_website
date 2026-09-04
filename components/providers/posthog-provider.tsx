"use client";

import { useEffect } from "react";
import posthog from "posthog-js";

import { captureCampaignAttribution } from "@/lib/analytics";

const urlPropertyNames = ["$current_url", "$referrer", "$initial_current_url", "$initial_referrer"] as const;

function removeQueryAndHash(value: unknown): string | undefined {
  if (typeof value !== "string") return undefined;

  try {
    const url = new URL(value);
    return `${url.origin}${url.pathname}`;
  } catch {
    return undefined;
  }
}

export function PostHogProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  useEffect(() => {
    captureCampaignAttribution(window.location.search);

    const key = process.env.NEXT_PUBLIC_POSTHOG_KEY;
    if (!key) return;

    posthog.init(key, {
      api_host: process.env.NEXT_PUBLIC_POSTHOG_HOST,
      capture_pageview: true,
      capture_pageleave: false,
      autocapture: false,
      capture_heatmaps: false,
      capture_performance: false,
      disable_external_dependency_loading: true,
      disable_session_recording: true,
      disable_surveys: true,
      advanced_disable_feature_flags: true,
      person_profiles: "identified_only",
      before_send: (event) => {
        if (!event?.properties) return event;

        for (const propertyName of urlPropertyNames) {
          if (!(propertyName in event.properties)) continue;

          const sanitizedUrl = removeQueryAndHash(event.properties[propertyName]);
          if (sanitizedUrl) {
            event.properties[propertyName] = sanitizedUrl;
          } else {
            delete event.properties[propertyName];
          }
        }

        return event;
      },
    });
  }, []);

  return <>{children}</>;
}
