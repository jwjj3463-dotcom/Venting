import React, { useEffect, useState } from 'react';
import {
  MessageCircle,
  RefreshCw,
  SkipForward,
  SlidersHorizontal,
  Crown,
  Gift,
  Radar,
  Users,
  Sparkles,
} from 'lucide-react';
import { FramedAvatar, OfficialBadge } from './FramedAvatar';
import { RealmUser } from '../db/realmLocalDB';
import { fadfadahClient, LiveMatchCandidate } from '../services/fadfadahNetworkClient';
import { AdBanner } from './AdBanner';
import {
  AppLang,
  AVAILABLE_COUNTRIES,
  AVAILABLE_LANGUAGES,
  TRANSLATIONS,
} from '../i18n/translations';

interface RandomMatchScreenProps {
  selfUser: RealmUser;
  lang: AppLang;
  onOpenChatRoom: (roomId: string) => void;
  onNavigateUpgrade: () => void;
}

const FREE_DAILY_LIMIT = 5;

function getRadarPosition(userId: string): { left: string; top: string } {
  let seed = 0;
  for (const character of userId) {
    seed = (seed * 31 + character.charCodeAt(0)) >>> 0;
  }
  const angle = (seed % 360) * (Math.PI / 180);
  const radius = 18 + (seed % 24);
  return {
    left: `${50 + Math.cos(angle) * radius}%`,
    top: `${50 + Math.sin(angle) * radius}%`,
  };
}

