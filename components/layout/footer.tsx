import { footerLinks } from "@/lib/data";
import { siteConfig } from "@/lib/site-config";
import { Logo } from "@/components/ui/logo";

export function Footer() {
  const year = new Date().getFullYear();

  return (
    <footer className="border-t border-border py-[46px]">
      <div className="mx-auto flex max-w-wrap flex-col items-center gap-6 px-5 text-center sm:flex-row sm:flex-wrap sm:justify-between sm:text-left sm:px-8">
        <Logo />

        <nav aria-label="Footer" className="flex flex-wrap justify-center gap-[26px]">
          {footerLinks.map((link) => (
            <a
              key={link.label}
              href={link.href}
              className="text-[13px] text-ink-dim transition-colors duration-200 ease-out-expo hover:text-ink"
            >
              {link.label}
            </a>
          ))}
        </nav>

        <div className="text-right">
    <a
      href="mailto:hello@operationos.org"
      className="block text-sm text-ink hover:text-ink-dim transition-colors"
    >
      operationos.org@gmail.com
    </a>

        {/* text-ink-dim (not ink-faint): ink-faint fails WCAG AA contrast
            against bg for real body text — see components/ui/eyebrow.tsx */}
        <p className="text-xs text-ink-dim">
          © {year} {siteConfig.name}
        </p>
      </div>
    </footer>
  );
}
