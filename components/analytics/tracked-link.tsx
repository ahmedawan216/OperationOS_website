"use client";

import type { ComponentProps } from "react";
import Link from "next/link";

import {
  trackEvent,
  type AnalyticsEventName,
  type AnalyticsProperties,
} from "@/lib/analytics";

type TrackedLinkProps<EventName extends AnalyticsEventName> =
  ComponentProps<typeof Link> & {
    eventName: EventName;
    eventProperties: AnalyticsProperties[EventName];
  };

export function TrackedLink<EventName extends AnalyticsEventName>({
  eventName,
  eventProperties,
  onClick,
  ...props
}: TrackedLinkProps<EventName>) {
  return (
    <Link
      {...props}
      onClick={(event) => {
        trackEvent(eventName, eventProperties);
        onClick?.(event);
      }}
    />
  );
}
