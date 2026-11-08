# Fadfada (فضفضة) Privacy Policy

**Last updated: November 3, 2026**

This policy describes how the Fadfada Android app (`com.fadfadahnative`) handles information. “Fadfada” in this document means the app and service, not a separately verified registered company.

## Information the service handles

- **Sign-in:** Sign-in and email verification are provided by Firebase Authentication. Firebase processes the credentials and account information needed for the sign-in method you choose, including your email address and, when you use Google sign-in, information provided by Google. Fadfada's app server does not ask for or store your password.
- **App profile:** The app may process your nickname, profile image, country, languages, interests, bio, personal-link name, app-generated account identifier, and settings. The app server stores an authentication token hash rather than the raw app token.
- **Messages and community content:** The service stores chat messages and media, public posts (“vents”), likes, and related timestamps so it can provide chats, community features, synchronization, and moderation.
- **Calls:** Audio and video calls use WebRTC. The service processes call signaling and stores call metadata (the participating account IDs, call type, and start/end times or duration); it does not store call audio or video. Calls may use a configured TURN relay, which processes network connection information to relay encrypted media. Call metadata is retained for up to 90 days.
- **Safety and moderation:** If you block or report an account, the service processes the associated account identifiers and the report details or evidence you submit. Authorized moderators may review reports and related content to investigate them and take moderation action.
- **Ban appeals:** If your account is permanently banned, the service stores the appeal message you submit and the platform owner's review decision and note so the appeal can be processed and audited. An appeal is available once per account; deleting the account also deletes its appeal record.
- **Points and transaction records:** The service can store point balances and in-app spending or transaction records. The current server release does not process real-money checkout: its checkout endpoint is not configured. The app source reviewed for this policy does not implement paid bouquet or gift purchases.
- **Device and connection information:** App data is stored locally on your device and synchronized with the Fadfada server. The server and network providers necessarily process connection information such as IP address and request timing to deliver the service. The app uses your profile country; the reviewed app code does not request precise GPS location.

## How information is used

Information is used to authenticate accounts, create and maintain profiles and personal links, deliver and synchronize chats and posts, operate matching and points features, prevent abuse, process reports, enforce account restrictions, and maintain service security.

## Service providers

- **Google Firebase Authentication** handles sign-in and email verification. Google processes that information under its own terms and privacy disclosures.
- **Google Gemini** may receive public community content, profile or room descriptions, and submitted report evidence for automated safety moderation or report summarization if the service operator has configured a Gemini API key on the server. One-to-one private chat content is not automatically scanned; authorized staff may review relevant content when it is reported or when necessary to address safety or service abuse. Without Gemini configuration, automated moderation uses the server's built-in checks instead.
- **OpenRouter** receives messages and recent conversation context from AI-character chats when that feature is configured, to generate responses using its free-model router. OpenRouter and the selected model provider process that content under their applicable terms and privacy policies. Do not send sensitive information to AI characters.
- **Google AdMob** is integrated in the app. Whether ads are active depends on the release and server configuration. If enabled, Google may process device and ad-interaction information under Google's applicable policies; the app requests consent information before requesting ads.
- **GitHub** serves app release information and update downloads. When the app checks for or downloads an update, GitHub may receive ordinary connection information.

The current release does not have a configured real-money checkout provider. If payment processing is enabled in a future release, this policy will be updated to identify the relevant provider and information handled before that processing begins.

## Storage, retention, and deletion

Some app information is stored in the app's local database on your device; synchronized account and service data is stored on the Fadfada server. The service does not currently publish a fixed automatic retention period.

The in-app account-deletion control requests deletion of the app account, personal link, chats, and public posts from the Fadfada server and clears app data on that device. Report, moderation, and transaction records may be retained after account deletion for safety, security, dispute handling, or legal obligations. Firebase Authentication credentials are managed separately by Google and are not deleted by the app's server-side account-deletion request. To request deletion of the sign-in account as well, contact us from the account email address; do not send your password.

## Security and international processing

The app communicates with its configured server over HTTPS and secure WebSockets. Reasonable technical and organizational measures are used to protect service data, but no internet transmission or storage method can be guaranteed completely secure. The app and its providers may process information in countries other than the country where you live.

## Your choices and privacy requests