export const RandomMatchScreen: React.FC<RandomMatchScreenProps> = ({
  selfUser,
  lang,
  onOpenChatRoom,
  onNavigateUpgrade,
}) => {
  const t = TRANSLATIONS[lang];
  const [countryFilter, setCountryFilter] = useState<string>('ALL');
  const [langFilter, setLangFilter] = useState<string>('ALL');
  const [candidates, setCandidates] = useState<LiveMatchCandidate[]>(() =>
    fadfadahClient.getMatchCandidates()
  );
  const [stats, setStats] = useState(() => fadfadahClient.getOnlineStats());
  const [connectionState, setConnectionState] = useState(() =>
    fadfadahClient.getConnectionState()
  );
  const [candidateIndex, setCandidateIndex] = useState<number>(0);
  const [requesting, setRequesting] = useState<boolean>(false);
  const [feedbackBanner, setFeedbackBanner] = useState<string>('');
  const [quotaError, setQuotaError] = useState<string>('');

  const todayStr = new Date().toISOString().slice(0, 10);
  const usedToday = selfUser.last_random_date === todayStr ? selfUser.daily_random_count : 0;

  useEffect(() => {
    const unsub = fadfadahClient.subscribe(() => {
      setCandidates(fadfadahClient.getMatchCandidates());
      setStats(fadfadahClient.getOnlineStats());
      setConnectionState(fadfadahClient.getConnectionState());
    });

    fadfadahClient.joinMatchmakingQueue(countryFilter, langFilter);

    return () => {
      unsub();
      fadfadahClient.leaveMatchmakingQueue();
    };
  }, [countryFilter, langFilter]);

  const currentMatch =
    candidates.length > 0 ? candidates[candidateIndex % candidates.length] : null;
  const onlineCandidates = candidates.filter((candidate) => candidate.peer.is_online);

  const handleSkip = () => {
    setFeedbackBanner('');
    setQuotaError('');
    setCandidateIndex((prev) => prev + 1);
    fadfadahClient.joinMatchmakingQueue(countryFilter, langFilter);
  };

  const handleStartChat = async () => {
    if (!currentMatch || requesting) return;
    setRequesting(true);
    setQuotaError('');
    setFeedbackBanner('');

    const intro =
      lang === 'ar'
        ? `مرحباً ${currentMatch.peer.nickname}! جمعتنا المطابقة العشوائية في فضفضة.`
        : `Hi ${currentMatch.peer.nickname}! Matched with you on Fadfadah.`;

    const res = await fadfadahClient.requestRandomMatch(currentMatch.peer.id, intro);
    setRequesting(false);

    if (res.quotaReached) {
      setQuotaError(
        lang === 'ar'
          ? 'وصلت إلى الحد اليومي للحساب المجاني (5 مطابقات). قم بالترقية لحساب فضفضة المميز أو افتح 3 مطابقات مقابل 50 نقطة.'
          : 'Daily Free Tier limit reached (5 matches). Upgrade to Premium or spend 50 points.'
      );
      return;
    }

    if (!res.ok || !res.room) {
      setFeedbackBanner(res.error || (lang === 'ar' ? 'تعذر إرسال الطلب.' : 'Request failed.'));
      return;
    }

    if (res.room.status === 'ACCEPTED') {
      onOpenChatRoom(res.room.id);
    } else {
      setFeedbackBanner(
        lang === 'ar'
          ? `تم إرسال طلب محادثة حقيقي إلى ${currentMatch.peer.nickname}! ستفتح القناة فور قبوله للطلب.`
          : `Live chat request sent to ${currentMatch.peer.nickname}!`
      );
      setCandidateIndex((prev) => prev + 1);
    }
  };

  const handleUnlockExtraWithPoints = async () => {
    const res = await fadfadahClient.spendPoints({ action: 'UNLOCK_QUOTA' });
    if (res.ok) {
      setQuotaError('');
    }
  };

  return (
    <div className="p-4 sm:p-5 space-y-5 max-w-2xl mx-auto">
      <section className="relative isolate overflow-hidden rounded-[2rem] border border-violet-200/80 bg-gradient-to-br from-white via-violet-50 to-indigo-100 p-5 shadow-xl shadow-violet-950/5 dark:border-white/10 dark:from-[#211a37] dark:via-[#17142a] dark:to-[#111323] sm:p-6">
        <div className="pointer-events-none absolute -right-20 -top-24 -z-10 h-64 w-64 rounded-full bg-violet-400/20 blur-3xl dark:bg-violet-500/15" />
        <div className="pointer-events-none absolute -bottom-28 -left-20 -z-10 h-56 w-56 rounded-full bg-indigo-400/20 blur-3xl dark:bg-indigo-500/10" />

        <div className="mb-5 flex items-start justify-between gap-3">
          <div className="flex min-w-0 items-center gap-3">
            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-violet-600 text-white shadow-lg shadow-violet-900/20">
              <Radar className="h-5 w-5" />
            </span>
            <div className="min-w-0">
              <h2 className="text-sm font-extrabold text-slate-900 dark:text-white sm:text-base">
                {lang === 'ar' ? 'رادار المطابقة المباشر' : 'Live match radar'}
              </h2>
              <p className="mt-0.5 text-[11px] text-slate-500 dark:text-slate-400">
                {lang === 'ar'
                  ? 'اكتشف المستخدمين المتصلين الآن'
                  : 'Discover people online right now'}
              </p>
            </div>
          </div>
          <span className="inline-flex shrink-0 items-center gap-1.5 rounded-full border border-white/70 bg-white/70 px-2.5 py-1 text-[10px] font-bold text-slate-600 shadow-sm backdrop-blur dark:border-white/10 dark:bg-white/5 dark:text-slate-200">
            <span
              className={`h-1.5 w-1.5 rounded-full ${
                connectionState === 'connected'
                  ? 'bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.8)]'
                  : connectionState === 'connecting'
                    ? 'animate-pulse bg-amber-400'
                    : 'bg-rose-500'
              }`}
            />
            {connectionState === 'connected'
              ? t.radarLive
              : connectionState === 'connecting'
                ? t.radarConnecting
                : t.radarOffline}
          </span>
        </div>

        <div className="mb-5 grid grid-cols-2 gap-3">
          <div className="flex items-center gap-2.5 rounded-2xl border border-white/80 bg-white/70 p-3 backdrop-blur dark:border-white/10 dark:bg-black/15">
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-emerald-100 text-emerald-700 dark:bg-emerald-400/10 dark:text-emerald-300">
              <Users className="h-4 w-4" />
            </span>
            <span className="min-w-0">
              <strong className="block text-base font-extrabold leading-tight text-slate-900 dark:text-white">
                {onlineCandidates.length}
              </strong>
              <span className="block truncate text-[10px] text-slate-500 dark:text-slate-400">
                {t.radarOnlineMatches}
              </span>
            </span>
          </div>
          <div className="flex items-center gap-2.5 rounded-2xl border border-white/80 bg-white/70 p-3 backdrop-blur dark:border-white/10 dark:bg-black/15">
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-violet-100 text-violet-700 dark:bg-violet-400/10 dark:text-violet-300">
              <Sparkles className="h-4 w-4" />
            </span>
            <span className="min-w-0">
              <strong className="block text-base font-extrabold leading-tight text-slate-900 dark:text-white">
                {stats.queueSize}
              </strong>
              <span className="block truncate text-[10px] text-slate-500 dark:text-slate-400">
                {t.radarQueueUsers}
              </span>
            </span>
          </div>
        </div>

        <div className="relative mx-auto mb-4 aspect-square w-full max-w-[19rem] overflow-hidden rounded-full border border-violet-300/50 bg-[radial-gradient(circle_at_50%_42%,#322259_0%,#1b1630_58%,#121020_100%)] shadow-[inset_0_0_40px_rgba(139,92,246,0.16),0_18px_45px_rgba(45,27,105,0.18)] dark:border-violet-300/20">
          <div className="radar-pulse-ring absolute inset-[8%] rounded-full border border-violet-300/35" />
          <div className="radar-pulse-ring absolute inset-[8%] rounded-full border border-violet-300/25 [animation-delay:1.6s]" />
          <div className="radar-grid absolute inset-[8%] rounded-full border border-violet-300/20" />
          <div
            className="radar-sweep absolute inset-[8%] rounded-full"
            style={{
              background:
                'conic-gradient(from 0deg, rgba(167,139,250,0.38) 0deg, rgba(139,92,246,0.12) 36deg, rgba(139,92,246,0) 78deg, transparent 360deg)',
            }}
          />

          {onlineCandidates.slice(0, 8).map((candidate) => (
            <button
              key={candidate.peer.id}
              type="button"
              onClick={() => setCandidateIndex(candidates.indexOf(candidate))}
              aria-label={
                lang === 'ar'
                  ? `عرض المستخدم المتصل ${candidate.peer.nickname}`
                  : `View online user ${candidate.peer.nickname}`
              }
              title={candidate.peer.nickname}
              className="radar-blip absolute z-10 flex h-10 w-10 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border border-white/60 bg-violet-300/20 p-1 shadow-[0_0_16px_rgba(167,139,250,0.65)] transition-transform hover:scale-125 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-violet-300"
              style={getRadarPosition(candidate.peer.id)}
            >
              <FramedAvatar
                avatarUrl={candidate.peer.avatar_url}
                frameId={candidate.peer.frame_id}
                nickname={candidate.peer.nickname}
                size="radar"
              />
              <span
                className={`absolute bottom-0 right-0 h-2.5 w-2.5 rounded-full border-2 border-[#211936] shadow-sm ${
                  candidate.inQueue ? 'bg-emerald-300' : 'bg-violet-300'
                }`}
              />
            </button>
          ))}

          <div className="absolute left-1/2 top-1/2 z-20 flex h-[4.5rem] w-[4.5rem] -translate-x-1/2 -translate-y-1/2 flex-col items-center justify-center rounded-full border border-violet-200/30 bg-[#17132b]/90 text-violet-100 shadow-[0_0_28px_rgba(139,92,246,0.28)] backdrop-blur">
            <Radar className="h-6 w-6" />
            <span className="mt-0.5 text-[8px] font-bold tracking-[0.18em]">LIVE</span>
          </div>

          <div className="absolute inset-x-0 bottom-[9%] z-20 flex justify-center px-4">
            <span className="rounded-full border border-white/10 bg-[#120f20]/70 px-3 py-1 text-[10px] font-medium text-violet-100/85 backdrop-blur">
              {onlineCandidates.length > 0
                ? t.scanningPeers
                : t.radarNoOnlineUsers}
            </span>
          </div>
        </div>

        <div className="mb-5 flex items-center justify-between gap-3 text-[10px] text-slate-500 dark:text-slate-400">
          <span className="inline-flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-full bg-violet-300" />
            {lang === 'ar' ? 'متصل' : 'Online'}
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-full bg-emerald-300" />
            {lang === 'ar' ? 'يبحث عن مطابقة' : 'Looking for a match'}
          </span>
          <span className="font-mono-num">
            {t.dailyQuotaLabel}:{' '}
            {selfUser.is_premium ? t.unlimited : `${usedToday}/${FREE_DAILY_LIMIT}`}
          </span>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <select
            value={countryFilter}
            onChange={(e) => {
              setCountryFilter(e.target.value);
              setCandidateIndex(0);
            }}
            aria-label={t.filterCountry}
            className="h-11 rounded-xl border border-white/80 bg-white/75 px-3 text-xs font-semibold text-slate-800 shadow-sm backdrop-blur outline-none transition focus:border-violet-400 focus:ring-2 focus:ring-violet-400/20 dark:border-white/10 dark:bg-[#151221]/80 dark:text-slate-100"
          >
            <option value="ALL">{t.allCountries}</option>
            {AVAILABLE_COUNTRIES.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>

          <select
            value={langFilter}
            onChange={(e) => {
              setLangFilter(e.target.value);
              setCandidateIndex(0);
            }}
            aria-label={t.filterLanguage}
            className="h-11 rounded-xl border border-white/80 bg-white/75 px-3 text-xs font-semibold text-slate-800 shadow-sm backdrop-blur outline-none transition focus:border-violet-400 focus:ring-2 focus:ring-violet-400/20 dark:border-white/10 dark:bg-[#151221]/80 dark:text-slate-100"
          >
            <option value="ALL">{t.allLanguages}</option>
            {AVAILABLE_LANGUAGES.map((l) => (
              <option key={l} value={l}>
                {l}
              </option>
            ))}
          </select>
        </div>

      </section>

      {feedbackBanner && (
        <div className="rounded-2xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800/60 p-3.5 text-xs font-semibold text-emerald-800 dark:text-emerald-200 text-center">
          {feedbackBanner}
        </div>
      )}

      {quotaError && (
        <div className="rounded-2xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800/60 p-4 space-y-3">
          <p className="text-xs text-amber-800 dark:text-amber-200 leading-relaxed">{quotaError}</p>
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={onNavigateUpgrade}
              className="min-h-[44px] px-4 py-2 rounded-xl bg-[#2D1B69] text-white text-xs font-semibold flex items-center gap-1.5 whitespace-nowrap"
            >
              <Crown className="w-4 h-4 text-amber-300" />
              <span>{t.upgradeNow}</span>
            </button>
            {selfUser.points >= 50 && (
              <button
                type="button"
                onClick={handleUnlockExtraWithPoints}
                className="min-h-[44px] px-4 py-2 rounded-xl bg-[#8B5CF6] text-white text-xs font-semibold whitespace-nowrap"
              >
                {lang === 'ar' ? 'فتح 3 مطابقات (50 نقطة)' : 'Unlock +3 Matches (50 pts)'}
              </button>
            )}
          </div>
        </div>
      )}

      {/* Real User Match Card */}
      {currentMatch ? (
        <div className="rounded-3xl bg-white dark:bg-[#1E1B2E] border border-slate-200 dark:border-white/10 p-6 text-center space-y-4">
          <div className="flex flex-col items-center space-y-2.5">
            <FramedAvatar
              avatarUrl={currentMatch.peer.avatar_url}
              frameId={currentMatch.peer.frame_id}
              nickname={currentMatch.peer.nickname}
              size="lg"
            />
            <div>
              <h3 className="flex items-center justify-center gap-1 text-lg font-bold text-slate-900 dark:text-white">
                <span>{currentMatch.peer.nickname}</span>
                <OfficialBadge role={currentMatch.peer.role} />
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                {currentMatch.peer.languages.join(' · ')}
                {' · '}
                {currentMatch.peer.country}
                {' · '}
                {currentMatch.inQueue
                  ? lang === 'ar'
                    ? 'في الرادار الآن'
                    : 'Searching Live'
                  : currentMatch.peer.is_online
                  ? lang === 'ar'
                    ? 'متصل الآن'
                    : 'Online'
                  : lang === 'ar'
                  ? 'مسجل'
                  : 'Member'}
              </p>
            </div>
          </div>

          <p className="text-xs text-slate-600 dark:text-slate-300 max-w-md mx-auto leading-relaxed">
            {currentMatch.peer.bio}
          </p>

          <div className="py-2 border-y border-slate-100 dark:border-white/5 text-xs text-[#8B5CF6] font-medium">
            {currentMatch.peer.interests.join(' · ')}
          </div>

          <p className="text-[11px] text-slate-500 dark:text-slate-400 font-mono-num">
            {lang === 'ar'
              ? `التوافق الدلالي الحقيقي: ${Math.round(currentMatch.similarityScore * 100)}%`
              : `Compatibility Score: ${Math.round(currentMatch.similarityScore * 100)}%`}
          </p>

          <div className="grid grid-cols-2 gap-3 pt-1">
            <button
              type="button"
              disabled={requesting}
              onClick={handleStartChat}
              className="min-h-[48px] px-4 py-2.5 rounded-2xl bg-[#8B5CF6] active:scale-[0.98] disabled:opacity-50 text-white text-sm font-bold flex items-center justify-center gap-2 transition-transform whitespace-nowrap"
            >
              <MessageCircle className="w-4 h-4" />
              <span>{currentMatch.inQueue ? t.startChat : lang === 'ar' ? 'طلب محادثة' : 'Send Request'}</span>
            </button>
            <button
              type="button"
              onClick={handleSkip}
              className="min-h-[48px] px-4 py-2.5 rounded-2xl bg-slate-100 dark:bg-[#151221] active:scale-[0.98] border border-slate-200 dark:border-white/10 text-slate-700 dark:text-slate-200 text-sm font-semibold flex items-center justify-center gap-2 transition-transform whitespace-nowrap"
            >
              <SkipForward className="w-4 h-4" />
              <span>{t.skipNext}</span>
            </button>
          </div>
        </div>
      ) : (
        <div className="rounded-3xl bg-white dark:bg-[#1E1B2E] border border-slate-200 dark:border-white/10 p-7 text-center space-y-3">
          <p className="text-sm font-bold text-slate-900 dark:text-white">
            {lang === 'ar'
              ? 'أنت الآن في طابور المطابقة الحقيقي المباشر'
              : 'You are live in the real matchmaking queue'}
          </p>
          <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed max-w-md mx-auto">
            {lang === 'ar'
              ? 'بمجرد دخول مستخدم آخر من هاتف ثانٍ أو نافذة متصفح خاصة (Incognito)، سيظهر أمامك هنا فوراً لبدء محادثة حقيقية بدون أي بوتات.'
              : 'As soon as another real user connects from a second phone or private window, their card will appear immediately.'}
          </p>
          <button
            type="button"
            onClick={() => fadfadahClient.joinMatchmakingQueue(countryFilter, langFilter)}
            className="min-h-[44px] px-4 py-2 rounded-xl bg-[#8B5CF6] text-white text-xs font-semibold inline-flex items-center gap-2"
          >
            <RefreshCw className="w-4 h-4" />
            <span>{lang === 'ar' ? 'تحديث المسح الآن' : 'Refresh Scan'}</span>
          </button>
        </div>
      )}

      {/* AdMob Banner Unit */}
      <AdBanner selfUser={selfUser} lang={lang} position="inline" onOpenUpgrade={onNavigateUpgrade} />

    </div>
  );
};
