/**
 * Shared content types for the OperationOS.ai marketing site.
 * Keeping these centralized lets section components stay presentational
 * while `lib/data.ts` owns the actual copy.
 */

export interface NavLink {
  label: string;
  href: string;
}

export interface PidPrinciple {
  id: string;
  title: string;
  description: string;
}

export type AgentStatus = "online" | "training";

export interface AgentSlot {
  id: string;
  name: string;
  role: string;
  status: AgentStatus;
}

export interface RecruitOsHighlight {
  id: string;
  text: string;
}

export interface Candidate {
  id: string;
  initials: string;
  name: string;
  role: string;
  score: number;
  selected?: boolean;
}

export interface ReasonItem {
  id: string;
  label: string;
  detail: string;
}
