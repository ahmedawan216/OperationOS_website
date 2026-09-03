export const featuredProduct = {
  name: "RecruitOS",
  href: "/recruitos",
  audience: "Hiring teams reviewing candidates across active roles",
  description:
    "RecruitOS brings job requirements, candidate review, recommendations, and hiring status into one clear workflow.",
  outcomes: [
    "Review candidates against the requirements of each role",
    "See the reasoning behind a recommendation",
    "Keep hiring status and next actions organized",
  ],
} as const;

export const productPrinciples = [
  {
    title: "Start with a clear next step",
    description:
      "New users should understand where to begin without learning the entire system first.",
  },
  {
    title: "Reveal depth when it becomes useful",
    description:
      "Guidance and detail appear in context, keeping routine work focused while supporting closer review.",
  },
  {
    title: "Make repeated work faster",
    description:
      "Once a workflow is familiar, direct paths and visible status help experienced users keep moving.",
  },
] as const;

export const workflowSteps = [
  {
    number: "01",
    title: "Choose the right product",
    description: "Start with software designed around the operational job you need to complete.",
  },
  {
    number: "02",
    title: "Set up the workflow",
    description: "Provide the context, requirements, and material the work depends on.",
  },
  {
    number: "03",
    title: "Reduce repetitive review",
    description: "The product organizes information and assists with the repeatable parts of the process.",
  },
  {
    number: "04",
    title: "Review and act",
    description: "You inspect the reasoning, control the status, and make the important decision.",
  },
] as const;

export const operationalProblems = [
  "Repeated review that consumes time but still requires judgment",
  "Important information spread across disconnected steps",
  "Administrative work that obscures the next useful action",
] as const;
