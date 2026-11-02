import React, { useMemo, useState } from 'react';
import { Heart, MessageSquarePlus, Send, AlertTriangle } from 'lucide-react';
import { FramedAvatar, OfficialBadge } from './FramedAvatar';
import {
  RealmPublicVent,
  RealmUser,
  isRealmPremiumActive,
} from '../db/realmLocalDB';
import { fadfadahClient } from '../services/fadfadahNetworkClient';
import { AppLang, TRANSLATIONS } from '../i18n/translations';
import { AdBanner } from './AdBanner';

interface ExploreVentScreenProps {
  selfUser: RealmUser;
  allUsers: RealmUser[];
  vents: RealmPublicVent[];
  lang: AppLang;
  onOpenChatRoom: (roomId: string) => void;
}

const VENT_TOPICS = ['الكل', 'فضفضة', 'فن وقراءة', 'دراسة وعمل', 'مواضيع عامة'];

export const ExploreVentScreen: React.FC<ExploreVentScreenProps> = ({
  selfUser,
  allUsers,
  vents,
  lang,
  onOpenChatRoom,
}) => {
  const t = TRANSLATIONS[lang];
  const [selectedTopic, setSelectedTopic] = useState<string>('الكل');
  const [newVentTopic, setNewVentTopic] = useState<string>('فضفضة');
  const [newVentText, setNewVentText] = useState<string>('');
  const [posting, setPosting] = useState(false);
  const [modError, setModError] = useState('');
  const [replyNotice, setReplyNotice] = useState('');
  const [reportTargetVent, setReportTargetVent] = useState<RealmPublicVent | null>(null);
  const [reportReason, setReportReason] = useState('محتوى مسيء أو تنمر');
  const [submittingReport, setSubmittingReport] = useState(false);
  const [reportFeedback, setReportFeedback] = useState('');

  const onlinePeers = useMemo(() => {
    return allUsers
      .filter((u) => !u.is_self && u.is_online && !selfUser.blocked_user_ids.includes(u.id))
      .sort((a, b) => Number(isRealmPremiumActive(b)) - Number(isRealmPremiumActive(a)));
  }, [allUsers, selfUser.blocked_user_ids]);

  const filteredVents = useMemo(() => {
    return vents
      .filter((v) => !selfUser.blocked_user_ids.includes(v.author_id))
      .filter((v) => selectedTopic === 'الكل' || v.topic === selectedTopic)
      .sort((a, b) => b.created_at - a.created_at);
  }, [vents, selectedTopic, selfUser.blocked_user_ids]);

  const handlePublishVent = async (e: React.FormEvent) => {
    e.preventDefault();
    const clean = newVentText.trim();
    if (!clean) return;

    setPosting(true);
    setModError('');

    const res = await fadfadahClient.publishVent(newVentTopic, clean);
    setPosting(false);
    if (!res.ok) {
      setModError(res.error || (lang === 'ar' ? 'تعذر النشر.' : 'Publish failed.'));
      return;
    }
    setNewVentText('');
  };

  const handleStartPrivateReply = async (peer: RealmUser, quotedVent?: string) => {
    if (peer.id === selfUser.id) return;
    setReplyNotice('');
    const intro = quotedVent
      ? lang === 'ar'
        ? `مرحباً! قرأت منشورك: "${quotedVent.slice(0, 48)}..." وأردت النقاش معك.`
        : `Hi! Read your vent: "${quotedVent.slice(0, 48)}..." and wanted to chat.`
      : lang === 'ar'
      ? `مرحباً ${peer.nickname}! رأيتك ضمن المتصلين الآن.`
      : `Hi ${peer.nickname}! Saw you in Online Now.`;

    const res = await fadfadahClient.requestRandomMatch(peer.id, intro);
    if (res.ok && res.room) {
      if (res.room.status === 'ACCEPTED') {
        onOpenChatRoom(res.room.id);
      } else {
        setReplyNotice(
          lang === 'ar'
            ? `تم إرسال طلب محادثة خاص إلى ${peer.nickname}.`
            : `Private chat request sent to ${peer.nickname}.`
        );
      }
    }
  };

  const formatAgo = (ts: number) => {
    const mins = Math.max(1, Math.round((Date.now() - ts) / 60000));
    if (mins < 60) return lang === 'ar' ? `منذ ${mins} د` : `${mins}m ago`;
    const hrs = Math.round(mins / 60);
    return lang === 'ar' ? `منذ ${hrs} س` : `${hrs}h ago`;
  };

  return (
    <div className="p-4 sm:p-5 space-y-5 max-w-3xl mx-auto">
      {/* Real Online Now Users Strip */}
      <section className="space-y-2.5">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-bold text-slate-900 dark:text-white">
            {t.onlinePrioritySection} ({onlinePeers.length})
          </h3>
          <span className="text-xs text-slate-500 dark:text-slate-400">
            {lang === 'ar' ? 'متصلون فعلياً الآن' : 'Live connected users'}
          </span>
        </div>

        {onlinePeers.length === 0 ? (
          <div className="p-3.5 rounded-2xl bg-white dark:bg-[#1E1B2E] border border-slate-200 dark:border-white/10 text-xs text-slate-500 dark:text-slate-400">
            {lang === 'ar'
              ? 'لا يوجد مستخدمون آخرون متصلون في هذه اللحظة. افتح التطبيق من جهاز أندرويد آخر لرؤيته هنا مباشرة.'
              : 'No other users online right now. Connect from a second device to see them live.'}
          </div>
        ) : (
          <div className="flex items-center gap-3 overflow-x-auto pb-1">
            {onlinePeers.map((peer) => (
              <button
                key={peer.id}
                type="button"
                onClick={() => handleStartPrivateReply(peer)}
                className="min-w-[104px] p-3 rounded-2xl bg-white dark:bg-[#1E1B2E] border border-slate-200 dark:border-white/10 active:border-[#8B5CF6] flex flex-col items-center text-center gap-1.5 shrink-0 transition-colors"
              >
                <FramedAvatar
                  avatarUrl={peer.avatar_url}
                  frameId={peer.frame_id}
                  nickname={peer.nickname}
                  size="md"
                />
                <span className="inline-flex items-center gap-1 text-xs font-bold text-slate-900 dark:text-white truncate max-w-[90px]">
                  {peer.nickname}
                  <OfficialBadge role={peer.role} />
                </span>
                <span className="text-[10px] text-slate-500 dark:text-slate-400 truncate max-w-[90px]">
                  {isRealmPremiumActive(peer) ? (lang === 'ar' ? 'أولوية مميزة' : 'VIP Priority') : peer.country}
                </span>
              </button>
            ))}
          </div>
        )}
      </section>

      {replyNotice && (
        <div className="p-3 rounded-2xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800/60 text-xs font-semibold text-emerald-800 dark:text-emerald-200 text-center">
          {replyNotice}
        </div>
      )}

      {/* Real Public Vent Composer */}
      <form
        onSubmit={handlePublishVent}
        className="rounded-3xl bg-white dark:bg-[#1E1B2E] border border-slate-200 dark:border-white/10 p-4 space-y-3"
      >
        <textarea
          rows={3}
          value={newVentText}
          onChange={(e) => setNewVentText(e.target.value)}
          placeholder={
            selfUser.role === 'owner'
              ? lang === 'ar'
                ? 'اكتب تحديثًا أو إعلانًا رسميًا للمستخدمين...'
                : 'Write an official update or announcement for users...'
              : t.postVentPlaceholder
          }
          className="w-full p-3 rounded-2xl bg-slate-50 dark:bg-[#151221] border border-slate-200 dark:border-white/10 text-sm text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-[#8B5CF6] resize-none"
        />

        {modError && (
          <div className="p-3 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800/60 flex items-center gap-2 text-xs text-rose-700 dark:text-rose-300">
            <AlertTriangle className="w-4 h-4 shrink-0" />
            <span>{modError}</span>
          </div>
        )}

        <div className="flex flex-wrap items-center justify-between gap-2">
          <select
            value={newVentTopic}
            onChange={(e) => setNewVentTopic(e.target.value)}
            aria-label="Topic"
            className="h-11 px-3 rounded-xl bg-slate-50 dark:bg-[#151221] border border-slate-200 dark:border-white/10 text-xs font-medium text-slate-700 dark:text-slate-200"
          >
            {VENT_TOPICS.slice(1).map((tp) => (
              <option key={tp} value={tp}>
                {tp}
              </option>
            ))}
          </select>

          <button
            type="submit"
            disabled={posting || !newVentText.trim()}
            className="min-h-[44px] px-5 py-2 rounded-xl bg-[#8B5CF6] active:scale-[0.98] disabled:opacity-45 text-white text-xs font-bold flex items-center gap-2 transition-transform whitespace-nowrap"
          >
            <Send className="w-4 h-4" />
            <span>{posting ? (lang === 'ar' ? 'جارٍ النشر...' : 'Posting...') : t.publishVent}</span>
          </button>
        </div>
      </form>

      {/* Topic Filter Buttons */}
      <div className="flex items-center gap-1.5 overflow-x-auto pb-1">
        {VENT_TOPICS.map((tp) => (
          <button
            key={tp}
            type="button"
            onClick={() => setSelectedTopic(tp)}
            className={`min-h-[40px] px-3.5 py-1.5 rounded-xl text-xs font-semibold transition-colors whitespace-nowrap shrink-0 ${
              selectedTopic === tp
                ? 'bg-[#2D1B69] text-white'
                : 'bg-white dark:bg-[#1E1B2E] text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-white/10'
            }`}
          >
            {tp}
          </button>
        ))}
      </div>

      {/* Real Public Vents Feed */}
      <div className="space-y-3">
        {filteredVents.length === 0 ? (
          <div className="rounded-3xl bg-white dark:bg-[#1E1B2E] border border-slate-200 dark:border-white/10 p-8 text-center text-xs text-slate-500 dark:text-slate-400">
            {lang === 'ar'
              ? 'كن أول من يكتب فضفضة عامة في هذا القسم ليقرأها جميع المتصلين الآن.'
              : 'Be the first to share a public vent with connected users.'}
          </div>
        ) : (
          filteredVents.map((vent, index) => {
            const author =
              allUsers.find((u) => u.id === vent.author_id) ?? {
                id: vent.author_id,
                nickname: 'Anon_User',
                avatar_url: 'aurora',
                frame_id: 0,
                interests: [],
                languages: [],
                country: 'عالمي',
                embedding_vector: [],
                is_premium: false,
                premium_plan: 'free' as const,
                points: 0,
                unlocked_frames: [0],
                blocked_user_ids: [],
                daily_random_count: 0,
                last_random_date: '',
                is_self: false,
                is_online: false,
                bio: '',
                role: 'user',
                status: 'active',
              };

            return (
              <React.Fragment key={vent.id}>
                <article
                  className="rounded-3xl bg-white dark:bg-[#1E1B2E] border border-slate-200 dark:border-white/10 p-5 space-y-3"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <FramedAvatar
                    avatarUrl={author.avatar_url}
                    frameId={author.frame_id}
                    nickname={author.nickname}
                    size="sm"
                  />
                  <div className="min-w-0">
                    <h4 className="flex items-center gap-1 text-sm font-bold text-slate-900 dark:text-white">
                      <span className="truncate">{author.nickname}</span>
                      <OfficialBadge role={author.role} />
                    </h4>
                    <p className="text-xs text-slate-500 dark:text-slate-400">
                      {vent.topic} · <span className="font-mono-num">{formatAgo(vent.created_at)}</span>
                    </p>
                  </div>
                </div>

                <p className="text-sm text-slate-800 dark:text-slate-100 leading-relaxed selectable-text">
                  {vent.content}
                </p>

                <div className="pt-2 border-t border-slate-100 dark:border-white/5 flex items-center justify-between">
                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      onClick={() => fadfadahClient.toggleLikeVent(vent.id)}
                      className={`min-h-[44px] px-3 rounded-xl flex items-center gap-1.5 text-xs font-semibold transition-colors ${
                        vent.liked_by_me
                          ? 'text-rose-500 bg-rose-500/10'
                          : 'text-slate-500 dark:text-slate-400'
                      }`}
                    >
                      <Heart
                        className={`w-4 h-4 transition-transform ${
                          vent.liked_by_me ? 'scale-110 saturate-150' : 'grayscale opacity-70'
                        }`}
                      />
                      <span className="font-mono-num">{vent.likes_count}</span>
                    </button>

                    {author.id !== selfUser.id && (
                      <button
                        type="button"
                        onClick={() => {
                          setReportTargetVent(vent);
                          setReportFeedback('');
                        }}
                        title={t.reportVent}
                        className="min-h-[44px] min-w-[44px] rounded-xl text-slate-400 active:text-amber-500 flex items-center justify-center transition-colors"
                      >
                        <AlertTriangle className="w-4 h-4" />
                      </button>
                    )}
                  </div>

                  {author.id !== selfUser.id && (
                    <button
                      type="button"
                      onClick={() => handleStartPrivateReply(author, vent.content)}
                      className="min-h-[44px] px-4 rounded-xl bg-[#8B5CF6]/10 active:bg-[#8B5CF6]/20 text-[#8B5CF6] dark:text-[#A78BFA] text-xs font-semibold flex items-center gap-1.5 whitespace-nowrap"
                    >
                      <MessageSquarePlus className="w-4 h-4" />
                      <span>{t.replyPrivately}</span>
                    </button>
                  )}
                </div>
              </article>
              {index === 2 && (
                <AdBanner key={`banner-mid-${vent.id}`} selfUser={selfUser} lang={lang} position="inline" />
              )}
            </React.Fragment>
            );
          })
        )}

        <AdBanner selfUser={selfUser} lang={lang} position="inline" />
      </div>

      {reportTargetVent && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/65 backdrop-blur-sm p-4">
          <div className="w-full max-w-md rounded-3xl bg-white dark:bg-[#1E1B2E] border border-slate-200 dark:border-white/10 p-6 space-y-4">
            <h3 className="text-base font-bold text-slate-900 dark:text-white">
              {lang === 'ar' ? 'إبلاغ عن محتوى فضفضة مخالف' : 'Report Vent Content'}
            </h3>

            {reportFeedback ? (
              <div className="space-y-4">
                <p className="p-3.5 rounded-2xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800/60 text-xs font-semibold text-emerald-800 dark:text-emerald-200 leading-relaxed">
                  {reportFeedback}
                </p>
                <button
                  type="button"
                  onClick={() => setReportTargetVent(null)}
                  className="w-full min-h-[44px] rounded-xl bg-[#8B5CF6] text-white text-xs font-bold"
                >
                  {lang === 'ar' ? 'إغلاق' : 'Close'}
                </button>
              </div>
            ) : (
              <div className="space-y-3">
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  {lang === 'ar'
                    ? 'سيصل هذا البلاغ مع نص الفضفضة فوراً إلى لوحة تحكم المشرفين للمراجعة واتخاذ الإجراء اللازم.'
                    : 'This report and vent content will be sent immediately to moderators.'}
                </p>
                <select
                  value={reportReason}
                  onChange={(e) => setReportReason(e.target.value)}
                  className="w-full h-11 px-3 rounded-xl bg-slate-50 dark:bg-[#151221] border border-slate-200 dark:border-white/10 text-xs text-slate-900 dark:text-white"
                >
                  <option value="محتوى مسيء أو تنمر">محتوى مسيء أو تنمر</option>
                  <option value="تهديد أو تشجيع على إيذاء النفس">تهديد أو تشجيع على إيذاء النفس</option>
                  <option value="مشاركة بيانات أو أرقام شخصية">مشاركة بيانات أو أرقام شخصية</option>
                  <option value="محتوى غير لائق أو مزعج">محتوى غير لائق أو مزعج</option>
                </select>
                <div className="flex items-center justify-end gap-2 pt-2">
                  <button
                    type="button"
                    onClick={() => setReportTargetVent(null)}
                    className="min-h-[42px] px-4 rounded-xl bg-slate-100 dark:bg-white/10 text-xs font-semibold text-slate-600 dark:text-slate-300"
                  >
                    {lang === 'ar' ? 'إلغاء' : 'Cancel'}
                  </button>
                  <button
                    type="button"
                    disabled={submittingReport}
                    onClick={async () => {
                      setSubmittingReport(true);
                      const res = await fadfadahClient.submitReport({
                        reportedUserId: reportTargetVent.author_id,
                        target_type: 'vent',
                        target_id: reportTargetVent.id,
                        reason: reportReason,
                        details: `بلاغ عن فضفضة: "${reportTargetVent.content.slice(0, 100)}"`,
                      });
                      setSubmittingReport(false);
                      setReportFeedback(res.summary);
                    }}
                    className="min-h-[42px] px-5 rounded-xl bg-amber-600 text-white text-xs font-bold"
                  >
                    {submittingReport ? (lang === 'ar' ? 'جارٍ الإرسال...' : 'Sending...') : t.reportUser}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
