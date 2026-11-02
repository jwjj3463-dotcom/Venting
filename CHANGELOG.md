# سجل التغييرات | Changelog

تُوثّق هنا التغييرات التي تصل إلى المستخدمين. يُنشأ إصدار GitHub رسمي تلقائيًا عند دفع وسم إصدار بصيغة `vMAJOR.MINOR.PATCH` بعد إعداد مفتاح التوقيع.

User-facing changes are recorded here. A GitHub Release is published automatically for a `vMAJOR.MINOR.PATCH` tag once release signing is configured.

## 3.10.6 — إعدادات موحدة لشحن النقاط واشتراكات VIP | Unified top-up and VIP settings

### أُضيف

- إدارة باقات النقاط وباقات VIP ووسائل الدفع من مكان واحد في لوحة الإدارة، مع تحديد السعر والنقاط والعملة ومدة الاشتراك.
- تحديث إعدادات الشحن وطلبات المستخدمين مباشرةً دون الحاجة إلى إعادة تشغيل التطبيق.
- عرض خطط VIP النشطة من الخادم، وتثبيت السعر والمدة والمكافأة في الطلب وقت إنشائه حتى لا تتغير الطلبات السابقة عند تعديل الباقات.

### Added

- Manage points packages, VIP plans, and payment methods together in the admin panel, including price, bonus points, currency, and duration.
- Refresh wallet configuration and request statuses live without restarting the app.
- Load active VIP plans from the server and preserve each request's original price, duration, and bonus when plans change.

## 3.10.5 — اشتراكات VIP اليدوية وإصلاح إرسال الصور | Manual VIP subscriptions and image sending

### أُضيف وأُصلح

- ربط باقات VIP بالدفع اليدوي؛ تظهر الطلبات في لوحة الإدارة، ولا يتفعّل الاشتراك أو تضاف نقاطه الترحيبية إلا بعد موافقة المالك.
- تطبيق مدد الباقات الأسبوعية والشهرية وربع السنوية، مع تمديد الاشتراك النشط عند التجديد.
- تحسين نافذة تحديث Android وقسم VIP بتأثير Border Beam، دون تغيير خطوات تنزيل التحديث وتثبيته.
- ضغط صور المحادثات الخاصة والتحقق من نوعها وحجمها قبل الإرسال لتفادي فشل الطلبات الكبيرة.

### Added and fixed

- Connect VIP plans to manual payment review; approval activates the subscription and credits its bonus points exactly once.
- Enforce weekly, monthly, and quarterly subscription durations; renewals extend an active subscription.
- Refresh the Android update prompt and VIP card with a Border Beam effect without changing the download/install flow.
- Compress and validate private-chat images before sending to avoid oversized requests.

## 3.10.4 — إصلاح تسجيل Google على Android | Fix Google sign-in on Android

### أُصلح

- تضمين اعتمادات Google الأصلية لإضافة Firebase Authentication في بناء Android، مع منع الرجوع الصامت إلى مسار الويب إذا لم تكن الإضافة الأصلية متاحة.
- لم تتغير وظائف تسجيل الدخول والتسجيل والتحقق من البريد واستعادة كلمة المرور.

### Fixed

- Include the Firebase Authentication plugin's native Google dependencies in Android builds and fail clearly rather than silently using the web fallback when the native plugin is unavailable.
- Email/password sign-in, registration, verification, and password recovery behavior is unchanged.

## 3.10.3 — إعلانات المحادثات والروابط المباشرة | Sponsored chat card and app links

### أُضيف

- بطاقة إعلان Monetag واضحة بين المحادثات المقبولة، مع مفتاح تشغيل مستقل في لوحة الإدارة وتوافقها مع مفتاح إيقاف الإعلانات العام.
- فتح روابط `/u/:slug` داخل تطبيق Android عند تثبيت الإصدار الجديد والتحقق من ارتباط النطاق.

### أُصلح

- تقديم واجهة التطبيق على النطاق العام بدل رفضه بواسطة خادم Vite التطويري، وإبقاء الرابط الشخصي قابلًا للفتح في المتصفح عند عدم تثبيت التطبيق.
- نشر ملف Android App Links المرتبط بشهادة إصدار التطبيق.
- مكافآت مشاهدة الإعلانات تبقى متوقفة حتى يتوفر تحقق موثوق من اكتمال الإعلان على الخادم.

## 3.10.2 — الشحن اليدوي | Manual wallet top-ups

### أُضيف

