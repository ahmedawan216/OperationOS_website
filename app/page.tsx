import { AgentRack } from "@/components/sections/agent-rack";
import { Hero } from "@/components/sections/hero";
import { HowItWorks } from "@/components/sections/how-it-works";
import { RecruitOsSection } from "@/components/sections/recruit-os-section";
import { Waitlist } from "@/components/sections/waitlist";
import { Rail } from "@/components/ui/rail";

// NOTE: no per-page `metadata` export here on purpose. The homepage's
// title/description are exactly the root layout's `default` — re-stating
// them here previously caused a real bug: Next's title *template*
// (`"%s — OperationOS.ai"`) wraps any string a page sets, so the old
// `metadata.title` here rendered as
// "...AI Employees — OperationOS.ai — OperationOS.ai" (brand name doubled).
// `alternates.canonical: "/"` is also already set at the layout level.

export default function HomePage() {
  return (
    <>
      <Hero />
      <Rail />
      <HowItWorks />
      <Rail />
      <AgentRack />
      <Rail />
      <RecruitOsSection />
      <Rail />
      <Waitlist />
    </>
  );
}
