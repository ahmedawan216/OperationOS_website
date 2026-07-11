import type {
  AgentSlot,
  Candidate,
  NavLink,
  PidPrinciple,
  ReasonItem,
  RecruitOsHighlight,
} from "@/types";

/** Primary nav — mirrors the approved prototype's <nav class="nav-links"> */
export const navLinks: NavLink[] = [
  { label: "How it works", href: "#how" },
  { label: "Agents", href: "#ecosystem" },
  { label: "RecruitOS", href: "#recruitos" },
];

/** Footer links — mirrors <div class="footer-links"> */
export const footerLinks: NavLink[] = [
  { label: "RecruitOS", href: "#recruitos" },
  { label: "Agents", href: "#ecosystem" },
  { label: "Careers", href: "#" },
  { label: "Privacy", href: "#" },
];

/** "How the OS works" — the three operating constraints every agent runs under */
export const pidPrinciples: PidPrinciple[] = [
  {
    id: "PID 001",
    title: "Explains itself",
    description:
      "Every decision comes with its reasoning, written in plain language — never just a confidence score.",
  },
  {
    id: "PID 002",
    title: "Fits your workflow",
    description:
      "Agents plug into the tools your team already runs on. You don't change how you work to use one.",
  },
  {
    id: "PID 003",
    title: "Stays under your control",
    description:
      "Agents recommend and act only within limits your team sets. Nothing ships without sign-off.",
  },
];

/** Agent rack — 8 slots, one online today */
export const agentSlots: AgentSlot[] = [
  { id: "01", name: "RecruitOS", role: "Screens and ranks candidates", status: "online" },
  { id: "02", name: "SalesOS", role: "Qualifies leads", status: "training" },
  { id: "03", name: "SupportOS", role: "Resolves tickets", status: "training" },
  { id: "04", name: "FinanceOS", role: "Reconciles spend", status: "training" },
  { id: "05", name: "MarketingOS", role: "Drafts campaigns", status: "training" },
  { id: "06", name: "ResearchOS", role: "Reads everything", status: "training" },
  { id: "07", name: "LegalOS", role: "Reviews contracts", status: "training" },
  { id: "08", name: "OpsOS", role: "Runs internal process", status: "training" },
];

/** RecruitOS deep-dive checklist */
export const recruitOsHighlights: RecruitOsHighlight[] = [
  { id: "h1", text: "Screens every resume against your real criteria, not keywords." },
  { id: "h2", text: "Ranks and summarizes candidates in minutes, not days." },
  { id: "h3", text: "Shows its reasoning behind every recommendation." },
  { id: "h4", text: "Learns your preferences — without ever making the final call." },
];

/** Dashboard preview — candidate ranking list */
export const candidates: Candidate[] = [
  { id: "c1", initials: "AO", name: "Amara Osei", role: "Senior Backend Engineer", score: 94, selected: true },
  { id: "c2", initials: "DK", name: "Daniel Kwan", role: "Senior Backend Engineer", score: 88 },
  { id: "c3", initials: "PN", name: "Priya Nair", role: "Senior Backend Engineer", score: 81 },
  { id: "c4", initials: "IP", name: "Ilya Petrov", role: "Senior Backend Engineer", score: 76 },
];

/** Dashboard preview — "why this candidate" reasoning panel for the selected candidate */
export const candidateReasons: ReasonItem[] = [
  {
    id: "r1",
    label: "Distributed systems —",
    detail: "5 years leading migrations at similar scale to your infrastructure.",
  },
  {
    id: "r2",
    label: "Role trajectory —",
    detail: "Progressed from IC to tech lead in under 3 years.",
  },
  {
    id: "r3",
    label: "Possible gap —",
    detail: "No direct experience with your primary cloud provider.",
  },
];
