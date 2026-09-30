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

* ✅ تم تصحيح فهم OTP في التوثيق:

  * **Bird = WhatsApp OTP (أساسي)**

  * **Vonage = SMS fallback**

  * **Vonage الحالي ليس VoIP production**

* ✅ تم تصحيح ترتيب التنفيذ: **Phase 1 (DB/Auth/RLS) قبل أي توسع إضافي**.

* ✅ تم تشغيل التحقق المحلي بنجاح بعد تثبيت Bun في البيئة:

  * `bun install` نجح

  * `bun run build` نجح

  * `bunx vitest run` نجح (17/17 tests)

* ✅ **مفاتيح VAPID (Push) تم توليدها وتخزينها بأمان** في secret store الحساب:

  * `VAPID_PUBLIC_KEY` + `VAPID_PRIVATE_KEY` (ECDSA P-256 بصيغة web-push القياسية)

  * `VAPID_SUBJECT` = [mailto:push@hamoula.app](mailto:push@hamoula.app)

  * ⚠️ خاصها تُنسخ لبيئة النشر (Lovable `.env`) عند توفر الوصول — ممنوع دخلها للـ git

* ⏳ **Phase 1 على Supabase محجوبة**: محتاجين من المالك:

  1. **Service Role Key** (Project Settings → API) — ضروري للتطبيق server-side

  2. **DB Connection string** (Project Settings → Database) — لتطبيق Backup + Batch 1→4 عبر psql

  3. **BIRD_API_KEY** + **VONAGE_API_KEY/SECRET/FROM** + **SEND_SMS_HOOK_SECRET** — لتفعيل OTP الحقيقي

* 🚫 لن يتم عمل merge إلى `main` قبل إكمال Phase 1 + التحقق الكامل (Build + اختبارات + فحوصات التشغيل الأساسية).

## تقدم تنفيذي ذاتي (30 سبتمبر 2026)

* ✅ تم جلب حزمة تنفيذ Phase 1 داخل الريبو نفسه لضمان الجاهزية الكاملة:

  * `supabase/phase1_execution_kit/README.md`

  * `supabase/phase1_execution_kit/backup_instructions.md`

  * `supabase/phase1_execution_kit/batch1_columns.sql`

  * `supabase/phase1_execution_kit/batch2_tables.sql`

  * `supabase/phase1_execution_kit/batch3_functions.sql`

  * `supabase/phase1_execution_kit/batch4_rls.sql`

  * `supabase/phase1_execution_kit/verify_after_each_batch.sql`

* ✅ تم إنشاء أدوات تشغيل آمنة مباشرة داخل المشروع:

  * `scripts/phase1_preflight.sh` → فحص جاهزية الملفات + فحص المتطلبات + إظهار الحوايج الناقصة قبل أي تنفيذ

  * `scripts/phase1_apply.sh` → تشغيل Batch 1→2→3→4 بنفس الترتيب الإجباري مع `ON_ERROR_STOP` وتسجيل logs

* ✅ تم إضافة Scripts في `package.json`:

  * `bun run phase1:preflight`

  * `bun run phase1:apply`

  * `bun run test`

  * `bun run typecheck`

* ✅ إصلاح تقني في الكود:

  * تم إصلاح خطأ TypeScript في `src/lib/push.server.ts` (exactOptionalPropertyTypes) داخل `resolveRecipients`.

* ✅ التحقق المحلي بعد الإصلاح:

  * `bun run typecheck` نجح

  * `bun run test` نجح (17/17)

  * `bun run build` نجح

* ⏳ مازال التنفيذ الحقيقي على Supabase محجوب حتى يتوفر:

  * `DATABASE_URL` (أو اتصال مباشر DB)

  * `SUPABASE_SERVICE_ROLE_KEY`

  * مفاتيح OTP الحقيقية (Bird/Vonage) + webhook secret

## إصلاحات مراجعة الكود الحقيقي (30 سبتمبر 2026)

