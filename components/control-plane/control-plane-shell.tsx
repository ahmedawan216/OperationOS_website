"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Activity, Bot, Boxes, Brain, CheckSquare, FlaskConical, Gauge, LayoutDashboard, MessageSquareText, ShieldCheck, Sparkles, Workflow } from "lucide-react";

const navigation = [
  ["Command", "", LayoutDashboard], ["Products", "products", Boxes], ["Agents", "agents", Bot],
  ["Executions", "executions", Workflow], ["Learnings", "learnings", Brain], ["Improvements", "improvements", Sparkles],
  ["Evaluations", "evaluations", FlaskConical], ["Safety", "safety", ShieldCheck], ["Approvals", "approvals", CheckSquare],
  ["Versions", "versions", Activity], ["Health", "health", Gauge],
  ["Meta-Agent", "meta-agent", MessageSquareText],
] as const;

function navigationHref(section: string, cleanUrls: boolean): string {
  if (cleanUrls) return section ? `/${section}` : "/";
  return section ? `/control/${section}` : "/control";
}

export function ControlPlaneShell({ children, founderId, cleanUrls }: { children: React.ReactNode; founderId: string; cleanUrls: boolean }) {
  const pathname = usePathname();
  return <div className="cp-shell">
    <aside className="cp-sidebar" aria-label="Control Panel navigation">
      <div className="cp-brand"><Image src="/brand/operationos-h1-mark-white.svg" width={30} height={30} alt="" aria-hidden/><div><strong>OperationOS</strong><span>Control Panel</span></div></div>
      <nav>{navigation.map(([navLabel, section, Icon]) => {
        const href = navigationHref(section, cleanUrls);
        const internalHref = section ? `/control/${section}` : "/control";
        const active = pathname === href || pathname === internalHref;
        return <Link key={navLabel} href={href} aria-current={active ? "page" : undefined}><Icon aria-hidden size={16}/><span>{navLabel}</span></Link>;
      })}</nav>
      <div className="cp-operator"><span className="cp-live-dot"/>Private operator<div>{founderId}</div><form action="/api/control-plane/auth/logout" method="post"><button type="submit">Sign out</button></form></div>
    </aside>
    <div className="cp-workspace"><header className="cp-topbar"><div><span className="cp-kicker">Founder command center</span><strong>Operational truth, human authority.</strong></div><div className="cp-environment">PRIVATE · FOUNDER ONLY</div></header><div id="control-panel-content">{children}</div></div>
  </div>;
}
