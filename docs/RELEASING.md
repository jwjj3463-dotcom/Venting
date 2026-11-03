# دليل الإصدارات | Release guide

يستطيع مالك التطبيق نشر APK على GitHub دون انتظار موافقة Google Play. مراجعة AdMob إجراء منفصل، وقد تؤثر في عرض الإعلانات لا في رفع APK إلى صفحة GitHub Releases.

## قبل أول إصدار

### 1. أنشئ مفتاح توقيع ثابتًا

أنشئ مفتاحًا خاصًا على جهاز موثوق، وليس داخل GitHub Actions أو داخل المستودع:

```sh
keytool -genkeypair -v \
  -keystore fadfadah-upload-key.jks \
  -alias fadfadah-upload \
  -keyalg RSA -keysize 2048 -validity 10000
```

احتفظ بملف `.jks` وكلمات المرور في مكان خاص وآمن، وأنشئ نسخة احتياطية مشفرة. المفتاح نفسه مطلوب لكل تحديث؛ فقدان المفتاح أو تغييره قد يمنع Android من تثبيت التحديث فوق النسخة السابقة. لا ترسله في المحادثات ولا ترفعه إلى GitHub.

### 2. خزّن بيانات المفتاح كأسرار GitHub

حوّل ملف المفتاح إلى نص Base64 محليًا. على Linux:

```sh
base64 -w 0 fadfadah-upload-key.jks
```

على macOS:

```sh
base64 fadfadah-upload-key.jks | tr -d '\n'
```

في المستودع افتح **Settings → Secrets and variables → Actions → New repository secret**، وأضف القيم التالية:

| اسم السر | القيمة |
|---|---|
| `ANDROID_KEYSTORE_BASE64` | ناتج Base64 الكامل لملف `.jks` |
| `ANDROID_KEYSTORE_PASSWORD` | كلمة مرور ملف المفتاح |
| `ANDROID_KEY_ALIAS` | الاسم الذي اخترته لـ `-alias` |
| `ANDROID_KEY_PASSWORD` | كلمة مرور المفتاح |

لا تضع هذه القيم في `package.json` أو ملفات workflow أو Issues أو Pull Requests.

### 3. جهّز AdMob عند الرغبة في تشغيل الإعلانات

أضف `ADMOB_APP_ID` إلى **Settings → Secrets and variables → Actions → Variables** بعد صدوره من AdMob. الإعلانات على الخادم متوقفة حاليًا؛ لا تفعّلها ولا تستخدم معرّفات الاختبار للإنتاج قبل إكمال مراجعة AdMob وإعداد وحدات الإعلان وسياسة الخصوصية. مكافآت النقاط تظل متوقفة حتى وجود تحقق خادمي آمن.

## إعدادات الذكاء الاصطناعي والإشعارات

- تُحفظ قيمة `GEMINI_API_KEY` في بيئة خدمة الخادم فقط لتفعيل ردود الشخصيات الذكية. لا تُضمّن في التطبيق أو المستودع.
- إعداد FCM للإنتاج مكتمل في مشروع `fadfada-3c5e8`: واجهة FCM API v1 مفعّلة، واعتماد إرسال مستقل محدود بالمشروع بدور **Firebase Cloud Messaging API Admin** مربوط بخدمة API عبر `GOOGLE_APPLICATION_CREDENTIALS`.
- يبقى ملف الاعتماد خارج المستودع والتطبيق، بصلاحيات ملف مقيدة، ولا يُرفع إلى GitHub. بعد أي تدوير للاعتماد، أعد تشغيل خدمة API بالطريقة المعتادة وتحقق أن `/api/health` يعيد `pushNotificationsEnabled: true`. إذا كانت القيمة `false` فلن تُرسل إشعارات الدفع؛ تبقى الأحداث داخل التطبيق متاحة أثناء الاتصال.

## AI and push notification prerequisites

- Keep `GEMINI_API_KEY` in the server service environment only to enable AI character replies. Never bundle it with the app or commit it.
- Production FCM is configured for project `fadfada-3c5e8`: FCM API v1 is enabled, and a dedicated sender credential with the project-scoped **Firebase Cloud Messaging API Admin** role is connected to the API service through `GOOGLE_APPLICATION_CREDENTIALS`.
- The credential file stays outside the repository and app with restricted file permissions; never upload it to GitHub. After rotating credentials, restart the API using its normal deployment procedure and verify `/api/health` reports `pushNotificationsEnabled: true`. If it is `false`, push delivery is disabled; in-app events remain available while connected.

## استرداد صلاحية المالك

إذا احتجت إلى استبدال حساب المالك، انشر تحديث الخادم الذي يتضمن `/api/admin/owner-recovery` أولًا. أنشئ سرًا عشوائيًا لا يقل عن 32 بايت (`openssl rand -hex 32`) وضعه في متغير بيئة الخادم `OWNER_RECOVERY_TOKEN` فقط؛ لا تضعه في التطبيق أو المستودع. أنشئ الحساب الجديد من التطبيق واحفظ رمز استرداده، ثم أدخل سر الخادم مرة واحدة في شاشة حفظ الرمز. عند نجاح العملية، يصبح الحساب الجديد مالكًا ويُحذف حساب المالك السابق وبياناته التابعة نهائيًا. لا تُنفّذ العملية ما لم يوجد مالك سابق واحد بالضبط، وتُحفظ النتيجة على القرص قبل تأكيد النجاح. بعد النجاح، أزل `OWNER_RECOVERY_TOKEN` من بيئة الخادم؛ رمز استرداد الحساب الجديد مستقل عن هذا السر.

## إصدار نسخة جديدة

1. حدّث رقم الإصدار في `package.json` وسجل التغييرات في `CHANGELOG.md`.
2. تُولّد ملفات Android Launcher وAdaptive Icons وPWA تلقائيًا من `resources/logo.png` في مساري البناء؛ لا تعدّل الصور المولّدة يدويًا.
3. افحص التغييرات وشغّل `npm ci --legacy-peer-deps` و`npm run lint` و`npm run build`.
4. ادمج النسخة في `main`.
5. أنشئ وسمًا مطابقًا لإصدار SemVer وادفعه:

   ```sh
   git tag -a v3.9.1 -m "Fadfada 3.9.1"
   git push origin v3.9.1
   ```

6. راقب **Actions → Publish Android Release**. عند النجاح، ينشئ GitHub Release تلقائيًا ويضيف:
   - `app-release.apk` للتثبيت المباشر على Android.
   - `app-release.aab` لحزمة رفع Google Play.
   - `android-release-checksums.txt` للتحقق من سلامة التنزيل.

وسم خاطئ أو غياب أحد أسرار التوقيع يفشل البناء بوضوح ولا ينشر إصدارًا غير موقّع.

## مفاتيح التوقيع وGoogle Play

يستخدم APK المباشر وAAB مفتاح الرفع المخزن في GitHub. إذا تقرر النشر مستقبلًا عبر Google Play، احسم استراتيجية **Play App Signing** قبل توزيع التحديثات؛ يجب أن تتوافق شهادة توقيع التطبيق مع طريقة التحديث التي ستستخدمها، وقد تختلف شهادة التطبيق التي يوزعها Play عن شهادة مفتاح الرفع. لا تغيّر مفتاح التوقيع بعد بدء توزيع نسخ عامة دون خطة انتقال واختبار.
