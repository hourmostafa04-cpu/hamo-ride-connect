# خطة إصلاح أمان: الطلبات، العروض، الشات

الهدف: سد ثغرات الصلاحيات فقط. بلا تغيير تصميم، بلا نشر، بلا لمس OTP/Vonage/Bird أو إصلاحات Demo/GPS.

## 1) الطلبات (loads)

المشكل الحالي: أي سائق عنده عرض على الطلب يقدر يعدّل الطلب كامل (الثمن، الهاتف، البضاعة، العرض المقبول).

الحل:
- تعويض سياسة التعديل الواسعة `loads_update` بسياسة تخص صاحب الطلب فقط (`user_id = auth.uid()`).
- تغيير حالة الرحلة يمر عبر دالة آمنة `set_trip_status(load_id, status)`:
  - `enroute` / `loaded` / `delivered` = السائق المقبول فقط.
  - صاحب الطلب ما عندوش صلاحية على حالات السائق؛ عندو فقط `cancelled` حسب الفلو الحالي.
  - قيم غير مسموحة أو انتقال غير منطقي = رفض.
- الأعمدة الحساسة (الثمن، الهاتف، بيانات المرسل، العرض المقبول) تبقى ممنوعة على السائق نهائياً.

## 2) العروض (bids)

المشكل الحالي: صاحب الطلب يقدر يعدّل أي عمود في عرض السائق (الثمن، الهاتف، الاسم).

الحل:
- إيقاف UPDATE المباشر الواسع: صاحب الطلب ما عندو حتى UPDATE على `bids`.
- حتى السائق صاحب العرض ممنوع يغيّر `user_id` / `driver_id` / `load_id` / `driver_phone` / أي هوية — لأن RLS ما كتحددش الأعمدة، التعديل يمر عبر RPC `update_own_bid(bid_id, price, eta_min, voice_note)` وكتخدم فقط إذا `status = 'pending'` والعرض ديال المتصل.
- القبول/الرفض من صاحب الطلب عبر `respond_to_bid(bid_id, decision)` فقط.

## 3) خصوصية الشات

الوضع الحالي: الشات في الواجهة يخدم فقط بين صاحب الطلب والسائق المقبول، لكن القواعد كتسمح لأي سائق قدّم عرض يقرا نفس المحادثة.

الحل (نفس تجربة المستخدم الحالية، بلا حذف الشات):
- القراءة تبقى فقط لصاحب الطلب + السائق المقبول (`accepted_offer` / العرض المقبول).
- INSERT المباشر من العميل ممنوع نهائياً (ما كاين سياسة INSERT لـ `authenticated`).
- تحديث دالة `can_access_chat_load` المستعملة كذلك في ملفات الصوت (`chat-voice`) بنفس الشرط.
- ما كاين حتى حذف لرسائل موجودة.

## 4) هوية المرسل

- كل إرسال يمر فقط عبر Server Function `sendChatMessage` مع `requireSupabaseAuth`.
- السيرفر هو اللي يحدد `user_id` / `sender_phone` / `sender_name` / `sender_role` من `auth.uid()` و`app_users` والطلب/العرض المقبول.
- أي هوية جاية من العميل كتتجاهل بالكامل (المدخل = `loadId` + النص/الصوت فقط).
- الكتابة فقاعدة البيانات تتم عبر دالة آمنة/عميل موثوق، والعميل ما بقاش عندو INSERT.

## 5) إشعارات الشات

- في `push.server.ts` تعويض إرسال الإشعار لجميع أصحاب العروض بإرسال للطرف الآخر فقط في نفس المحادثة (صاحب الطلب أو السائق المقبول).


## التفاصيل التقنية

قاعدة البيانات (Migration واحدة):
- `loads`: DROP/CREATE `loads_update` → صاحب الطلب فقط. دالة `public.set_trip_status(text, text)` (SECURITY DEFINER, search_path=public).
- `bids`: DROP/CREATE `bids_update` → السائق صاحب العرض و`status='pending'`. دالة `public.respond_to_bid(text, text)`.
- `chat_messages`: DROP/CREATE سياسات SELECT/INSERT مبنية على دالة جديدة `public.is_chat_party(load_id)` = صاحب الطلب أو السائق المقبول.
- تحديث `public.can_access_chat_load` لتعتمد `is_chat_party`.
- GRANT EXECUTE للدوال الجديدة لـ `authenticated` فقط.

الملفات:
- `src/lib/chat.functions.ts` (جديد): إرسال رسالة بهوية السيرفر.
- `src/lib/hamoula-chat.ts`: `sendMessage` كيمر عبر الدالة الجديدة.
- `src/lib/hamoula-sync.ts`: `saveLoadStatus` (تغيير الحالة) و`saveBidStatus` (قبول/رفض) كيمرو عبر RPC الجديدة.
- `src/lib/push.server.ts`: مستقبل إشعار الشات = الطرف الآخر فقط.
- `PROJECT_MEMORY.md` و `CHANGELOG.md`: تحديث.

## التحقق
- typecheck + اختبارات موجهة للأمان فقط (محاولة تعديل طلب من سائق، تعديل عرض من صاحب الطلب، قراءة شات من bidder غير مقبول).
- بلا Audit شامل، بلا Playwright شامل، بلا نشر.
