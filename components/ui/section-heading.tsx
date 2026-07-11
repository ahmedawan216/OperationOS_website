import { Eyebrow } from "@/components/ui/eyebrow";

interface SectionHeadingProps {
  eyebrow: string;
  title: string;
  description: string;
}

/**
 * The centered eyebrow + h2 + intro-paragraph block repeated at the top
 * of `how-it-works.tsx`, `agent-rack.tsx`, and `waitlist.tsx`. Extracting
 * it guarantees identical spacing/typography everywhere it appears, and
 * means the intro-paragraph style only needs to be tuned in one place.
 */
export function SectionHeading({ eyebrow, title, description }: SectionHeadingProps) {
  return (
    <div className="mx-auto mb-[60px] max-w-[520px] text-center">
      <Eyebrow>{eyebrow}</Eyebrow>
      <h2 className="my-4 font-display text-[clamp(26px,3.2vw,36px)] font-semibold tracking-[-0.025em] text-ink">
        {title}
      </h2>
      <p className="text-[15.5px] text-ink-dim">{description}</p>
    </div>
  );
}