بناءً على مراجعة المالك للـZIP الحقيقي، تم إصلاح النقاط التالية قبل أي تطبيق لـ Phase 1:

### حزمة Phase 1 (SQL + scripts)

* ✅ **Backup تلقائي ومتحقق منه**: `phase1_apply.sh` كيدير pg_dump (schema + data) قبل أي Batch، وكيتأكد أن الملفات غير فارغة وفيها الجداول الأربعة (loads, bids, app_users, drafts) — إلا فشل، كيتوقف قبل أي SQL.

* ✅ **Verification Gates حقيقية**: ملفات `verify_batch1.sql` → `verify_batch4.sql` جديدة كيستعملو `RAISE EXCEPTION` — أي عمود/جدول/دالة/سياسة/bucket ناقص = فشل فعلي للـpsql مع ON_ERROR_STOP.

* ✅ **Bucket `chat-voice`**: batch4 دابا كيخلقو بأمان (`INSERT ... ON CONFLICT DO NOTHING` + `public=false`) قبل ما يطبّق policies ديالو.

* ✅ **RPC `delete_own_load`**: حذف نهائي آمن — صاحب الطلب فقط، كيمسح العروض + رسائل الشات + الطلب نفسه (بدل DELETE مباشر اللي كان كيتصادم مع RLS).

* ✅ **RPC `current_user_role`**: فرض الأدوار فالقاعدة — `loads_insert` كيتطلب `current_user_role()='shipper'` و`bids_insert` كيتطلب `'driver'` (ماشي غير AuthGate فـUI).

### كود العميل (server-first)

* ✅ **`saveBid`**: دابا كيتحقق من `error` ديال Supabase — إلا فشل، كيرمي خطأ وما كيتزادش العرض فالواجهة كأنو تسجل.

* ✅ **`updateBidPrice` / `withdrawBid` / `cancelRequest` / `saveLoadStatus`**: كلهم server-first — أي خطأ كيوقف العملية وما كيتحدثش UI محلياً.

* ✅ **`removeOwnLoad`**: كيستعمل RPC `delete_own_load` بدل DELETE المباشر.

### الأمان والذاكرة

* ✅ **`.env` خرج من git tracking** (`git rm --cached .env`) + `.gitignore` فيه `.env` و`.env.*` — ممنوع أي Secret فـGit.

* ✅ **الذاكرة تصححات**: STT الحالي = OpenAI gpt-4o-transcribe / Lovable AI gateway (ماشي Deepgram)؛ Demo mode موثق كما هو فعلاً (DEV مفعّل افتراضياً بأي رقم + 123456، Production ممنوع دائماً).

### التحقق

* ✅ `bun run typecheck` نجح

* ✅ `bun run test` نجح (17/17)

* ✅ `bun run build` نجح (client + SSR + Nitro)

### مازال ناقص

* ⏳ **الفرنسية**: app-language.ts كيبدل lang وRTL/LTR، لكن باقي الشاشات ما عندهاش ترجمة فرنسية حقيقية (مهمة منفصلة).

* ⏳ **Phase 1 apply**: محجوب حتى يتوفر DATABASE_URL + SUPABASE_SERVICE_ROLE_KEY + مفاتيح OTP.

_آخر تحديث: 30 سبتمبر 2026 بواسطة Abacus AI Agent_

---

## تحديث تنفيذ مراجعة Phase 1 (2026-09-30)

### DONE ✅

* فحص المستودع والفرع والملفات الأساسية المرتبطة بـ Phase 1.

* التحقق من OTP route: Bird WhatsApp أساسي + Vonage SMS fallback موجود ومفعل برمجياً.

* التحقق من Demo mode:

  * `demo-login.ts` مرتبط بـ `import.meta.env.DEV`.

  * OTP `123456` مسموح فقط في DEV.

  * production ممنوع.

