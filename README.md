<div align="center">
  <img src="resources/logo.png" width="112" height="112" alt="شعار فضفضة Fadfada" />

  <h1>فضفضة | Fadfada</h1>

  <p><strong>مساحة عربية للتعبير، والتواصل، واكتشاف أشخاص جدد.</strong></p>
  <p>An Arabic-first social app for sharing thoughts, chatting, and meeting people.</p>

  <p>
    <a href="https://github.com/jwjj3463-dotcom/Venting/releases/latest"><img src="https://img.shields.io/github/v/release/jwjj3463-dotcom/Venting?label=latest%20release" alt="Latest release" /></a>
    <a href="https://github.com/jwjj3463-dotcom/Venting/actions/workflows/main.yml"><img src="https://img.shields.io/github/actions/workflow/status/jwjj3463-dotcom/Venting/main.yml?branch=main&label=build" alt="Main branch build status" /></a>
    <a href="https://github.com/jwjj3463-dotcom/Venting/releases"><img src="https://img.shields.io/badge/platform-Android-3DDC84?logo=android&logoColor=white" alt="Android app" /></a>
  </p>

  <p>
    <a href="https://jwjj3463-dotcom.github.io/Venting/">الموقع الرسمي</a>
    ·
    <a href="https://github.com/jwjj3463-dotcom/Venting/releases/latest">تنزيل أحدث إصدار Android</a>
    ·
    <a href="https://github.com/jwjj3463-dotcom/Venting/releases">كل الإصدارات</a>
    ·
    <a href="https://github.com/jwjj3463-dotcom/Venting/actions">حالة البناء</a>
  </p>
</div>

## نبذة

فضفضة تطبيق اجتماعي عربي لأجهزة Android، يتيح للمستخدمين التعبير عن أفكارهم والتواصل واكتشاف أشخاص جدد. يجمع المشروع بين تطبيق مبني بـ **React وTypeScript وVite وCapacitor** وخدمة خلفية منفصلة للاتصال الفوري عبر HTTPS وWebSocket.

هذا المستودع هو المصدر الرسمي لتطبيق Android ذي معرّف الحزمة `com.fadfadahnative`. يُنشر التطبيق وملاحظات إصداراته الرسمية في GitHub Releases.

**Fadfada** is an Arabic-first Android social app for sharing thoughts, connecting with people, and discovering new conversations. The mobile app is built with React, TypeScript, Vite, and Capacitor, and connects to a separate backend over HTTPS and WebSocket.

## أبرز الميزات

- **التواصل والمحادثات:** إنشاء حساب والتواصل عبر المحادثات.
- **رادار المطابقة الحية:** اكتشاف أشخاص جدد وفق إمكانات المطابقة المتاحة في التطبيق.
- **المجتمع:** مشاركة المنشورات والتفاعل معها في الجدار العام.
- **شخصيات ذكية معلنة:** محادثات مع شخصيات ذكاء اصطناعي موضّح أنها افتراضية، مع معلومات عن معالجة المحادثة في [سياسة الخصوصية](privacy-policy.md).
- **Android:** تثبيت APK رسمي موقّع، مع تحديثات منشورة وملاحظات إصدار.

## تنزيل التطبيق وتثبيته

