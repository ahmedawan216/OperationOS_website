import Link from "next/link";

import { cn } from "@/lib/utils";

interface LogoProps {
  className?: string;
}

/**
 * The square rounded logo mark with the accent chip inside, plus the
 * "OperationOS.ai" wordmark. Used identically in the header and footer.
 */
export function Logo({ className }: LogoProps) {
  return (
    <Link
      href="/"
      className={cn(
        "flex items-center gap-2.5 font-display text-[15px] font-semibold text-ink",
        className
      )}
      aria-label="OperationOS.ai — home"
    >
      <svg
        className="h-[22px] w-[22px] shrink-0"
        viewBox="0 0 22 22"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        aria-hidden="true"
      >
        <rect
          x="0.75"
          y="0.75"
          width="20.5"
          height="20.5"
          rx="6"
          stroke="currentColor"
          strokeOpacity="0.2"
          strokeWidth="1.3"
        />
        <rect x="5" y="5" width="6" height="6" rx="1.4" className="fill-accent" />
      </svg>
      <span>
        OperationOS
        <span className="text-ink-faint">.ai</span>
      </span>
    </Link>
  );
}
