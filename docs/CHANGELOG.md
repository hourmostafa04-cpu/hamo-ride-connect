# CHANGELOG (docs) — Hamoula

## 2026-09-30 — Phase1 Review Completion Pass

### Security / RLS
- تحديث `batch4_rls.sql` لمنع `UPDATE(role)` مباشرة على `app_users` لدور `authenticated`.
- تشديد `chat_messages` عبر `REVOKE INSERT, UPDATE, DELETE` من `authenticated` (الإرسال عبر Server Function فقط).
- تعديل سياسة `trip_ratings_insert_participant` للاعتماد على `can_access_chat_load(load_id)`.

### RPC / Functions
- إضافة توثيق صريح في `batch3_functions.sql` أن تغيير role ليس متاحاً للمستخدم النهائي (لا `set_user_role` للعميل).

### Client-side robustness
- `src/lib/hamoula-sync.ts`: إضافة فحص أخطاء Supabase في `saveDraft` و`clearDraft` مع `throw`.
- `src/lib/hamoula-accounts.ts`: إضافة فحص أخطاء Supabase في `saveAccount` مع `throw`.

### Tracking TODOs
- إضافة TODO في `src/routes/tracking.tsx` بخصوص:
  - نقل الشات المحلي إلى `chat_messages` في Supabase.
  - حفظ تحديثات موقع السائق في قاعدة البيانات بدل state المحلي فقط.

### Execution docs
- تحديث `supabase/phase1_execution_kit/README.md` لاستخدام `verify_batch1..4.sql` كـ verification gates الأساسية.

### New docs
- إضافة:
  - `docs/PROJECT_MEMORY.md`
  - `docs/E2E_TEST_PLAN.md`
  - `docs/VOIP_OPTIONS.md`
  - `docs/ABACUS_PROGRESS.md` (تحديث شامل للحالة)
