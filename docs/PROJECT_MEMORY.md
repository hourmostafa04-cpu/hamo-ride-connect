# PROJECT_MEMORY — Hamoula (Lovable)

## 1) Stack المؤكد
- Frontend: **Lovable** (Vite + React 19 + TanStack Router)
- Backend: Supabase (PostgreSQL + Auth + Realtime + Storage)
- الملاحظة: المشروع **ليس** TanStack Start كمرجع تنفيذي للهيكل الحالي المطلوب في هاد المرحلة.

## 2) قاعدة البيانات — الحالة الحالية
### جداول مطبّقة فعلياً (حالياً في البيئة الأساسية)
1. `loads`
2. `bids`
3. `app_users` / `app_members` (حسب التسمية التاريخية)
4. `drafts`

### جداول موجودة في migrations / phase1 kit لكن قد لا تكون مطبّقة بعد
1. `chat_messages`
2. `push_subscriptions`
3. `trip_ratings`

## 3) OTP delivery
- القناة الأساسية: **Bird WhatsApp**
- Fallback عند الفشل: **Vonage SMS**
- Hook: `src/routes/api/public/auth-send-sms.ts`
- المبدأ: نفس OTP جاي من Supabase Auth Hook (بدون توليد OTP محلي).

## 4) STT (Speech-to-Text)
- المعتمد: **OpenAI gpt-4o-transcribe**
- ليس Deepgram في النسخة الحالية.

## 5) Demo mode
- Demo login متاح في **DEV فقط**
- `VITE_DEMO_LOGIN=true` في التطوير يسمح مسار الاختبار
- كود OTP التجريبي: `123456`
- Production: Demo mode لازم يبقى مقفول (`import.meta.env.DEV === false`).

## 6) Secrets المطلوبة تشغيل/إنتاج
- `BIRD_API_KEY`
- `VONAGE_API_KEY`
- `VONAGE_API_SECRET`
- `VAPID_PUBLIC_KEY`
- `VAPID_PRIVATE_KEY`
- `OPENAI_API_KEY`
- `GOOGLE_MAPS_API_KEY`

## 7) قواعد حماية ثابتة
- ممنوع إدراج أي Secret داخل Git أو logs.
- `.env` و`.env.*` خارج التتبع، مع السماح فقط بـ `.env.example`.
- تغييرات DB الحساسة تنفذ عبر batch SQL + verification gates.
