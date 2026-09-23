import Link from "next/link";
import { Activity, Bot, Boxes, Brain, CheckSquare, FlaskConical, Gauge, LayoutDashboard, MessageSquareText, ShieldCheck, Sparkles, Workflow } from "lucide-react";

const navigation = [
  ["Command", "/control", LayoutDashboard], ["Products", "/control/products", Boxes], ["Agents", "/control/agents", Bot],
  ["Executions", "/control/executions", Workflow], ["Learnings", "/control/learnings", Brain], ["Improvements", "/control/improvements", Sparkles],
  ["Evaluations", "/control/evaluations", FlaskConical], ["Safety", "/control/safety", ShieldCheck], ["Approvals", "/control/approvals", CheckSquare],
  ["Versions", "/control/versions", Activity], ["Health", "/control/health", Gauge],
  ["Meta-Agent", "/control/meta-agent", MessageSquareText],
] as const;

export function ControlPlaneShell({ children, founderId }: { children: React.ReactNode; founderId: string }) {
  return <div className="cp-shell">
    <aside className="cp-sidebar" aria-label="Control Plane navigation">
      <div className="cp-brand"><div className="cp-mark">H1</div><div><strong>OperationOS</strong><span>Control Plane</span></div></div>
      <nav>{navigation.map(([label, href, Icon]) => <Link key={href} href={href}><Icon aria-hidden size={16}/><span>{label}</span></Link>)}</nav>
      <div className="cp-operator"><span className="cp-live-dot"/>Private operator<div>{founderId}</div><form action="/api/control-plane/auth/logout" method="post"><button type="submit">Sign out</button></form></div>
    </aside>
    <div className="cp-workspace"><header className="cp-topbar"><div><span className="cp-kicker">Founder command center</span><strong>Operational truth, human authority.</strong></div><div className="cp-environment">PRIVATE · NON-PRODUCTION</div></header>{children}</div>
  </div>;
}
