import type { ReactNode } from "react";

import { GuidelinesNavigation } from "@/components/guidelines/guidelines-navigation";

export default function GuidelinesLayout({ children }: { children: ReactNode }) {
  return (
    <div className="border-b border-border pt-[72px]">
      <div className="container-wide lg:grid lg:grid-cols-[240px_minmax(0,1fr)] lg:gap-16 xl:grid-cols-[260px_minmax(0,1fr)] xl:gap-20">
        <GuidelinesNavigation />
        <div className="min-w-0">{children}</div>
      </div>
    </div>
  );
}
