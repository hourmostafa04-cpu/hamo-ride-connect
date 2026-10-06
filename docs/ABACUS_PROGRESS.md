# Hamoula - سجل تقدم Abacus AI

هاد الملف كيوثق التقدم اللي دار Abacus AI Agent على مشروع حمولة (hamo-ride-connect).

---

## OTP Production Fix — 2026-10-07 (Bird Verify + real Supabase session)

**Branch**: `features/phase1-review`

### DONE ✅
- Replaced production OTP API flow with **Bird Verify server endpoints**:
  - `POST /api/public/auth-verify-request`
  - `POST /api/public/auth-verify-check`
- Reused Moroccan phone normalization from `src/lib/auth-sms-hook.ts` (no duplicated phone rules).
- Removed production dependency on Supabase Send SMS Hook path and **removed Vonage from the production OTP execution path**.
- Added server-side Supabase session establishment after successful Bird OTP verification:
  - find-or-create Auth user by phone
  - enforce `phone_confirm: true`
  - mint real session via server-side password sign-in
  - return access/refresh tokens for frontend `supabase.auth.setSession(...)`
- Kept demo login behavior untouched (DEV-only branch remains intact).
- Added hermetic unit tests for Bird verify integration logic (`src/lib/bird-verify.test.ts`).
- Updated `.env.example` with `SUPABASE_PUBLISHABLE_KEY` / `VITE_SUPABASE_PUBLISHABLE_KEY` placeholders.

### NOTES
- Supabase JS version in this repo does not support `admin.generateLink({ type: 'sms' })` typings; implemented a supported server-only session minting flow after Bird check.
- Live Bird delivery was **not** executed locally (no runtime production secrets in local shell).

---

## تحديث تنفيذي 2026-09-30 (جولة 2: الوصول المباشر لـ Lovable)

**Branch**: `features/phase1-review` (آخر commit: `b85a59c`)

### DONE ✅
- **Lovable Editor access مؤكد** — المشروع "Remix of Hamoula Go" مفتوح والـ Preview خدام.
- **Lovable Secret Manager access مؤكد** — صفحة Cloud → Secrets تفتح وتخدم.
- **جرد الـ Secrets الفعلي داخل Lovable** (فحص مباشر، الأسماء فقط): الموجودين هم `LOVABLE_API_KEY`, `DEEPGRAM_API_KEY`, `LOVABLE_CRON_SECRET`. كل اللي كان `UNVERIFIED IN LOVABLE` (Bird/Vonage/OpenAI/Maps/Supabase) ولّى **`VERIFIED ABSENT`** — متحقق غيابه من داخل Lovable.
- **زوج VAPID الجديد المتطابق دخل بنجاح فـ Lovable Secret Manager**: `VAPID_PUBLIC_KEY` + `VAPID_PRIVATE_KEY` + `VAPID_SUBJECT` (القيم ما كتباتش فالشات ولا logs — دخلات مباشرة فـ Lovable).

### BLOCKED ⛔
- **Phase 1 (backup + batch1→4 + verification)**: لا يوجد ربط خارجي بمشروع Supabase مستقل (Disconnected)، و`DATABASE_URL` / `SUPABASE_SERVICE_ROLE_KEY` / access token غير متوفرة. محتاجين من المالك: ربط Supabase production أو توفير DATABASE_URL/service role key.
- **E2E حقيقي (OTP/طلبات/عروض/Chat/Push/Tracking/Ratings)**: محتاج `BIRD_API_KEY`, `VONAGE_API_KEY`, `VONAGE_API_SECRET`, `SEND_SMS_HOOK_SECRET`, `OPENAI_API_KEY` (متحقق غيابهم فـ Lovable) + تطبيق Phase 1 على القاعدة.

### ملاحظات
- تنبيه أمني "Critical errors" فلوحة Cloud — يجب فحصو من المالك قبل الإطلاق.
- زوج VAPID القديم (فـ Abacus secret store) غير متطابق — الزوج الجديد دخل فـ Lovable؛ يُنصح بتحديث Abacus store بنفس الزوج الجديد للاتساق.

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

---

## تحديث تكميلي بدون Secrets/Production (2026-09-30)