نزّل أحدث **APK رسمي موقّع** من [صفحة الإصدارات](https://github.com/jwjj3463-dotcom/Venting/releases/latest)، ثم افتحه على جهاز Android واتبع تعليمات النظام. قد يطلب Android السماح بالتثبيت من مصدر التنزيل.

تحديث التطبيق من صفحة الإصدارات يحافظ على بياناته المحلية عادةً؛ لا تحذف التطبيق قبل التحديث. أما ملفات **Debug APK** الناتجة عن البناء المستمر فهي للاختبار، وليست بديلًا عن الإصدار الرسمي وقد لا تُثبّت فوق نسخة موقّعة بمفتاح مختلف.

| الملف | الاستخدام |
|---|---|
| `app-release.apk` | تثبيت التطبيق أو تحديثه مباشرةً على جهاز Android |
| `app-release.aab` | حزمة Android مخصصة للتوزيع عبر Google Play |
| `android-release-checksums.txt` | قيم SHA-256 للتحقق من ملفات الإصدار |

## الخصوصية والسلامة

- راجع [سياسة الخصوصية](privacy-policy.md) و[شروط الاستخدام](terms-of-service.md).
- الشخصيات الذكية هي شخصيات افتراضية وليست أشخاصًا حقيقيين؛ اطّلع على الإفصاح داخل التطبيق قبل استخدامها.
- لا تنشر كلمات مرور أو مفاتيح أو رموز جلسات أو بيانات شخصية في Issues أو Pull Requests.
- الإعلانات ومكافآت الإعلانات تخضع لتهيئة ومراجعات منفصلة؛ لا يعني وجود تكامل برمجي أن الخدمة معتمدة أو مفعّلة.

## التقنية

| الجزء | التقنية |
|---|---|
| تطبيق Android | React، TypeScript، Vite، Capacitor |
| الواجهة | CSS وTailwind CSS |
| الخدمات الخلفية | Express، REST API، WebSocket |
| البناء والإصدارات | GitHub Actions، Android Gradle، APK وAAB موقّعان |

تتصل نسخة الإنتاج بخدمة API منفصلة. لا يتضمن هذا المستودع بيانات اعتماد الخدمة الخاصة أو مفتاح توقيع التطبيق.

## التطوير محليًا

### المتطلبات

- Node.js 22
- Android Studio وAndroid SDK لبناء نسخة Android محلية

### الإعداد

```sh
npm ci --legacy-peer-deps
cp .env.example .env.local
```

اضبط `VITE_API_SERVER_URL` على خادم تطوير تملكه أو لديك إذن باستخدامه، ثم شغّل:

```sh
npm run lint
npm run build
```

تتطلب مزايا التطبيق المتصلة بالخادم خدمة Fadfada خلفية قابلة للوصول. راجع [دليل الإصدارات](docs/RELEASING.md) لإعداد بناء Android وإصداراته.

## الإصدارات الرسمية

تُشغّل تغييرات فرع `main` فحوص CI وتنتج Debug APK للاختبار. يبدأ بناء الإصدار الرسمي عند دفع وسم إصدار بصيغة `vMAJOR.MINOR.PATCH`، مثل:

```sh
git tag -a vX.Y.Z -m "Fadfada X.Y.Z"
git push origin vX.Y.Z
```

يتطلب نشر APK وAAB الموقّعين أسرار توقيع Android الثابتة في GitHub Actions. لا ترفع ملف المفتاح أو كلمات مروره إلى المستودع. راجع [دليل تجهيز التوقيع والإصدارات](docs/RELEASING.md) قبل إنشاء إصدار.

## الإبلاغ عن مشكلة

استخدم [صفحة Issues](https://github.com/jwjj3463-dotcom/Venting/issues) للإبلاغ عن مشكلة عامة أو اقتراح تحسين. اذكر إصدار التطبيق، وطراز الجهاز، وإصدار Android، وخطوات إعادة المشكلة؛ ولا تُرفق معلومات دخول أو بيانات مستخدمين أو أسرارًا.

للمسائل الأمنية، لا تنشر تفاصيل قابلة للاستغلال أو بيانات حساسة في بلاغ عام؛ تواصل مع مالك المشروع عبر قناة خاصة.

## Links

- **Official website:** [jwjj3463-dotcom.github.io/Venting](https://jwjj3463-dotcom.github.io/Venting/)
- **Latest Android release:** [Download from GitHub Releases](https://github.com/jwjj3463-dotcom/Venting/releases/latest)
- **Privacy policy:** [Arabic and English policy](privacy-policy.md)
- **Terms of service:** [Arabic and English terms](terms-of-service.md)
