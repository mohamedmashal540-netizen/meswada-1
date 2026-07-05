import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./index.css";
import App from "@/app/App";
import { ClerkProvider } from "@clerk/react";
import { ThemeProvider } from "next-themes";

// جلب المفتاح العام من ملفات البيئة (Environment Variables)
// (بافتراض إنك بتستخدم Vite اللي هو الأفضل والأكثر شيوعاً دلوقتي)
const PUBLISHABLE_KEY = import.meta.env.VITE_CLERK_PUBLISHABLE_KEY;

// حماية إضافية: التأكد من وجود المفتاح قبل تشغيل التطبيق عشان تتجنب أي أخطاء وقت الـ Runtime
if (!PUBLISHABLE_KEY) {
  throw new Error("Missing Publishable Key");
}

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    {/* attribute="class" toggles the `.dark` class already defined in index.css */}
    <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
      <ClerkProvider publishableKey={PUBLISHABLE_KEY}>
        <App />
      </ClerkProvider>
    </ThemeProvider>
  </StrictMode>,
);