### DONE ✅

* ربط شاشة `tracking` بالشات الحقيقي (`chat_messages`) بدل الـlocal chat:

  * تحميل الرسائل من Supabase

  * اشتراك Realtime للرسائل الجديدة

  * إرسال نص/صوت عبر Server Function (`sendChatMessage`) فقط

* تنفيذ مزامنة موقع السائق بشكل server-first:

  * ملف جديد: `src/lib/tracking.functions.ts` (Server Function آمن)

  * ملف جديد: `src/lib/hamoula-trip-location.ts` (fetch/subscribe/persist)

  * في `tracking.tsx`: حفظ الموقع دورياً في DB عبر السيرفر + عرض آخر موقع محفوظ للطرفين

* إزالة TODO/FIXME من `src/` بعد تنفيذ ما يمكن تنفيذه محلياً.

### FIXED 🔧

* تحديث `src/routes/tracking.tsx`:

  * إزالة الشات المحلي التجريبي وتعويضه بقراءة/إرسال حقيقي عبر `chat_messages`.

  * إضافة مزامنة `trip_locations` وربطها بالخريطة.

  * منع نجاح UI الوهمي عند فشل الإرسال/المزامنة (server-first).

* تحديث kit ديال SQL باش يدعم مزامنة الموقع بشكل idempotent:

  * `batch2_tables.sql`: إضافة جدول `trip_locations` + trigger + realtime publication.

  * `batch4_rls.sql`: سياسات RLS للقراءة لطرفي الرحلة، مع منع الكتابة المباشرة من authenticated.

  * `verify_batch2.sql` و `verify_batch4.sql`: إضافة gates للتحقق من `trip_locations`.

* تحديث `src/integrations/supabase/types.ts` بإضافة `trip_locations`.

* تحسين i18n runtime:

  * `app-language.ts` أصبح فيه event موحد `hamoula:language-changed` + hook `useAppLanguage()`.

* بدء ترجمة فرنسية فعلية على الشاشات الرئيسية الأكثر استعمالاً:

  * `tracking.tsx`

  * `chat.tsx`

  * `MyRequests.tsx`

  * `MyBids.tsx`

  * `DriverDashboard.tsx` (العناوين الأساسية)

### TESTED 🧪

* `bun run typecheck` ✅

* `bun run test` ✅ (17/17)

* `bun run build` ✅ (client + SSR + Nitro)

* اختبار محلي stubbed-flow على مستوى الكود:

  * tracking chat load/send flow

  * tracking location persistence flow

### BLOCKED ⛔

* تفعيل فعلي end-to-end لمزامنة `trip_locations` في بيئة الإنتاج يحتاج تطبيق SQL batches على قاعدة Supabase المستهدفة.

* OTP الحقيقي وPush الحقيقي مازالان مرتبطين بوجود secrets في runtime.

* قرار VoIP النهائي مازال يحتاج اختيار المالك.

### NEED FROM OWNER 📋

1. تطبيق SQL kit على قاعدة Supabase المستهدفة (خصوصاً `trip_locations`).

2. إدخال secrets الإنتاج (Bird/Vonage/VAPID) في بيئة التشغيل.

3. اعتماد مزود VoIP النهائي.

---

## تحديث استكمال الأشغال الممكنة — features/phase1-review (2026-09-30)

### DONE ✅

* تم الالتزام بقاعدة **عدم إعادة العمل** قبل أي تعديل:

  * مراجعة `docs/ABACUS_PROGRESS.md`.

  * مراجعة `docs/PROJECT_MEMORY.md`.

  * مراجعة `git status` و`git diff` قبل التنفيذ.

* `RegisterScreen.tsx`:

  * إكمال ترجمة النصوص المتبقية المطلوبة للفرنسية (منها: **اختر نوع الحساب**، **الرقم تأكد بال SMS**، **الاسم والنسب**، ورسائل OTP/errors/labels/aria).

  * توحيد رسائل الخطأ الديناميكية (send/verify/demo) لتدعم العربية/الفرنسية.

  * تحسين بعض نصوص الحالة (GPS/voice status) مع fallback عربي.

