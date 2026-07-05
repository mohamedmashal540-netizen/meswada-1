import { Link } from "react-router-dom";
import { FormattedMessage } from "react-intl";
import { LanguageSwitcher } from "@/components/common/LanguageSwitcher";
import { ThemeToggle } from "@/components/common/ThemeToggle";
import { useLocale } from "@/i18n/LocaleContext";

const navItems = [
  { id: "nav.overview", to: "/" },
  { id: "nav.workflows", to: "/" },
  { id: "nav.insights", to: "/" },
] as const;

export function Header() {
  const { locale, setLocale } = useLocale();

  return (
    <header className="sticky top-0 z-50 w-full">
      <div className="mx-auto w-full max-w-6xl px-4 pt-4 sm:px-6 lg:px-8">
        <div className="glass-card flex items-center justify-between gap-4 rounded-2xl px-4 py-3 sm:px-6">
          <div className="flex items-center gap-3">
            <Link to="/" className="text-sm font-semibold tracking-wide">
              <FormattedMessage id="app.title" />
            </Link>
            <span className="hidden text-xs text-muted-foreground sm:inline">
              <FormattedMessage id="app.tagline" />
            </span>
          </div>

          <nav
            aria-label="Primary"
            className="hidden items-center gap-4 text-xs font-medium text-muted-foreground sm:flex"
          >
            {navItems.map((item) => (
              <Link
                key={item.id}
                to={item.to}
                className="transition-colors hover:text-foreground"
              >
                <FormattedMessage id={item.id} />
              </Link>
            ))}
          </nav>

          <div className="flex items-center gap-2">
            <ThemeToggle />
            <LanguageSwitcher locale={locale} onChange={setLocale} />
          </div>
        </div>

        {/* Mobile navigation */}
        <nav
          aria-label="Primary mobile"
          className="mt-3 flex items-center gap-3 text-xs font-medium text-muted-foreground sm:hidden"
        >
          {navItems.map((item) => (
            <Link
              key={item.id}
              to={item.to}
              className="glass-border rounded-full px-3 py-1 transition-colors hover:text-foreground"
            >
              <FormattedMessage id={item.id} />
            </Link>
          ))}
        </nav>
      </div>
    </header>
  );
}
