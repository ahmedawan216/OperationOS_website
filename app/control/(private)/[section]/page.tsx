import { notFound } from "next/navigation";
import { ControlPlaneView, type ControlSection } from "@/components/control-plane/control-plane-view";
import { queryControlPlane } from "@/lib/control-plane/query";
import { MetaAgentView } from "@/components/control-plane/meta-agent-view";
import { askMetaAgent } from "@/lib/control-plane/meta-agent";
import { GroundedMetaAgentProvider } from "@/lib/control-plane/grounded-meta-agent-provider";
import { requireFounderSession } from "@/lib/control-plane/auth";

const sections = new Set<ControlSection>(["products", "agents", "executions", "health", "learnings", "improvements", "evaluations", "safety", "approvals", "versions", "meta-agent"]);

export default async function SectionPage({ params, searchParams }: { params: Promise<{ section: string }>; searchParams: Promise<{ q?: string }> }) {
  const { section } = await params;
  if (!sections.has(section as ControlSection)) notFound();
  const snapshot = await queryControlPlane();
  if (section === "meta-agent") {
    const session = await requireFounderSession();
    const question = (await searchParams).q?.trim() || "What has OperationOS learned recently?";
    const answer = await askMetaAgent({ provider: new GroundedMetaAgentProvider(), snapshot, founderId: session.sub, queryId: "control-query", question });
    return <MetaAgentView snapshot={snapshot} answer={answer} question={question} />;
  }
  return <ControlPlaneView snapshot={snapshot} section={section as ControlSection} />;
}
