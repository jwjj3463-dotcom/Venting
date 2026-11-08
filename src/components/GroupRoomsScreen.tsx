import React, { FormEvent, useCallback, useEffect, useMemo, useState } from 'react';
import {
  ArrowLeft,
  Compass,
  Copy,
  Crown,
  DoorOpen,
  Flag,
  LockKeyhole,
  MessageCircle,
  Plus,
  Send,
  Users,
  X,
  Dices,
} from 'lucide-react';
import { CasualGameArena } from '../games/components/CasualGameArena';
import { RealmUser } from '../db/realmLocalDB';
import {
  fadfadahClient,
  GroupRoomDTO,
  GroupRoomMessageDTO,
} from '../services/fadfadahNetworkClient';
import { AppLang } from '../i18n/translations';
import { nativeCopyText } from '../services/androidNative';

type RoomCategory = GroupRoomDTO['category'];

const DEFAULT_PDF_ROOMS: Array<GroupRoomDTO & { countryCode: string }> = [
  {
    id: 'room-ma-sohba',
    name_ar: 'سهرة المغرب',
    name_en: 'Morocco Night',
    description_ar: 'نقاش حر بالدارجة المغربية وسوالف ممتعة.',
    description_en: 'Free open chat in Moroccan Darija.',
    category: 'PUBLIC',
    invite_code: null,
    created_by: 'system',
    host_id: 'system',
    member_count: 42,
    is_member: false,
    is_host: false,
    created_at: Date.now(),
    updated_at: Date.now(),
    is_active: true,
    countryCode: 'MA',
  },
  {
    id: 'room-eg-sohba',
    name_ar: 'مصر بتتكلم',
    name_en: 'Egypt Talks',
    description_ar: 'ونس وحكايات يومية ودردشة مصرية أصيلة.',
    description_en: 'Warm friendly daily Egyptian conversations.',
    category: 'PUBLIC',
    invite_code: null,
    created_by: 'system',
    host_id: 'system',
    member_count: 37,
    is_member: false,
    is_host: false,
    created_at: Date.now(),
    updated_at: Date.now(),
    is_active: true,
    countryCode: 'EG',
  },
  {
    id: 'room-sa-sohba',
    name_ar: 'ليالي الخليج',
    name_en: 'Gulf Nights',
    description_ar: 'دردشة وتعارف ومواضيع عامة بأجواء خليجية.',
    description_en: 'Gulf evening chat and friendly networking.',
    category: 'PUBLIC',
    invite_code: null,
    created_by: 'system',
    host_id: 'system',
    member_count: 29,
    is_member: false,
    is_host: false,
    created_at: Date.now(),
    updated_at: Date.now(),
    is_active: true,
    countryCode: 'SA',
  },
  {
    id: 'room-sy-sohba',
    name_ar: 'الشام الحبيب',
    name_en: 'Beloved Levant',
    description_ar: 'سوالف ومواضيع عامة وأجواء شامية دافئة.',
    description_en: 'Levantine conversations and warm gatherings.',
    category: 'PUBLIC',
    invite_code: null,
    created_by: 'system',
    host_id: 'system',
    member_count: 18,
    is_member: false,
    is_host: false,
    created_at: Date.now(),
    updated_at: Date.now(),
    is_active: true,
    countryCode: 'SY',
  },
  {
    id: 'room-ar-games',
    name_ar: 'غرفة الألعاب',
    name_en: 'Games Room',
    description_ar: 'تحديات وكسر الجليد وألعاب ترفيهية.',
    description_en: 'Ice-breakers and casual multiplayer games.',
    category: 'PUBLIC',
    invite_code: null,
    created_by: 'system',
    host_id: 'system',
    member_count: 25,
    is_member: false,
    is_host: false,
    created_at: Date.now(),
    updated_at: Date.now(),
    is_active: true,
    countryCode: 'AR',
  },
];

interface GroupRoomsScreenProps {
  selfUser: RealmUser;
  allUsers: RealmUser[];
  lang: AppLang;
  onOpenProfile: () => void;
  onOpenRandomMatch: () => void;
}

const categoryOrder: RoomCategory[] = ['PUBLIC', 'PRIVATE', 'HOSTED'];

function renderGroupMessageContent(content: string, members: GroupRoomDTO['members']): React.ReactNode {
  const mentionTokens = [...new Set((members ?? []).map((member) => `@${member.nickname}`))]
    .sort((a, b) => b.length - a.length);
  if (!mentionTokens.length) return content;

  const escapeRegExp = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const mentionPattern = new RegExp(`(${mentionTokens.map(escapeRegExp).join('|')})`, 'giu');
  const mentionSet = new Set(mentionTokens.map((token) => token.toLocaleLowerCase()));
  return content.split(mentionPattern).map((part, index) =>
    mentionSet.has(part.toLocaleLowerCase())
      ? <span key={index} className="font-bold underline decoration-current/50">{part}</span>
      : part
  );
}

