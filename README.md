<div align="center">
  <img src="resources/logo.png" width="120" height="120" alt="شعار فضفضة" />
  <h1>فضفضة | Fadfada</h1>
  <p>منصة عربية للتعبير والتواصل واكتشاف أشخاص جدد.</p>
  <p>
    <a href="https://github.com/jwjj3463-dotcom/Venting/releases">التنزيلات والإصدارات</a>
    ·
    <a href="https://github.com/jwjj3463-dotcom/Venting/actions">حالة البناء</a>
  </p>
</div>

## عن المشروع

فضفضة تطبيق Android مبني باستخدام React وVite وCapacitor، ويتصل بخدمة خلفية مستقلة عبر HTTPS وWebSocket. هذا المستودع هو المصدر الرسمي لتطبيق `com.fadfadahnative`.

يهدف هذا المستودع إلى توضيح الإصدارات وطريقة تثبيتها، مع إبقاء ملفات التوقيع ومفاتيح الخدمات خارج الشيفرة العامة.

## تنزيل التطبيق

نزّل **APK** من صفحة [GitHub Releases](https://github.com/jwjj3463-dotcom/Venting/releases). ملف APK مخصص للتثبيت المباشر على أجهزة Android. يتضمن كل إصدار منشور ملاحظات التحديث وملفات التحقق من السلامة.

لتثبيت APK يدويًا، قد يطلب Android السماح بالتثبيت من مصدر التنزيل. ثبّت تحديثات التطبيق من الجهة نفسها، ولا تحذف التطبيق قبل التحديث إذا أردت الاحتفاظ ببياناته المحلية.

ملفات **Debug APK** التي تُنتجها عمليات CI مخصصة للاختبار فقط؛ لا تُعد إصدارات رسمية، وقد لا تقبل التثبيت فوق إصدار موقّع بمفتاح مختلف. استخدم صفحة Releases للنسخ الرسمية.

## الإصدارات والتوقيع

- تُشغّل تغييرات فرع `main` فحوص البناء وتنتج Debug APK مؤقتًا في GitHub Actions.
- يُنشأ إصدار عام تلقائيًا عند دفع وسم مثل `v3.9.1`.
- يرفق الإصدار APK موقّعًا للتثبيت المباشر، وAAB مخصصًا للتوزيع عبر Google Play، وملف SHA-256 للتحقق من التنزيل.
- نشر الإصدار يتطلب مفتاح رفع Android ثابتًا محفوظًا في **GitHub Actions Secrets**. لا ترفع ملف المفتاح أو كلمات مروره إلى هذا المستودع.
- نشر التطبيق في GitHub Releases لا يتطلب موافقة Google Play؛ مراجعة AdMob منفصلة عن نشر ملفات التطبيق على GitHub.

لإنشاء إصدار بعد إعداد أسرار التوقيع، يُحدّث المالك رقم الإصدار وسجل التغييرات، ثم ينشئ الوسم ويدفعه:

```sh
git tag -a v3.9.1 -m "Fadfada 3.9.1"
git push origin v3.9.1
```

تنشئ GitHub Actions الإصدار وتنشر ملفات Android تلقائيًا. لا تُنشئ وسمًا قبل إعداد أسرار التوقيع الأربعة: `ANDROID_KEYSTORE_BASE64` و`ANDROID_KEYSTORE_PASSWORD` و`ANDROID_KEY_ALIAS` و`ANDROID_KEY_PASSWORD`.

راجع [دليل تجهيز التوقيع والإصدارات](docs/RELEASING.md) لإعداد المفتاح وإصدار نسخة جديدة بأمان.

## الميزات

- حسابات ومحادثات ومطابقة مباشرة عبر خدمة فضفضة.
- جدار عام للمنشورات والتفاعل.
- شارات تميّز حسابات المالك والإشراف.
- بنية إعلانات AdMob للإعلانات الشريطية والبينية.

الإعلانات معطّلة افتراضيًا حتى إضافة معرّفات AdMob الإنتاجية وإكمال مراجعة التطبيق. مكافآت النقاط مقابل الإعلانات متوقفة إلى أن يُنفذ تحقق خادمي آمن. لا تُعد هذه المستودعات إعلانًا عن موافقة AdMob أو Google Play.

تستخدم واجهات التطبيق أصول أيقونات 3Dicons.co بصيغة WebP وبدقة 400×400، وتُحفظ محليًا في `public/assets/3d-icons` لتعمل دون اتصال. الأصول مرخصة بموجب CC0.

## التطوير المحلي

### المتطلبات

- Node.js 22
- Android Studio وAndroid SDK عند بناء التطبيق محليًا

### الإعداد

```sh
npm ci --legacy-peer-deps
cp .env.example .env.local
npm run dev
```

املأ `VITE_API_SERVER_URL` بعنوان خادم تطوير تملكه أو لديك إذن باستخدامه. لا تضع مفاتيح خاصة أو رموز تهيئة المالك في ملفات عامة.

### الفحوص والبناء

```sh
npm run lint
npm run build
```

لإنشاء Android محليًا، جهّز بناء الويب أولًا، ثم استخدم أوامر Capacitor وAndroid Studio. ملف Debug الناتج للاختبار فقط.

## الإعدادات الحساسة

- `VITE_API_SERVER_URL`: عنوان API الذي يُضمّن وقت بناء واجهة التطبيق.
- `ADMOB_APP_ID`: متغير GitHub Actions لإعداد تطبيق AdMob في Android Manifest.
- بيانات التوقيع: أسرار GitHub المذكورة في قسم الإصدارات؛ لا تُحفظ في المستودع.
- مفاتيح الإدارة وتهيئة المالك: إعدادات خادم خاصة، وليست إعدادات عميل.

## الأمان والإبلاغ عن مشكلة

لا تفتح بلاغًا عامًا يتضمن كلمات مرور أو مفاتيح توقيع أو رموز جلسات أو بيانات مستخدمين. أزل المعلومات الحساسة وأبلغ المالك عبر قناة خاصة قبل مشاركة أي تفاصيل أمنية.

## اللغات | Languages

**English:** Fadfada is an Arabic-first Android application built with React, Vite, and Capacitor. Official installable APKs and release notes are published on the [GitHub Releases page](https://github.com/jwjj3463-dotcom/Venting/releases). Main-branch CI APKs are for testing only. Official tagged releases require the owner's private Android signing key, stored only in GitHub Actions Secrets.