You can edit profile information in the app, use its account-deletion control, and contact us with questions or requests concerning your information at **joogamil63@gmail.com**. We may need to verify your request before acting on it. Do not include passwords, authentication tokens, or sensitive account secrets in an email.

## Changes and contact

We may update this policy when the service or its data practices change. The latest version will be published at this URL. For privacy questions, contact **joogamil63@gmail.com**.

---

# سياسة خصوصية فضفضة (Fadfada)

**آخر تحديث: 3 نوفمبر 2026**

توضح هذه السياسة كيفية تعامل تطبيق فضفضة لنظام Android (`com.fadfadahnative`) مع المعلومات. ويقصد باسم «فضفضة» هنا التطبيق والخدمة، وليس شركة مسجلة تم التحقق من وجودها.

## المعلومات التي تتعامل معها الخدمة

- **تسجيل الدخول:** تتم المصادقة والتحقق من البريد عبر Firebase Authentication. وتعالج Firebase بيانات الاعتماد ومعلومات الحساب اللازمة لطريقة الدخول المختارة، بما في ذلك البريد الإلكتروني، ومعلومات Google عند استخدام تسجيل الدخول بحساب Google. لا يطلب خادم فضفضة كلمة مرورك ولا يخزنها.
- **الملف الشخصي:** قد يعالج التطبيق اسمك الظاهر وصورة الملف الشخصي والدولة واللغات والاهتمامات والنبذة واسم الرابط الشخصي ومعرّف الحساب الذي ينشئه التطبيق والإعدادات. ويخزن خادم التطبيق بصمة رمز المصادقة بدلًا من الرمز الخام.
- **المحادثات ومحتوى المجتمع:** تخزن الخدمة رسائل المحادثة والوسائط والمنشورات العامة («الفضفضة») والإعجابات والطوابع الزمنية اللازمة لتقديم المحادثات وميزات المجتمع والمزامنة والإشراف.
- **المكالمات:** تستخدم المكالمات الصوتية والمرئية WebRTC. تعالج الخدمة إشارات الاتصال وتحفظ بيانات وصفية للمكالمة (معرّفات الحسابات المشاركة ونوع المكالمة ووقت بدئها وانتهائها أو مدتها)، ولا تحفظ الصوت أو الفيديو. قد تمر الوسائط المشفرة عبر خادم TURN مهيأ، والذي يعالج معلومات اتصال الشبكة لتمريرها. تُحتفظ ببيانات المكالمات الوصفية لمدة تصل إلى 90 يومًا.
- **السلامة والإشراف:** عند حظر حساب أو الإبلاغ عنه، تعالج الخدمة معرّفات الحسابات وتفاصيل البلاغ أو الأدلة التي ترسلها. ويمكن للمشرفين المخولين مراجعة البلاغات والمحتوى المرتبط بها والتحقيق فيها واتخاذ إجراءات الإشراف.
- **استئناف الحظر:** إذا حُظر حسابك نهائيًا، تحفظ الخدمة نص طلب الاستئناف الذي ترسله وقرار المراجعة وملاحظته لكي يراجعه مالك المنصة ويوثّق القرار. يتاح طلب واحد لكل حساب، ويحذف سجل الاستئناف عند حذف الحساب.
- **النقاط وسجلات المعاملات:** يمكن للخدمة تخزين رصيد النقاط وسجلات الإنفاق أو المعاملات داخل التطبيق. إصدار الخادم الحالي لا يعالج الدفع المالي الحقيقي لأن نقطة الدفع غير مهيأة. كما أن الشيفرة التي تمت مراجعتها لا تنفذ شراء البوكيهات أو الهدايا المدفوعة.
- **الجهاز والاتصال:** تُخزن بعض بيانات التطبيق محليًا على جهازك وتتم مزامنتها مع خادم فضفضة. ويعالج الخادم ومزودو الشبكة معلومات الاتصال اللازمة لتقديم الخدمة، مثل عنوان IP ووقت الطلب. يستخدم التطبيق الدولة التي تختارها في ملفك الشخصي؛ ولا يطلب كود التطبيق الذي تمت مراجعته موقع GPS دقيقًا.

## كيفية استخدام المعلومات

