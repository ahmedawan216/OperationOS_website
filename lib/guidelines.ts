export type GuidelinesPath =
  | "/guidelines"
  | "/guidelines/getting-started"
  | "/guidelines/recruitos"
  | "/guidelines/concepts"
  | "/guidelines/account-billing"
  | "/guidelines/privacy-security";

interface GuidelinesPage {
  title: string;
  href: GuidelinesPath;
}

interface GuidelinesGroup {
  label: string;
  items: readonly GuidelinesPage[];
}

export const guidelinesGroups: readonly GuidelinesGroup[] = [
  {
    label: "Start here",
    items: [
      { title: "Overview", href: "/guidelines" },
      { title: "Getting started", href: "/guidelines/getting-started" },
    ],
  },
  {
    label: "Products",
    items: [{ title: "RecruitOS", href: "/guidelines/recruitos" }],
  },
  {
    label: "Understand the system",
    items: [{ title: "Concepts", href: "/guidelines/concepts" }],
  },
  {
    label: "Account",
    items: [{ title: "Account & billing", href: "/guidelines/account-billing" }],
  },
  {
    label: "Trust",
    items: [{ title: "Privacy & security", href: "/guidelines/privacy-security" }],
  },
] as const;

export const guidelinesPages: readonly GuidelinesPage[] = guidelinesGroups.flatMap((group) => group.items);

export function getGuidelinesNeighbors(path: GuidelinesPath) {
  const index = guidelinesPages.findIndex((page) => page.href === path);

  return {
    previous: index > 0 ? guidelinesPages[index - 1] : undefined,
    next: index < guidelinesPages.length - 1 ? guidelinesPages[index + 1] : undefined,
  };
}