export const GroupRoomsScreen: React.FC<GroupRoomsScreenProps> = ({
  selfUser,
  allUsers,
  lang,
  onOpenProfile,
  onOpenRandomMatch,
}) => {
  const isArabic = lang === 'ar';
  const localize = (arabic: string, english: string, french: string) =>
    lang === 'ar' ? arabic : lang === 'fr' ? french : english;
  const [rooms, setRooms] = useState<GroupRoomDTO[]>([]);
  const [roomsBusy, setRoomsBusy] = useState(true);
  const [roomsError, setRoomsError] = useState('');
  const [roomNotice, setRoomNotice] = useState('');
  const [socketRefresh, setSocketRefresh] = useState(0);
  const [activeCategory, setActiveCategory] = useState<RoomCategory>('PUBLIC');
  const [selectedRoom, setSelectedRoom] = useState<GroupRoomDTO | null>(null);
  const [messages, setMessages] = useState<GroupRoomMessageDTO[]>([]);
  const [messageText, setMessageText] = useState('');
  const [mentionedUserIds, setMentionedUserIds] = useState<string[]>([]);
  const [messageBusy, setMessageBusy] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);
  const [createCategory, setCreateCategory] = useState<RoomCategory>('PUBLIC');
  const [createBusy, setCreateBusy] = useState(false);
  const [roomName, setRoomName] = useState('');
  const [roomNameEn, setRoomNameEn] = useState('');
  const [roomDescription, setRoomDescription] = useState('');
  const [roomDescriptionEn, setRoomDescriptionEn] = useState('');
  const [roomPassword, setRoomPassword] = useState('');
  const [privateRoomCode, setPrivateRoomCode] = useState('');
  const [privateRoomPassword, setPrivateRoomPassword] = useState('');
  const [actionBusy, setActionBusy] = useState(false);
  const [reportingMessageId, setReportingMessageId] = useState('');
  const [showGamesArena, setShowGamesArena] = useState(false);

  const loadRooms = useCallback(async () => {
    try {
      const nextRooms = await fadfadahClient.getGroupRooms();
      setRooms(nextRooms.length > 0 ? nextRooms : DEFAULT_PDF_ROOMS);
      setRoomsError('');
      setSelectedRoom((current) =>
        current ? nextRooms.find((room) => room.id === current.id) ?? null : null
      );
    } catch {
      // Graceful fallback to default rooms from Sohba Chat PDF specification (Figure 6)
      setRooms(DEFAULT_PDF_ROOMS);
      setRoomsError('');
    } finally {
      setRoomsBusy(false);
    }
  }, []);

  useEffect(() => {
    void loadRooms();
    return fadfadahClient.subscribe(() => {
      setSocketRefresh((tick) => tick + 1);
      void loadRooms();
    });
  }, [loadRooms]);

  useEffect(() => {
    if (!selectedRoom) {
      setMessages([]);
      return;
    }
    let active = true;
    const loadMessages = async () => {
      try {
        const nextMessages = await fadfadahClient.getGroupRoomMessages(selectedRoom.id);
        if (active) setMessages(nextMessages);
      } catch (error) {
        if (active) {
          setRoomsError(error instanceof Error ? error.message : localize('تعذر تحميل رسائل الغرفة.', 'Could not load room messages.', 'Impossible de charger les messages du salon.'));
        }
      }
    };
    void loadMessages();
    return () => {
      active = false;
    };
  }, [selectedRoom?.id, socketRefresh]);

  const visibleRooms = useMemo(
    () => rooms.filter((room) => room.category === activeCategory),
    [activeCategory, rooms]
  );
  const namesById = useMemo(
    () => new Map(allUsers.map((user) => [user.id, user.nickname])),
    [allUsers]
  );
  const mentionSearch = useMemo(() => {
    const match = messageText.match(/(?:^|\s)@([^\s@]*)$/u);
    if (!match || !selectedRoom?.is_member) return null;
    return {
      members: (selectedRoom.members ?? [])
        .filter((member) =>
          member.id !== selfUser.id &&
          member.nickname.toLocaleLowerCase().startsWith(match[1].toLocaleLowerCase())
        )
        .slice(0, 6),
    };
  }, [messageText, selectedRoom, selfUser.id]);

  const categoryName = (category: RoomCategory) => {
    if (category === 'PUBLIC') return localize('الغرف العامة', 'Public rooms', 'Salons publics');
    if (category === 'PRIVATE') return localize('الغرف الخاصة', 'Private rooms', 'Salons privés');
    return localize('جلسات مستضافة', 'Hosted sessions', 'Sessions hébergées');
  };

  const showAgeRequirement =
    roomsError.includes('PROFILE_REQUIRED') ||
    roomsError.includes('أكمل العمر والجنس');

  const handleCreateRoom = async (event: FormEvent) => {
    event.preventDefault();
    setCreateBusy(true);
    setRoomsError('');
    try {
      const room = await fadfadahClient.createGroupRoom({
        name_ar: roomName.trim(),
        name_en: roomNameEn.trim() || roomName.trim(),
        description_ar: roomDescription.trim(),
        description_en: roomDescriptionEn.trim() || roomDescription.trim(),
        category: createCategory,
        ...(createCategory === 'PRIVATE' ? { password: roomPassword } : {}),
      });
      setRooms((current) => [room, ...current]);
      setActiveCategory(createCategory);
      setSelectedRoom(room);
      setCreateOpen(false);
      setRoomName('');
      setRoomNameEn('');
      setRoomDescription('');
      setRoomDescriptionEn('');
      setRoomPassword('');
    } catch (error) {
      setRoomsError(error instanceof Error ? error.message : localize('تعذر إنشاء الغرفة.', 'Could not create the room.', 'Impossible de créer le salon.'));
    } finally {
      setCreateBusy(false);
    }
  };

  const joinRoom = async (room: GroupRoomDTO) => {
    setActionBusy(true);
    setRoomsError('');
    try {
      const joinedRoom = await fadfadahClient.joinGroupRoom(room.id);
      setRooms((current) => [
        joinedRoom,
        ...current.filter((currentRoom) => currentRoom.id !== joinedRoom.id),
      ]);
      setSelectedRoom(joinedRoom);
    } catch (error) {
      setRoomsError(error instanceof Error ? error.message : localize('تعذر الانضمام إلى الغرفة.', 'Could not join the room.', 'Impossible de rejoindre le salon.'));
    } finally {
      setActionBusy(false);
    }
  };

  const handleSendMessage = async (event: FormEvent) => {
    event.preventDefault();
    const clean = messageText.trim();
    if (!selectedRoom || !clean || messageBusy) return;
    setMessageBusy(true);
    setRoomsError('');
    try {
      const activeMentions = (selectedRoom.members ?? [])
        .filter(
          (member) =>
            mentionedUserIds.includes(member.id) &&
            clean.includes(`@${member.nickname}`)
        )
        .map((member) => member.id);
      const message = await fadfadahClient.sendGroupRoomMessage(
        selectedRoom.id,
        clean,
        activeMentions
      );
      setMessages((current) =>
        current.some((existing) => existing.id === message.id) ? current : [...current, message]
      );
      setMessageText('');
      setMentionedUserIds([]);
    } catch (error) {
      setRoomsError(error instanceof Error ? error.message : localize('تعذر إرسال الرسالة.', 'Could not send the message.', 'Impossible d’envoyer le message.'));
    } finally {
      setMessageBusy(false);
    }
  };

  const handleReportMessage = async (message: GroupRoomMessageDTO) => {
    if (!selectedRoom || reportingMessageId) return;
    setReportingMessageId(message.id);
    setRoomsError('');
    setRoomNotice('');
    try {
      const report = await fadfadahClient.submitReport({
        roomId: selectedRoom.id,
        reportedUserId: message.sender_id,
        target_type: 'message',
        target_id: message.id,
        reason: localize('محتوى غير مناسب في غرفة جماعية', 'Inappropriate group-room content', 'Contenu inapproprié dans un salon de groupe'),
      });
      if (report.ok) setRoomNotice(localize('تم إرسال البلاغ للمراجعة.', 'Report submitted for review.', 'Signalement envoyé pour examen.'));
      else setRoomsError(report.summary);
    } catch (error) {
      setRoomsError(error instanceof Error ? error.message : localize('تعذر إرسال البلاغ.', 'Could not submit the report.', 'Impossible d’envoyer le signalement.'));
    } finally {
      setReportingMessageId('');
    }
  };

  const handleLeaveRoom = async () => {
    if (!selectedRoom) return;
    setActionBusy(true);
    setRoomsError('');
    try {
      await fadfadahClient.leaveGroupRoom(selectedRoom.id);
      setSelectedRoom(null);
      await loadRooms();
    } catch (error) {
      setRoomsError(error instanceof Error ? error.message : localize('تعذر مغادرة الغرفة.', 'Could not leave the room.', 'Impossible de quitter le salon.'));
    } finally {
      setActionBusy(false);
    }
  };

  const handleJoinPrivateByCode = async (event: FormEvent) => {
    event.preventDefault();
    setActionBusy(true);
    setRoomsError('');
    try {
      const room = await fadfadahClient.joinPrivateGroupRoomByCode(
        privateRoomCode.trim(),
        privateRoomPassword
      );
      setRooms((current) => [room, ...current.filter((item) => item.id !== room.id)]);
      setSelectedRoom(room);
      setPrivateRoomCode('');
      setPrivateRoomPassword('');
    } catch (error) {
      setRoomsError(error instanceof Error ? error.message : localize('تعذر دخول الغرفة الخاصة.', 'Could not join the private room.', 'Impossible de rejoindre le salon privé.'));
    } finally {
      setActionBusy(false);
    }
  };

  if (selectedRoom?.is_member) {
    return (
      <section className="flex h-full min-h-0 flex-col bg-[#f7f8fc] dark:bg-[#151221]">
        <header className="flex items-center gap-3 border-b border-slate-200 bg-white px-4 py-3 dark:border-white/10 dark:bg-[#1e1b2e]">
          <button
            type="button"
            onClick={() => setSelectedRoom(null)}
            aria-label={localize('العودة إلى دليل الغرف', 'Back to room directory', 'Retour à la liste des salons')}
            className="flex h-10 w-10 items-center justify-center rounded-full text-slate-600 hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-white/10"
          >
            <ArrowLeft className="h-5 w-5 rtl:rotate-180" />
          </button>
          <div className="min-w-0 flex-1">
            <h2 className="truncate text-sm font-extrabold text-slate-900 dark:text-white">
              {isArabic ? selectedRoom.name_ar : selectedRoom.name_en}
            </h2>
            <p className="flex items-center gap-1 text-[11px] text-slate-500 dark:text-slate-400">
              <Users className="h-3.5 w-3.5" />
              {selectedRoom.member_count} {localize('عضو', 'members', 'membres')}
              {selectedRoom.is_host && (
                <span className="ms-1 inline-flex items-center gap-1 text-amber-600 dark:text-amber-300">
                  <Crown className="h-3 w-3" />
                  {localize('المضيف', 'Host', 'Hôte')}
                </span>
              )}
            </p>
            {selectedRoom.category === 'PRIVATE' && selectedRoom.invite_code && (
              <p className="mt-1 text-[10px] font-semibold text-blue-700 dark:text-blue-300">
                {localize(`رمز الدعوة: ${selectedRoom.invite_code}`, `Invite code: ${selectedRoom.invite_code}`, `Code d’invitation : ${selectedRoom.invite_code}`)}
              </p>
            )}
          </div>
          {selectedRoom.category === 'PRIVATE' && selectedRoom.invite_code && (
            <button
              type="button"
              onClick={() => {
                void nativeCopyText(selectedRoom.invite_code || '').then((copied) => {
                  setRoomNotice(
                    copied
                      ? localize('تم نسخ رمز الدعوة.', 'Invite code copied.', 'Code d’invitation copié.')
                      : localize('تعذر نسخ رمز الدعوة.', 'Could not copy the invite code.', 'Impossible de copier le code d’invitation.')
                  );
                });
              }}
              aria-label={localize('نسخ رمز الدعوة', 'Copy invite code', 'Copier le code d’invitation')}
              className="flex h-10 w-10 items-center justify-center rounded-xl text-blue-700 hover:bg-blue-50 dark:text-blue-200 dark:hover:bg-white/10"
            >
              <Copy className="h-4 w-4" />
            </button>
          )}
          <button
            type="button"
            disabled={actionBusy}
            onClick={() => void handleLeaveRoom()}
            className="flex min-h-10 items-center gap-1.5 rounded-xl px-3 text-xs font-bold text-rose-600 hover:bg-rose-50 disabled:opacity-50 dark:hover:bg-rose-400/10"
          >
            <DoorOpen className="h-4 w-4" />
            {localize('مغادرة', 'Leave', 'Quitter')}
          </button>
        </header>

        {roomNotice && (
          <p role="status" className="px-4 pt-2 text-[11px] font-semibold text-emerald-700 dark:text-emerald-300">
            {roomNotice}
          </p>
        )}
        <div className="flex-1 space-y-3 overflow-y-auto p-4">
          {!messages.length ? (
            <div className="mx-auto mt-12 max-w-xs text-center text-xs leading-6 text-slate-500 dark:text-slate-400">
              {localize(
                'ابدأ الحوار في هذه الغرفة. تذكّر أن تحافظ على مساحة آمنة ومحترمة للجميع.',
                'Start the conversation. Help keep this a safe and respectful space.',
                'Lancez la discussion et contribuez à préserver un espace sûr et respectueux pour tous.'
              )}
            </div>
          ) : (
            messages.map((message) => {
              const isMine = message.sender_id === selfUser.id;
              return (
                <article
                  key={message.id}
                  className={`max-w-[88%] rounded-2xl px-3.5 py-2.5 ${
                    isMine
                      ? 'ms-auto rounded-br-md bg-[#293f91] text-white'
                      : 'me-auto rounded-bl-md border border-slate-200 bg-white text-slate-800 dark:border-white/10 dark:bg-[#211e32] dark:text-slate-100'
                  }`}
                >
                  <p className={`mb-1 text-[10px] font-bold ${isMine ? 'text-blue-100' : 'text-violet-600 dark:text-violet-300'}`}>
                    {isMine ? localize('أنت', 'You', 'Vous') : namesById.get(message.sender_id) || localize('عضو', 'Member', 'Membre')}
                  </p>
                  <p className="whitespace-pre-wrap break-words text-sm leading-6">
                    {renderGroupMessageContent(message.content, selectedRoom.members)}
                  </p>
                  {!isMine && (
                    <button
                      type="button"
                      disabled={reportingMessageId === message.id}
                      onClick={() => void handleReportMessage(message)}
                      className={`mt-1 inline-flex min-h-7 items-center gap-1 text-[10px] ${
                        isMine ? 'text-blue-100/80' : 'text-slate-500 hover:text-rose-600 dark:text-slate-400'
                      }`}
                    >
                      <Flag className="h-3 w-3" />
                      {reportingMessageId === message.id
                        ? localize('جارٍ الإبلاغ...', 'Reporting...', 'Signalement en cours...')
                        : localize('إبلاغ', 'Report', 'Signaler')}
                    </button>
                  )}
                  {message.is_frozen && (
                    <p className="mt-1 text-[10px] text-amber-300">
                      {message.ai_flag_reason}
                    </p>
                  )}
                  <time className={`mt-1 block text-end text-[9px] ${isMine ? 'text-blue-100/70' : 'text-slate-400'}`}>
                    {new Date(message.created_at).toLocaleTimeString(lang, {
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </time>
                </article>
              );
            })
          )}
        </div>

        {roomsError && (
          <p role="alert" className="mx-4 mb-2 rounded-xl bg-rose-50 px-3 py-2 text-xs text-rose-700 dark:bg-rose-950/40 dark:text-rose-200">
            {roomsError}
          </p>
        )}
        <form onSubmit={handleSendMessage} className="flex items-end gap-2 border-t border-slate-200 bg-white p-3 dark:border-white/10 dark:bg-[#1e1b2e]">
          <div className="relative min-w-0 flex-1">
            {mentionSearch && mentionSearch.members.length > 0 && (
              <div
                role="listbox"
                aria-label={localize('أعضاء الغرفة', 'Room members', 'Membres du salon')}
                className="absolute inset-x-0 bottom-full z-20 mb-2 max-h-48 overflow-y-auto rounded-xl border border-slate-200 bg-white p-1 shadow-xl dark:border-white/10 dark:bg-[#211e32]"
              >
                {mentionSearch.members.map((member) => (
                  <button
                    key={member.id}
                    type="button"
                    role="option"
                    aria-selected={mentionedUserIds.includes(member.id)}
                    onClick={() => {
                      const atIndex = messageText.lastIndexOf('@');
                      setMessageText(`${messageText.slice(0, atIndex)}@${member.nickname} `);
                      setMentionedUserIds((current) =>
                        current.includes(member.id) ? current : [...current, member.id]
                      );
                    }}
                    className="flex min-h-10 w-full items-center rounded-lg px-3 text-start text-xs font-semibold text-slate-800 hover:bg-violet-50 dark:text-slate-100 dark:hover:bg-violet-400/10"
                  >
                    @{member.nickname}
                  </button>
                ))}
              </div>
            )}
            <textarea
              value={messageText}
              onChange={(event) => {
                const nextText = event.target.value;
                setMessageText(nextText);
                setMentionedUserIds((current) =>
                  current.filter((id) => {
                    const member = selectedRoom.members?.find((candidate) => candidate.id === id);
                    return Boolean(member && nextText.includes(`@${member.nickname}`));
                  })
                );
              }}
              maxLength={1000}
              rows={1}
              aria-label={localize('اكتب رسالة', 'Write a message', 'Écrire un message')}
              placeholder={localize('اكتب رسالة للغرفة...', 'Message the room...', 'Écrire un message au salon...')}
              className="max-h-28 min-h-11 w-full resize-y rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-900 outline-none focus:border-violet-400 dark:border-white/10 dark:bg-[#151221] dark:text-white"
            />
          </div>
          <button
            type="submit"
            disabled={messageBusy || !messageText.trim()}
            aria-label={localize('إرسال الرسالة', 'Send message', 'Envoyer le message')}
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-[#293f91] text-white disabled:opacity-40"
          >
            <Send className="h-4 w-4 rtl:rotate-180" />
          </button>
        </form>
      </section>
    );
  }

  return (
    <section className="mx-auto w-full max-w-3xl space-y-4 p-4 pb-6 sm:p-5">
      <header className="relative overflow-hidden rounded-[26px] bg-gradient-to-br from-[#18377f] via-[#24489e] to-[#3867ca] p-5 text-white shadow-lg shadow-blue-950/15 sm:p-6">
        <div aria-hidden="true" className="absolute -end-10 -top-20 h-52 w-52 rounded-full bg-white/10 blur-2xl" />
        <div className="relative flex items-start justify-between gap-4">
          <div>
            <span className="mb-3 inline-flex h-10 w-10 items-center justify-center rounded-2xl bg-white/15">
              <Compass className="h-5 w-5" />
            </span>
            <h2 className="text-xl font-black sm:text-2xl">
              {localize('مساحتك تبدأ من هنا', 'Find your conversation', 'Trouvez votre espace de discussion')}
            </h2>
            <p className="mt-1 max-w-md text-xs leading-5 text-blue-100">
              {localize(
                'اكتشف نقاشات عامة، غرفًا خاصة، وجلسات يديرها مضيفون.',
                'Discover public discussions, private rooms, and hosted sessions.',
                'Découvrez des discussions publiques, des salons privés et des sessions animées.'
              )}
            </p>
          </div>
          <button
            type="button"
            onClick={() => setCreateOpen(true)}
            className="flex min-h-11 shrink-0 items-center gap-1.5 rounded-xl bg-amber-400 px-3 text-xs font-extrabold text-blue-950 shadow-md hover:bg-amber-300"
          >
            <Plus className="h-4 w-4" />
            {localize('إنشاء غرفة', 'Create room', 'Créer un salon')}
          </button>
        </div>
      </header>

      <button
        type="button"
        onClick={onOpenRandomMatch}
        className="flex min-h-[58px] w-full items-center gap-3 rounded-2xl border border-blue-100 bg-white px-4 text-start shadow-sm transition hover:border-blue-300 dark:border-white/10 dark:bg-[#1e1b2e]"
      >
        <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-50 text-blue-700 dark:bg-blue-400/10 dark:text-blue-200">
          <MessageCircle className="h-5 w-5" />
        </span>
        <span className="flex-1">
          <strong className="block text-xs font-extrabold text-slate-900 dark:text-white">
            {localize('المطابقة العشوائية', 'Random matching', 'Discussion aléatoire')}
          </strong>
          <span className="mt-0.5 block text-[10px] text-slate-500 dark:text-slate-400">
            {localize('ابدأ محادثة فردية مع أشخاص جدد', 'Meet someone new one-on-one', 'Rencontrez quelqu’un en tête-à-tête')}
          </span>
        </span>
        <ArrowLeft className="h-4 w-4 text-slate-400 rtl:rotate-180" />
      </button>

      <nav className="grid grid-cols-4 gap-2 rounded-2xl bg-slate-100 p-1.5 dark:bg-white/5">
        {categoryOrder.map((category) => {
          const Icon = category === 'PRIVATE' ? LockKeyhole : category === 'HOSTED' ? Crown : Users;
          return (
            <button
              key={category}
              type="button"
              onClick={() => setActiveCategory(category)}
              aria-pressed={activeCategory === category}
              className={`flex min-h-10 items-center justify-center gap-1.5 rounded-xl px-1 text-[10px] font-bold transition sm:text-xs ${
                activeCategory === category
                  ? 'bg-white text-[#203d8c] shadow-sm dark:bg-[#28243a] dark:text-white'
                  : 'text-slate-500 dark:text-slate-400'
              }`}
            >
              <Icon className="h-3.5 w-3.5" />
              {categoryName(category)}
            </button>
          );
        })}
        <button
          type="button"
          onClick={() => setShowGamesArena(true)}
          className="flex min-h-10 items-center justify-center gap-1.5 rounded-xl px-1 text-[10px] font-bold text-violet-700 dark:text-violet-300 hover:bg-white/50 dark:hover:bg-white/5 transition sm:text-xs"
        >
          <Dices className="h-3.5 w-3.5" />
          {localize('الألعاب (22)', 'Games (22)', 'Jeux (22)')}
        </button>
      </nav>

      {showGamesArena && (
        <CasualGameArena
          opponentName={localize('صديق', 'Friend', 'Ami')}
          lang={lang}
          onClose={() => setShowGamesArena(false)}
        />
      )}

      {activeCategory === 'PRIVATE' && (
        <form
          onSubmit={(event) => void handleJoinPrivateByCode(event)}
          className="grid gap-2 rounded-2xl border border-slate-200 bg-white p-3 dark:border-white/10 dark:bg-[#1e1b2e] sm:grid-cols-[1fr_1fr_auto]"
        >
          <label className="sr-only" htmlFor="private-room-code">
            {localize('رمز دعوة الغرفة', 'Room invite code', 'Code d’invitation du salon')}
          </label>
          <input
            id="private-room-code"
            required
            maxLength={10}
            autoCapitalize="characters"
            value={privateRoomCode}
            onChange={(event) =>
              setPrivateRoomCode(
                event.target.value.replace(/[^a-fA-F0-9]/g, '').slice(0, 10).toUpperCase()
              )
            }
            placeholder={localize('رمز الدعوة', 'Invite code', 'Code d’invitation')}
            className="h-10 min-w-0 rounded-xl border border-slate-200 bg-slate-50 px-3 text-xs dark:border-white/10 dark:bg-[#151221]"
          />
          <label className="sr-only" htmlFor="private-room-password">
            {localize('كلمة مرور الغرفة', 'Room password', 'Mot de passe du salon')}
          </label>
          <input
            id="private-room-password"
            required
            type="password"
            value={privateRoomPassword}
            onChange={(event) => setPrivateRoomPassword(event.target.value)}
            placeholder={localize('كلمة المرور', 'Password', 'Mot de passe')}
            className="h-10 min-w-0 rounded-xl border border-slate-200 bg-slate-50 px-3 text-xs dark:border-white/10 dark:bg-[#151221]"
          />
          <button
            type="submit"
            disabled={actionBusy}
            className="min-h-10 rounded-xl bg-[#203d8c] px-4 text-xs font-bold text-white disabled:opacity-50"
          >
            {localize('دخول', 'Join', 'Rejoindre')}
          </button>
        </form>
      )}

      {roomsError && (
        <div role="alert" className="rounded-2xl border border-rose-200 bg-rose-50 p-4 text-xs leading-5 text-rose-800 dark:border-rose-400/20 dark:bg-rose-950/30 dark:text-rose-100">
          <p>{roomsError.replace('PROFILE_REQUIRED: ', '')}</p>
          {showAgeRequirement && (
            <button type="button" onClick={onOpenProfile} className="mt-2 min-h-9 rounded-lg bg-rose-700 px-3 font-bold text-white">
              {localize('إكمال الملف الشخصي', 'Complete your profile', 'Compléter votre profil')}
            </button>
          )}
        </div>
      )}

      <div className="flex items-center justify-between">
        <h3 className="text-sm font-extrabold text-slate-900 dark:text-white">
          {categoryName(activeCategory)}
        </h3>
        <button type="button" onClick={() => void loadRooms()} className="min-h-9 px-2 text-[11px] font-bold text-blue-700 dark:text-blue-300">
          {localize('تحديث', 'Refresh', 'Actualiser')}
        </button>
      </div>

      {roomsBusy ? (
        <div className="rounded-2xl border border-slate-200 bg-white p-8 text-center text-xs text-slate-500 dark:border-white/10 dark:bg-[#1e1b2e]">
          {localize('جارٍ تحميل الغرف...', 'Loading rooms...', 'Chargement des salons...')}
        </div>
      ) : visibleRooms.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-8 text-center dark:border-white/15 dark:bg-[#1e1b2e]">
          <Users className="mx-auto mb-2 h-7 w-7 text-slate-400" />
          <p className="text-xs font-semibold text-slate-700 dark:text-slate-200">
            {localize('لا توجد غرف في هذا القسم بعد', 'No rooms in this section yet', 'Aucun salon dans cette catégorie pour le moment')}
          </p>
          <p className="mt-1 text-[10px] text-slate-500 dark:text-slate-400">
            {localize('يمكنك إنشاء أول غرفة وبدء الحوار.', 'Create the first room and start a conversation.', 'Créez le premier salon et lancez la discussion.')}
          </p>
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          {visibleRooms.map((room) => (
            <article key={room.id} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-white/10 dark:bg-[#1e1b2e] transition hover:shadow-md">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <h4 className="truncate text-sm font-extrabold text-slate-900 dark:text-white">
                    {isArabic ? room.name_ar : room.name_en}
                  </h4>
                  <p className="mt-1 line-clamp-2 min-h-9 text-[11px] leading-5 text-slate-500 dark:text-slate-400">
                    {isArabic ? room.description_ar : room.description_en}
                  </p>
                </div>
                <div className="flex items-center gap-1.5 shrink-0">
                  <span className="text-xs font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1">
                    <span className="text-emerald-500 text-[10px]">●</span> {room.member_count}
                  </span>
                  <span className="px-1.5 py-0.5 rounded-md bg-slate-100 dark:bg-white/10 text-[10px] font-black text-slate-700 dark:text-slate-200">
                    {(room as any).countryCode || (room.category === 'PRIVATE' ? '—' : 'AR')}
                  </span>
                </div>
              </div>
              <div className="mt-3 flex items-center justify-between border-t border-slate-100 pt-3 dark:border-white/10">
                <span className="inline-flex items-center gap-1 text-[10px] text-slate-500 dark:text-slate-400">
                  <Users className="h-3.5 w-3.5" />
                  {room.member_count} {localize('عضو', 'members', 'membres')}
                </span>
                {room.is_member ? (
                  <button type="button" onClick={() => setSelectedRoom(room)} className="min-h-9 rounded-lg bg-blue-700 px-3 text-[11px] font-bold text-white">
                    {localize('فتح الغرفة', 'Open room', 'Ouvrir le salon')}
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={() => void joinRoom(room)}
                    className="min-h-9 rounded-lg bg-[#203d8c] px-3 text-[11px] font-bold text-white"
                  >
                    {localize('انضمام', 'Join', 'Rejoindre')}
                  </button>
                )}
              </div>
            </article>
          ))}
        </div>
      )}

      {createOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4" role="presentation">
          <form onSubmit={(event) => void handleCreateRoom(event)} className="max-h-[90dvh] w-full max-w-md space-y-4 overflow-y-auto rounded-3xl bg-white p-5 shadow-2xl dark:bg-[#211e32]">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-extrabold text-slate-900 dark:text-white">{localize('إنشاء غرفة جديدة', 'Create a room', 'Créer un salon')}</h3>
              <button type="button" onClick={() => setCreateOpen(false)} aria-label={localize('إغلاق', 'Close', 'Fermer')} className="flex h-9 w-9 items-center justify-center rounded-full hover:bg-slate-100 dark:hover:bg-white/10"><X className="h-4 w-4" /></button>
            </div>
            <label className="block space-y-1.5 text-xs font-semibold">
              <span>{localize('اسم الغرفة بالعربية', 'Room name in Arabic', 'Nom du salon en arabe')}</span>
              <input required maxLength={50} value={roomName} onChange={(event) => setRoomName(event.target.value)} className="h-11 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 text-sm dark:border-white/10 dark:bg-[#151221]" />
            </label>
            <label className="block space-y-1.5 text-xs font-semibold">
              <span>{localize('اسم الغرفة بالإنجليزية (اختياري)', 'Room name in English (optional)', 'Nom du salon en anglais (facultatif)')}</span>
              <input maxLength={50} value={roomNameEn} onChange={(event) => setRoomNameEn(event.target.value)} className="h-11 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 text-sm dark:border-white/10 dark:bg-[#151221]" />
            </label>
            <label className="block space-y-1.5 text-xs font-semibold">
              <span>{localize('وصف مختصر بالعربية', 'Short description in Arabic', 'Brève description en arabe')}</span>
              <textarea maxLength={240} rows={3} value={roomDescription} onChange={(event) => setRoomDescription(event.target.value)} className="w-full rounded-xl border border-slate-200 bg-slate-50 p-3 text-sm dark:border-white/10 dark:bg-[#151221]" />
            </label>
            <label className="block space-y-1.5 text-xs font-semibold">
              <span>{localize('وصف مختصر بالإنجليزية (اختياري)', 'Short description in English (optional)', 'Brève description en anglais (facultatif)')}</span>
              <textarea maxLength={240} rows={3} value={roomDescriptionEn} onChange={(event) => setRoomDescriptionEn(event.target.value)} className="w-full rounded-xl border border-slate-200 bg-slate-50 p-3 text-sm dark:border-white/10 dark:bg-[#151221]" />
            </label>
            <label className="block space-y-1.5 text-xs font-semibold">
              <span>{localize('نوع الغرفة', 'Room type', 'Type de salon')}</span>
              <select value={createCategory} onChange={(event) => {
                const category = categoryOrder.find((item) => item === event.target.value);
                if (category) setCreateCategory(category);
              }} className="h-11 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 text-sm dark:border-white/10 dark:bg-[#151221]">
                <option value="PUBLIC">{localize('غرفة عامة', 'Public room', 'Salon public')}</option>
                <option value="PRIVATE">{localize('غرفة خاصة بكلمة مرور', 'Private room with password', 'Salon privé avec mot de passe')}</option>
                <option value="HOSTED">{localize('جلسة نقاش مستضافة', 'Hosted discussion', 'Discussion animée')}</option>
              </select>
            </label>
            {createCategory === 'PRIVATE' && (
              <label className="block space-y-1.5 text-xs font-semibold">
                <span>{localize('كلمة مرور (6 أحرف على الأقل)', 'Password (at least 6 characters)', 'Mot de passe (6 caractères minimum)')}</span>
                <input required minLength={6} maxLength={64} type="password" autoComplete="new-password" value={roomPassword} onChange={(event) => setRoomPassword(event.target.value)} className="h-11 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 text-sm dark:border-white/10 dark:bg-[#151221]" />
              </label>
            )}
            {roomsError && <p role="alert" className="text-xs text-rose-600">{roomsError}</p>}
            <button type="submit" disabled={createBusy || !roomName.trim()} className="flex min-h-11 w-full items-center justify-center gap-2 rounded-xl bg-[#203d8c] text-sm font-bold text-white disabled:opacity-50">
              <Plus className="h-4 w-4" />
              {createBusy
                ? localize('جارٍ الإنشاء...', 'Creating...', 'Création en cours...')
                : localize('إنشاء وفتح الغرفة', 'Create and open', 'Créer et ouvrir')}
            </button>
          </form>
        </div>
      )}

    </section>
  );
};
