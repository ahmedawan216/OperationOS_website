import { notFound } from "next/navigation";
import { ControlPlaneView, type ControlSection } from "@/components/control-plane/control-plane-view";
import { queryControlPlane } from "@/lib/control-plane/query";
const sections = new Set<ControlSection>(["products","agents","executions","health","learnings","improvements","evaluations","safety","approvals","versions","meta-agent"]);
export default async function SectionPage({params}:{params:Promise<{section:string}>}){const {section}=await params;if(!sections.has(section as ControlSection))notFound();return <ControlPlaneView snapshot={await queryControlPlane()} section={section as ControlSection}/>}
