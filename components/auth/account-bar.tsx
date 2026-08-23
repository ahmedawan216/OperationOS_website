import { signOut } from "@/app/auth/actions";

export function AccountBar({ email }: { email: string }) {
  return (
    <div className="fixed right-5 top-20 z-40 flex items-center gap-3 rounded-lg border border-border bg-bg/[0.94] px-3 py-2 backdrop-blur-md sm:right-8">
      <span className="max-w-[180px] truncate text-xs text-ink-dim">{email}</span>
      <form action={signOut}>
        <button type="submit" className="text-xs font-medium text-ink transition-colors hover:text-accent">
          Sign out
        </button>
      </form>
    </div>
  );
}
