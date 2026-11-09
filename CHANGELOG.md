# سجل التغييرات | Changelog

تُوثّق هنا التغييرات التي تصل إلى المستخدمين. يُنشأ إصدار GitHub رسمي تلقائيًا عند دفع وسم إصدار بصيغة `vMAJOR.MINOR.PATCH` بعد إعداد مفتاح التوقيع.

User-facing changes are recorded here. A GitHub Release is published automatically for a `vMAJOR.MINOR.PATCH` tag once release signing is configured.

## 3.14.0 — استضافة الخادم السحابية واستعادة الهوية الأصلية | Cloud Hosting & Original Branding

### أُضيف
- ربط التطبيق تلقائياً بالخادم السحابي الجديد على Railway بدلاً من الخادم المؤقت.
- استعادة شعار وهوية تطبيق فضفضة الرسمية الأصلية في شاشة الدخول والتسجيل.
- تحديث بيئة تشغيل الخادم لدعم Docker وتثبيت الاعتماديات الأساسية تلقائياً.

### Added
- Native integration with the new production Railway server URL.
- Restored official Fadfadah app branding and original logo.
- Enhanced Docker container infrastructure and dependency reliability.

## 3.13.0 — منظومة الألعاب والغرف والمكالمات ومستويات الثقة | Games, Rooms, Calls, and Trust Levels

### أُضيف
- كتالوج الألعاب الـ 22 كاملاً مع ساحة ألعاب تفاعلية ومحرك ذكاء اصطناعي تكتيكي للعب الفوري أو تحدي الأصدقاء.
- دليل الغرف الجماعية العامة والخاصة بكلمات مرور ورموز دعوة، مع دعم الإشارة بالاسم `@mention`.
- مكالمات صوتية ومرئية مباشرة عبر WebRTC P2P مع إشارات الخادم وأذونات أندرويد.
- التحقق من البوتات عبر كابتشا Cloudflare Turnstile لحماية التسجيل المجهول.
- شاشة مخصصة لتقديم التماس فك الحظر للحسابات المحظورة.
- معمارية مستويات الثقة (عضو موثوق مقابل حساب جديد) لتقييد الروابط والوسائط للحسابات غير الموثقة.
- دعم إرسال مقاطع الفيديو القصيرة بصيغ MP4 و WebM حتى 3 ميجابايت.

### Added
- Complete 22 casual games catalog with interactive arena and tactical AI engine for instant play or peer challenges.
- Group rooms directory for public and password-protected private rooms with invite codes and @mentions.
- Direct peer-to-peer WebRTC audio and video calling with signaling and Android permissions.
- Cloudflare Turnstile bot verification on anonymous registration.
- Dedicated ban appeal submission screen for banned accounts.
- Trust Level Architecture (Trusted Member vs New Member) restricting links and media for untrusted accounts.
- Short video messaging support for MP4 and WebM files up to 3MB.

## 3.12.1 — توضيح حالة عضوية VIP | VIP membership visibility

### أُصلح

- إظهار عضوية VIP النشطة وخطتها وتاريخ انتهائها في قائمة المستخدمين، بما في ذلك حسابات المالك والمشرف.
- إظهار شارة VIP إلى جانب صفة المالك أو المشرف في الملف الشخصي عند وجود اشتراك نشط.

### Fixed

- Show active VIP membership, plan, and expiration in the user list, including owner and moderator accounts.
- Show the VIP badge alongside owner or moderator status when their subscription is active.

## 3.12.0 — AdMob فقط وإزالة Monetag | AdMob-only ads

### أُصلح

- إزالة إعلانات Monetag والروابط الدعائية من التطبيق.
- قصر إعلانات Android على وحدات Google AdMob الأصلية، مع عدم حقن أكواد شبكات خارجية داخل الصفحة.
- إزالة علامة التحقق التي أُضيفت خطأً إلى موقع الويب.

### Fixed

- Remove Monetag ads and sponsored links from the app.
- Restrict Android ads to native Google AdMob units and stop injecting third-party ad code into the page.
- Remove the verification tag mistakenly added to the website.

## 3.11.9 — تمييز المالك وإضافة العملات | Owner account and coin grants

### أُضيف

- تمييز مالك المنصة بوضوح في ملفه الشخصي، وضمان حد أدنى قدره مليون نقطة لحساب المالك.
- تمكين المالك من إضافة نقاط إلى حساب بالاسم المستعار الدقيق أو المعرّف الشخصي الفريد، مع تسجيل كل عملية في السجل المالي.

### Added

- Identify the platform owner distinctly and ensure owner accounts have at least one million points.
- Allow the owner to credit points to an account by exact nickname or unique profile slug, recording each grant in the financial ledger.

## 3.11.8 — استكمال تثبيت التحديث دون إعادة تنزيل | Resume update installation without redownloading

### أُصلح

- استكمال تثبيت ملف التحديث المكتمل بعد العودة إلى التطبيق، بدل تنزيله مرة أخرى.
- التحقق من رقم الإصدار وحجم ملف APK قبل إعادة فتح مُثبّت أندرويد.

### Fixed

- Resume installing a completed update after returning to the app instead of downloading it again.
- Verify the APK version and file size before reopening the Android installer.

