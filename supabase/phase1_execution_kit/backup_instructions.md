# تعليمات النسخ الاحتياطي قبل أي Migration (حمولة — المرحلة 1)

> **مهم:** لا تطبّق أي ملف SQL قبل إكمال النسخ الاحتياطي والتحقق منه.
> الهدف هو حماية المشروع الحالي وإكماله بأقل مخاطرة.

## 1) نسخ احتياطي من Supabase Dashboard (بدون سطر أوامر)

### A) نسخ احتياطي للبنية (Schema)
1. افتح مشروع Supabase.
2. ادخل إلى **SQL Editor**.
3. شغّل سكربت استخراج البنية (Schema) من لوحة Supabase (إن كانت متاحة عندك عبر أدوات النسخ/التصدير).
4. احفظ الناتج باسم مقترح:
   - `hamoula_schema_YYYYMMDD_HHMM.sql`

### B) نسخ احتياطي للبيانات (Data)
1. من **Table Editor**، صدّر الجداول الأساسية (على الأقل):
   - `loads`
   - `bids`
   - `app_users`
   - `drafts`
2. وصدّر أي جداول إضافية موجودة فعلياً عندك (إن وجدت).
3. الأفضل حفظ كل جدول بصيغة CSV + نسخة SQL إن كانت متاحة.

> إذا كانت ميزة "Backups / PITR" مفعّلة في خطتك، سجّل **تاريخ/وقت** واضح قبل التنفيذ (Checkpoint) للرجوع السريع عند الحاجة.

---

## 2) نسخ احتياطي كامل عبر pg_dump (مفضّل)

### المتطلبات
- وجود PostgreSQL client محلياً (`pg_dump`, `psql`).
- رابط اتصال مباشر بقاعدة PostgreSQL من إعدادات Supabase.

### A) متغيرات البيئة (عدّل القيم)
```bash
export PGHOST="<db-host>"
export PGPORT="5432"
export PGDATABASE="postgres"
export PGUSER="postgres"
export PGPASSWORD="<db-password>"
```

### B) نسخة بنية فقط (Schema only)
```bash
pg_dump \
  --schema-only \
  --no-owner \
  --no-privileges \
  --format=plain \
  --file="hamoula_schema_$(date +%Y%m%d_%H%M).sql"
```

### C) نسخة بيانات فقط (Data only)
```bash
pg_dump \
  --data-only \
  --no-owner \
  --no-privileges \
  --format=plain \
  --file="hamoula_data_$(date +%Y%m%d_%H%M).sql"
```

### D) نسخة كاملة مضغوطة (أفضل خيار للاسترجاع)
```bash
pg_dump \
  --format=custom \
  --compress=9 \
  --no-owner \
  --no-privileges \
  --file="hamoula_full_$(date +%Y%m%d_%H%M).dump"
```

---

## 3) تحقق من نجاح النسخ الاحتياطي (إجباري)

### تحقق سريع من الملفات
```bash
ls -lh hamoula_schema_*.sql hamoula_data_*.sql hamoula_full_*.dump
```

### تحقق من أن ملف الـSchema فيه جداول متوقعة
```bash
grep -E "CREATE TABLE .*\.(loads|bids|app_users|drafts)" hamoula_schema_*.sql
```

### تحقق من ملف البيانات (وجود INSERT/COPY)
```bash
grep -E "^(INSERT INTO|COPY )" hamoula_data_*.sql | head
```

### اختبار قابلية الاسترجاع (اختياري لكن مهم)
- استرجع النسخة على قاعدة اختبار منفصلة (ليس الإنتاج).
- جرّب أوامر listing:
```bash
pg_restore --list hamoula_full_*.dump | head -n 40
```

---

## 4) قواعد قبل تنفيذ أي Batch

1. لا تنفيذ بدون Backup متحقق منه.
2. نفّذ كل Batch لوحده.
3. بعد كل Batch شغّل ملف التحقق `verify_after_each_batch.sql`.
4. عند أول خطأ: **توقّف فوراً**، لا تنتقل للدفعة الموالية.
5. إذا لزم التراجع: استعمل النسخة الاحتياطية بدل ترقيعات عشوائية.

---

## 5) ملاحظة أمان
- لا تشارك `PGPASSWORD` أو connection strings في Git أو الشات.
- خزّن النسخ الاحتياطية في مسار آمن ومشفّر إن أمكن.
