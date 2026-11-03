import React, { Fragment, useEffect, useMemo, useState } from 'react';
import {
  Copy,
  Check,
  Share2,
  ExternalLink,
  CheckCircle2,
  XCircle,
  Crown,
  Flag,
  Ban,
} from 'lucide-react';
import { FramedAvatar, OfficialBadge } from './FramedAvatar';
import {
  RealmChatRoom,
  RealmPersonalLink,
  RealmUser,
  isRealmPremiumActive,
} from '../db/realmLocalDB';
import { fadfadahClient, InterestRequestDTO } from '../services/fadfadahNetworkClient';
import { nativeCopyText, nativeShareUrl } from '../services/androidNative';
import { AppLang, TRANSLATIONS } from '../i18n/translations';
import { AdBanner } from './AdBanner';

interface UnifiedInboxScreenProps {
  selfUser: RealmUser;
  allUsers: RealmUser[];
  personalLink: RealmPersonalLink;
  rooms: RealmChatRoom[];
  activeRoomId: string | null;
  lang: AppLang;
  onSelectRoom: (roomId: string) => void;
  onOpenGatewayModal: () => void;
  onOpenUpgrade: () => void;
}

export const UnifiedInboxScreen: React.FC<UnifiedInboxScreenProps> = ({
  selfUser,
  allUsers,
  personalLink,
  rooms,
  activeRoomId,
  lang,
  onSelectRoom,
  onOpenGatewayModal,
  onOpenUpgrade,
}) => {
  const t = TRANSLATIONS[lang];
  const [activeInboxTab, setActiveInboxTab] = useState<'LINK_BASED' | 'RANDOM' | 'INTEREST'>(
    'INTEREST'
  );
  const [interestRequests, setInterestRequests] = useState<InterestRequestDTO[]>([]);
  const [interestRequestsLoading, setInterestRequestsLoading] = useState(true);
  const [interestRequestsError, setInterestRequestsError] = useState('');
  const [pendingInterestAction, setPendingInterestAction] = useState<string | null>(null);
  const [copiedLink, setCopiedLink] = useState(false);
  useEffect(() => {
    let active = true;
    const loadRequests = async () => {
      try {
        const requests = await fadfadahClient.getInterestRequests();
        if (active) {
          setInterestRequests(requests);
          setInterestRequestsError('');
        }
      } catch (error) {
        if (active) {
          setInterestRequestsError(
            error instanceof Error ? error.message : 'تعذر تحميل طلبات التعارف.'
          );
        }
      } finally {
        if (active) setInterestRequestsLoading(false);
      }
    };
    void loadRequests();
    const unsubscribe = fadfadahClient.subscribeInterestRequestUpdates(loadRequests);
    return () => {
      active = false;
      unsubscribe();
    };
  }, []);

  const shareableUrl = `${fadfadahClient.getShareBaseUrl()}/u/${encodeURIComponent(
    personalLink.slug
  )}`;

  const linkRooms = useMemo(() => {
    return rooms
      .filter((r) => r.type === 'LINK_BASED' && r.status === 'ACCEPTED')
      .filter((r) => {
        const peerId = r.participant_a === selfUser.id ? r.participant_b : r.participant_a;
        return !selfUser.blocked_user_ids.includes(peerId);
      })
      .sort((a, b) => b.last_message_at - a.last_message_at);
  }, [rooms, selfUser]);

  const pendingRandomRequests = useMemo(() => {
    // Incoming requests are where participant_b === selfUser.id (or show outgoing pending clearly)
    return rooms
      .filter((r) => r.type === 'RANDOM' && r.status === 'PENDING')
      .filter((r) => {
        const peerId = r.participant_a === selfUser.id ? r.participant_b : r.participant_a;
        return !selfUser.blocked_user_ids.includes(peerId);
      })
      .sort((a, b) => b.created_at - a.created_at);
  }, [rooms, selfUser]);

  const acceptedRandomRooms = useMemo(() => {
    return rooms
      .filter((r) => r.type === 'RANDOM' && r.status === 'ACCEPTED')
      .filter((r) => {
        const peerId = r.participant_a === selfUser.id ? r.participant_b : r.participant_a;
        return !selfUser.blocked_user_ids.includes(peerId);
      })
      .sort((a, b) => b.last_message_at - a.last_message_at);
  }, [rooms, selfUser]);

  const linkUnreadTotal = linkRooms.reduce((acc, r) => acc + r.unread_count, 0);
  const randomUnreadTotal =
    acceptedRandomRooms.reduce((acc, r) => acc + r.unread_count, 0) +
    pendingRandomRequests.filter((r) => r.participant_b === selfUser.id).length;
  const incomingInterestRequests = interestRequests.filter(
    (request) => request.direction === 'INCOMING' && request.status === 'PENDING'
  );
  const outgoingInterestRequests = interestRequests.filter(
    (request) => request.direction === 'OUTGOING' && request.status === 'PENDING'
  );
  const resolvedInterestRequests = interestRequests
    .filter((request) => ['ACCEPTED', 'REJECTED', 'IGNORED'].includes(request.status))
    .slice(0, 5);

  const handleCopyLink = async () => {
    const ok = await nativeCopyText(shareableUrl);
    if (ok) {
      setCopiedLink(true);
      setTimeout(() => setCopiedLink(false), 2000);
    }
  };

  const handleShareLink = async () => {
    const shared = await nativeShareUrl({
      title: t.appName,
      text:
        lang === 'ar'
          ? 'أرسل لي مصارحة أو فضفضة مجهولة الهوية عبر تطبيقي في فضفضة:'
          : 'Send me an anonymous message on Fadfadah:',
      url: shareableUrl,
    });
    if (!shared) {
      await handleCopyLink();
    }
  };

  const handleAcceptRequest = async (room: RealmChatRoom) => {
    await fadfadahClient.respondToChatRequest(room.id, 'ACCEPT');
    onSelectRoom(room.id);
  };

  const handleRejectRequest = async (room: RealmChatRoom) => {
    await fadfadahClient.respondToChatRequest(room.id, 'REJECT');
  };

  const handleInterestAction = async (
    request: InterestRequestDTO,
    action: 'ACCEPT' | 'REJECT' | 'IGNORE' | 'BLOCK'
  ) => {
    setPendingInterestAction(request.id);
    try {
      const result = await fadfadahClient.respondToInterestRequest(request.id, action);
      if (!result.ok) {
        setInterestRequestsError(
          result.error || (lang === 'ar' ? 'تعذر تحديث الطلب.' : 'Could not update request.')
        );
        return;
      }
      if (action === 'ACCEPT' && result.roomId) onSelectRoom(result.roomId);
      const updated = await fadfadahClient.getInterestRequests();
      setInterestRequests(updated);
      setInterestRequestsError('');
    } catch (error) {
      setInterestRequestsError(
        error instanceof Error ? error.message : 'تعذر تحديث طلب التعارف.'
      );
    } finally {
      setPendingInterestAction(null);
    }
  };

  const handleReportInterestRequest = async (request: InterestRequestDTO) => {
    setPendingInterestAction(request.id);
    try {
      const result = await fadfadahClient.submitReport({
        interestRequestId: request.id,
        reportedUserId: request.sender_id,
        target_type: 'user',
        target_id: request.id,
        reason: 'طلب تعارف غير مرغوب أو مخالف',
      });
      if (!result.ok) {
        setInterestRequestsError(result.summary || 'تعذر إرسال البلاغ.');
        return;
      }
      setInterestRequests(await fadfadahClient.getInterestRequests());
      setInterestRequestsError('');
    } catch (error) {
      setInterestRequestsError(error instanceof Error ? error.message : 'تعذر إرسال البلاغ.');
    } finally {
      setPendingInterestAction(null);
    }
  };

  const formatRowTime = (ts: number) => {
    const diffMins = Math.round((Date.now() - ts) / 60000);
    if (diffMins < 60) {
      return new Date(ts).toLocaleTimeString(lang === 'ar' ? 'ar-EG' : 'en-US', {
        hour: '2-digit',
        minute: '2-digit',
      });
    }
    if (diffMins < 1440) {
      return lang === 'ar' ? 'اليوم' : 'Today';
    }
    return lang === 'ar' ? 'أمس' : 'Yesterday';
  };

  const resolvePeer = (room: RealmChatRoom): RealmUser => {
    const peerId = room.participant_a === selfUser.id ? room.participant_b : room.participant_a;
    return (
      allUsers.find((u) => u.id === peerId) ?? {
        id: peerId,
        nickname: 'مستخدم مجهول',
        avatar_url: 'cloud',
        frame_id: 0,
        interests: ['فضفضة'],
        languages: ['العربية'],
        country: 'عالمي',
        embedding_vector: [],
        is_premium: false,
        premium_plan: 'free',
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
      }
    );
  };

  return (
    <div className="flex flex-col h-full">
      {/* Native Android Dual Tab Bar */}
      <div className="bg-white dark:bg-[#1E1B2E] border-b border-slate-200 dark:border-white/10 px-4 shrink-0">
        <div className="grid grid-cols-3">
          <button
            type="button"
            onClick={() => setActiveInboxTab('INTEREST')}
            className={`min-h-[46px] text-xs sm:text-sm font-bold border-b-2 transition-colors flex items-center justify-center gap-2 whitespace-nowrap ${
              activeInboxTab === 'INTEREST'
                ? 'border-[#8B5CF6] text-[#8B5CF6]'
                : 'border-transparent text-slate-500 dark:text-slate-400'
            }`}
          >
            <span>{lang === 'ar' ? 'طلبات التعارف' : 'Requests'}</span>
            {incomingInterestRequests.length > 0 && (
              <span className="font-mono-num text-[11px] font-bold text-[#8B5CF6]">
                ({incomingInterestRequests.length})
              </span>
            )}
          </button>
          <button
            type="button"
            onClick={() => setActiveInboxTab('LINK_BASED')}
            className={`min-h-[46px] text-xs sm:text-sm font-bold border-b-2 transition-colors flex items-center justify-center gap-2 whitespace-nowrap ${
              activeInboxTab === 'LINK_BASED'
                ? 'border-[#8B5CF6] text-[#8B5CF6]'
                : 'border-transparent text-slate-500 dark:text-slate-400'
            }`}
          >
            <span>{t.tabLinkMessages}</span>
            {linkUnreadTotal > 0 && (
              <span className="font-mono-num text-[11px] font-bold text-[#8B5CF6]">
                ({linkUnreadTotal})
              </span>
            )}
          </button>

          <button
            type="button"
            onClick={() => setActiveInboxTab('RANDOM')}
            className={`min-h-[46px] text-xs sm:text-sm font-bold border-b-2 transition-colors flex items-center justify-center gap-2 whitespace-nowrap ${
              activeInboxTab === 'RANDOM'
                ? 'border-[#8B5CF6] text-[#8B5CF6]'
                : 'border-transparent text-slate-500 dark:text-slate-400'
            }`}
          >
            <span>{t.tabRandomChats}</span>
            {randomUnreadTotal > 0 && (
              <span className="font-mono-num text-[11px] font-bold text-[#8B5CF6]">
                ({randomUnreadTotal})
              </span>
            )}
          </button>
        </div>
      </div>

      {/* Scrollable Inbox Feed */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
      {activeInboxTab === 'INTEREST' && (
        <section className="space-y-3">
          <div className="rounded-2xl bg-gradient-to-br from-[#2D1B69] to-[#5536a5] p-4 text-white">
            <h3 className="text-sm font-bold">
              {lang === 'ar' ? 'ابدأ التعارف بموافقة واضحة' : 'Meet with mutual consent'}
            </h3>
            <p className="mt-1 text-xs leading-relaxed text-purple-100">
              {lang === 'ar'
                ? 'لن تبدأ المحادثة الخاصة إلا بعد قبول طلب التعارف. يمكنك رفض الطلب أو تجاهله أو حظر صاحبه والإبلاغ عنه.'
                : 'Private chat starts only after you accept. You can reject, ignore, block, or report a request.'}
            </p>
          </div>
          {interestRequestsError && (
            <p role="alert" className="rounded-xl bg-rose-50 p-3 text-xs text-rose-700 dark:bg-rose-950/40 dark:text-rose-300">
              {interestRequestsError}
            </p>
          )}
          {interestRequestsLoading ? (
            <p className="py-8 text-center text-xs text-slate-500">
              {lang === 'ar' ? 'جارٍ تحميل الطلبات...' : 'Loading requests...'}
            </p>
          ) : incomingInterestRequests.length === 0 &&
            outgoingInterestRequests.length === 0 &&
            resolvedInterestRequests.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-slate-300 p-7 text-center text-xs text-slate-500 dark:border-white/15 dark:text-slate-400">
              {lang === 'ar' ? 'لا توجد طلبات تعارف معلقة.' : 'No pending introduction requests.'}
            </div>
          ) : (
            <>
              {incomingInterestRequests.map((request) => {
                const busy = pendingInterestAction === request.id;
                return (
                  <article
                    key={request.id}
                    className="rounded-2xl border border-[#8B5CF6]/30 bg-white p-4 shadow-sm dark:bg-[#1E1B2E]"
                  >
                    <div className="flex items-start gap-3">
                      <FramedAvatar
                        avatarUrl={request.sender_avatar_url}
                        frameId={request.sender_frame_id}
                        nickname={request.sender_nickname}
                        size="md"
                      />
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-1.5">
                          <h4 className="text-sm font-bold text-slate-900 dark:text-white">
                            {request.is_anonymous
                              ? lang === 'ar'
                                ? 'زائر مجهول'
                                : 'Anonymous visitor'
                              : request.sender_nickname}
                          </h4>
                          {!request.is_anonymous && request.sender_age && (
                            <span className="rounded-full bg-purple-50 px-2 py-0.5 text-[10px] font-semibold text-purple-700 dark:bg-purple-950/50 dark:text-purple-200">
                              {request.sender_age} {lang === 'ar' ? 'سنة' : 'years'}
                            </span>
                          )}
                        </div>
                        {!request.is_anonymous && request.sender_bio && (
                          <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                            {request.sender_bio}
                          </p>
                        )}
                      </div>
                    </div>
                    {!request.is_anonymous && request.sender_interests.length > 0 && (
                      <div className="mt-3 flex flex-wrap gap-1.5">
                        {request.sender_interests.slice(0, 6).map((interest) => (
                          <span
                            key={interest}
                            className="rounded-full bg-slate-100 px-2.5 py-1 text-[10px] text-slate-600 dark:bg-white/5 dark:text-slate-300"
                          >
                            {interest}
                          </span>
                        ))}
                      </div>
                    )}
                    <p className="mt-3 rounded-xl bg-slate-50 p-3 text-sm leading-relaxed text-slate-800 dark:bg-[#151221] dark:text-slate-100">
                      {request.intro_text}
                    </p>
                    <div className="mt-3 grid grid-cols-2 gap-2">
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() => void handleInterestAction(request, 'ACCEPT')}
                        className="min-h-[42px] rounded-xl bg-[#8B5CF6] text-xs font-bold text-white disabled:opacity-50"
                      >
                        <CheckCircle2 className="me-1 inline h-4 w-4" />
                        {lang === 'ar' ? 'قبول وبدء المحادثة' : 'Accept & chat'}
                      </button>
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() => void handleInterestAction(request, 'REJECT')}
                        className="min-h-[42px] rounded-xl bg-slate-100 text-xs font-semibold text-slate-700 dark:bg-white/5 dark:text-slate-200 disabled:opacity-50"
                      >
                        <XCircle className="me-1 inline h-4 w-4" />
                        {lang === 'ar' ? 'رفض' : 'Reject'}
                      </button>
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() => void handleInterestAction(request, 'IGNORE')}
                        className="min-h-[38px] rounded-xl border border-slate-200 text-[11px] font-semibold text-slate-600 dark:border-white/10 dark:text-slate-300 disabled:opacity-50"
                      >
                        {lang === 'ar' ? 'تجاهل' : 'Ignore'}
                      </button>
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() => void handleInterestAction(request, 'BLOCK')}
                        className="min-h-[38px] rounded-xl border border-rose-200 text-[11px] font-semibold text-rose-600 dark:border-rose-900/50 dark:text-rose-300 disabled:opacity-50"
                      >
                        <Ban className="me-1 inline h-3.5 w-3.5" />
                        {lang === 'ar' ? 'حظر' : 'Block'}
                      </button>
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() => void handleReportInterestRequest(request)}
                        className="col-span-2 min-h-[36px] text-[11px] font-semibold text-slate-500 disabled:opacity-50 dark:text-slate-400"
                      >
                        <Flag className="me-1 inline h-3.5 w-3.5" />
                        {lang === 'ar' ? 'إبلاغ عن الطلب' : 'Report request'}
                      </button>
                    </div>
                  </article>
                );
              })}
              {outgoingInterestRequests.map((request) => (
                <article
                  key={request.id}
                  className="rounded-2xl border border-slate-200 bg-white p-4 dark:border-white/10 dark:bg-[#1E1B2E]"
                >
                  <p className="text-xs font-bold text-slate-800 dark:text-white">
                    {lang === 'ar' ? 'طلبك بانتظار الموافقة' : 'Your request is awaiting a response'}
                  </p>
                  <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">{request.intro_text}</p>
                </article>
              ))}
              {resolvedInterestRequests.length > 0 && (
                <div className="space-y-2 pt-2">
                  <h4 className="px-1 text-[11px] font-bold text-slate-500 dark:text-slate-400">
                    {lang === 'ar' ? 'آخر الطلبات' : 'Recent requests'}
                  </h4>
                  {resolvedInterestRequests.map((request) => {
                    const statusLabel =
                      request.status === 'ACCEPTED'
                        ? lang === 'ar'
                          ? 'مقبول'
                          : 'Accepted'
                        : request.status === 'REJECTED'
                          ? lang === 'ar'
                            ? 'مرفوض'
                            : 'Rejected'
                          : lang === 'ar'
                            ? 'مغلق'
                            : 'Closed';
                    return (
                      <button
                        key={request.id}
                        type="button"
                        disabled={!request.accepted_room_id}
                        onClick={() => {
                          if (request.accepted_room_id) onSelectRoom(request.accepted_room_id);
                        }}
                        className="flex min-h-[54px] w-full items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white px-3 text-start dark:border-white/10 dark:bg-[#1E1B2E] disabled:cursor-default"
                      >
                        <span className="min-w-0">
                          <span className="block truncate text-xs font-semibold text-slate-800 dark:text-slate-100">
                            {request.is_anonymous
                              ? lang === 'ar'
                                ? 'زائر مجهول'
                                : 'Anonymous visitor'
                              : request.sender_nickname}
                          </span>
                          <span className="mt-0.5 block text-[10px] text-slate-500 dark:text-slate-400">
                            {request.intro_text}
                          </span>
                        </span>
                        <span
                          className={`shrink-0 rounded-full px-2.5 py-1 text-[10px] font-bold ${
                            request.status === 'ACCEPTED'
                              ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300'
                              : 'bg-slate-100 text-slate-600 dark:bg-white/5 dark:text-slate-300'
                          }`}
                        >
                          {statusLabel}
                        </span>
                      </button>
                    );
                  })}
                </div>
              )}
            </>
          )}
        </section>
      )}
      {/* Dynamic Personal Link Card */}
        {activeInboxTab === 'LINK_BASED' && (
          <div className="rounded-2xl bg-[#2D1B69] text-white p-4 space-y-3 shadow-sm">
            <div className="flex items-center justify-between gap-2">
              <p className="text-xs sm:text-sm font-bold">{t.linkCardTitle}</p>
              <span className="text-[11px] text-purple-200 font-mono-num shrink-0">
                {personalLink.visits_count} {lang === 'ar' ? 'زيارة' : 'visits'}
              </span>
            </div>

            <div
              className="px-3.5 py-2.5 rounded-xl bg-black/25 border border-white/10 text-xs font-mono-num text-purple-100 truncate selectable-text"
              dir="ltr"
            >
              {shareableUrl}
            </div>

            <div className="grid grid-cols-2 gap-2.5">
              <button
                type="button"
                onClick={handleCopyLink}
                className="min-h-[44px] px-3 py-2 rounded-xl bg-white text-[#2D1B69] active:scale-[0.98] text-xs font-bold flex items-center justify-center gap-1.5 transition-transform whitespace-nowrap"
              >
                {copiedLink ? (
                  <Check className="w-4 h-4 text-emerald-600" />
                ) : (
                  <Copy className="w-4 h-4" />
                )}
                <span>{copiedLink ? t.copied : t.copyLink}</span>
              </button>

              <button
                type="button"
                onClick={handleShareLink}
                className="min-h-[44px] px-3 py-2 rounded-xl bg-[#8B5CF6] active:scale-[0.98] text-white text-xs font-bold flex items-center justify-center gap-1.5 transition-transform whitespace-nowrap"
              >
                <Share2 className="w-4 h-4" />
                <span>{t.shareLink}</span>
              </button>
            </div>

            <button
              type="button"
              onClick={onOpenGatewayModal}
              className="w-full min-h-[40px] px-3 py-1.5 rounded-xl bg-white/10 active:bg-white/20 text-purple-100 text-xs font-semibold flex items-center justify-center gap-1.5"
            >
              <ExternalLink className="w-3.5 h-3.5" />
              <span>{t.testGateway}</span>
            </button>
          </div>
        )}

        {/* Incoming & Outgoing Pending Chat Requests */}
        {activeInboxTab === 'RANDOM' && pendingRandomRequests.length > 0 && (
          <div className="space-y-2.5">
            <h3 className="text-xs font-bold text-slate-600 dark:text-slate-300 px-1">
              {t.pendingRequests} ({pendingRandomRequests.length})
            </h3>
            {pendingRandomRequests.map((reqRoom) => {
              const peer = resolvePeer(reqRoom);
              const isIncoming = reqRoom.participant_b === selfUser.id;
              return (
                <div
                  key={reqRoom.id}
                  className="rounded-2xl bg-white dark:bg-[#1E1B2E] border border-[#8B5CF6]/40 p-4 space-y-3"
                >
                  <div className="flex items-center gap-3">
                    <FramedAvatar
                      avatarUrl={peer.avatar_url}
                      frameId={peer.frame_id}
                      nickname={peer.nickname}
                      size="md"
                    />
                    <div className="min-w-0 flex-1">
                      <p className="flex items-center gap-1 text-sm font-bold text-slate-900 dark:text-white">
                        <span className="truncate">{peer.nickname}</span>
                        <OfficialBadge role={peer.role} />
                      </p>
                      <p className="text-xs text-slate-500 dark:text-slate-400 truncate">
                        {peer.country} · {peer.languages.join(' · ')}
                      </p>
                    </div>
                  </div>

                  <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
                    {reqRoom.last_message_preview}
                  </p>

                  {isIncoming ? (
                    <div className="grid grid-cols-2 gap-2">
                      <button
                        type="button"
                        onClick={() => handleAcceptRequest(reqRoom)}
                        className="min-h-[44px] px-3 rounded-xl bg-[#8B5CF6] text-white text-xs font-bold flex items-center justify-center gap-1.5"
                      >
                        <CheckCircle2 className="w-4 h-4" />
                        <span>{t.acceptChat}</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => handleRejectRequest(reqRoom)}
                        className="min-h-[44px] px-3 rounded-xl bg-slate-100 dark:bg-[#151221] text-slate-700 dark:text-slate-300 text-xs font-semibold flex items-center justify-center gap-1.5"
                      >
                        <XCircle className="w-4 h-4" />
                        <span>{t.rejectDelete}</span>
                      </button>
                    </div>
                  ) : (
                    <div className="flex items-center justify-between pt-1">
                      <span className="text-xs text-amber-600 dark:text-amber-400">
                        {lang === 'ar' ? 'بانتظار موافقة الطرف الآخر...' : 'Awaiting peer approval...'}
                      </span>
                      <button
                        type="button"
                        onClick={() => handleRejectRequest(reqRoom)}
                        className="min-h-[38px] px-3 rounded-lg bg-slate-100 dark:bg-[#151221] text-xs font-semibold text-slate-600 dark:text-slate-300"
                      >
                        {lang === 'ar' ? 'إلغاء الطلب' : 'Cancel'}
                      </button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {/* Active Chat List */}
        {activeInboxTab !== 'INTEREST' && (
          <div className="rounded-3xl bg-white dark:bg-[#1E1B2E] border border-slate-200 dark:border-white/10 divide-y divide-slate-100 dark:divide-white/10 overflow-hidden">
          {(activeInboxTab === 'LINK_BASED' ? linkRooms : acceptedRandomRooms).length === 0 ? (
            <div className="p-8 text-center text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
              {activeInboxTab === 'LINK_BASED' ? t.noLinkChats : t.noRandomChats}
            </div>
          ) : (
            (activeInboxTab === 'LINK_BASED' ? linkRooms : acceptedRandomRooms).map((room, index) => {
              const peer = resolvePeer(room);
              const isSelected = activeRoomId === room.id;
              return (
                <Fragment key={room.id}>
                  <button
                    type="button"
                    onClick={() => onSelectRoom(room.id)}
                    className={`w-full px-4 py-3.5 min-h-[68px] flex items-center justify-between gap-3 text-right transition-colors ${
                      isSelected
                        ? 'bg-[#8B5CF6]/12 dark:bg-[#8B5CF6]/18'
                        : 'active:bg-slate-100 dark:active:bg-white/5'
                    }`}
                  >
                    <div className="flex items-center gap-3 min-w-0 flex-1">
                      <FramedAvatar
                        avatarUrl={peer.avatar_url}
                        frameId={peer.frame_id}
                        nickname={peer.nickname}
                        size="md"
                      />
                      <div className="min-w-0 flex-1 text-start">
                        <h4 className="flex items-center gap-1 text-sm font-bold text-slate-900 dark:text-white">
                          <span className="truncate">{peer.nickname}</span>
                          <OfficialBadge role={peer.role} />
                        </h4>
                        <p
                          className={`text-xs truncate mt-0.5 ${
                            room.unread_count > 0
                              ? 'font-semibold text-slate-900 dark:text-slate-100'
                              : 'text-slate-500 dark:text-slate-400'
                          }`}
                        >
                          {room.last_message_preview}
                        </p>
                        </div>
                    </div>

                    <div className="flex flex-col items-end gap-1.5 shrink-0">
                      <span className="text-[11px] text-slate-400 dark:text-slate-500 font-mono-num">
                        {formatRowTime(room.last_message_at)}
                      </span>
                      {room.unread_count > 0 && (
                        <span className="min-w-[20px] h-5 px-1.5 rounded-full bg-[#8B5CF6] text-white text-[11px] font-mono-num font-bold flex items-center justify-center">
                          {room.unread_count}
                        </span>
                      )}
                    </div>
                  </button>
                </Fragment>
              );
            })
          )}
          </div>
        )}

        {/* Real VIP Perks Card (Honest, zero fake ad removal claims) */}
        {!isRealmPremiumActive(selfUser) && (
          <div className="rounded-2xl bg-gradient-to-r from-purple-500/10 to-indigo-500/10 border border-[#8B5CF6]/30 p-3.5 flex items-center justify-between gap-3">
            <div className="space-y-0.5">
              <p className="text-xs font-bold text-slate-900 dark:text-white">
                {lang === 'ar' ? 'الترقية إلى فضفضة المميزة' : 'Upgrade to Fadfadah VIP'}
              </p>
              <p className="text-[11px] text-slate-600 dark:text-slate-300 leading-relaxed">
                {t.vipBannerLabel}
              </p>
            </div>
            <button
              type="button"
              onClick={onOpenUpgrade}
              className="min-h-[40px] px-3.5 py-1.5 rounded-xl bg-[#2D1B69] text-white text-xs font-bold flex items-center gap-1.5 shrink-0 whitespace-nowrap"
            >
              <Crown className="w-3.5 h-3.5 text-amber-300" />
              <span>{t.upgradeNow}</span>
            </button>
          </div>
        )}

        {/* Bottom Banner Ad (Google AdMob compliant, hidden for VIP) */}
        <AdBanner selfUser={selfUser} lang={lang} position="inline" onOpenUpgrade={onOpenUpgrade} />
      </div>
    </div>
  );
};
