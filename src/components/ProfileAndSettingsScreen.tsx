import React, { useEffect, useRef, useState } from 'react';
import {
  Crown,
  Coins,
  Database,
  Smartphone,
  Trash2,
  Download,
  Check,
  ChevronLeft,
  ChevronRight,
  Eye,
  EyeOff,
  Lock,
  Sparkles,
  ImagePlus,
  Server,
  ShieldAlert,
  ShieldCheck,
  KeyRound,
  Receipt,
  X,
  AlertTriangle,
  Gift,
  Play,
} from 'lucide-react';
import {
  AVATAR_PRESETS,
  FramedAvatar,
  OfficialBadge,
  PROFILE_FRAMES,
} from './FramedAvatar';
import {
  FADFADAH_REALM_SCHEMAS,
  PremiumPlan,
  realmDB,
  RealmAppSettings,
  RealmPaymentTransaction,
  RealmPersonalLink,
  RealmUser,
} from '../db/realmLocalDB';
import { fadfadahClient } from '../services/fadfadahNetworkClient';
import { nativeCopyText } from '../services/androidNative';
import { AdminModerationDashboard } from './AdminModerationDashboard';
import { adService } from '../services/adService';
import {
  AppLang,
  AVAILABLE_COUNTRIES,
  AVAILABLE_INTERESTS,
  AVAILABLE_LANGUAGES,
  TRANSLATIONS,
} from '../i18n/translations';

interface ProfileAndSettingsScreenProps {
  selfUser: RealmUser;
  personalLink: RealmPersonalLink;
  settings: RealmAppSettings;
  onLinkAccount: () => void;
  onToggleTheme: () => void;
  onToggleLanguage: () => void;
  initialSubSection?: 'main' | 'monetization' | 'realm_android' | 'admin_portal';
}

