import type { Metadata } from "next";
import "./control-plane.css";
import "./productionization.css";
import "./governance.css";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Control Plane", description: "Private OperationOS founder command center.", robots: { index: false, follow: false, nocache: true, googleBot: { index: false, follow: false, noimageindex: true } } };

export default async function ControlLayout({ children }: { children: React.ReactNode }) {
  return children;
}
