"use client";

import type { ComponentProps } from "react";
import Link from "next/link";
import posthog from "posthog-js";

interface TrackedLinkProps extends ComponentProps<typeof Link> {
  eventName: string;
}

export function TrackedLink({ eventName, onClick, ...props }: TrackedLinkProps) {
  return (
    <Link
      {...props}
      onClick={(event) => {
        posthog.capture(eventName);
        onClick?.(event);
      }}
    />
  );
}
