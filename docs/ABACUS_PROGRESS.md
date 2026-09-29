# Hamoula - سجل تقدم Abacus AI

هاد الملف كيوثق التقدم اللي دار Abacus AI Agent على مشروع حمولة (hamo-ride-connect).

---

## Phase 2 - ميزات إضافية (سبتمبر 2026)

**Branch**: `feature/hamoula-phase2-12-progress`\
**Commit**: `4f8c232`\
**التاريخ**: 28-29 سبتمبر 2026

### الميزات المنفذة

#### 1\. نظام تبديل اللغة (عربي/فرنسي)

* **الملفات المعدلة**:

  * `src/lib/app-language.ts` (ملف جديد)

  * `src/routes/__root.tsx`

  * `src/routes/settings.tsx`

* **الوظائف**:

  * تخزين تفضيل اللغة في `localStorage` تحت مفتاح `"hamoula.lang.v1"`

  * تطبيق `direction` (RTL للعربي، LTR للفرنسي) على `<html>`

  * واجهة Toggle في صفحة الإعدادات مع زرين للتبديل

  * دعم اللغات: `ar` (العربية) و `fr` (الفرنسية)

#### 2\. إشعارات Push لحالة الرحلة

* **الملفات المعدلة**:

  * `src/lib/push.server.ts`

  * `src/lib/hamoula-store.tsx`

* **الوظائف**:

  * إضافة نوع جديد `"trip-status"` لـ `PushKind`

  * إرسال إشعارات عند تغيير حالة الرحلة (`in_progress`, `delivered`, `cancelled`)

  * إشعار صاحب الحمولة والسائق المقبول

  * الرسائل بالعربية (مثال: "الرحلة ديالك دابا في الطريق")

#### 3\. حذف نهائي للطلبات

* **الملفات المعدلة**:

  * `src/lib/hamoula-sync.ts`

  * `src/lib/hamoula-store.tsx`

  * `src/components/hamoula/MyRequests.tsx`

* **الوظائف**:

  * دالة `removeOwnLoad()` لحذف نهائي من Supabase

  * حذف الـ load والـ bids المرتبطة به

  * زر "حذف نهائي" في واجهة `MyRequests` مع تأكيد

  * إزالة الطلب من القوائم النشطة والأرشيف

#### 4\. توسيع قائمة المدن المغربية

* **الملف المعدل**:

  * `src/lib/hamoula-cities.ts`

* **المدن المضافة** (8 مدن جديدة):

  * المحمدية (Mohammedia)

  * سطات (Settat)

  * تازة (Taza)

  * جرسيف (Guercif)

  * القصر الكبير (Ksar El Kebir)

  * شفشاون (Chefchaouen)

  * اليوسفية (Youssoufia)

  * برشيد (Berrechid)

كل مدينة فيها: الاسم العربي، الإحداثيات (lat/lng)، والاسم الفرنسي (alias)

---

### حالة الـ Build و الاختبار

⚠️ **تنبيه مهم**:

* التعديلات **ما تم verification ديالها بـ build** بسبب قيود البيئة

* محاولة `npm run build` فشلت (خطأ: "Cannot read properties of null (reading 'edgesOut')")

* المشروع يستخدم `bun.lock` ولكن `bun` ما مثبتش في البيئة

* **الكود مكتوب بناءً على الـ patterns الموجودة** في الملفات الأصلية

* **اختبار end-to-end محتاج environment محلي** مع Supabase مهيأ

**التوصية**:

* تشغيل `bun install && bun run build` في بيئة تطوير محلية للتحقق

* مراجعة TypeScript errors إذا ظهرت

* اختبار الميزات الجديدة في بيئة staging قبل production

---

### المتطلبات المعلقة

#### 1\. قاعدة البيانات (Supabase)

الـ migrations الموجودة في `supabase/migrations/` **خاصها تُطبق** على قاعدة البيانات:

* Batch 1: إضافة أعمدة `user_id`

* Batch 2: إنشاء جداول `chat_messages`, `push_subscriptions`, `trip_ratings`

* Batch 3: دوال RPC (`set_trip_status`, `update_own_load`, إلخ)

* Batch 4: سياسات RLS (Row Level Security)

**الوثائق المرجعية**:

