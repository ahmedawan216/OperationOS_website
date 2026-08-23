import type { ReactNode } from "react";

import { AccountBar } from "@/components/auth/account-bar";
import { Header } from "@/components/layout/header";
import { requireAuthenticatedUser } from "@/lib/supabase/auth";

export default async function DashboardLayout({
  children,
}: {
  children: ReactNode;
}) {
  const user = await requireAuthenticatedUser();

  return (
    <>
      <Header />
      <AccountBar email={user.email ?? "Signed in"} />
      {children}
    </>
  );
}
