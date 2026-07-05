import { useIntl } from "react-intl";
import { Languages } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { Locale } from "@/i18n";

interface LanguageSwitcherProps {
  locale: Locale;
  onChange: (locale: Locale) => void;
}

export function LanguageSwitcher({ locale, onChange }: LanguageSwitcherProps) {
  const intl = useIntl();

  const handleClick = () => {
    onChange(locale === "ar" ? "en" : "ar");
  };

  return (
    <Button
      variant="outline"
      onClick={handleClick}
      className="glass-border h-9 cursor-pointer rounded-full px-4 text-xs font-medium transition hover:text-foreground"
    >
      <Languages className="me-2 h-4 w-4" />
      {intl.formatMessage({ id: "lang.switchTo" })}
    </Button>
  );
}
