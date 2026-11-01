/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useRef, useState } from 'react';
import {
  MessageSquare,
  Compass,
  Radar,
  User as UserIcon,
  Settings,
  ShieldAlert,
  AlertTriangle,
} from 'lucide-react';
import {
  realmDB,
  RealmAppSettings,
  RealmChatRoom,
  RealmMessage,
  RealmPersonalLink,
  RealmPublicVent,
  RealmUser,
} from './db/realmLocalDB';
import { fadfadahClient } from './services/fadfadahNetworkClient';
import {
  initNativeAndroidSystemBars,
  registerAndroidHardwareBackButton,
} from './services/androidNative';
import { UnifiedInboxScreen } from './components/UnifiedInboxScreen';
import { ChatRoomView } from './components/ChatRoomView';
import { RandomMatchScreen } from './components/RandomMatchScreen';
import { ExploreVentScreen } from './components/ExploreVentScreen';
import { ProfileAndSettingsScreen } from './components/ProfileAndSettingsScreen';
import { AnonymousWebGatewayModal } from './components/AnonymousWebGatewayModal';
import { AdInterstitialModal } from './components/AdInterstitialModal';
import { AndroidAppUpdatePrompt } from './components/AndroidAppUpdatePrompt';
import { AccountAccessScreen } from './components/AccountAccessScreen';
import { adService } from './services/adService';
import { TRANSLATIONS } from './i18n/translations';

type PrimaryTab = 'chats' | 'match' | 'explore' | 'profile';

