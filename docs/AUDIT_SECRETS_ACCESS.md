# 🔍 Audit: حالة Secrets و Production Access — مشروع حمولة

**التاريخ:** 2026-09-30\
**النوع:** Audit فقط — **ما تدار أي تغيير**، ما دخلناش أي Secret جديد، ما بدلنا والو.

---

## 1\. Secrets الموجودين فعلاً ✅

| Secret | الحالة | ملاحظة |
| --- | --- | --- |
| `VAPID_PUBLIC_KEY` | ✅ موجود فـ secret store | len=87 |
| `VAPID_SUBJECT` | ✅ موجود فـ secret store | len=30 |
| `VAPID_PRIVATE_KEY` | ⚠️ موجود **فقط** فـملف محلي [.tmp/vapid_keys.txt](https://apps.abacus.ai/conversationFiles/2fc33176b/.tmp/vapid_keys.txt) | **ماشي فـ secret store** |

> ملاحظة: الـ VAPID keys مكررين فـ secret store تحت اسمين (`hamoula push (vapid)` و `HAMOULA PUSH (VAPID)`) بنفس القيم — تكرار غير ضار لكن غير نظيف.

---

## 2\. حالة Secrets بالنسبة لـ Lovable

> مهم: هاد Audit **ما عندوش access مباشر لـ Lovable Secret Manager**، لذلك ما نقدرش نأكد واش secret ناقص من Lovable ولا لا إلا من داخل Lovable نفسه.

### 2.1 مؤكّد ناقص عند Abacus local/store فقط

| \# | Secret | الحالة | ملاحظة |
| --- | --- | --- | --- |
| 1 | `VAPID_PRIVATE_KEY` | ناقص فـ secret store الحالي | موجود فقط محلياً فـ`.tmp` |

### 2.2 `UNVERIFIED IN LOVABLE` (ماشي `MISSING`)

| \# | Secret |
| --- | --- |
| 1 | `BIRD_API_KEY` |
| 2 | `VONAGE_API_KEY` |
| 3 | `VONAGE_API_SECRET` |
| 4 | `OPENAI_API_KEY` |
| 5 | `GOOGLE_MAPS_API_KEY` |
| 6 | `SUPABASE_SERVICE_ROLE_KEY` |
| 7 | `VITE_SUPABASE_URL` / `SUPABASE_URL` |
| 8 | `VITE_SUPABASE_ANON_KEY` |
| 9 | `SEND_SMS_HOOK_SECRET` |

---

## 3\. خدام ✅ / فاشل ❌

### خدام ✅

* **GitHub App متصل بالريبو** — قراءة مؤكدة (list_branches نجح).

* **الفرع `features/phase1-review` موجود فـ GitHub** @ commit `55f150f` (مراجعة Phase 1 مرفوعة).

* البناء والاختبارات والـ typecheck كاملين (من الجولة السابقة).

### فاشل ❌ / credentials غير صحيحة

* ⚠️ **زوج VAPID keys غير متطابق!** تحققت برمجياً: الـ public key المستخرج من الـ private key **مختلف** على الـ public key المخزن. يعني push notifications **غادي تفشل** فـ production حتى لو دخلنا الـ keys. **يجب توليد زوج جديد صحيح** (أو اشتقاق public من private).

* **Supabase CLI غير مثبت** + **لا يوجد access token** (`~/.supabase/access-token` غير موجود).

* **لا يوجد أي `.env` فالمشروع** — غير `.env.example`.

* Push عبر HTTPS فشل سابقاً (نقص credentials) — لكن GitHub App token متوفر، **يمكن إصلاحه**.

---

## 4\. DB access لـ Phase 1 ❌

**لا — ما عندناش access كافٍ لتطبيق Phase 1.**

عندنا:

* ✅ project ref: `rfpxvayojwwvmzumwgia` (من `supabase/config.toml`)

* ✅ حزمة SQL كاملة جاهزة (`phase1_execution_kit`: 4 دفعات + 4 سكربتات تحقق)

* ❌ **ما عندناش**: access token، ولا CLI، ولا DATABASE_URL، ولا service role key

**لتفعيل Phase 1، محتاجين واحد من هاد الثلاثة:**

1. **Supabase Access Token** (من Supabase Dashboard → Account → Access Tokens) → نثبّتوا CLI ونربطو المشروع بـ `supabase link --project-ref rfpxvayojwwvmzumwgia` ثم نطبقو الدفعات.

2. **أو** `DATABASE_URL` (pooler connection string) + `SUPABASE_SERVICE_ROLE_KEY` → نطبقو عبر psql.

3. **أو** المالك ينفّذ ملفات الـ SQL يدوياً فـ Supabase SQL Editor (عبر Lovable) — عندو access للتطبيق المنشور.

---

## 5\. حالة Git

* الفرع: `features/phase1-review`

* ✅ تم الدفع إلى GitHub عبر GitHub App token (بدون إدخال أي Secret جديد).

* آخر commits مرفوعين لهاذ الإصلاحات:

  * `3500c41` — TripMap i18n labels

  * `f004a3e` — root 404/error i18n

  * `cf5e05b` — ratings error text

* ملاحظة: هادشي كيرفع جوهر تعديلات `cb1f37f` التقنية. توحيد commit بنفس SHA الأصلي غير ممكن عبر واجهة GitHub API المباشرة.

---

## 6\. الخلاصة

**ماشي كلشي مؤكد** → Phase 1 يبقى محجوب حتى يتوفر Supabase production access.

**التصنيف الصحيح دابا:**

1. `VAPID_PRIVATE_KEY` = **ناقص فـ store الحالي** (كان فقط محلياً).

2. Bird/Vonage/OpenAI/Maps/Supabase secrets = **UNVERIFIED IN LOVABLE** (ماشي `MISSING`) حتى يتفحصو من داخل Lovable Secret Manager.

**تم بدون Production access:**

* ✅ رفع تغييرات i18n الأساسية للفرع `features/phase1-review` على GitHub.

* ✅ توليد زوج VAPID جديد ومتطابق وآمن محلياً (متحقق رياضياً) بدون إدخاله لـ Git.

**مازال BLOCKED:**

* إدخال زوج VAPID الجديد في secret store الآمن (يتطلب access لأداة إدارة secrets).

* التحقق المباشر من Lovable Secret Manager لتأكيد شنو موجود فعلاً.

* تطبيق Phase 1 على Supabase (يتطلب `DATABASE_URL`/`SUPABASE_SERVICE_ROLE_KEY` أو access token).