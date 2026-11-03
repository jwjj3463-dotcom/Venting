import React, { useEffect, useState } from 'react';
import { Compass, Heart, RefreshCw, SlidersHorizontal, UserRound } from 'lucide-react';
import { AVAILABLE_COUNTRIES, AVAILABLE_INTERESTS, AVAILABLE_LANGUAGES, AppLang } from '../i18n/translations';
import { RealmUser } from '../db/realmLocalDB';
import { DiscoveryCandidateDTO, fadfadahClient } from '../services/fadfadahNetworkClient';
import { FramedAvatar, OfficialBadge } from './FramedAvatar';

interface SmartDiscoveryScreenProps {
  selfUser: RealmUser;
  lang: AppLang;
  onOpenProfile: () => void;
}

export const SmartDiscoveryScreen: React.FC<SmartDiscoveryScreenProps> = ({
  selfUser,
  lang,
  onOpenProfile,
}) => {
  const isArabic = lang === 'ar';
  const [candidates, setCandidates] = useState<DiscoveryCandidateDTO[]>([]);
  const [selectedInterests, setSelectedInterests] = useState<string[]>([]);
  const [country, setCountry] = useState('');
  const [language, setLanguage] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [sendingTo, setSendingTo] = useState('');

  const loadCandidates = async () => {
    setLoading(true);
    setError('');
    try {
      const results = await fadfadahClient.discoverPeople({
        interests: selectedInterests,
        country,
        language,
      });
      setCandidates(results);
    } catch (loadError) {
      setError(
        loadError instanceof Error
          ? loadError.message
          : isArabic
            ? 'تعذر تحميل اقتراحات التعارف.'
            : 'Could not load discovery suggestions.'
      );
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadCandidates();
  }, [selectedInterests, country, language]);

  const toggleInterest = (interest: string) => {
    setSelectedInterests((current) =>
      current.includes(interest)
        ? current.filter((value) => value !== interest)
        : current.length < 3
          ? [...current, interest]
          : current
    );
  };

  const sendRequest = async (candidate: DiscoveryCandidateDTO) => {
    if (sendingTo) return;
    setSendingTo(candidate.peer.id);
    setNotice('');
    const opening = isArabic
      ? `مرحبًا ${candidate.peer.nickname}، وجدت أن لدينا اهتمامات مشتركة وأود التعارف إذا رغبت.`
      : `Hi ${candidate.peer.nickname}, I noticed we share some interests and would enjoy meeting if you’re open to it.`;
    try {
      const result = await fadfadahClient.createInterestRequest(candidate.peer.id, opening);
      if (!result.ok) {
        setNotice(result.error || (isArabic ? 'تعذر إرسال الطلب.' : 'Could not send request.'));
      } else {
        setNotice(
          isArabic
            ? `أُرسل طلب التعارف إلى ${candidate.peer.nickname}. لن تبدأ المحادثة إلا بعد موافقته.`
            : `Your introduction request was sent to ${candidate.peer.nickname}. Chat starts only after acceptance.`
        );
      }
    } catch (sendError) {
      setNotice(sendError instanceof Error ? sendError.message : 'Could not send request.');
    } finally {
      setSendingTo('');
    }
  };

  if (!Number.isInteger(selfUser.age) || Number(selfUser.age) < 18 || selfUser.is_adult !== true) {
    return (
      <div className="p-5">
        <section className="mx-auto max-w-xl rounded-3xl border border-violet-200 bg-white p-6 text-center shadow-sm dark:border-white/10 dark:bg-[#1E1B2E]">
          <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-violet-100 text-violet-700 dark:bg-violet-500/15 dark:text-violet-200">
            <UserRound className="h-6 w-6" />
          </span>
          <h2 className="mt-4 text-base font-extrabold text-slate-900 dark:text-white">
            {isArabic ? 'أكمل ملفك لفتح الاكتشاف' : 'Complete your profile to discover people'}
          </h2>
          <p className="mt-2 text-sm leading-relaxed text-slate-600 dark:text-slate-300">
            {isArabic
              ? 'تقتصر طلبات التعارف والاكتشاف على البالغين 18 عامًا فأكثر. أضف عمرك الدقيق من الملف الشخصي؛ لا نعرضه في قائمة الاقتراحات إلا لك وللطرف الآخر ضمن طلب التعارف.'
              : 'Discovery and introduction requests are for adults 18+. Add your exact age in your profile; it is shown in a request card, not to everyone in discovery.'}
          </p>
          <button
            type="button"
            onClick={onOpenProfile}
            className="mt-5 min-h-[44px] rounded-xl bg-[#8B5CF6] px-5 text-xs font-bold text-white"
          >
            {isArabic ? 'إكمال الملف الشخصي' : 'Complete profile'}
          </button>
        </section>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-3xl space-y-4 p-4 sm:p-5">
      <header className="rounded-3xl bg-gradient-to-br from-[#2D1B69] to-[#6547b4] p-5 text-white shadow-lg shadow-violet-950/10">
        <div className="flex items-start justify-between gap-3">
          <div className="flex gap-3">
            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-white/15">
              <Compass className="h-5 w-5" />
            </span>
            <div>
              <h2 className="text-base font-extrabold">
                {isArabic ? 'اكتشف أشخاصًا يشبهون اهتماماتك' : 'Discover people who share your interests'}
              </h2>
              <p className="mt-1 text-xs leading-relaxed text-violet-100">
                {isArabic
                  ? 'اقتراحات للبالغين فقط، مرتبة حسب الاهتمامات المشتركة والنشاط. لا تبدأ محادثة خاصة دون قبول الطلب.'
                  : 'Adult-only suggestions, ranked by shared interests and activity. Private chat requires acceptance.'}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => void loadCandidates()}
            aria-label={isArabic ? 'تحديث الاقتراحات' : 'Refresh suggestions'}
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white/15 active:bg-white/25"
          >
            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </header>

      <section className="rounded-3xl border border-slate-200 bg-white p-4 dark:border-white/10 dark:bg-[#1E1B2E]">
        <div className="mb-3 flex items-center gap-2 text-xs font-bold text-slate-800 dark:text-white">
          <SlidersHorizontal className="h-4 w-4 text-[#8B5CF6]" />
          {isArabic ? 'تصفية الاقتراحات' : 'Filter suggestions'}
          <span className="ms-auto text-[10px] font-normal text-slate-500">
            {isArabic ? 'حتى 3 اهتمامات' : 'Up to 3 interests'}
          </span>
        </div>
        <div className="flex flex-wrap gap-2">
          {AVAILABLE_INTERESTS.map((interest) => {
            const active = selectedInterests.includes(interest);
            return (
              <button
                key={interest}
                type="button"
                aria-pressed={active}
                onClick={() => toggleInterest(interest)}
                className={`min-h-[36px] rounded-full px-3 text-[11px] font-semibold ${
                  active
                    ? 'bg-[#8B5CF6] text-white'
                    : 'bg-slate-100 text-slate-600 dark:bg-white/5 dark:text-slate-300'
                }`}
              >
                {interest}
              </button>
            );
          })}
        </div>
        <div className="mt-3 grid grid-cols-2 gap-2">
          <select
            value={country}
            onChange={(event) => setCountry(event.target.value)}
            aria-label={isArabic ? 'الدولة' : 'Country'}
            className="h-10 min-w-0 rounded-xl border border-slate-200 bg-slate-50 px-2 text-xs text-slate-800 dark:border-white/10 dark:bg-[#151221] dark:text-slate-100"
          >
            <option value="">{isArabic ? 'كل الدول' : 'All countries'}</option>
            {AVAILABLE_COUNTRIES.map((item) => <option key={item} value={item}>{item}</option>)}
          </select>
          <select
            value={language}
            onChange={(event) => setLanguage(event.target.value)}
            aria-label={isArabic ? 'اللغة' : 'Language'}
            className="h-10 min-w-0 rounded-xl border border-slate-200 bg-slate-50 px-2 text-xs text-slate-800 dark:border-white/10 dark:bg-[#151221] dark:text-slate-100"
          >
            <option value="">{isArabic ? 'كل اللغات' : 'All languages'}</option>
            {AVAILABLE_LANGUAGES.map((item) => <option key={item} value={item}>{item}</option>)}
          </select>
        </div>
      </section>

      {notice && (
        <p role="status" className="rounded-2xl border border-violet-200 bg-violet-50 p-3 text-xs leading-relaxed text-violet-900 dark:border-violet-900/50 dark:bg-violet-950/30 dark:text-violet-100">
          {notice}
        </p>
      )}
      {error && (
        <p role="alert" className="rounded-2xl border border-rose-200 bg-rose-50 p-3 text-xs text-rose-700 dark:border-rose-900/50 dark:bg-rose-950/30 dark:text-rose-200">
          {error}
        </p>
      )}
      {loading ? (
        <p className="py-10 text-center text-xs text-slate-500">
          {isArabic ? 'جارٍ البحث عن اقتراحات مناسبة...' : 'Finding relevant suggestions...'}
        </p>
      ) : candidates.length === 0 ? (
        <div className="rounded-3xl border border-dashed border-slate-300 p-8 text-center text-xs text-slate-500 dark:border-white/15 dark:text-slate-400">
          {isArabic
            ? 'لا توجد اقتراحات مطابقة حاليًا. جرّب تخفيف عوامل التصفية أو عد لاحقًا.'
            : 'No matching suggestions right now. Try fewer filters or check again later.'}
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          {candidates.map((candidate) => (
            <article
              key={candidate.peer.id}
              className="rounded-3xl border border-slate-200 bg-white p-4 shadow-sm dark:border-white/10 dark:bg-[#1E1B2E]"
            >
              <div className="flex items-start gap-3">
                <div className="relative">
                  <FramedAvatar
                    avatarUrl={candidate.peer.avatar_url}
                    frameId={candidate.peer.frame_id}
                    nickname={candidate.peer.nickname}
                    size="md"
                  />
                  {candidate.peer.is_online && (
                    <span className="absolute bottom-0 end-0 h-3 w-3 rounded-full border-2 border-white bg-emerald-500 dark:border-[#1E1B2E]" />
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-1.5">
                    <h3 className="truncate text-sm font-bold text-slate-900 dark:text-white">{candidate.peer.nickname}</h3>
                    <OfficialBadge role={candidate.peer.role} />
                    <span className="rounded-full bg-violet-50 px-2 py-0.5 text-[10px] font-bold text-violet-700 dark:bg-violet-950/50 dark:text-violet-200">
                      {candidate.peer.age} {isArabic ? 'سنة' : 'yrs'}
                    </span>
                  </div>
                  <p className="mt-1 text-[10px] text-slate-500 dark:text-slate-400">
                    {candidate.peer.is_online
                      ? isArabic ? 'متصل الآن' : 'Online now'
                      : candidate.peer.country}
                  </p>
                </div>
              </div>
              {candidate.peer.bio && (
                <p className="mt-3 line-clamp-2 text-xs leading-relaxed text-slate-600 dark:text-slate-300">
                  {candidate.peer.bio}
                </p>
              )}
              <div className="mt-3 flex flex-wrap gap-1.5">
                {candidate.commonInterests.map((interest) => (
                  <span key={interest} className="rounded-full bg-emerald-50 px-2.5 py-1 text-[10px] font-semibold text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-200">
                    {interest}
                  </span>
                ))}
                {candidate.peer.interests
                  .filter((interest) => !candidate.commonInterests.includes(interest))
                  .slice(0, 3)
                  .map((interest) => (
                    <span key={interest} className="rounded-full bg-slate-100 px-2.5 py-1 text-[10px] text-slate-600 dark:bg-white/5 dark:text-slate-300">
                      {interest}
                    </span>
                  ))}
              </div>
              <button
                type="button"
                disabled={Boolean(sendingTo)}
                onClick={() => void sendRequest(candidate)}
                className="mt-4 flex min-h-[42px] w-full items-center justify-center gap-2 rounded-xl bg-[#8B5CF6] text-xs font-bold text-white disabled:opacity-50"
              >
                <Heart className="h-4 w-4" />
                {sendingTo === candidate.peer.id
                  ? isArabic ? 'جارٍ إرسال الطلب...' : 'Sending request...'
                  : isArabic ? 'إرسال طلب اهتمام' : 'Send interest request'}
              </button>
            </article>
          ))}
        </div>
      )}
    </div>
  );
};