- طلبات شحن رصيد يدوية بإثبات تحويل ومراجعة من المالك، مع إضافة الرصيد مرة واحدة فقط بعد الاعتماد وتسجيله في السجل المالي.
- إعداد باقات الشحن ووسائل التحويل من لوحة الإدارة؛ تبقى غير متاحة للمستخدمين حتى إدخال بيانات المالك وتفعيلها.
- عرض حالة الطلب وسبب الرفض، مع إشعار مباشر عند اتخاذ القرار.

## 3.10.1 — صور المستخدمين على الرادار | Radar user avatars

### أُضيف

- عرض صور المستخدمين المتصلين مباشرة على الرادار بدل النقاط البيضاء، مع الإبقاء على مؤشر حالة المطابقة والضغط لفتح بطاقة المستخدم.

## 3.10.0 — رادار مطابقة مباشر | Live match radar

### أُضيف

- تحديث الرادار والمرشحين مباشرة عند اتصال المستخدمين أو مغادرتهم، مع إعادة الانضمام إلى الطابور تلقائيًا بعد استعادة الاتصال.
- تحسين مظهر الرادار وإظهار نقاط المستخدمين المتصلين الفعليين مع احترام إعداد تقليل الحركة.

## 3.9.9 — إصلاح تثبيت التحديث | Update installation fix

### أُصلح

- إصلاح مسار APK الذي يشاركه Android FileProvider، كي يتمكن مُثبّت Android من فتح التحديث بعد اكتمال تنزيله.

## 3.9.8 — إصلاح الحفظ وملاحظات التحديث | Profile save and update notes fix

### أُصلح

- ضغط صور الملف الشخصي قبل إرسالها، لتجنب رفض طلب الحفظ بسبب حد حجم الطلب في الخادم الوسيط.
- عرض رسائل خطأ حفظ الملف الشخصي بوضوح بدل تنسيقها كرسائل نجاح.
- عرض ملاحظات التحديث من سجل التغييرات بالعربية، مع إزالة علامات Markdown والرموز الخام.
- الإبقاء على إصلاح تسجيل Google المرتبط بشهادة إصدار Android والتحقق منه في بناء GitHub.

## 3.9.7 — إصلاح تسجيل Google في إصدار Android | Android Google sign-in fix

### أُصلح

- تسجيل بصمتي SHA-1 وSHA-256 لشهادة APK الموقّع المستخدمة فعليًا في GitHub Actions، وتحديث إعداد Firebase الناتج.
- التحقق تلقائيًا أثناء بناء الإصدار من تطابق بصمة شهادة التوقيع مع إعداد OAuth المضمّن.

## 3.9.5 — إصلاح التحقق من البريد | Email verification fix

### أُصلح

- يعتمد التحقق النهائي من البريد على حالة Firebase، لا على حداثة مطالبة `email_verified` في رمز الدخول.
- يعيد الخادم التحقق من حالة الحساب لدى Firebase عند غياب المطالبة أو تأخر تحديثها، ولا ينشئ الجلسة إلا إذا أكد Firebase أن البريد موثق.

## 3.9.4 — إصلاحات تسجيل الدخول | Sign-in fixes

### أُصلح

- استعادة تسجيل Google عبر واجهة تسجيل الدخول التقليدية إذا فشل Credential Manager بخطأ إعادة التحقق `[16]` فقط.
- انتظار تحديث مطالبة `email_verified` في رمز Firebase بعد إعادة تحميل حالة المستخدم، مع إبقاء تحقق الخادم إلزاميًا.
- حفظ القيم الفارغة لحقول الملف الشخصي الاختيارية عند مسح الاهتمامات أو اللغات أو الصورة أو البلد.

## 3.9.3 — تحسينات سابقة | Previous improvements

### أُضيف

- شارة توثيق مميزة لحسابات المالك والإشراف.
- مصدر أيقونة خاص بالتطبيق وتوليد الأيقونات تلقائيًا لبناء Android.
- تكامل AdMob للإعلانات الشريطية والبينية، مع طلب موافقة المستخدم على الإعلانات.

### الأمان والتهيئة

- إيقاف مكافآت الإعلانات ونقاطها حتى إضافة تحقق آمن من AdMob على الخادم.
- الإعلانات متوقفة افتراضيًا إلى أن تُضاف معرّفات AdMob الإنتاجية وتكتمل مراجعة التطبيق.
- فصل بناء الاختبار عن مسار إصدار Android الموقّع.
