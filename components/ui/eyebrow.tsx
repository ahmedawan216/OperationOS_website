import { cn } from "@/lib/utils";

interface EyebrowProps {
  children: React.ReactNode;
  className?: string;
  as?: "div" | "span" | "p";
}

/**
 * The small mono / letter-spaced label that precedes most section
 * headings in the approved design (e.g. "HOW THE OS WORKS").
 */
export function Eyebrow({ children, className, as: Tag = "div" }: EyebrowProps) {
  return (
    <Tag
      className={cn(
        "font-mono text-[11.5px] uppercase tracking-[0.16em] text-ink-dim",
        className
      )}
    >
      {children}
    </Tag>
  );
}
