import type { Metadata } from "next";
import "./control-plane.css";
import "./productionization.css";
import "./governance.css";
import "./empty-states.css";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: { absolute: "OperationOS Control Panel" }, description: "Private OperationOS founder command center.", alternates: { canonical: null }, robots: { index: false, follow: false, nocache: true, googleBot: { index: false, follow: false, noimageindex: true } } };

export default async function ControlLayout({ children }: { children: React.ReactNode }) {
  return <><a href="#control-panel-content" className="cp-skip-link">Skip to Control Panel content</a>{children}</>;
}