* [hamoula_phase1_migration_analysis.md](https://apps.abacus.ai/conversationFiles/2fc33176b/hamoula_phase1_migration_analysis.md)

* `/home/ubuntu/hamoula_phase1_execution_kit/`

#### 2\. المتغيرات البيئية (Secrets)

هاد الـ secrets محتاجين configuration:

* `BIRD_API_KEY` (**Bird WhatsApp OTP - القناة الأساسية**)

* `VONAGE_API_KEY` و `VONAGE_API_SECRET` (**SMS fallback** فقط)

* `VAPID_PUBLIC_KEY` و `VAPID_PRIVATE_KEY` (Push notifications)

* `OPENAI_API_KEY` (AI features)

* `GOOGLE_MAPS_API_KEY` (الخرائط)

#### 3\. خدمات خارجية

* **OTP الحالي**: Bird لواتساب + Vonage كـ SMS fallback

* **VoIP**: مازال غير محدد كخدمة production حالياً (ليس جزءاً من تكامل Vonage الحالي في OTP)

* **Push Notifications**: محتاج VAPID keys و service worker configured

---

### Git Operations

```bash
# Branch الحالي
git branch: feature/hamoula-phase2-12-progress

# Commits
4f8c232 - Hamoula: add language toggle, trip-status push, hard delete requests, and city list expansion

# Git user
hourmostafa04-cpu <316719197+hourmostafa04-cpu@users.noreply.github.com>
```

---

### الخطوات القادمة (ترتيب إلزامي مُصحّح)

1. 🔴 **Phase 1 أولاً**: تطبيق migrations ديال Supabase بالترتيب (Batch 1 → 2 → 3 → 4) مع verification بعد كل batch.

2. 🔴 إكمال Auth/RLS hardening والتحقق أن RPC والدوال الأمنية شغالة كما هو موثق.

3. 🟠 تشغيل Build ناجح (`bun install && bun run build`) ثم اختبارات TypeScript/flows الأساسية.

4. 🟠 اختبار End-to-End للسيناريوهات الحرجة (OTP، الطلبات، العروض، حالة الرحلة، الشات، الإشعارات).

5. 🟢 بعد نجاح الخطوات أعلاه فقط: تحديث التوثيق ثم التحضير للـ merge.

6. 🚫 **ممنوع merge إلى `main`** قبل نجاح الـ build والاختبارات بشكل واضح وموثق.

---

## مذكرات تقنية

### نمط الكود

* **Framework**: TanStack Start (React 19 + Vite)

* **Language**: TypeScript (strict mode)

* **State Management**: Zustand (في `hamoula-store.tsx`)

* **Backend**: Supabase (PostgreSQL + Realtime)

* **Styling**: Tailwind CSS + shadcn/ui

### قواعد المشروع (من الذاكرة)

> **قاعدة أساسية**: الاستمرار على المشروع الحالي وعدم إعادة البناء من الصفر

---

## تحديث مراجعة الجودة (29 سبتمبر 2026)

- ✅ تم تصحيح فهم OTP في التوثيق:
  - **Bird = WhatsApp OTP (أساسي)**
  - **Vonage = SMS fallback**
  - **Vonage الحالي ليس VoIP production**
- ✅ تم تصحيح ترتيب التنفيذ: **Phase 1 (DB/Auth/RLS) قبل أي توسع إضافي**.
- ✅ تم تشغيل التحقق المحلي بنجاح بعد تثبيت Bun في البيئة:
  - `bun install` نجح
  - `bun run build` نجح
  - `bunx vitest run` نجح (17/17 tests)
- ✅ **مفاتيح VAPID (Push) تم توليدها وتخزينها بأمان** في secret store الحساب:
  - `VAPID_PUBLIC_KEY` + `VAPID_PRIVATE_KEY` (ECDSA P-256 بصيغة web-push القياسية)
  - `VAPID_SUBJECT` = mailto:push@hamoula.app
  - ⚠️ خاصها تُنسخ لبيئة النشر (Lovable `.env`) عند توفر الوصول — ممنوع دخلها للـ git
- ⏳ **Phase 1 على Supabase محجوبة**: محتاجين من المالك:
  1. **Service Role Key** (Project Settings → API) — ضروري للتطبيق server-side
  2. **DB Connection string** (Project Settings → Database) — لتطبيق Backup + Batch 1→4 عبر psql
  3. **BIRD_API_KEY** + **VONAGE_API_KEY/SECRET/FROM** + **SEND_SMS_HOOK_SECRET** — لتفعيل OTP الحقيقي
- 🚫 لن يتم عمل merge إلى `main` قبل إكمال Phase 1 + التحقق الكامل (Build + اختبارات + فحوصات التشغيل الأساسية).

_آخر تحديث: 29 سبتمبر 2026 بواسطة Abacus AI Agent_