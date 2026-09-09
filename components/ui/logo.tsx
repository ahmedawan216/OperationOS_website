import Image from "next/image";
import Link from "next/link";

import { cn } from "@/lib/utils";

interface LogoProps {
  className?: string;
  variant?: "lockup" | "mark";
  tone?: "black" | "white";
}

/**
 * Final OperationOS H1 brand assets. The outlined lockup preserves the
 * approved Space Grotesk SemiBold wordmark without a runtime font dependency.
 */
export function Logo({
  className,
  variant = "lockup",
  tone = "black",
}: LogoProps) {
  const isMark = variant === "mark";
  const src = isMark
    ? `/brand/operationos-h1-mark-${tone}.svg`
    : `/brand/operationos-h1-horizontal-${tone}.svg`;

  return (
    <Link
      href="/"
      className={cn(
        "inline-flex shrink-0 items-center rounded-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-bg",
        className
      )}
      aria-label="OperationOS home"
    >
      <Image
        src={src}
        alt=""
        width={isMark ? 166 : 1556.8}
        height={isMark ? 160 : 264}
        priority
        className={cn(
          "block h-auto",
          isMark ? "w-8" : "w-[168px] sm:w-[177px]"
        )}
      />
    </Link>
  );
}
