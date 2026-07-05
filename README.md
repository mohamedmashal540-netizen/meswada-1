# Maswada AI — Full Project (Frontend + Backend)

مشروع ملاحظات ذكي (زي Notion) بـ React + Express، مقسوم لـ:

```
maswada-ai/
├── frontend/   # React + Vite + Tailwind + Clerk (المستخدم بيشوفه)
└── backend/    # Express + Sequelize (SQLite) + Clerk + OpenAI (الـ API)
```

## تشغيل المشروع

### 1) الباك إند
```bash
cd backend
npm install
cp .env.example .env   # واملأ القيم الحقيقية (Clerk secret, OpenAI key...)
npm run dev            # بيشتغل على http://localhost:3001
```

### 2) الفرونت إند
```bash
cd frontend
npm install
npm run dev             # بيشتغل على http://localhost:5173
```

الفرونت متظبط يكلم الباك على `http://localhost:3001` بشكل افتراضي (`VITE_API_BASE_URL` في `.env` لو عايز تغيّره).

## متطلبات الـ .env في الباك (backend/.env)
لازم تحطها بنفسك (مش موجودة هنا لأسباب أمان):
- `CLERK_SECRET_KEY`
- `CLERK_PUBLISHABLE_KEY` (لازم يطابق اللي في frontend/.env)
- `OPENAI_API_KEY` (السيرفر دلوقتي بيشتغل حتى من غيرها، بس فيتشرز الـ AI هترجع 503 لحد ما تحطها - راجع الـ Changelog تحت)

## حالة الميزات
راجع البريف الكامل في المحادثة، أو `frontend/README.md` و `backend/AI_FEATURES.md` و `backend/TESTING.md` لتفاصيل كل جزء.

## Changelog — التحسينات اللي اتعملت في النسخة دي

| # | التغيير | الملفات المتأثرة |
|---|---|---|
| 1 | **AI حقيقي مش Mock**: فك تعليق الاتصال الفعلي بـ OpenAI في الـ 3 features (تلخيص/ترجمة/إعادة صياغة) | `backend/src/services/openai.service.ts` |
| 2 | **Lazy-init للـ OpenAI client**: السيرفر بقى يشتغل حتى لو `OPENAI_API_KEY` مش موجود؛ فيتشرز الـ AI بس بترجع `503` واضح بدل ما السيرفر كله يوقع | نفس الملف |
| 3 | **Rate limiting** على `/api/ai/*` (10 طلبات/دقيقة لكل يوزر) عشان محدش يستهلك رصيد OpenAI بلا حدود | `backend/src/middlewares/rateLimiter.ts`, `backend/src/routes/ai.ts` |
| 4 | **بحث server-side** بدل الفلترة المحلية: `GET /api/notes?q=...` | `backend/src/services/notes.service.ts`, `backend/src/routes/notes.ts` |
| 5 | **Pagination حقيقي**: `?page=&pageSize=`, بيرجع `{ notes, total, page, pageSize, totalPages }` | نفس الملفين فوق |
| 6 | **الفرونت اتحدّث** ليطابق: بحث بـ debounce (300ms) + زرار "عرض المزيد" بدل تحميل كل النوتس مرة واحدة | `frontend/src/hooks/useNotesApi.ts`, `frontend/src/app/pages/HomePage.tsx` |
| 7 | **Error Boundary عام**: أي exception غير متوقع في أي component بقى بيوريه شاشة "حصل خطأ" مع زرار Reload بدل ما يكسر التطبيق كله | `frontend/src/components/common/ErrorBoundary.tsx`, `frontend/src/app/App.tsx` |
| 8 | **Dark mode شغال فعليًا**: `next-themes` كان متثبت وموقف، دلوقتي فيه زرار toggle حقيقي في الهيدر ومتوصل بالـ `.dark` class tokens الموجودة في `index.css` | `frontend/src/main.tsx`, `frontend/src/components/common/ThemeToggle.tsx`, `frontend/src/app/layout/Header.tsx` |
| 9 | **CORS يدعم أكتر من origin**: `FRONTEND_ORIGIN` بقى ياخد قيمة واحدة أو list مفصولة بفواصل (لـ staging/prod) | `backend/src/config/env.ts`, `backend/src/app.ts` |