تُستخدم المعلومات لمصادقة الحسابات وإنشاء الملفات الشخصية والروابط الشخصية، وتقديم المحادثات والمنشورات ومزامنتها، وتشغيل المطابقة وميزات النقاط، ومنع إساءة الاستخدام ومعالجة البلاغات وتطبيق القيود على الحسابات والحفاظ على أمن الخدمة.

## مزودو الخدمات

- **Google Firebase Authentication** لتسجيل الدخول والتحقق من البريد. وتعالج Google هذه المعلومات وفق شروطها وإفصاحاتها المتعلقة بالخصوصية.
- **Google Gemini** قد يتلقى النصوص المرسلة، والصور عند الاقتضاء، للمساعدة في الإشراف الآلي على السلامة إذا تم إعداد مفتاح Gemini API على الخادم. وفي غياب هذا الإعداد، يستخدم الخادم فحوصه المدمجة.
- **OpenRouter** يتلقى رسائل وسياقًا حديثًا من محادثة الشخصيات الذكية عند تهيئة الميزة، لتوليد الردود عبر موجّه النماذج المجاني. وتعالج OpenRouter ومزود النموذج المختار هذا المحتوى وفق الشروط وسياسات الخصوصية الخاصة بهما. لا ترسل معلومات حساسة إلى الشخصيات الذكية.
- **Google AdMob** مدمج في التطبيق، لكن ظهور الإعلانات يعتمد على إعدادات الإصدار والخادم. وعند تفعيلها قد تعالج Google معلومات الجهاز والتفاعل مع الإعلانات وفق سياساتها السارية؛ ويطلب التطبيق معلومات الموافقة قبل طلب الإعلانات.
- **GitHub** يستضيف معلومات الإصدارات والتنزيلات. وعند تحقق التطبيق من تحديث أو تنزيله، قد يستقبل GitHub معلومات الاتصال المعتادة.

لا يوجد في الإصدار الحالي مزود دفع مالي حقيقي مهيأ. إذا فُعّل الدفع في إصدار لاحق، فسيتم تحديث هذه السياسة لتحديد المزود والمعلومات التي يعالجها قبل بدء ذلك.

## التخزين والاحتفاظ والحذف

تُخزن بعض معلومات التطبيق في قاعدة بيانات محلية على جهازك، وتُخزن بيانات الحساب والخدمة المتزامنة على خادم فضفضة. ولا تنشر الخدمة حاليًا مدة ثابتة للحذف التلقائي.

يطلب خيار حذف الحساب داخل التطبيق حذف حساب التطبيق والرابط الشخصي والمحادثات والمنشورات العامة من خادم فضفضة، كما يمسح بيانات التطبيق من ذلك الجهاز. وقد تُحتفظ بسجلات البلاغات والإشراف والمعاملات بعد حذف الحساب لأغراض السلامة والأمن وتسوية النزاعات أو الالتزامات القانونية. وتُدار بيانات المصادقة في Firebase بصورة منفصلة بواسطة Google، ولا يؤدي طلب الحذف من خادم التطبيق إلى حذفها. لطلب حذف حساب تسجيل الدخول أيضًا، تواصل معنا من البريد المرتبط بالحساب، ولا ترسل كلمة مرورك.

## الأمان والمعالجة الدولية

يتصل التطبيق بالخادم المهيأ له عبر HTTPS وWebSocket آمن. تُستخدم تدابير تقنية وتنظيمية معقولة لحماية بيانات الخدمة، لكن لا يمكن ضمان أمان كامل لأي إرسال أو تخزين عبر الإنترنت. وقد يعالج التطبيق ومزودوه المعلومات في دول غير الدولة التي تقيم فيها.

## خياراتك وطلبات الخصوصية

يمكنك تعديل معلومات الملف الشخصي في التطبيق واستخدام خيار حذف الحساب، أو مراسلتنا بخصوص معلوماتك على **joogamil63@gmail.com**. قد نحتاج إلى التحقق من طلبك قبل تنفيذه. لا تضع كلمات المرور أو رموز المصادقة أو أسرار الحساب في البريد الإلكتروني.

## التغييرات والتواصل

قد نحدّث هذه السياسة عند تغيير الخدمة أو ممارسات البيانات، وستُنشر النسخة الأحدث على هذا الرابط. للاستفسارات المتعلقة بالخصوصية، راسل **joogamil63@gmail.com**.
