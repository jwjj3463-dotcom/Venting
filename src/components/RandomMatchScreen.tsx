import React, { useEffect, useState } from 'react';
import { RefreshCw, MessageCircle, SkipForward, SlidersHorizontal, Crown, Gift, Play } from 'lucide-react';
import { FramedAvatar } from './FramedAvatar';
import { RealmUser } from '../db/realmLocalDB';
import { fadfadahClient, LiveMatchCandidate } from '../services/fadfadahNetworkClient';
import { AdBanner } from './AdBanner';
import { AdRewardedModal } from './AdRewardedModal';
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
  const [candidateIndex, setCandidateIndex] = useState<number>(0);
  const [requesting, setRequesting] = useState<boolean>(false);
  const [feedbackBanner, setFeedbackBanner] = useState<string>('');
  const [quotaError, setQuotaError] = useState<string>('');
  const [showRewardedModal, setShowRewardedModal] = useState<boolean>(false);

  const todayStr = new Date().toISOString().slice(0, 10);
  const usedToday = selfUser.last_random_date === todayStr ? selfUser.daily_random_count : 0;

  useEffect(() => {
    const unsub = fadfadahClient.subscribe(() => {
      setCandidates(fadfadahClient.getMatchCandidates());
      setStats(fadfadahClient.getOnlineStats());
    });

    fadfadahClient.joinMatchmakingQueue(countryFilter, langFilter);

    return () => {
      unsub();
      fadfadahClient.leaveMatchmakingQueue();
    };
  }, [countryFilter, langFilter]);

  const currentMatch =
    candidates.length > 0 ? candidates[candidateIndex % candidates.length] : null;

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
      {/* Live Criteria Filter Bar */}
      <div className="rounded-2xl bg-white dark:bg-[#1E1B2E] border border-slate-200 dark:border-white/10 p-4 space-y-3">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 text-xs font-semibold text-slate-700 dark:text-slate-200">
            <SlidersHorizontal className="w-4 h-4 text-[#8B5CF6]" />
            <span>{lang === 'ar' ? 'رادار المطابقة الحقيقي المباشر' : 'Live Match Radar'}</span>
          </div>
          <span className="text-xs text-slate-500 dark:text-slate-400 font-mono-num">
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
            className="h-11 px-3 rounded-xl bg-slate-50 dark:bg-[#151221] border border-slate-200 dark:border-white/10 text-xs font-medium text-slate-800 dark:text-slate-100"
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
            className="h-11 px-3 rounded-xl bg-slate-50 dark:bg-[#151221] border border-slate-200 dark:border-white/10 text-xs font-medium text-slate-800 dark:text-slate-100"
          >
            <option value="ALL">{t.allLanguages}</option>
            {AVAILABLE_LANGUAGES.map((l) => (
              <option key={l} value={l}>
                {l}
              </option>
            ))}
          </select>
        </div>

        <p className="text-[11px] text-slate-500 dark:text-slate-400 font-mono-num">
          {lang === 'ar'
            ? `المتصلون بالسيرفر الآن: ${stats.onlineCount} · يبحثون في الرادار: ${stats.queueSize}`
            : `Online now: ${stats.onlineCount} · In live queue: ${stats.queueSize}`}
        </p>
      </div>

      {/* Radar Animation */}
      <div className="flex flex-col items-center justify-center py-1">
        <div className="relative w-40 h-40 flex items-center justify-center">
          <div className="absolute inset-0 rounded-full bg-[#8B5CF6]/15 animate-radar-ring-1" />
          <div className="absolute inset-3 rounded-full bg-[#8B5CF6]/20 animate-radar-ring-2" />
          <div className="relative w-32 h-32 rounded-full bg-[#EDE9FE] dark:bg-[#251E3E] border border-[#8B5CF6]/30 flex items-center justify-center overflow-hidden">
            <div
              className="absolute inset-0 animate-radar-sweep"
              style={{
                background:
                  'conic-gradient(from 0deg, rgba(139,92,246,0.36) 0deg, rgba(139,92,246,0) 75deg, rgba(139,92,246,0) 360deg)',
              }}
            />
            <div className="w-16 h-16 rounded-full border border-[#8B5CF6]/40 flex items-center justify-center">
              <div className="w-3.5 h-3.5 rounded-full bg-[#2D1B69] dark:bg-[#8B5CF6]" />
            </div>
          </div>
        </div>
        <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">{t.scanningPeers}</p>
      </div>

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
            <button
              type="button"
              onClick={() => setShowRewardedModal(true)}
              className="min-h-[44px] px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-bold flex items-center gap-1.5 whitespace-nowrap shadow-sm active:scale-95 transition-transform"
            >
              <Gift className="w-4 h-4 fill-current" />
              <span>{lang === 'ar' ? 'مشاهدة إعلان (+25 نقطة مجاناً)' : 'Watch Ad (+25 free pts)'}</span>
            </button>
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
              <h3 className="text-lg font-bold text-slate-900 dark:text-white">
                {currentMatch.peer.nickname}
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

      {/* Rewarded Video Ad Modal */}
      <AdRewardedModal
        isOpen={showRewardedModal}
        lang={lang}
        onClose={() => setShowRewardedModal(false)}
        onRewardClaimed={(pts) => {
          setFeedbackBanner(
            lang === 'ar'
              ? `تهانينا! حصلت على +${pts} نقطة رصيد مجانية بنجاح 🎉`
              : `Earned +${pts} free points!`
          );
        }}
      />
    </div>
  );
};