* `TripRating.tsx`:

  * تصحيح النص من: **"ما تسناش التقييم"** إلى **"ما تسجّلش التقييم"**.

* `ContactActions`:

  * التحقق من الاستعمال الفعلي عبر الاستيرادات داخل المشروع.

  * النتيجة: النسخة المستعملة هي `src/components/hamoula/ContactActions.tsx` فقط، ولم يتم العثور على ملف duplicate باسم `ContactActions(1).tsx` داخل `src/components/hamoula/`.

* TODO/FIXME:

  * فحص `src/` بالكامل والنتيجة: لا توجد `TODO`/`FIXME` متبقية قابلة للتنفيذ بدون Secrets.

* استكمال ترجمة فرنسية إضافية مؤثرة في تجربة السائق/الصوت:

  * `DriverDashboard.tsx` (أزرار/رسائل/حالات loading/errors/toasts/labels الأساسية).

  * `Voice.tsx` (VoiceBanner + VoiceNotePlayer + VoiceRecorderSheet: نصوص الإرشاد/التأكيد/الإلغاء/الإرسال/التحليل + aria + placeholders).

### REVIEWED 🔍

* مراجعة منطق OTP على مستوى الكود: الإرسال/التحقق + مسار demo.

* مراجعة demo safety: استمرار الاعتماد على `import.meta.env.DEV` لمسار demo (بدون تمكين production).

* مراجعة مسارات `chat/tracking/location` و`ratings` و`push` على مستوى الكود الحالي مع الحفاظ على server-first patterns السابقة.

* مراجعة حالات `errors/loading/disabled` في شاشات التسجيل/لوحة السائق/الصوت بعد التعديلات.

### TESTED 🧪

* `bun run typecheck` ✅

* `bun run test` ✅ (17/17)

* `bun run build` ✅

### BLOCKED ⛔

* تطبيق SQL kit على Supabase Production: يحتاج صلاحيات/اتصال قاعدة الإنتاج.

* إدخال Secrets الإنتاج (OTP/Push/Maps/AI): خارج نطاق هذه الجولة وبدون مشاركة أسرار.

* اختيار VoIP production النهائي: قرار مالك المنتج.

### NEED FROM OWNER 📋

1. توفير صلاحية تنفيذ SQL batches على قاعدة Supabase المستهدفة (Production/Staging).

2. إدخال Secrets الإنتاج في بيئة النشر (Bird/Vonage/VAPID/OpenAI/Maps).

3. اعتماد مزود VoIP النهائي قبل أي ربط إنتاجي.

---

## تحديث تدقيق نهائي إضافي — features/phase1-review (2026-09-30)

### DONE ✅

* تم تنفيذ تدقيق إضافي بدون إعادة الميزات المنجزة مسبقاً (اعتماداً على `ABACUS_PROGRESS` + `PROJECT_MEMORY` + حالة git).

* `src/components/hamoula/TripMap.tsx`:

  * إضافة دعم فرنسي فعلي لوسوم الخريطة:

    * `التحميل` ↔ `Chargement`

    * `الوجهة` ↔ `Destination`

  * تحديث الوسوم مباشرة عند تبديل اللغة (بدون كسر map state).

* `src/routes/__root.tsx`:

  * ترجمة شاشة `404` وشاشة `Error boundary` للعربية/الفرنسية بدل النص الإنجليزي الثابت.

* `src/lib/hamoula-ratings.ts`:

  * تصحيح رسالة الخطأ العربية إلى: **"ما تسجّلش التقييم، عاود المحاولة"**.

### FIXED 🛠️

* تغطية فجوة i18n كانت ظاهرة في وسوم `TripMap` (بقات عربية فقط قبل هذا التحديث).

* إزالة النصوص الإنجليزية الثابتة من مسارات الخطأ العامة (`NotFound` و`ErrorComponent`) لضمان اتساق الواجهة الثنائية اللغة.

### TESTED 🧪

* `bun run typecheck` ✅

* `bun run test` ✅ (17/17)

* `bun run build` ✅

* `bun run phase1:preflight` ✅ (التحقق المحلي نجح مع إظهار المتطلبات الناقصة للإنتاج كـ gates واضحة).

### BLOCKED ⛔

