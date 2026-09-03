import { GuidanceTrust } from "@/components/home/guidance-trust";
import { HomeHero } from "@/components/home/home-hero";
import { ProductExperience } from "@/components/home/product-experience";
import { ProductPhilosophy } from "@/components/home/product-philosophy";
import { ProductSpotlight } from "@/components/home/product-spotlight";
import { WorkflowSection } from "@/components/home/workflow-section";
import { Waitlist } from "@/components/sections/waitlist";

export default function HomePage() {
  return (
    <>
      <HomeHero />
      <ProductSpotlight />
      <ProductPhilosophy />
      <WorkflowSection />
      <ProductExperience />
      <GuidanceTrust />
      <Waitlist />
    </>
  );
}