export default function App() {
  const [ready, setReady] = useState(false);
  const [bootError, setBootError] = useState('');
  const [accountAccessRequired, setAccountAccessRequired] = useState(false);
  const [firebaseLinkRequired, setFirebaseLinkRequired] = useState(false);
  const [accountAccessBusy, setAccountAccessBusy] = useState(false);
  const [accountAccessError, setAccountAccessError] = useState('');
  const [recoveryCodeToSave, setRecoveryCodeToSave] = useState('');
  const [ownerRecoveryToken, setOwnerRecoveryToken] = useState('');
  const [ownerRecoveryBusy, setOwnerRecoveryBusy] = useState(false);
  const [bootAttempt, setBootAttempt] = useState(0);
  const [tick, setTick] = useState(0);

  const [activeTab, setActiveTab] = useState<PrimaryTab>('chats');
  const [profileSubSection, setProfileSubSection] = useState<
    'main' | 'monetization' | 'realm_android' | 'admin_portal'
  >('main');
  const [activeRoomId, setActiveRoomId] = useState<string | null>(null);
  const [gatewayTargetSlug, setGatewayTargetSlug] = useState<string | null>(null);
  const [showInterstitial, setShowInterstitial] = useState<boolean>(false);

  // Refs for Android hardware back button state navigation
  const navStateRef = useRef({
    activeRoomId: null as string | null,
    gatewayTargetSlug: null as string | null,
    activeTab: 'chats' as PrimaryTab,
  });
  navStateRef.current = { activeRoomId, gatewayTargetSlug, activeTab };

  useEffect(() => {
    let cancelled = false;
    let unsubRealm = () => {};
    let unsubNet = () => {};

    const bootstrap = async () => {
      try {
        const hasSession = await fadfadahClient.bootstrapSessionAndSync();
        if (cancelled) return;
        unsubRealm = realmDB.addListener(() => setTick((v) => v + 1));
        unsubNet = fadfadahClient.subscribe(() => {
          setTick((v) => v + 1);
          if (!realmDB.getSettings().auth_token) {
            setAccountAccessRequired(true);
          }
        });
        setAccountAccessRequired(!hasSession);
        setReady(true);
        const pendingRecoveryCode = realmDB.getSettings().pending_recovery_code;
        if (pendingRecoveryCode) setRecoveryCodeToSave(pendingRecoveryCode);

        const params = new URLSearchParams(window.location.search);
        const sharedSlug = params.get('u');
        if (sharedSlug) {
          setGatewayTargetSlug(sharedSlug);
        }
      } catch (err) {
        if (!cancelled) {
          const pendingRecoveryCode = realmDB.getSettings().pending_recovery_code;
          if (pendingRecoveryCode) setRecoveryCodeToSave(pendingRecoveryCode);
          setBootError(err instanceof Error ? err.message : 'تعذر تهيئة التطبيق');
        }
      }
    };

    void bootstrap();

    // Native Android Hardware Back Button Handling
    const cleanupBack = registerAndroidHardwareBackButton(() => {
      const current = navStateRef.current;
      if (current.gatewayTargetSlug) {
        setGatewayTargetSlug(null);
        return true;
      }
      if (current.activeRoomId) {
        setActiveRoomId(null);
        return true;
      }
      if (current.activeTab !== 'chats') {
        setActiveTab('chats');
        return true;
      }
      return false; // Let Android minimize app from root inbox screen
    });

    return () => {
      cancelled = true;
      unsubRealm();
      unsubNet();
      cleanupBack();
    };
  }, [bootAttempt]);

  const settings: RealmAppSettings = ready
    ? realmDB.getSettings()
    : { id: 'global', theme: 'dark', language: 'ar', auth_token: '', custom_server_url: '' };

  useEffect(() => {
    const html = document.documentElement;
    const isDark = settings.theme === 'dark';
    if (isDark) html.classList.add('dark');
    else html.classList.remove('dark');
    html.dir = settings.language === 'ar' ? 'rtl' : 'ltr';
    html.lang = settings.language;
    initNativeAndroidSystemBars(isDark);
  }, [settings.theme, settings.language, tick]);

  const selfUser: RealmUser | undefined = ready ? realmDB.findSelfUser() : undefined;
  const personalLink: RealmPersonalLink | undefined = ready
    ? realmDB.findPersonalLink()
    : undefined;

  const handleAccountAccess = async (action: () => Promise<string>) => {
    setAccountAccessBusy(true);
    setAccountAccessError('');
    try {
      const code = await action();
      setRecoveryCodeToSave(code);
      setAccountAccessRequired(false);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      const pendingRecoveryCode = realmDB.getSettings().pending_recovery_code;
      if (pendingRecoveryCode) {
        setRecoveryCodeToSave(pendingRecoveryCode);
        setAccountAccessRequired(false);
      }
      setAccountAccessError(message);
    } finally {
      setAccountAccessBusy(false);
    }
  };

  const handleFirebaseAction = async (action: () => Promise<string | void>) => {
    setAccountAccessBusy(true);
    setAccountAccessError('');
    try {
      const recoveryCode = await action();
      if (recoveryCode) {
        setRecoveryCodeToSave(recoveryCode);
      } else {
        setAccountAccessRequired(false);
      }
    } catch (err) {
      setAccountAccessError(err instanceof Error ? err.message : String(err));
    } finally {
      setAccountAccessBusy(false);
    }
  };

  const handleGoogleAccountAccess = async (idToken: string): Promise<string | void> => {
    try {
      await fadfadahClient.loginWithFirebase(idToken);
    } catch (error) {
      if (!(error instanceof Error) || !error.message.includes('HTTP 404')) throw error;
      return fadfadahClient.registerWithFirebase(idToken);
    }
  };

  const handleFirebaseLink = async (idToken: string) => {
    setAccountAccessBusy(true);
    setAccountAccessError('');
    try {
      await fadfadahClient.linkFirebaseIdentity(idToken);
      setFirebaseLinkRequired(false);
    } catch (error) {
      setAccountAccessError(error instanceof Error ? error.message : String(error));
    } finally {
      setAccountAccessBusy(false);
    }
  };

  const handleRecoveryCodeAcknowledged = async () => {
    try {
      await fadfadahClient.dismissPendingRecoveryCode();
      setRecoveryCodeToSave('');
    } catch (err) {
      setAccountAccessError(err instanceof Error ? err.message : String(err));
    }
  };

  const handleReplacementOwnerClaim = async () => {
    setOwnerRecoveryBusy(true);
    setAccountAccessError('');
    try {
      await fadfadahClient.claimReplacementOwner(ownerRecoveryToken);
      setOwnerRecoveryToken('');
      await handleRecoveryCodeAcknowledged();
    } catch (err) {
      setAccountAccessError(err instanceof Error ? err.message : String(err));
    } finally {
      setOwnerRecoveryBusy(false);
    }
  };

  if (bootError && !recoveryCodeToSave) {
    return (
      <div className="h-[100dvh] flex items-center justify-center p-6 bg-[#F8F9FA] dark:bg-[#151221]">
        <div className="max-w-sm w-full rounded-3xl bg-white dark:bg-[#1E1B2E] border border-rose-300 dark:border-rose-800 p-6 text-center space-y-3">
          <p className="text-base font-bold text-rose-600">خطأ في تهيئة تطبيق فضفضة</p>
          <p className="text-xs text-slate-600 dark:text-slate-300">{bootError}</p>
          <button
            type="button"
            onClick={() => {
              setBootError('');
              setReady(false);
              setBootAttempt((attempt) => attempt + 1);
            }}
            className="min-h-[44px] px-5 rounded-xl bg-[#8B5CF6] text-xs font-bold text-white"
          >
            إعادة المحاولة
          </button>
        </div>
      </div>
    );
  }

  if (recoveryCodeToSave) {
    return (
      <main className="min-h-[100dvh] flex items-center justify-center p-5 bg-[#2D1B69] text-white">
        <section className="w-full max-w-md rounded-3xl bg-[#1E1B2E] border border-white/10 p-6 space-y-5 shadow-2xl">
          <h1 className="text-xl font-bold text-center">احفظ رمز استرداد حسابك</h1>
          <p className="text-sm text-purple-200 leading-relaxed">
            هذا الرمز هو الطريقة الوحيدة لاستعادة حسابك بعد حذف التطبيق أو
            استخدام جهاز جديد. احتفظ به في مكان آمن؛ لن يظهر مرة أخرى.
          </p>
          <code
            dir="ltr"
            className="block rounded-xl bg-black/40 p-4 text-center text-sm font-mono break-all select-all"
          >
            {recoveryCodeToSave}
          </code>
          <div className="space-y-2 border-t border-white/10 pt-4">
            <label htmlFor="owner-recovery-token" className="block text-xs font-semibold">
              تفعيل حساب المالك (إجراء لمرة واحدة)
            </label>
            <p className="text-xs text-purple-200 leading-relaxed">
              يتطلب رمزًا مؤقتًا عيّنه مشغّل الخادم. عند نجاح التفعيل ستُحذف
              بيانات حساب المالك السابق نهائيًا.
            </p>
            <input
              id="owner-recovery-token"
              type="password"
              autoComplete="new-password"
              dir="ltr"
              value={ownerRecoveryToken}
              onChange={(event) => setOwnerRecoveryToken(event.target.value)}
              placeholder="Server owner recovery token"
              className="w-full h-11 px-3 rounded-xl bg-black/30 border border-white/15 text-sm font-mono"
            />
            <button
              type="button"
              disabled={ownerRecoveryBusy || !ownerRecoveryToken.trim()}
              onClick={() => void handleReplacementOwnerClaim()}
              className="w-full min-h-[44px] rounded-xl bg-amber-500 disabled:opacity-50 text-slate-950 font-bold text-sm"
            >
              {ownerRecoveryBusy ? 'جارٍ التفعيل...' : 'تفعيل صلاحية المالك'}
            </button>
          </div>
          <button
            type="button"
            disabled={ownerRecoveryBusy}
            onClick={() => void handleRecoveryCodeAcknowledged()}
            className="w-full min-h-[46px] rounded-xl bg-[#8B5CF6] disabled:opacity-50 font-bold text-sm"
          >
            حفظت الرمز، متابعة
          </button>
          {accountAccessError && (
            <p role="alert" className="text-xs text-rose-300 text-center">
              {accountAccessError}
            </p>
          )}
        </section>
      </main>
    );
  }

  if (accountAccessRequired) {
    return (
      <AccountAccessScreen
        busy={accountAccessBusy}
        error={accountAccessError}
        onFirebaseLogin={(idToken) =>
          void handleFirebaseAction(() => fadfadahClient.loginWithFirebase(idToken))
        }
        onFirebaseRegister={(idToken) =>
          void handleFirebaseAction(() => fadfadahClient.registerWithFirebase(idToken))
        }
        onGoogleAuth={(idToken) =>
          void handleFirebaseAction(() => handleGoogleAccountAccess(idToken))
        }
        onCreateAccount={() =>
          void handleAccountAccess(() => fadfadahClient.createFreshDeviceAccount())
        }
        onRecoverAccount={(code) =>
          void handleAccountAccess(() => fadfadahClient.recoverAccount(code))
        }
      />
    );
  }

  if (firebaseLinkRequired) {
    return (
      <AccountAccessScreen
        busy={accountAccessBusy}
        error={accountAccessError}
        purpose="link"
        onFirebaseLogin={() => {}}
        onFirebaseRegister={() => {}}
        onGoogleAuth={() => {}}
        onLinkFirebase={handleFirebaseLink}
        onCancelLink={() => setFirebaseLinkRequired(false)}
        onCreateAccount={() => {}}
        onRecoverAccount={() => {}}
      />
    );
  }

  if (!ready || !selfUser || !personalLink) {
    return (
      <div className="h-[100dvh] flex items-center justify-center bg-[#2D1B69] text-white">
        <div className="flex flex-col items-center gap-3">
          <div className="w-16 h-16 rounded-3xl bg-[#8B5CF6] flex items-center justify-center text-white font-bold text-2xl shadow-lg">
            ف
          </div>
          <p className="text-sm font-bold tracking-wide">فضفضة</p>
          <p className="text-xs text-purple-200/80">جارٍ الاتصال ومزامنة البيانات...</p>
        </div>
      </div>
    );
  }

  if (selfUser.status === 'banned') {
    return (
      <div className="h-[100dvh] flex items-center justify-center p-6 bg-[#F8F9FA] dark:bg-[#151221]">
        <div className="max-w-md w-full rounded-3xl bg-white dark:bg-[#1E1B2E] border border-rose-300 dark:border-rose-900 p-6 text-center space-y-4 shadow-xl">
          <div className="w-16 h-16 rounded-full bg-rose-100 dark:bg-rose-950/60 text-rose-600 flex items-center justify-center mx-auto">
            <ShieldAlert className="w-8 h-8" />
          </div>
          <h2 className="text-lg font-bold text-rose-600">
            {settings.language === 'ar' ? 'تم حظر هذا الحساب نهائياً' : 'Account Permanently Banned'}
          </h2>
          <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
            {selfUser.ban_reason ||
              (settings.language === 'ar'
                ? 'تم حظر حسابك بقرار من طاقم الإشراف لمخالفة معايير الأمان وشروط الاستخدام.'
                : 'Your account was banned for violating safety and community guidelines.')}
          </p>
          <button
            type="button"
            onClick={() => fadfadahClient.deleteAccountPermanently()}
            className="min-h-[44px] px-5 rounded-xl bg-slate-200 dark:bg-white/10 text-xs font-semibold text-slate-800 dark:text-slate-200"
          >
            {settings.language === 'ar' ? 'مسح وإنشاء هوية جديدة' : 'Reset Account'}
          </button>
        </div>
      </div>
    );
  }

  if (
    selfUser.status === 'suspended' &&
    selfUser.suspension_until &&
    selfUser.suspension_until > Date.now()
  ) {
    const hoursLeft = Math.ceil((selfUser.suspension_until - Date.now()) / 3600000);
    return (
      <div className="h-[100dvh] flex items-center justify-center p-6 bg-[#F8F9FA] dark:bg-[#151221]">
        <div className="max-w-md w-full rounded-3xl bg-white dark:bg-[#1E1B2E] border border-purple-300 dark:border-purple-900 p-6 text-center space-y-4 shadow-xl">
          <div className="w-16 h-16 rounded-full bg-purple-100 dark:bg-purple-950/60 text-[#8B5CF6] flex items-center justify-center mx-auto">
            <ShieldAlert className="w-8 h-8" />
          </div>
          <h2 className="text-lg font-bold text-slate-900 dark:text-white">
            {settings.language === 'ar' ? 'تم تعليق حسابك مؤقتاً' : 'Account Temporarily Suspended'}
          </h2>
          <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
            {selfUser.ban_reason ||
              (settings.language === 'ar'
                ? `الحساب موقوف مؤقتاً لمراجعة مخالفة إشرافية. متبقي: ${hoursLeft} ساعة.`
                : `Account suspended pending review. Remaining: ${hoursLeft} hours.`)}
          </p>
          <p className="text-[11px] text-slate-400 font-mono-num">
            {new Date(selfUser.suspension_until).toLocaleString()}
          </p>
        </div>
      </div>
    );
  }

  const allUsers: RealmUser[] = realmDB.objects('users');
  const allRooms: RealmChatRoom[] = realmDB.objects('chat_rooms');
  const allMessages: RealmMessage[] = realmDB.objects('messages');
  const allVents: RealmPublicVent[] = realmDB.objects('public_vents');

  const lang = settings.language;
  const t = TRANSLATIONS[lang];

  const totalUnreadCount = allRooms
    .filter((r) => r.status !== 'BLOCKED')
    .reduce(
      (sum, r) =>
        sum +
        (r.status === 'PENDING'
          ? r.participant_b === selfUser.id
            ? 1
            : 0
          : r.unread_count),
      0
    );

  const selectedRoom = activeRoomId
    ? allRooms.find((r) => r.id === activeRoomId && r.status !== 'BLOCKED') ?? null
    : null;

  const selectedRoomPeer = selectedRoom
    ? allUsers.find(
        (u) =>
          u.id ===
          (selectedRoom.participant_a === selfUser.id
            ? selectedRoom.participant_b
            : selectedRoom.participant_a)
      ) ?? null
    : null;

  const selectedRoomMessages = selectedRoom
    ? allMessages
        .filter((m) => m.room_id === selectedRoom.id)
        .sort((a, b) => a.created_at - b.created_at)
    : [];

  const handleToggleTheme = async () => {
    await realmDB.write((tx) => {
      tx.create('app_settings', {
        ...settings,
        theme: settings.theme === 'dark' ? 'light' : 'dark',
      });
    });
  };

  const handleToggleLanguage = async () => {
    await realmDB.write((tx) => {
      tx.create('app_settings', {
        ...settings,
        language: settings.language === 'ar' ? 'en' : 'ar',
      });
    });
  };

  const handleOpenRoom = (roomId: string) => {
    setActiveRoomId(roomId);
    setActiveTab('chats');
  };

  const handleCloseRoom = () => {
    setActiveRoomId(null);
    if (adService.canShowInterstitial(selfUser)) {
      setShowInterstitial(true);
    }
  };

  const handleNavigateUpgrade = () => {
    setProfileSubSection('monetization');
    setActiveRoomId(null);
    setActiveTab('profile');
  };

  return (
    <div className="h-[100dvh] w-full overflow-hidden flex flex-col lg:grid lg:grid-cols-12 bg-[#F8F9FA] dark:bg-[#151221] text-[#1F2937] dark:text-[#F3F4F6]">
      {/* Native Android Primary Pane (Full screen on Android phone; Left pane on Android Tablet / Wide Screen) */}
      <section
        className={`lg:col-span-5 xl:col-span-4 h-full flex flex-col lg:border-e border-slate-200 dark:border-white/10 overflow-hidden ${
          selectedRoom && activeTab === 'chats' ? 'hidden lg:flex' : 'flex'
        }`}
      >
        {/* Native Android App Bar */}
        <header className="pt-safe min-h-[56px] px-4 bg-[#2D1B69] text-white flex items-center justify-between border-b border-white/10 shrink-0">
          <button
            type="button"
            onClick={handleNavigateUpgrade}
            className="min-h-[44px] px-2 -mx-2 text-xs font-mono-num font-bold text-amber-300 flex items-center gap-1 whitespace-nowrap"
          >
            <span>{selfUser.points}</span>
            <span>{lang === 'ar' ? 'نقطة' : 'pts'}</span>
          </button>

          <h1 className="text-base font-bold truncate">
            {activeTab === 'chats'
              ? t.appName
              : activeTab === 'match'
              ? t.randomMatchTitle
              : activeTab === 'explore'
              ? t.exploreTitle
              : t.profileTitle}
          </h1>

          <div className="flex items-center gap-1 -mx-2">
            {selfUser.role === 'owner' || selfUser.role === 'moderator' ? (
              <button
                type="button"
                onClick={() => {
                  setProfileSubSection('admin_portal');
                  setActiveTab('profile');
                  setActiveRoomId(null);
                }}
                aria-label={t.adminPanelTitle}
                title={t.adminPanelTitle}
                className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded-full active:bg-white/15 text-amber-300 transition-colors"
              >
                <ShieldAlert className="w-5 h-5" />
              </button>
            ) : null}

            <button
              type="button"
              onClick={() => {
                setProfileSubSection('main');
                setActiveTab('profile');
                setActiveRoomId(null);
              }}
              aria-label={t.profileTitle}
              title={t.profileTitle}
              className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded-full active:bg-white/15 transition-colors"
            >
              <Settings className="w-5 h-5 text-purple-200" />
            </button>
          </div>
        </header>

        {/* Real Moderation Warning / Restriction Banner */}
        {selfUser.status === 'warned' && selfUser.warning_message && (
          <div className="bg-amber-500 text-slate-950 px-4 py-2 text-xs font-semibold flex items-center gap-2 shrink-0">
            <AlertTriangle className="w-4 h-4 shrink-0 text-slate-950" />
            <span className="flex-1 leading-snug">
              {lang === 'ar'
                ? `إنذار إشرافي: ${selfUser.warning_message}`
                : `Official Warning: ${selfUser.warning_message}`}
            </span>
          </div>
        )}

        {selfUser.status === 'restricted' && (
          <div className="bg-orange-600 text-white px-4 py-2 text-xs font-semibold flex items-center gap-2 shrink-0">
            <AlertTriangle className="w-4 h-4 shrink-0 text-white" />
            <span className="flex-1 leading-snug">
              {lang === 'ar'
                ? `الحساب مقيد: ${selfUser.restriction_reason || 'تم تقييد حسابك من المطابقة والنشر بقرار إشرافي.'}`
                : `Account Restricted: ${selfUser.restriction_reason || 'Your account is restricted.'}`}
            </span>
          </div>
        )}

        {/* Scrollable Active Tab Body */}
        <div className="flex-1 overflow-y-auto">
          {activeTab === 'chats' && (
            <UnifiedInboxScreen
              selfUser={selfUser}
              allUsers={allUsers}
              personalLink={personalLink}
              rooms={allRooms}
              activeRoomId={activeRoomId}
              lang={lang}
              onSelectRoom={handleOpenRoom}
              onOpenGatewayModal={() => setGatewayTargetSlug(personalLink.slug)}
              onOpenUpgrade={handleNavigateUpgrade}
            />
          )}

          {activeTab === 'match' && (
            <RandomMatchScreen
              selfUser={selfUser}
              lang={lang}
              onOpenChatRoom={handleOpenRoom}
              onNavigateUpgrade={handleNavigateUpgrade}
            />
          )}

          {activeTab === 'explore' && (
            <ExploreVentScreen
              selfUser={selfUser}
              allUsers={allUsers}
              vents={allVents}
              lang={lang}
              onOpenChatRoom={handleOpenRoom}
            />
          )}

          {activeTab === 'profile' && (
            <ProfileAndSettingsScreen
              key={`${profileSubSection}-${selfUser.id}`}
              selfUser={selfUser}
              personalLink={personalLink}
              settings={settings}
              onLinkAccount={() => {
                setAccountAccessError('');
                setFirebaseLinkRequired(true);
              }}
              onToggleTheme={handleToggleTheme}
              onToggleLanguage={handleToggleLanguage}
              initialSubSection={profileSubSection}
            />
          )}
        </div>

        {/* Native Android Bottom Navigation Bar */}
        <nav className="pb-safe min-h-[64px] bg-white dark:bg-[#1E1B2E] border-t border-slate-200 dark:border-white/10 grid grid-cols-4 items-center shrink-0">
          {(
            [
              { id: 'chats', label: t.navChats, icon: MessageSquare, badge: totalUnreadCount },
              { id: 'match', label: t.navMatch, icon: Radar, badge: 0 },
              { id: 'explore', label: t.navExplore, icon: Compass, badge: 0 },
              { id: 'profile', label: t.navProfile, icon: UserIcon, badge: 0 },
            ] as const
          ).map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => {
                  if (tab.id === 'profile') setProfileSubSection('main');
                  setActiveTab(tab.id);
                }}
                className={`min-h-[52px] flex flex-col items-center justify-center relative transition-colors ${
                  isActive
                    ? 'text-[#8B5CF6]'
                    : 'text-slate-500 dark:text-slate-400 active:text-slate-800 dark:active:text-slate-200'
                }`}
              >
                <div className="relative">
                  <Icon className="w-5 h-5" />
                  {tab.badge > 0 && (
                    <span className="absolute -top-1.5 -right-2.5 min-w-[16px] h-4 px-1 rounded-full bg-[#8B5CF6] text-white text-[10px] font-mono-num font-bold flex items-center justify-center">
                      {tab.badge}
                    </span>
                  )}
                </div>
                <span className="text-[11px] font-semibold mt-1 whitespace-nowrap">
                  {tab.label}
                </span>
              </button>
            );
          })}
        </nav>
      </section>

      {/* Native Android Conversation Pane (Full screen slide-in on Phone; Right Split Pane on Tablet/Wide) */}
      <section
        className={`lg:col-span-7 xl:col-span-8 h-full flex flex-col bg-[#F8F9FA] dark:bg-[#151221] overflow-hidden ${
          selectedRoom && activeTab === 'chats' ? 'flex' : 'hidden lg:flex'
        }`}
      >
        {selectedRoom && selectedRoomPeer ? (
          <ChatRoomView
            room={selectedRoom}
            selfUser={selfUser}
            peerUser={selectedRoomPeer}
            messages={selectedRoomMessages}
            lang={lang}
            onBack={handleCloseRoom}
          />
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center p-8 text-center space-y-4">
            <div className="w-16 h-16 rounded-3xl bg-[#2D1B69] text-white flex items-center justify-center shadow-sm">
              <MessageSquare className="w-8 h-8 text-[#A78BFA]" />
            </div>
            <div className="space-y-1.5 max-w-sm">
              <h2 className="text-lg font-bold text-slate-900 dark:text-white">
                {lang === 'ar' ? 'فضفضة — تواصل حقيقي وآمن' : 'Fadfadah — Real Anonymous Chat'}
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
                {lang === 'ar'
                  ? 'شارك رابطك الشخصي لاستقبال رسائل حقيقية، أو افتح رادار المطابقة للتواصل المباشر مع المتصلين الآن.'
                  : 'Share your personal link to receive real secret messages, or open the Match Radar to connect live.'}
              </p>
            </div>
            <button
              type="button"
              onClick={() => setActiveTab('match')}
              className="min-h-[46px] px-6 py-2.5 rounded-2xl bg-[#8B5CF6] active:scale-[0.98] text-white text-xs font-bold transition-transform whitespace-nowrap"
            >
              {t.randomMatchTitle}
            </button>
          </div>
        )}
      </section>

      {/* Real Secret Link Gateway Modal (For /u/:slug or ?u=slug) */}
      <AnonymousWebGatewayModal
        isOpen={Boolean(gatewayTargetSlug)}
        targetSlug={gatewayTargetSlug || ''}
        fallbackTargetUser={
          gatewayTargetSlug === personalLink.slug ? selfUser : undefined
        }
        onClose={() => {
          setGatewayTargetSlug(null);
          if (window.location.search.includes('u=')) {
            window.history.replaceState({}, '', window.location.pathname);
          }
        }}
        lang={lang}
        onMessageCreatedRoom={(newRoomId) => {
          handleOpenRoom(newRoomId);
        }}
      />

      {/* Google AdMob Fullscreen Interstitial Ad */}
      <AdInterstitialModal
        isOpen={showInterstitial}
        lang={lang}
        onClose={() => setShowInterstitial(false)}
      />
      <AndroidAppUpdatePrompt />
    </div>
  );
}
