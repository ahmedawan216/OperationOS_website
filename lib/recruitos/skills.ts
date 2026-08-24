const SKILL_ALIASES: Record<string, string> = {
  reactjs: "React",
  "react.js": "React",
  react: "React",
  nodejs: "Node.js",
  "node.js": "Node.js",
  node: "Node.js",
  nextjs: "Next.js",
  "next.js": "Next.js",
  typescript: "TypeScript",
  javascript: "JavaScript",
  js: "JavaScript",
  ts: "TypeScript",
  python: "Python",
  postgresql: "PostgreSQL",
  postgres: "PostgreSQL",
  sql: "SQL",
  mongodb: "MongoDB",
  docker: "Docker",
  kubernetes: "Kubernetes",
  aws: "AWS",
  gcp: "GCP",
  azure: "Azure",
  tailwindcss: "Tailwind CSS",
  tailwind: "Tailwind CSS",
};

export function normalizeSkill(skill: string) {
  const key = skill.trim().toLowerCase().replace(/\s+/g, " ");
  return SKILL_ALIASES[key] ?? skill.trim();
}

export function normalizeSkills(skills: string[]) {
  return [...new Set(skills.map(normalizeSkill).filter(Boolean))];
}

export function normalizeEmail(email: string | null | undefined) {
  const value = email?.trim().toLowerCase();
  return value || null;
}