### حاجات اتسابت عمدًا (قرارات بنية تحتية مش كود)
- **الانتقال من SQLite لـ Postgres**: ده تغيير بنية تحتية (تحتاج قاعدة بيانات حقيقية جاهزة ومتصلة)، مش تعديل كود بس. الكود دلوقتي بيستخدم Sequelize فعليًا فالانتقال هيبقى بس تغيير الـ `dialect` والـ connection config لما يكون عندك Postgres instance.
- **Automated tests (Vitest/Jest)**: `TESTING.md` لسه manual test cases. ممكن نضيف test suite فعلي في جلسة تانية لو عايز.
- **Undo/soft-delete للملاحظات**: لسه hard delete. مذكور كتحسين مستقبلي في البريف الأصلي.

## Changelog 2 — حل مشكلة `insufficient_quota` + إصلاح الـ Dark Mode

| # | التغيير | الملفات المتأثرة |
|---|---|---|
| 10 | **سلسلة AI fallback حقيقية**: OpenAI (أساسي) ← مزود مجاني متوافق مع OpenAI SDK زي Groq (احتياطي) ← رد محلي واضح إنه "وضع محدود" لو الاتنين وقعوا. محدش هياخد 502 أبدًا، وفي نفس الوقت الرد مش وهمي — لو Groq شغال، اليوزر هياخد رد AI حقيقي حتى لو OpenAI وقع | `backend/src/services/openai.service.ts`, `backend/src/config/env.ts` |
| 11 | **Circuit breaker بسيط**: بعد 3 محاولات فاشلة متتالية لمزود معين، بيتوقف عن المحاولة معاه لمدة 5 دقائق بدل ما كل request يستنى الـ timeout بتاعه من الأول | نفس الملف |
| 12 | **تمييز أخطاء الإعداد عن أخطاء الشبكة/الرصيد**: أخطاء زي 401 (مفتاح غلط) بتتسجل بـ `console.error` بدل `console.warn` عشان متتخبيش في اللوج العادي | نفس الملف |
| 13 | **إصلاح الـ Dark Mode**: السبب الحقيقي كان `.glass-card` في `index.css` متثبت على `bg-white/70` و `border-black/10` بشكل ثابت (hardcoded) مش متصل بالـ theme tokens، فالكروت كانت بتفضل رمادي فاتح فوق خلفية سودا مهما بدلت الوضع. اتصلح باستخدام `bg-card/70` و `border-border` اللي بتتغير تلقائي مع `.dark` class | `frontend/src/index.css` |

### إعداد الـ AI fallback (اختياري بس موصى بيه)
هتلاقي 3 متغيرات جديدة في `backend/.env.example`: `AI_FALLBACK_API_KEY`, `AI_FALLBACK_BASE_URL`, `AI_FALLBACK_MODEL`. لو سبتهم فاضيين، السيستم هيشتغل زي الأول (OpenAI بس، ولو وقع هيرجع الرد المحلي المباشر). لو حطيت مفتاح Groq المجاني (من https://console.groq.com/keys)، السيستم هيحول تلقائي عليه لو OpenAI وقع - من غير أي تعديل تاني في الكود.

### مقارنة سريعة: بدائل مجانية/freemium بديلة لـ OpenAI (تقدر تستبدلها بنفس الـ SDK لأنها كلها OpenAI-compatible)

| المزود | الحد المجاني | ملاحظات |
|---|---|---|
| **Groq** | ~1,000 طلب/يوم على `llama-3.3-70b-versatile`، سرعة عالية جدًا (LPU hardware) | الأنسب كـ fallback أول: نفس الـ OpenAI SDK، بس تغيير `baseURL` |
| **OpenRouter** | عشرات الموديلات مجانية (`$0/M tokens`) عبر endpoint واحد متوافق مع OpenAI | جيد لو عايز تجرب موديلات متعددة بمفتاح واحد |
| **Google Gemini (AI Studio)** | ~1,500 طلب/يوم على Gemini Flash، سياق يوصل مليون توكن | الأسخى من ناحية الحجم، بس محتاج SDK مختلف شوية (مش OpenAI-compatible بالكامل) |
| **Cerebras** | ~1M توكن/يوم، أسرع استنتاج متاح مجانًا | ممتاز لو الحمل كبير (batch processing) |

الأنسب كخطوة تانية في السلسلة عندك هو **Groq**، لأنه بالظبط نفس شكل `OpenAI({ apiKey, baseURL })` من غير أي تغيير في باقي الكود — وده اللي طبقته فوق.

### ملاحظة أمان مهمة
لو كنت بعتلي مفاتيح API حقيقية (Clerk/OpenAI) في محادثة سابقة، **لازم تكون عملتلهم rotate/revoke** فورًا من الـ dashboards بتاعتهم، لأن أي مفتاح بيتكتب كنص في أي مكان بره `.env` المحلي بيتعامل معاه كمحروق.