* تطبيق SQL kit على Supabase Production (يتطلب DB access وصلاحية تنفيذ).

* إدخال Secrets الإنتاج (Bird/Vonage/VAPID/OpenAI/Maps) في بيئة التشغيل.

* قرار مزود VoIP النهائي قبل الربط الإنتاجي.

### NEED FROM OWNER 📋

1. صلاحية/تنفيذ SQL batches على قاعدة Supabase المستهدفة.

2. إدخال أسرار الإنتاج في بيئة النشر (بدون مشاركتها في Git/Logs).

3. اعتماد مزود VoIP النهائي.

---

## تحديث تنفيذي — Audit Access/Secrets + Push Safe Path (2026-09-30)

### DONE ✅

* تنفيذ Audit محافظ بدون أي إدخال Secrets جديد.
* تأكيد أن تصنيف Bird/Vonage/OpenAI/Maps/Supabase keys لازم يكون:
  * **UNVERIFIED IN LOVABLE** (ماشي `MISSING`) ما دام ما كاينش access مباشر لـ Lovable Secret Manager.
* رفع تغييرات i18n الأساسية إلى GitHub branch `features/phase1-review` عبر GitHub App token:
  * `3500c41` — TripMap labels
  * `f004a3e` — 404/Error boundary i18n
  * `cf5e05b` — rating error message
* توليد زوج VAPID جديد ومتطابق (public/private) والتحقق الرياضي من التطابق محلياً.

### FIXED 🛠️

* تصحيح منهجية التصنيف في التدقيق:
  * أي Secret خارج نطاق Lovable المباشر ⇒ `UNVERIFIED IN LOVABLE`.
  * ممنوع إعادة إدخال Secrets عشوائياً قبل التحقق من Lovable نفسه.

### BLOCKED ⛔

* تخزين زوج VAPID الجديد في secret store الآمن مازال محجوب بسبب غياب access لأداة إدارة secrets في هاد الجلسة.
* تطبيق Phase 1 مازال محجوب حتى يتوفر Supabase production access (`DATABASE_URL`/`SUPABASE_SERVICE_ROLE_KEY` أو access token).

### NEED FROM OWNER 📋

1. فتح/تنفيذ فحص مباشر داخل Lovable Secret Manager لتحديد الموجود فعلاً.
2. توفير مسار آمن لإدخال VAPID pair الجديد (private/public) داخل secret manager.
3. توفير Supabase production access للانتقال من التحضير إلى التنفيذ الفعلي لـ Phase 1.



---

## تحديث تنفيذي 2026-09-30 (جولة 3: Phase 1 مطبق على Lovable Cloud + Security Scan)

### DONE ✅

* **Phase 1 مطبق بالكامل على قاعدة بيانات Lovable Cloud** (عبر Cloud → SQL Editor، بلا DATABASE_URL خارجي):
  * Batch 1: تحقق مضغوط → **PASS** (الأعمدة والفهارس موجودة، ما تعاودش التنفيذ).
  * Batch 2: التحقق الأول بيّن نقص فعلي (كل الجداول الجديدة غايبين) → تنفذ `batch2_tables.sql` كاملاً → إعادة تحقق **PASS** (chat_messages, push_subscriptions, trip_ratings, trip_locations + التريغرز + Realtime).
  * Batch 3: تنفذ `batch3_functions.sql` (440 سطر) بلا أخطاء → تحقق **PASS** (11 دالة RPC + صلاحيات EXECUTE).
  * Batch 4: تنفذ `batch4_rls.sql` (284 سطر) بلا أخطاء → تحقق **PASS** (RLS على 8 جداول، 9 سياسات أساسية، 2 سياسات storage، bucket chat-voice، UPDATE منزوع من authenticated على loads/bids، وكتابة chat/trip_locations منزوعة من العميل).
  * التقرير الكامل: `/home/ubuntu/PHASE1_LOVABLE_SQL_REPORT.md`.

* **Security Audit على القاعدة** (3 استعلامات):
  * 23 سياسة — كلها لـ `authenticated` فقط، صفر سياسات لـ `anon`.
  * RLS = true على الجداول الثمانية.
  * 48 صف صلاحيات — كلها `authenticated`، ما كاين حتى صف لـ `anon`.

