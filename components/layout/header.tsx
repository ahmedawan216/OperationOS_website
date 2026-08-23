import { getAuthenticatedUser } from "@/lib/supabase/auth";
import { HeaderClient } from "@/components/layout/header-client";

export async function Header() {
  const user = await getAuthenticatedUser();
  return <HeaderClient isAuthenticated={Boolean(user)} />;
}
