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
  generateUUID,
  FADFADAH_REALM_SCHEMAS,
  realmDB,
  RealmAppSettings,
  RealmPaymentTransaction,
  RealmPersonalLink,
  RealmUser,
  isRealmPremiumActive,
} from '../db/realmLocalDB';
import {
  fadfadahClient,
  ManualTopupConfigDTO,
  ManualTopupRequestDTO,
} from '../services/fadfadahNetworkClient';
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

const PROFILE_AVATAR_REQUEST_LIMIT = 700_000;

async function prepareAvatarForRequest(avatarUrl: string): Promise<string> {
  if (!avatarUrl.startsWith('data:image/') || avatarUrl.length <= PROFILE_AVATAR_REQUEST_LIMIT) {
    return avatarUrl;
  }

  const image = new Image();
  image.src = avatarUrl;
  await image.decode();

  const canvas = document.createElement('canvas');
  const scale = Math.min(1, 512 / Math.max(image.naturalWidth, image.naturalHeight));
  canvas.width = Math.max(1, Math.round(image.naturalWidth * scale));
  canvas.height = Math.max(1, Math.round(image.naturalHeight * scale));

  const context = canvas.getContext('2d');
  if (!context) throw new Error('تعذر تجهيز الصورة للحفظ.');
  context.drawImage(image, 0, 0, canvas.width, canvas.height);

  for (const quality of [0.82, 0.7, 0.58, 0.46]) {
    const webp = canvas.toDataURL('image/webp', quality);
    const compactImage = webp.startsWith('data:image/webp')
      ? webp
      : canvas.toDataURL('image/jpeg', quality);
    if (compactImage.length <= PROFILE_AVATAR_REQUEST_LIMIT) return compactImage;
  }

  throw new Error('تعذر ضغط الصورة إلى حجم مناسب. اختر صورة أصغر.');
}

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
  const [age, setAge] = useState(selfUser.age ? String(selfUser.age) : '');
  const [avatarUrl, setAvatarUrl] = useState(selfUser.avatar_url);
  const [frameId, setFrameId] = useState(selfUser.frame_id);
  const [interests, setInterests] = useState<string[]>(selfUser.interests);
  const [languages, setLanguages] = useState<string[]>(selfUser.languages);

  const [serverUrlInput, setServerUrlInput] = useState(settings.custom_server_url || '');
  const [connState, setConnState] = useState(() => fadfadahClient.getConnectionState());
  const [savingServerUrl, setSavingServerUrl] = useState(false);

  const [saveToast, setSaveToast] = useState('');
  const [profileSaveError, setProfileSaveError] = useState('');
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
  const [manualTopupConfig, setManualTopupConfig] = useState<ManualTopupConfigDTO>({
    packages: [],
    vip_plans: [],
    payment_methods: [],
  });
  const [manualTopupRequests, setManualTopupRequests] = useState<ManualTopupRequestDTO[]>([]);
  const [selectedTopupPackage, setSelectedTopupPackage] = useState('');
  const [selectedPaymentMethod, setSelectedPaymentMethod] = useState('');
  const [selectedVipPlan, setSelectedVipPlan] = useState<string>('');
  const [transactionReference, setTransactionReference] = useState('');
  const [paymentProof, setPaymentProof] = useState('');
  const [submittingTopup, setSubmittingTopup] = useState(false);
  const topupIdempotencyKey = useRef(generateUUID());
  const [vipTransactionReference, setVipTransactionReference] = useState('');
  const [vipPaymentProof, setVipPaymentProof] = useState('');
  const [submittingVip, setSubmittingVip] = useState(false);
  const vipIdempotencyKey = useRef(generateUUID());

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

  useEffect(() => {
    if (subView !== 'monetization') return;
    let cancelled = false;
    void Promise.all([
      fadfadahClient.getManualTopupConfig(),
      fadfadahClient.getManualTopupRequests(),
    ])
      .then(([config, requests]) => {
        if (cancelled) return;
        setManualTopupConfig(config);
        setManualTopupRequests(requests);
        setSelectedTopupPackage((current) =>
          config.packages.some((pack) => pack.id === current) ? current : config.packages[0]?.id || ''
        );
        setSelectedPaymentMethod((current) =>
          config.payment_methods.some((method) => method.id === current)
            ? current
            : config.payment_methods[0]?.id || ''
        );
        setSelectedVipPlan((current) =>
          config.vip_plans.some((plan) => plan.id === current)
            ? current
            : config.vip_plans[0]?.id || ''
        );
      })
      .catch((error: unknown) => {
        if (!cancelled) {
          setSaveToast(
            error instanceof Error ? error.message : 'تعذر تحميل بيانات الشحن اليدوي.'
          );
        }
      });
    return () => {
      cancelled = true;
    };
  }, [subView]);

  useEffect(() => {
    if (subView !== 'monetization') return;
    return fadfadahClient.subscribeManualTopupUpdates(() => {
      void fadfadahClient
        .getManualTopupRequests()
        .then(setManualTopupRequests)
        .catch((error: unknown) =>
          setSaveToast(error instanceof Error ? error.message : 'تعذر تحديث حالة طلبات الدفع.')
        );
    });
  }, [subView]);

  useEffect(() => {
    if (subView !== 'monetization') return;
    return fadfadahClient.subscribeManualTopupConfigUpdates(() => {
      void Promise.all([
        fadfadahClient.getManualTopupConfig(),
        fadfadahClient.getManualTopupRequests(),
      ])
        .then(([config, requests]) => {
          setManualTopupConfig(config);
          setManualTopupRequests(requests);
          setSelectedTopupPackage((current) =>
            config.packages.some((pack) => pack.id === current) ? current : config.packages[0]?.id || ''
          );
          setSelectedPaymentMethod((current) =>
            config.payment_methods.some((method) => method.id === current)
              ? current
              : config.payment_methods[0]?.id || ''
          );
          setSelectedVipPlan((current) =>
            config.vip_plans.some((plan) => plan.id === current)
              ? current
              : config.vip_plans[0]?.id || ''
          );
        })
        .catch((error: unknown) =>
          setSaveToast(error instanceof Error ? error.message : 'تعذر تحديث إعدادات الشحن.')
        );
    });
  }, [subView]);

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

    const isUnlocked = isRealmPremiumActive(selfUser) || selfUser.unlocked_frames.includes(targetFrameId);
    if (isUnlocked) {
      setFrameId(targetFrameId);
      return;
    }

    if (def.premiumOnly && !isRealmPremiumActive(selfUser)) {
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
    setProfileSaveError('');
    try {
      const requestAvatarUrl = await prepareAvatarForRequest(avatarUrl);
      if (requestAvatarUrl !== avatarUrl) setAvatarUrl(requestAvatarUrl);
      const res = await fadfadahClient.updateProfile({
        nickname: nickname.trim() || selfUser.nickname,
        slug: slug.trim() || personalLink.slug,
        country,
        bio: bio.trim(),
        age: age.trim() ? Number(age) : null,
        avatar_url: requestAvatarUrl,
        frame_id: frameId,
        interests,
        languages,
      });

      if (!res.ok) {
        setProfileSaveError(res.error || (lang === 'ar' ? 'تعذر الحفظ.' : 'Save failed.'));
        return;
      }
      const updatedLink = realmDB.findPersonalLink();
      if (updatedLink) setSlug(updatedLink.slug);
      setSaveToast(t.savedSuccess);
      setTimeout(() => setSaveToast(''), 2600);
    } catch (error) {
      setProfileSaveError(
        error instanceof Error
          ? error.message
          : lang === 'ar'
            ? 'تعذر تجهيز بيانات الملف الشخصي للحفظ.'
            : 'Could not prepare your profile for saving.'
      );
    } finally {
      setSavingProfile(false);
    }
  };

  const handleManualProofUpload = (
    e: React.ChangeEvent<HTMLInputElement>,
    setProof: React.Dispatch<React.SetStateAction<string>>
  ) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) {
      setSaveToast(lang === 'ar' ? 'اختر صورة بصيغة JPG أو PNG أو WebP.' : 'Choose a JPG, PNG, or WebP image.');
      e.target.value = '';
      return;
    }
    if (file.size > 2 * 1024 * 1024) {
      setSaveToast(lang === 'ar' ? 'حجم الإثبات يجب ألا يتجاوز 2 ميجابايت.' : 'Proof image must not exceed 2 MB.');
      e.target.value = '';
      return;
    }
    const reader = new FileReader();
    reader.onload = () => setProof(String(reader.result || ''));
    reader.onerror = () => setSaveToast(lang === 'ar' ? 'تعذرت قراءة صورة الإثبات.' : 'Could not read the proof image.');
    reader.readAsDataURL(file);
    e.target.value = '';
  };

  const handleSubmitManualSubscription = async (e: React.FormEvent) => {
    e.preventDefault();
    if (submittingVip || !selectedVipPlan) return;
    setSubmittingVip(true);
    setSaveToast('');
    try {
      const result = await fadfadahClient.createManualSubscriptionRequest({
        planId: selectedVipPlan,
        paymentMethodId: selectedPaymentMethod,
        transactionReference: vipTransactionReference,
        proofDataUrl: vipPaymentProof,
        idempotencyKey: vipIdempotencyKey.current,
      });
      if (!result.ok || !result.request) {
        const error = result.error || '';
        setSaveToast(
          error === 'TRANSACTION_REFERENCE_ALREADY_USED'
            ? lang === 'ar'
              ? 'رقم العملية مستخدم في طلب آخر.'
              : 'This transfer reference is already used.'
            : error === 'INVALID_PAYMENT_PROOF'
              ? lang === 'ar'
                ? 'ملف الإثبات غير صالح أو أكبر من الحد المسموح.'
                : 'The proof image is invalid or exceeds the size limit.'
              : error === 'INVALID_PACKAGE_OR_PAYMENT_METHOD'
                ? lang === 'ar'
                  ? 'وسيلة الدفع لم تعد متاحة. حدّث الصفحة وحاول مجددًا.'
                  : 'The payment method is no longer available. Refresh and retry.'
                : error || (lang === 'ar' ? 'تعذر إرسال طلب اشتراك VIP.' : 'Could not submit the VIP request.')
        );
        return;
      }
      setManualTopupRequests((requests) => [result.request!, ...requests]);
      setVipTransactionReference('');
      setVipPaymentProof('');
      vipIdempotencyKey.current = generateUUID();
      setSaveToast(
        lang === 'ar'
          ? 'تم إرسال طلب اشتراك VIP إلى الإدارة، وسيُفعّل بعد مراجعة التحويل.'
          : 'VIP subscription request sent; it will activate after transfer review.'
      );
    } catch (error) {
      setSaveToast(
        error instanceof Error
          ? error.message
          : lang === 'ar'
            ? 'تعذر إرسال طلب اشتراك VIP.'
            : 'Could not submit the VIP request.'
      );
    } finally {
      setSubmittingVip(false);
    }
  };

  const handleSubmitManualTopup = async (e: React.FormEvent) => {
    e.preventDefault();
    if (submittingTopup) return;
    setSubmittingTopup(true);
    setSaveToast('');
    const result = await fadfadahClient.createManualTopupRequest({
      packageId: selectedTopupPackage,
      paymentMethodId: selectedPaymentMethod,
      transactionReference,
      proofDataUrl: paymentProof,
      idempotencyKey: topupIdempotencyKey.current,
    });
    setSubmittingTopup(false);
    if (!result.ok || !result.request) {
      const error = result.error || '';
      const message =
        error === 'TRANSACTION_REFERENCE_ALREADY_USED'
          ? lang === 'ar'
            ? 'رقم العملية مستخدم في طلب آخر.'
            : 'This transaction reference is already used.'
          : error === 'INVALID_PAYMENT_PROOF'
            ? lang === 'ar'
              ? 'ملف الإثبات غير صالح أو أكبر من الحد المسموح.'
              : 'The proof image is invalid or exceeds the size limit.'
            : error === 'INVALID_PACKAGE_OR_PAYMENT_METHOD'
              ? lang === 'ar'
                ? 'الباقة أو وسيلة الدفع لم تعد متاحة. حدّث الصفحة وحاول مجددًا.'
                : 'The selected package or payment method is no longer available. Refresh and retry.'
              : error || (lang === 'ar' ? 'تعذر إرسال طلب الشحن.' : 'Could not submit the top-up request.');
      setSaveToast(message);
      return;
    }
    setManualTopupRequests((requests) => [result.request!, ...requests]);
    setTransactionReference('');
    setPaymentProof('');
    topupIdempotencyKey.current = generateUUID();
    setSaveToast(
      lang === 'ar'
        ? 'تم إرسال طلب الشحن إلى الإدارة، وسيبقى قيد المراجعة.'
        : 'Top-up request sent and is pending review.'
    );
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

        <div className="border-beam relative overflow-hidden rounded-3xl bg-gradient-to-br from-[#2D1B69] via-[#241753] to-[#151221] p-6 text-white shadow-xl shadow-purple-950/20 space-y-4">
          <div className="flex items-center gap-2.5">
            <Crown className="w-6 h-6 text-amber-300 shrink-0" />
            <h2 className="text-lg font-bold">
              {lang === 'ar' ? 'باقات فضفضة المميزة' : 'Fadfadah VIP Subscriptions'}
            </h2>
          </div>
          <p className="text-xs text-purple-100/85 leading-relaxed">
            {lang === 'ar'
              ? 'محادثات عشوائية غير محدودة بدون حد يومي · فتح جميع الإطارات الملكية الحصرية · أولوية الظهور في رادار المطابقة وقائمة المتصلين · شارة العضوية الذهبية VIP · رصيد نقاط ترحيبي مع كل باقة.'
              : 'Unlimited random matches · All VIP royal frames · Priority online visibility · Gold VIP Badge · Bonus points.'}
          </p>
          <ol className="grid grid-cols-3 gap-2 text-[10px] sm:text-xs">
            {[
              lang === 'ar' ? 'اختر باقة VIP' : 'Choose a VIP plan',
              lang === 'ar' ? 'حوّل عبر الوسيلة' : 'Make the transfer',
              lang === 'ar' ? 'أرسل الإثبات' : 'Submit the proof',
            ].map((step, index) => (
              <li key={step} className="rounded-xl border border-white/10 bg-white/5 p-2.5">
                <span className="me-1.5 inline-flex h-5 w-5 items-center justify-center rounded-full bg-amber-300/20 text-amber-200 font-bold">
                  {index + 1}
                </span>
                {step}
              </li>
            ))}
          </ol>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 pt-2">
            {manualTopupConfig.vip_plans.map((pkg) => {
              const active = selfUser.premium_plan === pkg.id && isRealmPremiumActive(selfUser);
              const selected = selectedVipPlan === pkg.id;
              return (
                <button
                  key={pkg.id}
                  type="button"
                  onClick={() => setSelectedVipPlan(pkg.id)}
                  aria-pressed={selected}
                  className={`rounded-2xl border p-4 text-start transition-all flex flex-col justify-between gap-3 ${
                    selected
                      ? 'bg-white/20 border-amber-200 ring-2 ring-amber-300/50 text-white'
                      : 'bg-white/5 active:bg-white/15 border-white/15 text-white'
                  }`}
                >
                  <div>
                    <p className="text-sm font-bold">{lang === 'ar' ? pkg.title_ar : pkg.title_en}</p>
                    <p className="text-xl font-bold font-mono-num mt-1">
                      {pkg.amount} {pkg.currency}
                    </p>
                    <p className="text-[11px] text-purple-200 mt-1">
                      {pkg.duration_days} {lang === 'ar' ? 'يوم' : 'days'} · +{pkg.points}{' '}
                      {lang === 'ar' ? 'نقطة ترحيبية' : 'bonus points'}
                    </p>
                  </div>
                  <span className="text-xs font-semibold">
                    {active ? (lang === 'ar' ? 'تجديد الاشتراك' : 'Renew subscription') : lang === 'ar' ? 'اختر الباقة' : 'Select plan'}
                  </span>
                </button>
              );
            })}
          </div>
          {manualTopupConfig.vip_plans.length === 0 && (
            <p className="rounded-2xl border border-white/10 bg-white/5 p-4 text-xs text-purple-100/80">
              {lang === 'ar'
                ? 'لا توجد باقات VIP متاحة حاليًا.'
                : 'No VIP plans are currently available.'}
            </p>
          )}

          {isRealmPremiumActive(selfUser) && selfUser.premium_expires_at && (
            <p className="text-[11px] text-purple-100">
              {lang === 'ar' ? 'ينتهي اشتراكك الحالي في: ' : 'Current subscription expires: '}
              {new Date(selfUser.premium_expires_at).toLocaleDateString(lang === 'ar' ? 'ar-EG' : 'en-US')}
            </p>
          )}

          {selectedVipPlan && manualTopupConfig.vip_plans.some((plan) => plan.id === selectedVipPlan) && (
            manualTopupConfig.payment_methods.length === 0 ? (
              <div className="rounded-2xl border border-amber-200/30 bg-amber-300/10 p-4 text-xs leading-relaxed text-amber-100">
                {lang === 'ar'
                  ? 'طلبات اشتراك VIP غير متاحة حتى يضيف المالك وسيلة دفع من لوحة الإدارة.'
                  : 'VIP requests are unavailable until the owner configures a payment method in the admin panel.'}
              </div>
            ) : (
              <form onSubmit={handleSubmitManualSubscription} className="space-y-3 rounded-2xl border border-white/10 bg-black/20 p-4">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="text-sm font-bold">
                      {lang === 'ar' ? 'طلب اشتراك يدوي' : 'Manual subscription request'}
                    </p>
                    <p className="mt-1 text-[11px] text-purple-100">
                      {(() => {
                        const plan = manualTopupConfig.vip_plans.find((item) => item.id === selectedVipPlan);
                        return plan ? `${plan.amount} ${plan.currency}` : '';
                      })()}
                      {' · '}
                      +{manualTopupConfig.vip_plans.find((plan) => plan.id === selectedVipPlan)?.points || 0}
                      {' '}{lang === 'ar' ? 'نقطة ترحيبية' : 'bonus points'}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setSelectedVipPlan('')}
                    className="min-h-10 rounded-xl bg-white/10 px-3 text-xs font-semibold"
                  >
                    {lang === 'ar' ? 'إلغاء' : 'Cancel'}
                  </button>
                </div>

                <label className="block space-y-1.5">
                  <span className="text-xs font-bold">{lang === 'ar' ? 'وسيلة الدفع' : 'Payment method'}</span>
                  <select
                    value={selectedPaymentMethod}
                    onChange={(e) => setSelectedPaymentMethod(e.target.value)}
                    className="w-full min-h-[46px] rounded-xl border border-white/10 bg-[#151221] px-3 text-sm text-white"
                    required
                  >
                    {manualTopupConfig.payment_methods.map((method) => (
                      <option key={method.id} value={method.id}>
                        {lang === 'ar' ? method.title_ar : method.title_en}
                      </option>
                    ))}
                  </select>
                </label>

                {(() => {
                  const method = manualTopupConfig.payment_methods.find(
                    (item) => item.id === selectedPaymentMethod
                  );
                  return method ? (
                    <div className="rounded-xl border border-purple-300/20 bg-purple-400/10 p-3">
                      <p className="text-xs font-bold text-purple-100">
                        {lang === 'ar' ? method.title_ar : method.title_en}
                      </p>
                      <p className="mt-1 whitespace-pre-wrap break-words text-xs leading-relaxed text-purple-100/80">
                        {lang === 'ar' ? method.instructions_ar : method.instructions_en}
                      </p>
                    </div>
                  ) : null;
                })()}

                <label className="block space-y-1.5">
                  <span className="text-xs font-bold">{lang === 'ar' ? 'رقم العملية' : 'Transfer reference'}</span>
                  <input
                    value={vipTransactionReference}
                    onChange={(e) => setVipTransactionReference(e.target.value)}
                    minLength={3}
                    maxLength={100}
                    required
                    className="w-full min-h-[44px] rounded-xl border border-white/10 bg-[#151221] px-3 text-sm text-white"
                    placeholder={lang === 'ar' ? 'أدخل رقم التحويل' : 'Enter transfer reference'}
                  />
                </label>

                <label className="block space-y-1.5">
                  <span className="text-xs font-bold">{lang === 'ar' ? 'إثبات الدفع' : 'Payment proof'}</span>
                  <input
                    type="file"
                    accept="image/jpeg,image/png,image/webp"
                    onChange={(e) => handleManualProofUpload(e, setVipPaymentProof)}
                    required={!vipPaymentProof}
                    className="block w-full text-xs text-purple-100 file:me-3 file:rounded-lg file:border-0 file:bg-white/15 file:px-3 file:py-2 file:text-xs file:font-semibold file:text-white"
                  />
                </label>
                {vipPaymentProof && (
                  <img
                    src={vipPaymentProof}
                    alt={lang === 'ar' ? 'معاينة إثبات الدفع' : 'Payment proof preview'}
                    className="max-h-40 rounded-xl border border-white/10 object-contain"
                  />
                )}
                <button
                  type="submit"
                  disabled={
                    submittingVip ||
                    !selectedPaymentMethod ||
                    vipTransactionReference.trim().length < 3 ||
                    !vipPaymentProof
                  }
                  className="w-full min-h-[48px] rounded-xl bg-gradient-to-r from-amber-300 to-amber-500 text-[#241753] text-sm font-bold disabled:opacity-50"
                >
                  {submittingVip
                    ? lang === 'ar' ? 'جارٍ إرسال الطلب...' : 'Submitting...'
                    : lang === 'ar' ? 'إرسال طلب VIP للمراجعة' : 'Submit VIP request for review'}
                </button>
              </form>
            )
          )}
        </div>

        {/* Server-verified manual wallet top-ups */}
        <div className="rounded-3xl bg-white dark:bg-[#1E1B2E] border border-slate-200 dark:border-white/10 p-6 space-y-4">
          <div className="flex items-center gap-2">
            <Coins className="w-5 h-5 text-amber-500" />
            <h3 className="text-base font-bold text-slate-900 dark:text-white">
              {lang === 'ar' ? 'شحن رصيد يدوي' : 'Manual wallet top-up'}
            </h3>
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
            {lang === 'ar'
              ? 'اختر باقة ووسيلة دفع، ثم أرفق رقم العملية وصورة الإثبات. لن تضاف النقاط إلا بعد مراجعة التحويل من الإدارة.'
              : 'Choose a package and payment method, then provide the transfer reference and proof. Points are added only after admin review.'}
          </p>
          <ol className="grid grid-cols-3 gap-2 text-[10px] sm:text-xs">
            {[
              lang === 'ar' ? 'اختر باقة النقاط' : 'Choose a points package',
              lang === 'ar' ? 'حوّل للمحفظة' : 'Make the transfer',
              lang === 'ar' ? 'أرفق الإثبات' : 'Attach the proof',
            ].map((step, index) => (
              <li
                key={step}
                className="rounded-xl border border-slate-200 bg-slate-50 p-2.5 text-slate-700 dark:border-white/10 dark:bg-[#151221] dark:text-slate-200"
              >
                <span className="me-1.5 inline-flex h-5 w-5 items-center justify-center rounded-full bg-[#8B5CF6]/15 text-[#8B5CF6] font-bold">
                  {index + 1}
                </span>
                {step}
              </li>
            ))}
          </ol>

          {manualTopupConfig.packages.length === 0 || manualTopupConfig.payment_methods.length === 0 ? (
            <div className="rounded-2xl bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800/50 p-4 text-xs leading-relaxed text-amber-900 dark:text-amber-200">
              {lang === 'ar'
                ? 'الشحن غير متاح حاليًا. سيظهر هنا بعد أن يضيف المالك باقات الشحن وبيانات التحويل من لوحة الإدارة.'
                : 'Top-ups are not available yet. The owner must configure packages and payment instructions in the admin panel.'}
            </div>
          ) : (
            <form onSubmit={handleSubmitManualTopup} className="space-y-4">
              <label className="block space-y-1.5">
                <span className="text-xs font-bold text-slate-700 dark:text-slate-200">
                  {lang === 'ar' ? 'باقة الشحن' : 'Top-up package'}
                </span>
                <select
                  value={selectedTopupPackage}
                  onChange={(e) => setSelectedTopupPackage(e.target.value)}
                  className="w-full min-h-[46px] rounded-xl border border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-[#151221] px-3 text-sm"
                  required
                >
                  {manualTopupConfig.packages.map((pack) => (
                    <option key={pack.id} value={pack.id}>
                      {lang === 'ar' ? pack.title_ar : pack.title_en} — {pack.points} {lang === 'ar' ? 'نقطة' : 'points'} · {pack.amount} {pack.currency}
                    </option>
                  ))}
                </select>
              </label>

              <label className="block space-y-1.5">
                <span className="text-xs font-bold text-slate-700 dark:text-slate-200">
                  {lang === 'ar' ? 'وسيلة الدفع' : 'Payment method'}
                </span>
                <select
                  value={selectedPaymentMethod}
                  onChange={(e) => setSelectedPaymentMethod(e.target.value)}
                  className="w-full min-h-[46px] rounded-xl border border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-[#151221] px-3 text-sm"
                  required
                >
                  {manualTopupConfig.payment_methods.map((method) => (
                    <option key={method.id} value={method.id}>
                      {lang === 'ar' ? method.title_ar : method.title_en}
                    </option>
                  ))}
                </select>
              </label>

              {(() => {
                const method = manualTopupConfig.payment_methods.find(
                  (item) => item.id === selectedPaymentMethod
                );
                const pack = manualTopupConfig.packages.find(
                  (item) => item.id === selectedTopupPackage
                );
                return (
                  <>
                    {method && (
                      <div className="rounded-2xl bg-[#2D1B69]/5 dark:bg-[#8B5CF6]/10 border border-[#8B5CF6]/20 p-4 space-y-2">
                        <p className="text-xs font-bold text-[#8B5CF6]">
                          {lang === 'ar' ? method.title_ar : method.title_en}
                        </p>
                        <p className="whitespace-pre-wrap break-words text-xs leading-relaxed text-slate-700 dark:text-slate-200">
                          {lang === 'ar' ? method.instructions_ar : method.instructions_en}
                        </p>
                      </div>
                    )}
                    {pack && (
                      <div className="rounded-xl bg-slate-50 dark:bg-[#151221] p-3 flex justify-between text-xs">
                        <span className="text-slate-500">{lang === 'ar' ? 'المطلوب تحويله' : 'Transfer amount'}</span>
                        <strong className="font-mono-num text-slate-900 dark:text-white">{pack.amount} {pack.currency}</strong>
                      </div>
                    )}
                  </>
                );
              })()}

              <label className="block space-y-1.5">
                <span className="text-xs font-bold text-slate-700 dark:text-slate-200">
                  {lang === 'ar' ? 'رقم العملية / مرجع التحويل' : 'Transaction reference'}
                </span>
                <input
                  value={transactionReference}
                  onChange={(e) => setTransactionReference(e.target.value)}
                  maxLength={100}
                  minLength={3}
                  required
                  className="w-full min-h-[46px] rounded-xl border border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-[#151221] px-3 text-sm"
                />
              </label>

              <label className="block space-y-1.5">
                <span className="text-xs font-bold text-slate-700 dark:text-slate-200">
                  {lang === 'ar' ? 'صورة إثبات الدفع (حتى 2 ميجابايت)' : 'Payment proof image (up to 2 MB)'}
                </span>
                <input
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  onChange={(e) => handleManualProofUpload(e, setPaymentProof)}
                  required={!paymentProof}
                  className="w-full text-xs text-slate-500 file:me-3 file:min-h-[40px] file:px-3 file:rounded-xl file:border-0 file:bg-slate-100 dark:file:bg-white/10 file:text-slate-700 dark:file:text-slate-200"
                />
              </label>
              {paymentProof && (
                <img
                  src={paymentProof}
                  alt={lang === 'ar' ? 'معاينة إثبات التحويل' : 'Transfer proof preview'}
                  className="max-h-48 rounded-xl border border-slate-200 dark:border-white/10 object-contain"
                />
              )}
              <button
                type="submit"
                disabled={
                  submittingTopup ||
                  !selectedTopupPackage ||
                  !selectedPaymentMethod ||
                  transactionReference.trim().length < 3 ||
                  !paymentProof
                }
                className="w-full min-h-[48px] rounded-xl bg-[#8B5CF6] disabled:opacity-50 text-white text-sm font-bold"
              >
                {submittingTopup
                  ? lang === 'ar'
                    ? 'جارٍ إرسال الطلب...'
                    : 'Submitting...'
                  : lang === 'ar'
                    ? 'إرسال طلب الشحن للمراجعة'
                    : 'Submit top-up request'}
              </button>
            </form>
          )}
        </div>

        {manualTopupRequests.length > 0 && (
          <div className="rounded-3xl bg-white dark:bg-[#1E1B2E] border border-slate-200 dark:border-white/10 p-6 space-y-3">
            <h3 className="text-base font-bold text-slate-900 dark:text-white">
              {lang === 'ar' ? 'طلبات الدفع اليدوي' : 'Manual payment requests'}
            </h3>
            <div className="divide-y divide-slate-100 dark:divide-white/10">
              {manualTopupRequests.map((request) => (
                <div key={request.id} className="py-3 flex items-start justify-between gap-3 text-xs">
                  <div className="min-w-0">
                    <p className="font-bold text-slate-900 dark:text-white">
                      {request.request_type === 'SUBSCRIPTION' &&
                        (lang === 'ar' ? 'اشتراك VIP · ' : 'VIP subscription · ')}
                      {lang === 'ar' ? request.package_title_ar : request.package_title_en}
                    </p>
                    <p className="mt-1 text-slate-500 font-mono-num">
                      {request.amount} {request.currency} · {request.points}{' '}
                      {request.request_type === 'SUBSCRIPTION'
                        ? lang === 'ar' ? 'نقطة ترحيبية' : 'bonus points'
                        : lang === 'ar' ? 'نقطة' : 'points'}
                    </p>
                    {request.premium_duration_days && (
                      <p className="mt-1 text-slate-500">
                        {lang === 'ar' ? 'مدة الاشتراك: ' : 'Subscription duration: '}
                        {request.premium_duration_days} {lang === 'ar' ? 'يوم' : 'days'}
                      </p>
                    )}
                    <p className="mt-1 text-[11px] text-slate-400 break-all">
                      {lang === 'ar' ? 'رقم العملية: ' : 'Reference: '}{request.transaction_reference}
                    </p>
                    {request.rejection_reason && (
                      <p className="mt-1 text-rose-600 dark:text-rose-300">
                        {lang === 'ar' ? 'سبب الرفض: ' : 'Rejection reason: '}{request.rejection_reason}
                      </p>
                    )}
                  </div>
                  <span
                    className={`shrink-0 rounded-full px-2.5 py-1 text-[10px] font-bold ${
                      request.status === 'APPROVED'
                        ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300'
                        : request.status === 'REJECTED'
                          ? 'bg-rose-100 text-rose-800 dark:bg-rose-950/60 dark:text-rose-300'
                          : 'bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300'
                    }`}
                  >
                    {request.status === 'PENDING'
                      ? lang === 'ar' ? 'قيد المراجعة' : 'Pending'
                      : request.status === 'APPROVED'
                        ? lang === 'ar' ? 'مقبول' : 'Approved'
                        : lang === 'ar' ? 'مرفوض' : 'Rejected'}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

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
                    {tx.amount_currency && (
                      <span className="block text-[10px] text-slate-500 font-mono-num">{tx.amount_currency}</span>
                    )}
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
            {isRealmPremiumActive(selfUser) ? t.premiumBadge : t.freeTierBadge} ·{' '}
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

        <div className="space-y-1.5">
          <label className="block text-xs font-semibold text-slate-600 dark:text-slate-300">
            {lang === 'ar' ? 'العمر (18 عامًا أو أكثر)' : 'Age (18 or older)'}
          </label>
          <input
            type="number"
            inputMode="numeric"
            min={18}
            max={120}
            step={1}
            value={age}
            onChange={(e) => setAge(e.target.value)}
            className="w-full h-11 px-3.5 rounded-xl bg-slate-50 dark:bg-[#151221] border border-slate-200 dark:border-white/10 text-sm text-slate-900 dark:text-white"
          />
          <p className="text-[11px] text-slate-500 dark:text-slate-400">
            {lang === 'ar'
              ? 'العمر الدقيق يظهر في بطاقة التعارف، ولن يُعرض للزوار المجهولين.'
              : 'Your exact age appears on introduction cards, but is hidden from anonymous link visitors.'}
          </p>
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
              const unlocked = isRealmPremiumActive(selfUser) || selfUser.unlocked_frames.includes(fr.id);
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

        {profileSaveError ? (
          <p role="alert" className="text-center text-xs font-semibold text-red-600 dark:text-red-400">
            {profileSaveError}
          </p>
        ) : saveToast ? (
          <p className="text-center text-xs font-semibold text-emerald-600 dark:text-emerald-400">
            {saveToast}
          </p>
        ) : null}
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
          فضفضة · الإصدار 3.11.0 (مستقر)
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
