import Image from "next/image";
import Link from "next/link";

import { cn } from "@/lib/utils";

interface LogoProps {
  className?: string;
}

/**
 * The OperationOS logo mark (public/operationos-logo-final.svg) plus the
 * "OperationOS.ai" wordmark. Used identically in the header and footer.
 *
 * The source SVG carries its own white background + black ring baked in —
 * that's preserved exactly as supplied, nothing in the artwork is edited.
 * `rounded-[6px] overflow-hidden` on the wrapping <span> just clips its
 * corners so it matches the site's existing soft-cornered look (buttons,
 * the previous logo chip, etc.) — it's a CSS clip on the container, not a
 * change to the vector itself.
 */
export function Logo({ className }: LogoProps) {
  return (
    <Link
      href="/"
      className={cn(
        "flex items-center gap-3 font-display text-base font-semibold text-ink",
        className
      )}
      aria-label="OperationOS.ai — home"
    >
      <span className="block h-[32px] w-[32px] shrink-0 overflow-hidden rounded-[6px]">
        <Image
          src="/operationos-logo-final.svg"
          alt=""
          width={32}
          height={32}
          priority
          className="h-full w-full object-cover"
        />
      </span>
      <span>
        OperationOS
        <span className="text-ink-faint">.ai</span>
      </span>
    </Link>
  );
}
