import React, { Fragment, useEffect, useMemo, useState } from 'react';
import {
  Copy,
  Check,
  Share2,
  ExternalLink,
  CheckCircle2,
  XCircle,
  Crown,
  Megaphone,
} from 'lucide-react';
import { FramedAvatar, OfficialBadge } from './FramedAvatar';
import {
  RealmChatRoom,
  RealmPersonalLink,
  RealmUser,
} from '../db/realmLocalDB';
import { fadfadahClient } from '../services/fadfadahNetworkClient';
import { nativeCopyText, nativeShareUrl, openExternalUrl } from '../services/androidNative';
import { AppLang, TRANSLATIONS } from '../i18n/translations';
import { AdBanner } from './AdBanner';
import { adService, AdConfig } from '../services/adService';

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
  const [activeInboxTab, setActiveInboxTab] = useState<'LINK_BASED' | 'RANDOM'>('LINK_BASED');
  const [copiedLink, setCopiedLink] = useState(false);
  const [adConfig, setAdConfig] = useState<AdConfig>(() => adService.getConfig());
  const [adOpenError, setAdOpenError] = useState(false);

  useEffect(() => {
    return adService.subscribe(() => setAdConfig(adService.getConfig()));
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

  const handleOpenSponsoredLink = async () => {
    setAdOpenError(false);
    try {
      await openExternalUrl(adConfig.chat_sponsor_url);
    } catch (error) {
      console.error('Failed to open sponsored ad link:', error);
      setAdOpenError(true);
    }
  };

  const handleAcceptRequest = async (room: RealmChatRoom) => {
    await fadfadahClient.respondToChatRequest(room.id, 'ACCEPT');
    onSelectRoom(room.id);
  };

  const handleRejectRequest = async (room: RealmChatRoom) => {
    await fadfadahClient.respondToChatRequest(room.id, 'REJECT');
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
        <div className="grid grid-cols-2">
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
                  {index === 0 && activeInboxTab === 'LINK_BASED' && adService.shouldShowChatCard(selfUser) && (
                    <div className="px-3 py-2 border-y border-[#8B5CF6]/15 bg-purple-50/60 dark:bg-[#191528]">
                      <button
                        type="button"
                        onClick={handleOpenSponsoredLink}
                        className="w-full min-h-[56px] px-3 py-2 rounded-xl border border-[#8B5CF6]/25 bg-white dark:bg-[#211c30] flex items-center gap-3 text-start active:scale-[0.99] transition-transform"
                        aria-label={lang === 'ar' ? 'فتح إعلان برعاية Monetag' : 'Open sponsored advertisement'}
                      >
                        <span className="w-9 h-9 rounded-xl bg-[#8B5CF6]/10 text-[#8B5CF6] flex items-center justify-center shrink-0">
                          <Megaphone className="w-4 h-4" />
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="block text-[9px] text-[#8B5CF6] font-semibold">
                            {lang === 'ar' ? 'إعلان برعاية' : 'Sponsored'}
                          </span>
                          <span className="block text-xs font-bold text-slate-900 dark:text-white">
                            {lang === 'ar' ? 'اكتشف عرضًا قد يهمك' : 'Discover an offer'}
                          </span>
                          {adOpenError && (
                            <span className="block text-[10px] text-rose-600" role="alert">
                              {lang === 'ar' ? 'تعذر فتح الإعلان. حاول مرة أخرى.' : 'Could not open the ad. Try again.'}
                            </span>
                          )}
                        </span>
                        <ExternalLink className="w-4 h-4 text-slate-400 shrink-0" />
                      </button>
                    </div>
                  )}
                </Fragment>
              );
            })
          )}
        </div>

        {/* Real VIP Perks Card (Honest, zero fake ad removal claims) */}
        {!selfUser.is_premium && (
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
