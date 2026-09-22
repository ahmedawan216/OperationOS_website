import type { Metadata } from "next";
import { ControlPlaneShell } from "@/components/control-plane/control-plane-shell";
import { requireFounderSession } from "@/lib/control-plane/auth";
import "./control-plane.css";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Control Plane", description: "Private OperationOS founder command center.", robots: { index: false, follow: false, nocache: true, googleBot: { index: false, follow: false, noimageindex: true } } };

export default async function ControlLayout({ children }: { children: React.ReactNode }) {
  const session = await requireFounderSession();
  return <ControlPlaneShell founderId={session.sub}>{children}</ControlPlaneShell>;
}