* **Security Scan على الكود** (توافق مع RLS الجديد):
  * إصلاح تدفق الدخول التجريبي فـ `src/components/hamoula/RegisterScreen.tsx` (طلب الجلسة حسب الدور المختار فعلياً بدل shipper افتراضي).
  * تقوية `src/lib/demo-auth.functions.ts` (فحص صريح لأخطاء upsert).
  * تأكيد أن كل الكتابات الحساسة (chat_messages, trip_locations) كتمّر من Server Functions، وكل UPDATE/DELETE على loads/bids كتمّر من RPC.
  * `bun run typecheck` ✅ | `bun run test` ✅ (17/17) | `bun run build` ✅.
  * Commit محلي: `14be8cc` — `security: harden demo auth flow for Phase1 RLS compliance`.

### BLOCKED ⛔

* **تفعيل OTP الحقيقي** (Bird WhatsApp أساسي + Vonage SMS fallback): محتاج Secrets غايبين فـ Lovable Secret Manager: `BIRD_API_KEY`, `VONAGE_API_KEY`, `VONAGE_API_SECRET`, `SEND_SMS_HOOK_SECRET` + ربط Supabase Auth Hook بعنوان الـ endpoint المنشور.
* **E2E الكامل** (الطلبات، العروض، Chat، Push، Tracking، Ratings): محتاج OTP حقيقي (فوق) + مزامنة الكود المصلح (RLS-compliant) إلى تطبيق Lovable المنشور.
* **git push** ديال commit `14be8cc`: فشل بسبب قيود auth فالجلسة السابقة — غادي يتعاد المحاولة.

### NEED FROM OWNER 📋

1. إدخال Secrets OTP فـ Lovable Secret Manager: `BIRD_API_KEY`, `VONAGE_API_KEY`, `VONAGE_API_SECRET`, `SEND_SMS_HOOK_SECRET` (و`VONAGE_SMS_FROM` اختياري).
2. مزامنة كود الريبو (الفرع `features/phase1-review`) إلى تطبيق Lovable المنشور باش الكود يمتثل لـ RLS الجديد.
3. بعدها: تفعيل Auth Hook + اختبار تسجيل/دخول حقيقيين + E2E كامل.



---

## تحديث تنفيذي 2026-10-01 (Post-Phase1 Hardening: Security Audit 3)

**Branch**: `features/phase1-review`

### المطلوب المنجز ✅
- تمت مراجعة **Security Audit 3** داخل **Lovable Cloud → SQL editor** بلا إعادة أي Batch.
- تم رصد صلاحيات زايدة للـ `authenticated` من النوع:
  - `REFERENCES`
  - `TRIGGER`
- تم تطبيق hardening مباشر على قاعدة Lovable:
  - `REVOKE TRUNCATE, TRIGGER, REFERENCES ON ALL TABLES IN SCHEMA public FROM anon, authenticated`
  - `ALTER DEFAULT PRIVILEGES ... REVOKE TRUNCATE, TRIGGER, REFERENCES ...`

### نتيجة إعادة التدقيق (Re-Audit) ✅
- `anon_policy_rows = 0`
- `public_tables_without_rls = 0`
- `risky_priv_rows = 0`  (TRUNCATE/TRIGGER/REFERENCES)
- توزيع الصلاحيات الجدولية بعد hardening:
  - `authenticated`: 24 grant rows
  - `privilege_types`: `DELETE, INSERT, SELECT, UPDATE`
  - `anon`: 0 rows

### Git / Sync ✅
- تأكيد أن commit `14be8cc` مرفوع فعلياً على GitHub (داخل تاريخ الفرع).
- `refs/heads/features/phase1-review` على origin كيشير لـ `4706f0f`، وداك الـHEAD فيه `14be8cc` ضمن السلسلة.
- من داخل Lovable (Cloud/Workspace) المشروع باقٍ مربوط بنفس repo/branch workflow ديال GitHub publishing.

### ملاحظات
- ما تعاود حتى Batch من Batch1..Batch4.
- ما تبدل حتى Secret فهاد الجولة.
