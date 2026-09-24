import { GuidanceTrust } from "@/components/home/guidance-trust";
import { HomeHero } from "@/components/home/home-hero";
import { CompanyClosing } from "@/components/home/company-closing";
import { ProductPhilosophy } from "@/components/home/product-philosophy";
import { ProductSpotlight } from "@/components/home/product-spotlight";
import { WorkflowSection } from "@/components/home/workflow-section";

export default function HomePage() {
  return (
    <>
      <HomeHero />
      <ProductSpotlight />
      <ProductPhilosophy />
      <WorkflowSection />
      <GuidanceTrust />
      <CompanyClosing />
    </>
  );
}