## 3.11.7 — تحسين نافذة تحديث التطبيق | App update prompt copy improvements

### تحسينات

- توضيح الإصدار الحالي والجديد وحجم ملف التحديث بدقة.
- شرح تنزيل التحديث وظهور نافذة أندرويد الرسمية لإكمال التثبيت.
- عرض مزايا الإصدار ورسائل التحديث باللغة العربية بصياغة أوضح.

### Improved

- Show the current and new versions and the exact update file size.
- Explain the download and Android's official installation confirmation.
- Present release notes and update messages in clearer Arabic.

## 3.11.6 — إصلاح الدفع وتحسين الشخصيات الذكية | Payment and AI character fixes

### أُصلح

- إصلاح إرسال طلبات الشحن واشتراك VIP مع إثبات التحويل.
- إعادة محاولة إرسال رسالة الشخصية عند فشل الرد، وتحسين نبرة الشخصيات لتكون طبيعية وأقل رسمية.

### Fixed

- Fix submitting top-up and VIP requests with transfer proof.
- Make AI character replies more natural and less formal, and retry transient response failures.

## 3.11.5 — تحسين شاشة الدخول | Sign-in screen polish

### أُضيف

- تحديث شاشة الدخول والتسجيل بتصميم زجاجي واستخدام شعار التطبيق.
- إضافة إطار ضوئي متحرك هادئ إلى أزرار المتابعة الأساسية، مع احترام إعداد تقليل الحركة.

### Added

- Refresh the sign-in and registration screen with a glass-style layout and the app logo.
- Add a restrained animated accent border to primary authentication actions, respecting reduced-motion preferences.

## 3.11.4 — شاشة بدء فضفضة | Fadfada launch screen

### أُضيف

- تحديث أيقونة فضفضة مع الحفاظ على المقاسات المطلوبة لتطبيق Android والويب.
- عرض الصورة المختارة كشاشة بدء مستقلة قبل الدخول أو إنشاء الحساب.
- استخدام الصورة نفسها في شاشة بدء Android الأصلية، مع الإبقاء على صفحات المصادقة كما كانت.

### Added

- Refresh the Fadfada app icon while preserving the required Android and web asset sizes.
- Show the selected artwork on a dedicated startup screen before sign-in or account creation.
- Use the same image for the native Android launch screen while keeping authentication screens unchanged.

## 3.11.3 — تحديث أيقونة التطبيق | App icon refresh

### أُضيف

- تحديث أيقونة فضفضة مع الحفاظ على المقاسات المطلوبة لتطبيق Android والويب.
- عُرضت الصورة المختارة خلف صفحة الدخول والتسجيل في هذا الإصدار المؤقت؛ نُقلت إلى شاشة بدء مستقلة في 3.11.4.

### Added

- Refresh the Fadfada app icon while preserving the required Android and web asset sizes.
- The selected artwork appeared behind sign-in and registration in this interim version; 3.11.4 moves it to a dedicated launch screen.

## 3.11.2 — إصلاح تشخيص رادار المطابقة | Match radar feedback fix

### أُصلح

- إظهار سبب تعذر الانضمام إلى رادار المطابقة بدل استمرار حالة البحث بصمت، مع الحفاظ على شرط الحساب غير الضيف والعمر 18 عامًا أو أكثر.

### Fixed

- Show why an account cannot join the live match radar instead of leaving it silently searching; retain the non-guest and age-18+ eligibility safeguards.

## 3.11.1 — محادثات الشخصيات الذكية | AI character conversations

### أُضيف

- ربط ردود الشخصيات الذكية بموجّه OpenRouter المجاني، مع حفظ مفتاح الخدمة على الخادم فقط.
- توضيح أن الشخصيات افتراضية، وأن رسائلها وسياق المحادثة يُرسلان إلى OpenRouter لتوليد الردود.
- تحديث سياسة الخصوصية العربية والإنجليزية ومعلومات مزود الخدمة.

### Added

- Connect AI-character replies to OpenRouter's free-model router; the API key remains server-side.
- Disclose that characters are AI and that messages and conversation context are sent to OpenRouter to generate replies.
- Update the Arabic and English privacy policy and service-provider details.

## 3.11.0 — طلبات التعارف وSafe Chat | Introduction requests and Safe Chat

### أُضيف

- طلبات تعارف ببطاقات تعريفية، مع خيارات القبول والرفض والتجاهل والحظر والإبلاغ.
- اكتشاف أشخاص وفق الاهتمامات والبلد واللغة، ومحادثات مع شخصيات ذكية واضحة الهوية.
- وضع Safe Chat بموافقة الطرفين، ومؤقت حذف للرسائل، وتنبيه عند رصد لقطة شاشة على إصدارات Android المدعومة.
- تسجيل أجهزة Android لإشعارات طلبات التعارف وقبولها؛ يتطلب تسليم الإشعارات الخلفية تهيئة اعتماد FCM على الخادم.

### Added

- Introduction requests with profile cards and accept, reject, ignore, block, and report actions.
- Discover people by interests, country, and language, and chat with clearly labeled AI characters.
- Mutual-consent Safe Chat with expiring messages and screenshot alerts on supported Android versions.
- Android device registration for introduction-request and acceptance notifications; background delivery requires FCM server credentials.

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