export const ProfileAndSettingsScreen: React.FC<ProfileAndSettingsScreenProps> = ({
  selfUser,
  personalLink,
  settings,
  onLinkAccount,
  onToggleTheme,
  onToggleLanguage,
  initialSubSection = 'main',
}) => {
  const lang: AppLang = settings.language;
  const t = TRANSLATIONS[lang];

  const [subView, setSubView] = useState<'main' | 'monetization' | 'realm_android' | 'admin_portal'>(
    initialSubSection
  );
  const [nickname, setNickname] = useState(selfUser.nickname);
  const [slug, setSlug] = useState(personalLink.slug);
  const [country, setCountry] = useState(selfUser.country);
  const [bio, setBio] = useState(selfUser.bio);
  const [avatarUrl, setAvatarUrl] = useState(selfUser.avatar_url);
  const [frameId, setFrameId] = useState(selfUser.frame_id);
  const [interests, setInterests] = useState<string[]>(selfUser.interests);
  const [languages, setLanguages] = useState<string[]>(selfUser.languages);

  const [serverUrlInput, setServerUrlInput] = useState(settings.custom_server_url || '');
  const [connState, setConnState] = useState(() => fadfadahClient.getConnectionState());
  const [savingServerUrl, setSavingServerUrl] = useState(false);

  const [saveToast, setSaveToast] = useState('');
  const [savingProfile, setSavingProfile] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [copiedCmd, setCopiedCmd] = useState(false);

  // Staff Login Modal
  const [showStaffModal, setShowStaffModal] = useState(false);
  const [staffPasscode, setStaffPasscode] = useState('');
  const [staffError, setStaffError] = useState('');
  const [verifyingStaff, setVerifyingStaff] = useState(false);
  const [showPasscodeText, setShowPasscodeText] = useState(false);

  // Payment transactions
  const [transactions, setTransactions] = useState<RealmPaymentTransaction[]>(() =>
    realmDB.objects('payment_transactions').sort((a, b) => b.created_at - a.created_at)
  );

  const avatarUploadRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    const unsub = fadfadahClient.subscribe(() => {
      setConnState(fadfadahClient.getConnectionState());
      setTransactions(realmDB.objects('payment_transactions').sort((a, b) => b.created_at - a.created_at));
    });
    try {
      const params = new URLSearchParams(window.location.search);
      if (params.get('admin') === '1' || params.get('admin') === 'true' || window.location.hash === '#admin') {
        setShowStaffModal(true);
      }
    } catch {
      // Ignore
    }
    return unsub;
  }, []);

  const toggleInterest = (item: string) => {
    setInterests((prev) =>
      prev.includes(item)
        ? prev.length > 1
          ? prev.filter((x) => x !== item)
          : prev
        : [...prev, item]
    );
  };

  const toggleLanguageItem = (item: string) => {
    setLanguages((prev) =>
      prev.includes(item)
        ? prev.length > 1
          ? prev.filter((x) => x !== item)
          : prev
        : [...prev, item]
    );
  };

  const handleCustomAvatarUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 2 * 1024 * 1024) {
      setSaveToast(lang === 'ar' ? 'الصورة أكبر من 2 ميجابايت.' : 'Avatar exceeds 2MB.');
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      setAvatarUrl(String(reader.result));
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  };

  const handleSelectFrame = async (targetFrameId: number) => {
    const def = PROFILE_FRAMES.find((f) => f.id === targetFrameId);
    if (!def) return;

    const isUnlocked = selfUser.is_premium || selfUser.unlocked_frames.includes(targetFrameId);
    if (isUnlocked) {
      setFrameId(targetFrameId);
      return;
    }

    if (def.premiumOnly && !selfUser.is_premium) {
      setSubView('monetization');
      return;
    }

    if (selfUser.points >= def.costPoints) {
      const res = await fadfadahClient.spendPoints({
        action: 'UNLOCK_FRAME',
        frameId: targetFrameId,
      });
      if (res.ok) {
        setFrameId(targetFrameId);
        setSaveToast(
          lang === 'ar'
            ? `تم فتح ${def.nameAr} مقابل ${def.costPoints} نقطة وتوثيق العملية في السجل!`
            : `Unlocked ${def.nameEn}!`
        );
      }
    } else {
      setSubView('monetization');
    }
  };

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingProfile(true);
    try {
      const res = await fadfadahClient.updateProfile({
        nickname: nickname.trim() || selfUser.nickname,
        slug: slug.trim() || personalLink.slug,
        country,
        bio: bio.trim(),
        avatar_url: avatarUrl,
        frame_id: frameId,
        interests,
        languages,
      });

      if (!res.ok) {
        setSaveToast(res.error || (lang === 'ar' ? 'تعذر الحفظ.' : 'Save failed.'));
        return;
      }
      const updatedLink = realmDB.findPersonalLink();
      if (updatedLink) setSlug(updatedLink.slug);
      setSaveToast(t.savedSuccess);
      setTimeout(() => setSaveToast(''), 2600);
    } finally {
      setSavingProfile(false);
    }
  };

  // Real Server-Verified Checkout (Idempotent & Audited in Server Database)
  const handleCheckoutPlan = async (planKey: string) => {
    setSaveToast(lang === 'ar' ? 'جارٍ التحقق من عملية الدفع في السيرفر...' : 'Verifying payment on server...');
    const res = await fadfadahClient.checkoutPackage({
      type: 'SUBSCRIPTION',
      packageId: planKey,
    });
    if (!res.ok) {
      setSaveToast(res.error || 'فشلت عملية الدفع.');
      return;
    }
    setSaveToast(
      lang === 'ar'
        ? 'تم التحقق من الدفع وتفعيل الباقة بنجاح وتسجيلها في السجل المالي!'
        : 'Payment verified and subscription activated!'
    );
    setTimeout(() => setSaveToast(''), 3000);
  };

  const handleCheckoutPoints = async (packKey: string) => {
    setSaveToast(lang === 'ar' ? 'جارٍ التحقق من عملية الشحن في السيرفر...' : 'Verifying pack purchase...');
    const res = await fadfadahClient.checkoutPackage({
      type: 'POINTS_PACK',
      packageId: packKey,
    });
    if (!res.ok) {
      setSaveToast(res.error || 'فشلت عملية الشحن.');
      return;
    }
    setSaveToast(
      lang === 'ar'
        ? 'تمت إضافة النقاط وتوثيق المعاملة بنجاح في السيرفر!'
        : 'Points credited and verified!'
    );
    setTimeout(() => setSaveToast(''), 3000);
  };

  const handleSaveServerEndpoint = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingServerUrl(true);
    const connected = await fadfadahClient.updateCustomServerUrl(serverUrlInput);
    setSavingServerUrl(false);
    setSaveToast(
      connected
        ? lang === 'ar'
          ? 'تم الاتصال بالسيرفر بنجاح ومزامنة الحساب!'
          : 'Connected to server & synced!'
        : lang === 'ar'
        ? 'تعذر الوصول للسيرفر المحدد، يعمل التطبيق حالياً بوضع Realm المحلي.'
        : 'Server unreachable; running on Local Realm offline cache.'
    );
  };

  const handleExportRealm = () => {
    const json = realmDB.exportSnapshotJSON();
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `fadfadah_android_realm_${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handlePermanentDelete = async () => {
    await fadfadahClient.deleteAccountPermanently();
    setShowDeleteConfirm(false);
    const freshSelf = realmDB.findSelfUser();
    const freshLink = realmDB.findPersonalLink();
    if (freshSelf) {
      setNickname(freshSelf.nickname);
      setAvatarUrl(freshSelf.avatar_url);
      setFrameId(freshSelf.frame_id);
    }
    if (freshLink) setSlug(freshLink.slug);
    setSaveToast(
      lang === 'ar'
        ? 'تم حذف الحساب نهائياً من السيرفر ومن هاتفك وإنشاء هوية جديدة.'
        : 'Account deleted permanently from server and device.'
    );
  };

  const handleStaffLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setStaffError('');
    const clean = staffPasscode.trim();
    if (!clean) {
      setStaffError(lang === 'ar' ? 'يرجى كتابة رمز الإدارة.' : 'Please enter the admin passcode.');
      return;
    }

    setVerifyingStaff(true);
    const res = await fadfadahClient.verifyStaffPasscode(clean);
    setVerifyingStaff(false);

    if (!res.ok) {
      setStaffError(res.error || (lang === 'ar' ? 'رمز الصلاحيات غير صحيح.' : 'Invalid passcode.'));
      return;
    }

    setShowStaffModal(false);
    setStaffPasscode('');
    setSaveToast(
      lang === 'ar'
        ? 'تم التحقق من الصلاحيات. جاري فتح لوحة الإدارة والإشراف...'
        : 'Staff credentials verified successfully!'
    );
    setTimeout(() => setSaveToast(''), 3000);
    setSubView('admin_portal');
  };

  const DisclosureChevron = lang === 'ar' ? ChevronLeft : ChevronRight;
  const currentSelf = realmDB.findSelfUser() || selfUser;
  const isStaff = currentSelf.role === 'owner' || currentSelf.role === 'moderator';

  // 1. ADMIN DASHBOARD VIEW
  if (subView === 'admin_portal') {
    return <AdminModerationDashboard selfUser={currentSelf} lang={lang} onBack={() => setSubView('main')} />;
  }

  // 2. MONETIZATION & PAYMENTS LEDGER VIEW
  if (subView === 'monetization') {
    return (
      <div className="p-4 sm:p-5 space-y-5 max-w-3xl mx-auto">
        <div className="flex items-center justify-between">
          <button
            type="button"
            onClick={() => setSubView('main')}
            className="min-h-[44px] px-3.5 rounded-xl bg-white dark:bg-[#1E1B2E] border border-slate-200 dark:border-white/10 text-xs font-semibold text-slate-700 dark:text-slate-200"
          >
            {lang === 'ar' ? 'رجوع للملف الشخصي' : 'Back'}
          </button>
          <div className="text-xs font-mono-num font-bold text-[#8B5CF6]">
            {lang === 'ar' ? `رصيد النقاط: ${selfUser.points}` : `Points: ${selfUser.points}`}
          </div>
        </div>

        {/* Real VIP Perks Card */}
        <div className="rounded-3xl bg-[#2D1B69] text-white p-6 space-y-4">
          <div className="flex items-center gap-2.5">
            <Crown className="w-6 h-6 text-amber-300 shrink-0" />
            <h2 className="text-lg font-bold">
              {lang === 'ar' ? 'باقات فضفضة المميزة (تحقق فوري من السيرفر)' : 'Fadfadah VIP Subscriptions'}
            </h2>
          </div>
          <p className="text-xs text-purple-100/85 leading-relaxed">
            {lang === 'ar'
              ? 'محادثات عشوائية غير محدودة بدون حد يومي · فتح جميع الإطارات الملكية الحصرية · أولوية الظهور في رادار المطابقة وقائمة المتصلين · شارة العضوية الذهبية VIP · رصيد نقاط ترحيبي مع كل باقة.'
              : 'Unlimited random matches · All VIP royal frames · Priority online visibility · Gold VIP Badge · Bonus points.'}
          </p>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2">
            {[
              { id: 'weekly', titleAr: 'أسبوعية', titleEn: 'Weekly', price: '$2.99', bonus: 150 },
              { id: 'monthly', titleAr: 'شهرية', titleEn: 'Monthly', price: '$7.99', bonus: 500 },
              { id: 'quarterly', titleAr: '3 أشهر', titleEn: '3 Months', price: '$18.99', bonus: 1500 },
            ].map((pkg) => {
              const active = selfUser.premium_plan === pkg.id && selfUser.is_premium;
              return (
                <button
                  key={pkg.id}
                  type="button"
                  onClick={() => handleCheckoutPlan(pkg.id)}
                  className={`p-4 rounded-2xl text-start border transition-colors flex flex-col justify-between gap-3 ${
                    active
                      ? 'bg-[#8B5CF6] border-white text-white'
                      : 'bg-white/10 active:bg-white/20 border-white/15 text-white'
                  }`}
                >
                  <div>
                    <p className="text-sm font-bold">{lang === 'ar' ? pkg.titleAr : pkg.titleEn}</p>
                    <p className="text-xl font-bold font-mono-num mt-1">{pkg.price}</p>
                    <p className="text-[11px] text-purple-200 mt-1">
                      +{pkg.bonus} {lang === 'ar' ? 'نقطة رصيدية' : 'bonus pts'}
                    </p>
                  </div>
                  <span className="text-xs font-semibold underline">
                    {active ? (lang === 'ar' ? 'مفعّلة ومؤكدة' : 'Active') : lang === 'ar' ? 'شراء وتفعيل' : 'Subscribe'}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Verified Points Packs */}
        <div className="rounded-3xl bg-white dark:bg-[#1E1B2E] border border-slate-200 dark:border-white/10 p-6 space-y-4">
          <div className="flex items-center gap-2">
            <Coins className="w-5 h-5 text-amber-500" />
            <h3 className="text-base font-bold text-slate-900 dark:text-white">
              {lang === 'ar' ? 'شحن رصيد النقاط المؤكد' : 'Verified Point Packs'}
            </h3>
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            {lang === 'ar'
              ? 'تتم معالجة وتوثيق كل عملية شحن على السيرفر برقم طلب رسمي لمنع أي تكرار أو تلاعب.'
              : 'Transactions are authenticated on the server with unique order IDs to prevent replay or forgery.'}
          </p>
          <div className="grid grid-cols-3 gap-3">
            {[
              { id: 'pts_150', pts: 150, label: '$0.99' },
              { id: 'pts_500', pts: 500, label: '$2.49' },
              { id: 'pts_1200', pts: 1200, label: '$4.99' },
            ].map((pack) => (
              <button
                key={pack.id}
                type="button"
                onClick={() => handleCheckoutPoints(pack.id)}
                className="min-h-[64px] p-3 rounded-2xl bg-slate-50 dark:bg-[#151221] active:border-[#8B5CF6] border border-slate-200 dark:border-white/10 text-center space-y-1 transition-colors"
              >
                <p className="text-sm font-bold font-mono-num text-[#8B5CF6]">+{pack.pts}</p>
                <p className="text-xs text-slate-600 dark:text-slate-400 font-mono-num">{pack.label}</p>
              </button>
            ))}
          </div>
        </div>

        {/* Real User Financial Ledger History */}
        <div className="rounded-3xl bg-white dark:bg-[#1E1B2E] border border-slate-200 dark:border-white/10 p-6 space-y-3">
          <div className="flex items-center gap-2">
            <Receipt className="w-5 h-5 text-[#8B5CF6]" />
            <h3 className="text-base font-bold text-slate-900 dark:text-white">{t.paymentHistory}</h3>
          </div>

          {transactions.length === 0 ? (
            <p className="text-xs text-slate-400 text-center py-4">
              {lang === 'ar' ? 'لا توجد عمليات شحن سابقة.' : 'No previous transactions.'}
            </p>
          ) : (
            <div className="divide-y divide-slate-100 dark:divide-white/10">
              {transactions.map((tx) => (
                <div key={tx.id} className="py-2.5 flex items-center justify-between gap-3 text-xs">
                  <div>
                    <p className="font-bold text-slate-900 dark:text-white">{tx.item_title}</p>
                    <p className="text-[11px] text-slate-400 font-mono-num">
                      {tx.order_id} · {new Date(tx.created_at).toLocaleDateString(lang === 'ar' ? 'ar-EG' : 'en-US')}
                    </p>
                  </div>
                  <div className="text-end">
                    <span className="font-mono-num font-bold text-emerald-600 dark:text-emerald-400 block">
                      {tx.amount_usd > 0 ? `$${tx.amount_usd}` : `${tx.points_delta} pts`}
                    </span>
                    <span className="text-[10px] text-emerald-600 font-bold">مؤكد</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {saveToast && (
          <div className="p-3.5 rounded-2xl bg-emerald-50 dark:bg-emerald-950/50 border border-emerald-200 dark:border-emerald-800/60 text-xs font-semibold text-emerald-800 dark:text-emerald-200">
            {saveToast}
          </div>
        )}

      </div>
    );
  }

  // 3. ANDROID EXPORT & REALM DB VIEW (Strictly Staff / Owner Only)
  if (subView === 'realm_android') {
    if (!isStaff) {
      setSubView('main');
      return null;
    }
    const capBuildCmd = `npm install && npm run android:init && npm run android:open`;
    return (
      <div className="p-4 sm:p-5 space-y-5 max-w-3xl mx-auto">
        <div className="flex items-center justify-between">
          <button
            type="button"
            onClick={() => setSubView('main')}
            className="min-h-[44px] px-3.5 rounded-xl bg-white dark:bg-[#1E1B2E] border border-slate-200 dark:border-white/10 text-xs font-semibold text-slate-700 dark:text-slate-200"
          >
            {lang === 'ar' ? 'رجوع للملف الشخصي' : 'Back'}
          </button>
          <span className="text-xs font-mono-num text-slate-500 dark:text-slate-400">
            com.fadfadahnative · APK
          </span>
        </div>

        {/* Live Server Connection Endpoint Configurator for Android APK */}
        <form
          onSubmit={handleSaveServerEndpoint}
          className="rounded-3xl bg-white dark:bg-[#1E1B2E] border border-slate-200 dark:border-white/10 p-5 space-y-4"
        >
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <Server className="w-5 h-5 text-[#8B5CF6]" />
              <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                {lang === 'ar' ? 'ربط تطبيق الأندرويد بالسيرفر المستقل' : 'Android Server Endpoint'}
              </h3>
            </div>
            <span
              className={`text-xs font-bold ${
                connState === 'connected'
                  ? 'text-emerald-600 dark:text-emerald-400'
                  : 'text-amber-600 dark:text-amber-400'
              }`}
            >
              {connState === 'connected'
                ? lang === 'ar'
                  ? 'متصل بالسيرفر الحقيقي'
                  : 'Connected Live'
                : lang === 'ar'
                ? 'وضع Realm المحلي'
                : 'Offline Realm Mode'}
            </span>
          </div>

          <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
            {lang === 'ar'
              ? 'العنوان الفعلي النشط حالياً: '
              : 'Active Server Endpoint: '}
            <span className="font-mono-num text-slate-800 dark:text-slate-200" dir="ltr">
              {fadfadahClient.getServerBaseUrl()}
            </span>
          </p>

          <div className="space-y-2">
            <input
              type="url"
              value={serverUrlInput}
              onChange={(e) => setServerUrlInput(e.target.value)}
              placeholder="http://192.168.1.15:3000 أو https://api.yourdomain.com"
              dir="ltr"
              className="w-full h-11 px-3.5 rounded-xl bg-slate-50 dark:bg-[#151221] border border-slate-200 dark:border-white/10 text-xs font-mono-num text-slate-900 dark:text-white"
            />
            <div className="flex items-center gap-2">
              <button
                type="submit"
                disabled={savingServerUrl}
                className="min-h-[42px] px-4 py-2 rounded-xl bg-[#8B5CF6] text-white text-xs font-bold"
              >
                {savingServerUrl
                  ? lang === 'ar'
                    ? 'جارٍ الاتصال...'
                    : 'Connecting...'
                  : lang === 'ar'
                  ? 'حفظ والاتصال بالسيرفر'
                  : 'Save & Connect'}
              </button>
              {serverUrlInput && (
                <button
                  type="button"
                  onClick={() => {
                    setServerUrlInput('');
                    fadfadahClient.updateCustomServerUrl('');
                  }}
                  className="min-h-[42px] px-3 py-2 rounded-xl bg-slate-100 dark:bg-[#151221] text-xs font-semibold text-slate-600 dark:text-slate-300"
                >
                  {lang === 'ar' ? 'الافتراضي' : 'Default'}
                </button>
              )}
            </div>
          </div>
        </form>

        {/* Android Studio APK Packaging Commands */}
        <div className="rounded-3xl bg-[#2D1B69] text-white p-5 space-y-3">
          <div className="flex items-center gap-2.5">
            <Smartphone className="w-5 h-5 text-[#A78BFA]" />
            <h2 className="text-sm font-bold">
              {lang === 'ar'
                ? 'استخراج ملف الـ APK الأصلي على جهاز الكمبيوتر'
                : 'Build Native Android APK on Your PC'}
            </h2>
          </div>

          <p className="text-xs text-purple-100/85 leading-relaxed">
            {lang === 'ar'
              ? 'جميع حزم Capacitor Android مضمنة بالكامل داخل المشروع بدون أي ارتباط خارجي. بعد تنزيل المشروع على كمبيوترك نفذ الأمر التالي لفتح Android Studio وبناء الـ APK:'
              : 'All Capacitor Android packages are bundled locally. Run this on your PC to open Android Studio and build the APK:'}
          </p>

          <div className="p-3.5 rounded-2xl bg-black/30 border border-white/10 space-y-2">
            <code className="block text-xs font-mono-num text-emerald-300 break-all selectable-text" dir="ltr">
              {capBuildCmd}
            </code>
            <button
              type="button"
              onClick={async () => {
                await nativeCopyText(capBuildCmd);
                setCopiedCmd(true);
                setTimeout(() => setCopiedCmd(false), 2000);
              }}
              className="min-h-[38px] px-3 py-1.5 rounded-lg bg-white/10 active:bg-white/20 text-xs font-semibold"
            >
              {copiedCmd ? t.copied : lang === 'ar' ? 'نسخ الأمر' : 'Copy Command'}
            </button>
          </div>
        </div>

        {/* Local Realm DB Sync Store Inspector */}
        <div className="rounded-3xl bg-white dark:bg-[#1E1B2E] border border-slate-200 dark:border-white/10 p-5 space-y-4">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <Database className="w-5 h-5 text-[#8B5CF6]" />
              <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                {lang === 'ar' ? 'جداول Realm DB المحلية على الهاتف' : 'Local Realm DB Tables'}
              </h3>
            </div>

            <button
              type="button"
              onClick={handleExportRealm}
              className="min-h-[40px] px-3 py-1.5 rounded-xl bg-[#8B5CF6] text-white text-xs font-semibold flex items-center gap-1.5"
            >
              <Download className="w-3.5 h-3.5" />
              <span>{lang === 'ar' ? 'نسخة JSON' : 'Export JSON'}</span>
            </button>
          </div>

          <div className="divide-y divide-slate-100 dark:divide-white/10">
            {FADFADAH_REALM_SCHEMAS.map((schema) => {
              const count = realmDB.objects(
                schema.name as Parameters<typeof realmDB.objects>[0]
              ).length;
              return (
                <div key={schema.name} className="py-2.5 flex items-center justify-between gap-4">
                  <span className="text-xs font-bold font-mono-num text-slate-900 dark:text-white">
                    {schema.name}
                  </span>
                  <span className="text-xs font-mono-num font-bold text-[#8B5CF6]">
                    {count} {lang === 'ar' ? 'سجل' : 'docs'}
                  </span>
                </div>
              );
            })}
          </div>
        </div>

        {saveToast && (
          <div className="p-3.5 rounded-2xl bg-emerald-50 dark:bg-emerald-950/50 border border-emerald-200 dark:border-emerald-800/60 text-xs font-semibold text-emerald-800 dark:text-emerald-200">
            {saveToast}
          </div>
        )}
      </div>
    );
  }

  // 4. MAIN PROFILE & SETTINGS VIEW
  return (
    <div className="p-4 sm:p-5 space-y-5 max-w-2xl mx-auto">
      {/* Identity Card */}
      <div className="rounded-3xl bg-white dark:bg-[#1E1B2E] border border-slate-200 dark:border-white/10 p-6 flex flex-col items-center text-center space-y-3">
        <div className="relative">
          <FramedAvatar avatarUrl={avatarUrl} frameId={frameId} nickname={nickname} size="xl" />
          <input
            ref={avatarUploadRef}
            type="file"
            accept="image/*"
            onChange={handleCustomAvatarUpload}
            className="hidden"
          />
          <button
            type="button"
            onClick={() => avatarUploadRef.current?.click()}
            title={lang === 'ar' ? 'رفع صورة رمزية' : 'Upload custom avatar'}
            className="absolute -bottom-1 -left-1 min-h-[38px] min-w-[38px] rounded-full bg-[#2D1B69] text-white border-2 border-white dark:border-[#1E1B2E] flex items-center justify-center shadow"
          >
            <ImagePlus className="w-4 h-4" />
          </button>
        </div>

        <div>
          <div className="flex items-center justify-center gap-2">
            <h2 className="text-lg font-bold text-slate-900 dark:text-white">{selfUser.nickname}</h2>
            <OfficialBadge role={selfUser.role} />
            {isStaff && (
              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-[#8B5CF6] text-white">
                {selfUser.role === 'owner' ? t.roleOwner : t.roleModerator}
              </span>
            )}
          </div>
          <p className="text-xs font-semibold text-amber-600 dark:text-amber-400 mt-0.5">
            {selfUser.is_premium ? t.premiumBadge : t.freeTierBadge} ·{' '}
            <span className="font-mono-num">{selfUser.points}</span>{' '}
            {lang === 'ar' ? 'نقطة' : 'pts'}
          </p>

        </div>
      </div>

      {/* Staff Dashboard Direct Access (Only visible when authenticated as owner or moderator) */}
      {isStaff && (
        <button
          type="button"
          onClick={() => setSubView('admin_portal')}
          className="w-full min-h-[56px] px-5 py-3 rounded-2xl bg-gradient-to-r from-[#2D1B69] to-[#8B5CF6] text-white flex items-center justify-between gap-3 shadow-md active:scale-[0.99] transition-transform"
        >
          <div className="flex items-center gap-3">
            <ShieldAlert className="w-6 h-6 text-amber-300 shrink-0" />
            <div className="text-start">
              <span className="text-sm font-bold block">{t.adminPanelTitle}</span>
              <span className="text-xs text-purple-200">
                {lang === 'ar' ? 'إدارة البلاغات، الرقابة، الإحصائيات، وسجل العمليات' : 'Reports, Moderation & Audit'}
              </span>
            </div>
          </div>
          <DisclosureChevron className="w-5 h-5 text-purple-200" />
        </button>
      )}

      {/* Profile Editor */}
      <form
        onSubmit={handleSaveProfile}
        className="rounded-3xl bg-white dark:bg-[#1E1B2E] border border-slate-200 dark:border-white/10 p-5 space-y-4"
      >
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <label className="block text-xs font-semibold text-slate-600 dark:text-slate-300">
              {t.nicknameLabel}
            </label>
            <input
              type="text"
              value={nickname}
              onChange={(e) => setNickname(e.target.value)}
              maxLength={24}
              className="w-full h-11 px-3.5 rounded-xl bg-slate-50 dark:bg-[#151221] border border-slate-200 dark:border-white/10 text-sm font-semibold text-slate-900 dark:text-white"
            />
          </div>

          <div className="space-y-1.5">
            <label className="block text-xs font-semibold text-slate-600 dark:text-slate-300">
              {t.customSlugLabel}
            </label>
            <div
              className="flex items-center h-11 px-3 rounded-xl bg-slate-50 dark:bg-[#151221] border border-slate-200 dark:border-white/10"
              dir="ltr"
            >
              <span className="text-xs text-slate-400 font-mono-num">/u/</span>
              <input
                type="text"
                value={slug}
                onChange={(e) => setSlug(e.target.value)}
                maxLength={20}
                className="flex-1 bg-transparent text-xs font-mono-num font-semibold text-slate-900 dark:text-white focus:outline-none"
              />
            </div>
          </div>
        </div>

        <div className="space-y-1.5">
          <label className="block text-xs font-semibold text-slate-600 dark:text-slate-300">
            {t.countryLabel}
          </label>
          <select
            value={country}
            onChange={(e) => setCountry(e.target.value)}
            className="w-full h-11 px-3.5 rounded-xl bg-slate-50 dark:bg-[#151221] border border-slate-200 dark:border-white/10 text-sm text-slate-900 dark:text-white"
          >
            {AVAILABLE_COUNTRIES.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </div>

        <div className="space-y-1.5">
          <label className="block text-xs font-semibold text-slate-600 dark:text-slate-300">
            {lang === 'ar' ? 'نبذة قصيرة للمطابقة' : 'Short Bio'}
          </label>
          <input
            type="text"
            value={bio}
            onChange={(e) => setBio(e.target.value)}
            maxLength={110}
            className="w-full h-11 px-3.5 rounded-xl bg-slate-50 dark:bg-[#151221] border border-slate-200 dark:border-white/10 text-sm text-slate-900 dark:text-white"
          />
        </div>

        <div className="space-y-3">
          <label className="block text-xs font-semibold text-slate-600 dark:text-slate-300">
            {t.avatarAndFrames}
          </label>
          <div className="flex items-center gap-2.5 overflow-x-auto pb-1">
            {AVATAR_PRESETS.map((preset) => (
              <button
                key={preset}
                type="button"
                onClick={() => setAvatarUrl(preset)}
                className={`min-h-[48px] min-w-[48px] rounded-full flex items-center justify-center ${
                  avatarUrl === preset ? 'scale-105 ring-2 ring-[#8B5CF6]' : 'opacity-70'
                }`}
              >
                <FramedAvatar avatarUrl={preset} frameId={0} nickname={preset} size="sm" />
              </button>
            ))}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 pt-1">
            {PROFILE_FRAMES.map((fr) => {
              const unlocked = selfUser.is_premium || selfUser.unlocked_frames.includes(fr.id);
              const selected = frameId === fr.id;
              return (
                <button
                  key={fr.id}
                  type="button"
                  onClick={() => handleSelectFrame(fr.id)}
                  aria-pressed={selected}
                  className={`min-h-[76px] min-w-0 px-3 py-2.5 rounded-2xl border text-start flex items-center gap-3 transition-colors ${
                    selected
                      ? 'border-[#8B5CF6] bg-[#8B5CF6]/10 shadow-sm'
                      : 'border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-[#151221]'
                  }`}
                >
                  <FramedAvatar
                    avatarUrl={avatarUrl}
                    frameId={fr.id}
                    nickname={fr.nameEn}
                    size="sm"
                  />
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-bold text-slate-900 dark:text-white truncate">
                      {lang === 'ar' ? fr.nameAr : fr.nameEn}
                    </p>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400 flex items-center gap-1">
                      {unlocked ? (
                        <>
                          <Check className="w-3 h-3 text-emerald-500" />
                          <span>{lang === 'ar' ? 'متاح' : 'Unlocked'}</span>
                        </>
                      ) : fr.premiumOnly ? (
                        <>
                          <Sparkles className="w-3 h-3 text-amber-500" />
                          <span>VIP</span>
                        </>
                      ) : (
                        <>
                          <Lock className="w-3 h-3" />
                          <span className="font-mono-num">{fr.costPoints}</span>
                        </>
                      )}
                    </p>
                  </div>
                  {selected && (
                    <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-[#8B5CF6] text-white">
                      <Check className="h-3 w-3 stroke-[3]" />
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </div>

        <div className="space-y-2.5">
          <label className="block text-xs font-semibold text-slate-600 dark:text-slate-300">
            {t.interestsAndLangs}
          </label>
          <div className="flex flex-wrap gap-2">
            {AVAILABLE_INTERESTS.map((item) => {
              const active = interests.includes(item);
              return (
                <button
                  key={item}
                  type="button"
                  onClick={() => toggleInterest(item)}
                  className={`min-h-[40px] px-3.5 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap ${
                    active
                      ? 'bg-[#8B5CF6] text-white'
                      : 'bg-slate-100 dark:bg-[#151221] text-slate-600 dark:text-slate-300'
                  }`}
                >
                  {item}
                </button>
              );
            })}
          </div>

          <div className="flex flex-wrap gap-2 pt-1">
            {AVAILABLE_LANGUAGES.map((lItem) => {
              const active = languages.includes(lItem);
              return (
                <button
                  key={lItem}
                  type="button"
                  onClick={() => toggleLanguageItem(lItem)}
                  className={`min-h-[40px] px-3.5 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap ${
                    active
                      ? 'bg-[#2D1B69] text-white'
                      : 'bg-slate-100 dark:bg-[#151221] text-slate-600 dark:text-slate-300'
                  }`}
                >
                  {lItem}
                </button>
              );
            })}
          </div>
        </div>

        <button
          type="submit"
          disabled={savingProfile}
          className="w-full min-h-[48px] rounded-2xl bg-[#8B5CF6] active:scale-[0.99] disabled:opacity-60 text-white text-sm font-bold transition-transform"
        >
          {savingProfile
            ? lang === 'ar'
              ? 'جارٍ حفظ التعديلات...'
              : 'Saving changes...'
            : t.saveProfile}
        </button>

        {saveToast && (
          <p className="text-center text-xs font-semibold text-emerald-600 dark:text-emerald-400">
            {saveToast}
          </p>
        )}
      </form>

      {/* Native Android Settings Rows */}
      <div className="rounded-3xl bg-white dark:bg-[#1E1B2E] border border-slate-200 dark:border-white/10 divide-y divide-slate-100 dark:divide-white/10 overflow-hidden">
        <div className="px-5 min-h-[58px] flex items-center justify-between gap-4">
          <span className="text-sm font-semibold text-slate-900 dark:text-white">{t.darkMode}</span>
          <button
            type="button"
            role="switch"
            aria-checked={settings.theme === 'dark'}
            onClick={onToggleTheme}
            className={`w-12 h-7 rounded-full p-1 transition-colors flex items-center ${
              settings.theme === 'dark'
                ? 'bg-[#8B5CF6] justify-end'
                : 'bg-slate-300 justify-start'
            }`}
          >
            <span className="w-5 h-5 rounded-full bg-white shadow" />
          </button>
        </div>

        <button
          type="button"
          onClick={onToggleLanguage}
          className="w-full px-5 min-h-[58px] flex items-center justify-between gap-4 active:bg-slate-50 dark:active:bg-white/5"
        >
          <span className="text-sm font-semibold text-slate-900 dark:text-white">
            {t.languageToggle}
          </span>
          <span className="text-xs font-bold text-[#8B5CF6]">
            {settings.language === 'ar' ? 'العربية (RTL)' : 'English (LTR)'}
          </span>
        </button>

        <button
          type="button"
          onClick={onLinkAccount}
          className="w-full px-5 min-h-[58px] flex items-center justify-between gap-4 active:bg-slate-50 dark:active:bg-white/5"
        >
          <span className="text-sm font-semibold text-slate-900 dark:text-white flex items-center gap-2">
            <KeyRound className="w-4 h-4 text-[#8B5CF6]" />
            <span>{lang === 'ar' ? 'ربط بريد أو Google لحماية الحساب' : 'Link email or Google to your account'}</span>
          </span>
          <DisclosureChevron className="w-4 h-4 text-slate-400" />
        </button>

        <button
          type="button"
          onClick={() => setSubView('monetization')}
          className="w-full px-5 min-h-[58px] flex items-center justify-between gap-4 active:bg-slate-50 dark:active:bg-white/5"
        >
          <span className="text-sm font-semibold text-slate-900 dark:text-white">
            {t.subscriptionsAndPoints}
          </span>
          <DisclosureChevron className="w-4 h-4 text-slate-400" />
        </button>

        {isStaff && (
          <>
            <button
              type="button"
              onClick={() => setSubView('admin_portal')}
              className="w-full px-5 min-h-[58px] flex items-center justify-between gap-4 bg-purple-500/10 hover:bg-purple-500/15 active:bg-purple-500/20 text-[#8B5CF6] transition-colors"
            >
              <span className="text-sm font-bold flex items-center gap-2.5">
                <ShieldAlert className="w-5 h-5 text-[#8B5CF6]" />
                <span>
                  {lang === 'ar'
                    ? 'لوحة تحكم الإدارة والإشراف على البلاغات'
                    : 'Admin & Reports Moderation'}
                </span>
              </span>
              <DisclosureChevron className="w-4 h-4 text-[#8B5CF6]" />
            </button>

            <button
              type="button"
              onClick={() => setSubView('realm_android')}
              className="w-full px-5 min-h-[58px] flex items-center justify-between gap-4 active:bg-slate-50 dark:active:bg-white/5"
            >
              <span className="text-sm font-semibold text-slate-900 dark:text-white flex items-center gap-2">
                <Server className="w-4 h-4 text-slate-400" />
                <span>
                  {lang === 'ar'
                    ? 'إعدادات السيرفر وتصدير APK للأندرويد'
                    : 'Server URL & Android APK Build'}
                </span>
              </span>
              <DisclosureChevron className="w-4 h-4 text-slate-400" />
            </button>
          </>
        )}

        <button
          type="button"
          onClick={() => setShowDeleteConfirm(true)}
          className="w-full px-5 min-h-[58px] flex items-center justify-between gap-4 active:bg-rose-50 dark:active:bg-rose-950/30 text-rose-600 dark:text-rose-400"
        >
          <span className="text-sm font-semibold flex items-center gap-2">
            <Trash2 className="w-4 h-4" />
            <span>{t.deleteAccount}</span>
          </span>
          <DisclosureChevron className="w-4 h-4" />
        </button>
      </div>

      {/* Discreet Version & Protected Admin Trigger */}
      <div className="pt-2 pb-6 text-center space-y-1">
        <p className="text-[11px] text-slate-400 dark:text-slate-500 font-mono-num">
          فضفضة · الإصدار 3.9.0 (مستقر)
        </p>
        {!isStaff && (
          <button
            type="button"
            onClick={() => {
              setStaffError('');
              setStaffPasscode('');
              setShowStaffModal(true);
            }}
            aria-label={lang === 'ar' ? 'وصول المشرفين' : 'Staff Access'}
            className="text-[10px] text-slate-400/60 dark:text-slate-600 hover:text-slate-500 dark:hover:text-slate-400 transition-colors inline-flex items-center gap-1 cursor-pointer py-1 px-2 rounded"
          >
            <Lock className="w-2.5 h-2.5 opacity-40" />
            <span>{lang === 'ar' ? 'منطقة المشرفين المعتمدين' : 'Staff Access'}</span>
          </button>
        )}
      </div>

      {/* Staff Secret Key Verification Modal (Completely masked, zero hints or credentials exposed) */}
      {showStaffModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm p-4">
          <div className="w-full max-w-sm rounded-3xl bg-white dark:bg-[#1E1B2E] border border-slate-200 dark:border-white/10 p-6 space-y-4 shadow-2xl">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <ShieldCheck className="w-5 h-5 text-[#8B5CF6]" />
                <h3 className="text-base font-bold text-slate-900 dark:text-white">
                  {lang === 'ar' ? 'التحقق الأمني للإدارة' : 'Admin Security Verification'}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => {
                  setShowStaffModal(false);
                  setStaffPasscode('');
                  setStaffError('');
                }}
                className="p-1 text-slate-400 hover:text-slate-600 dark:hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
              {lang === 'ar'
                ? 'يرجى إدخال رمز الأمان السري لتوثيق صلاحيات المالك والمشرفين وفتح لوحة الإشراف.'
                : 'Please enter the confidential admin passcode to verify staff privileges.'}
            </p>

            <form onSubmit={handleStaffLogin} className="space-y-3">
              <div className="space-y-1.5">
                <label className="block text-xs font-semibold text-slate-600 dark:text-slate-300">
                  {lang === 'ar' ? 'رمز الأمان السري' : 'Admin Passcode'}
                </label>
                <div className="relative">
                  <input
                    type={showPasscodeText ? 'text' : 'password'}
                    autoComplete="current-password"
                    autoFocus
                    value={staffPasscode}
                    onChange={(e) => setStaffPasscode(e.target.value)}
                    placeholder="••••••••••••"
                    dir="ltr"
                    required
                    className="w-full h-11 pl-3.5 pr-11 rounded-xl bg-slate-50 dark:bg-[#151221] border border-slate-200 dark:border-white/10 text-sm font-mono-num text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-[#8B5CF6]"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPasscodeText(!showPasscodeText)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-white p-1"
                    title={showPasscodeText ? 'إخفاء' : 'إظهار'}
                  >
                    {showPasscodeText ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              {staffError && (
                <div className="p-3 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900/60 text-xs font-semibold text-rose-600 dark:text-rose-400 flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 shrink-0" />
                  <span>{staffError}</span>
                </div>
              )}

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => {
                    setShowStaffModal(false);
                    setStaffPasscode('');
                    setStaffError('');
                  }}
                  className="min-h-[42px] px-4 rounded-xl bg-slate-100 dark:bg-white/10 text-xs font-semibold text-slate-700 dark:text-slate-200"
                >
                  {lang === 'ar' ? 'إلغاء' : 'Cancel'}
                </button>
                <button
                  type="submit"
                  disabled={verifyingStaff || !staffPasscode.trim()}
                  className="min-h-[42px] px-5 rounded-xl bg-[#8B5CF6] disabled:opacity-50 text-white text-xs font-bold"
                >
                  {verifyingStaff
                    ? lang === 'ar'
                      ? 'جارٍ التحقق...'
                      : 'Verifying...'
                    : lang === 'ar'
                    ? 'تحقق وترقية'
                    : 'Verify'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {showDeleteConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/65 backdrop-blur-sm p-4">
          <div className="w-full max-w-sm rounded-3xl bg-white dark:bg-[#1E1B2E] border border-slate-200 dark:border-white/10 p-6 space-y-4">
            <h3 className="text-base font-bold text-rose-600 dark:text-rose-400">
              {t.deleteAccount}
            </h3>
            <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
              {lang === 'ar'
                ? 'سيتم مسح حسابك ورابطك الشخصي وجميع محادثاتك نهائياً من السيرفر ومن قاعدة بيانات Realm على هاتفك.'
                : 'Your account, link, and chats will be deleted permanently from both the server and Local Realm DB.'}
            </p>
            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setShowDeleteConfirm(false)}
                className="min-h-[44px] px-4 py-2 rounded-xl bg-slate-100 dark:bg-white/10 text-xs font-semibold text-slate-700 dark:text-slate-200"
              >
                {lang === 'ar' ? 'تراجع' : 'Cancel'}
              </button>
              <button
                type="button"
                onClick={handlePermanentDelete}
                className="min-h-[44px] px-4 py-2 rounded-xl bg-rose-600 text-xs font-semibold text-white"
              >
                {lang === 'ar' ? 'حذف نهائي' : 'Delete Permanently'}
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};
