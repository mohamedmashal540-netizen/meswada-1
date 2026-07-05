import { useEffect, useState } from "react";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { Toaster } from "sonner";
import { IntlProvider } from "react-intl";
import { useAuth } from "@clerk/react";

import { AppLayout } from "@/app/layout/AppLayout";
import { HomePage } from "@/app/pages/HomePage";
import { NotFoundPage } from "@/app/pages/NotFoundPage";

import SignInPage from "./pages/SignInPage";
import SignUpPage from "./pages/SignUpPage";
import NotePageDetails from "./pages/NotePageDetails";

import {
  getInitialLocale,
  localeDir,
  messages,
  LOCALE_STORAGE_KEY,
  type Locale,
} from "@/i18n";
import { LocaleContext } from "@/i18n/LocaleContext";
import { ErrorBoundary } from "@/components/common/ErrorBoundary";

function ProtectedAppLayout() {
  const { isLoaded, isSignedIn } = useAuth();

  if (!isLoaded) {
    return null;
  }

  if (!isSignedIn) {
    return <Navigate to="/sign-in" replace />;
  }

  return <AppLayout />;
}

export default function App() {
  const [locale, setLocaleState] = useState<Locale>(getInitialLocale);

  const setLocale = (next: Locale) => {
    window.localStorage.setItem(LOCALE_STORAGE_KEY, next);
    setLocaleState(next);
  };

  // Keep <html dir="rtl|ltr" lang="ar|en"> in sync with the active locale.
  // This is what actually flips the layout direction app-wide (flexbox,
  // text alignment, logical Tailwind utilities like ps-/pe-/ms-/me-).
  useEffect(() => {
    document.documentElement.dir = localeDir[locale];
    document.documentElement.lang = locale;
  }, [locale]);

  return (
    <ErrorBoundary>
      <IntlProvider locale={locale} messages={messages[locale]} defaultLocale="en">
        <LocaleContext.Provider value={{ locale, setLocale }}>
          <BrowserRouter>
            <Routes>
              {/* مسارات Clerk */}
              <Route path="/sign-in/*" element={<SignInPage />} />
              <Route path="/sign-up/*" element={<SignUpPage />} />

              {/* المسارات الأساسية للمتجر (محمية) */}
              <Route element={<ProtectedAppLayout />}>
                <Route path="/" element={<HomePage />} />
                <Route path="/notes/:id" element={<NotePageDetails />} />
                <Route path="*" element={<NotFoundPage />} />
              </Route>
            </Routes>
            <Toaster position="top-right" theme="dark" richColors />
          </BrowserRouter>
        </LocaleContext.Provider>
      </IntlProvider>
    </ErrorBoundary>
  );
}