* مراجعة push:

  * `push.functions.ts` يعيد `VAPID_PUBLIC_KEY`.

  * `push-client.ts` + `public/sw.js` مسار registration واضح.

* مراجعة ratings:

  * الربط مع `trip_ratings` موجود في `hamoula-ratings.ts`.

* مراجعة اللغة والمدن:

  * `app-language.ts` يضبط `html.lang` و `html.dir` بشكل صحيح.

  * قائمة المدن تغطي المدن المغربية الرئيسية عبر `voice-order.ts` + `hamoula-cities.ts`.

* إنشاء الوثائق المطلوبة:

  * `docs/PROJECT_MEMORY.md`

  * `docs/E2E_TEST_PLAN.md`

  * `docs/VOIP_OPTIONS.md`

  * `docs/CHANGELOG.md`

### FIXED 🔧

* `.gitignore`:

  * إضافة `/backups/`.

  * تأكيد وجود: `.env`, `.env.*`, `!.env.example`, `*.log`, `.output/`, `.wrangler/`, `.nitro/`.

* إضافة `.env.example` جديد بدون أي أسرار.

* `src/lib/hamoula-accounts.ts`:

  * `saveAccount` أصبح يتحقق من خطأ Supabase ويرمي `throw` واضح.

* `src/lib/hamoula-sync.ts`:

  * `saveDraft` أصبح يتحقق من الخطأ ويرمي `throw`.

  * `clearDraft` أصبح يتحقق من الخطأ ويرمي `throw`.

* `supabase/phase1_execution_kit/batch4_rls.sql`:

  * `REVOKE UPDATE(role) ON public.app_users FROM authenticated`.

  * `REVOKE INSERT, UPDATE, DELETE ON public.chat_messages FROM authenticated` (server-only write).

  * سياسة `trip_ratings_insert_participant` تعتمد `can_access_chat_load(load_id)`.

* `supabase/phase1_execution_kit/batch3_functions.sql`:

  * إضافة توثيق صريح أن تغيير role ليس متاحاً مباشرة للمستخدم النهائي.

* `supabase/phase1_execution_kit/README.md`:

  * تحديث مسار التحقق إلى `verify_batch1..4.sql` بدل الاعتماد التنفيذي على `verify_after_each_batch.sql`.

* `src/routes/tracking.tsx`:

  * إضافة TODO بالعربية بخصوص:

    * نقل الشات المحلي إلى `chat_messages`.

    * حفظ تحديث الموقع في DB عبر table/RPC.

### TESTED 🧪

* تم فحص الشيفرة والملفات المستهدفة يدوياً للتطابق مع متطلبات المراجعة.

* التحقق من وجود الدوال والسياسات الحساسة المطلوبة في batch3/batch4.

* التحقق من مسارات OTP وDemo وPush وRatings وLanguage/Cities على مستوى الكود.

* تشغيل أوامر التحقق بنجاح:

  * `bun run typecheck` ✅

  * `bun run test` (17/17) ✅

  * `bun run build` ✅

### BLOCKED ⛔

* تفعيل Push فعلياً في بيئة التشغيل يحتاج وجود `VAPID_PUBLIC_KEY` في runtime environment.

* اختبار OTP الحقيقي end-to-end يحتاج secrets فعليّة:

  * `BIRD_API_KEY`

  * `VONAGE_API_KEY`

  * `VONAGE_API_SECRET`

  * (وكذلك secret توقيع webhook)

* تنفيذ فعلي لدفعات SQL على قاعدة Supabase الإنتاجية يحتاج صلاحيات/اتصال DB مناسب.

### NEED FROM OWNER 📋

1. توفير/تأكيد secrets الإنتاج (OTP + VAPID) في بيئة النشر.

2. منح/تأكيد صلاحية تنفيذ migration على قاعدة Supabase المستهدفة.

3. اعتماد خيار VoIP النهائي (Daily/Agora/Twilio/WebRTC) قبل أي ربط إنتاجي.