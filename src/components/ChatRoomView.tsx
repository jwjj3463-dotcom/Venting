import React, { useEffect, useRef, useState } from 'react';
import {
  ArrowRight,
  ArrowLeft,
  Ban,
  Flag,
  Send,
  Smile,
  ImagePlus,
  Check,
  CheckCheck,
  ShieldAlert,
  X,
  ShieldCheck,
  Camera,
} from 'lucide-react';
import { FramedAvatar, OfficialBadge } from './FramedAvatar';
import {
  RealmChatRoom,
  RealmMessage,
  RealmUser,
} from '../db/realmLocalDB';
import { fadfadahClient } from '../services/fadfadahNetworkClient';
import { AppLang, TRANSLATIONS } from '../i18n/translations';
import { watchAndroidSafeChatScreenshots } from '../services/androidNative';

interface ChatRoomViewProps {
  room: RealmChatRoom;
  selfUser: RealmUser;
  peerUser: RealmUser;
  messages: RealmMessage[];
  lang: AppLang;
  onBack: () => void;
}

const EXPRESSIVE_STICKERS = [
  { id: 'support', labelAr: 'أنا أسمعك', labelEn: 'Here for you', symbol: '💜' },
  { id: 'coffee', labelAr: 'قهوة هادئة', labelEn: 'Warm Coffee', symbol: '☕' },
  { id: 'star', labelAr: 'كلام ملهم', labelEn: 'Inspiring', symbol: '✨' },
  { id: 'peace', labelAr: 'سلام وهدوء', labelEn: 'Peaceful', symbol: '🌿' },
  { id: 'smile', labelAr: 'شكراً جزيلاً', labelEn: 'Thank you', symbol: '🌸' },
];

const MAX_CHAT_IMAGE_SIZE = 2.5 * 1024 * 1024;
const MAX_CHAT_IMAGE_PAYLOAD_SIZE = 650 * 1024;

async function prepareChatImage(file: File): Promise<string> {
  if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) {
    throw new Error('UNSUPPORTED_IMAGE_TYPE');
  }

  const bitmap = await createImageBitmap(file);
  try {
    let scale = Math.min(1, 1280 / Math.max(bitmap.width, bitmap.height));
    for (let resizeAttempt = 0; resizeAttempt < 5; resizeAttempt += 1) {
      const canvas = document.createElement('canvas');
      canvas.width = Math.max(1, Math.round(bitmap.width * scale));
      canvas.height = Math.max(1, Math.round(bitmap.height * scale));
      const context = canvas.getContext('2d');
      if (!context) throw new Error('IMAGE_PROCESSING_FAILED');
      context.fillStyle = '#fff';
      context.fillRect(0, 0, canvas.width, canvas.height);
      context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);

      let quality = 0.82;
      for (let qualityAttempt = 0; qualityAttempt < 5; qualityAttempt += 1) {
        const blob = await new Promise<Blob | null>((resolve) =>
          canvas.toBlob(resolve, 'image/jpeg', quality)
        );
        if (!blob) throw new Error('IMAGE_PROCESSING_FAILED');
        if (blob.size <= MAX_CHAT_IMAGE_PAYLOAD_SIZE) {
          return await new Promise<string>((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => resolve(String(reader.result || ''));
            reader.onerror = () => reject(new Error('IMAGE_PROCESSING_FAILED'));
            reader.readAsDataURL(blob);
          });
        }
        quality -= 0.1;
      }
      scale *= 0.75;
    }
  } finally {
    bitmap.close();
  }
  throw new Error('IMAGE_TOO_LARGE_AFTER_COMPRESSION');
}

export const ChatRoomView: React.FC<ChatRoomViewProps> = ({
  room,
  selfUser,
  peerUser,
  messages,
  lang,
  onBack,
}) => {
  const t = TRANSLATIONS[lang];
  const [inputText, setInputText] = useState('');
  const [showStickers, setShowStickers] = useState(false);
  const [peerTyping, setPeerTyping] = useState(() =>
    fadfadahClient.isPeerTypingInRoom(room.id)
  );
  const [moderationNotice, setModerationNotice] = useState('');
  const [showBlockModal, setShowBlockModal] = useState(false);
  const [showReportModal, setShowReportModal] = useState(false);
  const [reportReason, setReportReason] = useState('إزعاج أو سلوك غير لائق');
  const [submittingReport, setSubmittingReport] = useState(false);
  const [reportFeedback, setReportFeedback] = useState('');
  const [safeChatDuration, setSafeChatDuration] = useState(60);
  const [safeChatBusy, setSafeChatBusy] = useState(false);
  const [safeChatNotice, setSafeChatNotice] = useState('');
  const [safeChatNow, setSafeChatNow] = useState(Date.now());
  const [captureSupported, setCaptureSupported] = useState(false);

  const bottomRef = useRef<HTMLDivElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const typingTimeoutRef = useRef<number | null>(null);
  const lastScreenshotNoticeRef = useRef(0);

  // Subscribe to real WebSocket typing updates from the other device
  useEffect(() => {
    lastScreenshotNoticeRef.current =
      fadfadahClient.getSafeChatScreenshotNotice(room.id)?.createdAt ?? 0;
    const unsub = fadfadahClient.subscribe(() => {
      setPeerTyping(fadfadahClient.isPeerTypingInRoom(room.id));
      const notice = fadfadahClient.getSafeChatScreenshotNotice(room.id);
      if (notice && notice.createdAt > lastScreenshotNoticeRef.current) {
        lastScreenshotNoticeRef.current = notice.createdAt;
        setSafeChatNotice(
          lang === 'ar'
            ? `أبلغ ${notice.nickname || 'الطرف الآخر'} عن التقاط الشاشة أثناء وضع المحادثة الآمنة.`
            : `${notice.nickname || 'The other participant'} reported a screenshot during Safe Chat.`
        );
      }
    });
    return () => {
      unsub();
      fadfadahClient.sendTypingIndicator(room.id, false);
    };
  }, [lang, room.id]);

  useEffect(() => {
    if (room.safe_chat_status !== 'ACTIVE') return;
    const timer = window.setInterval(() => setSafeChatNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, [room.safe_chat_status, room.safe_chat_expires_at]);

  useEffect(() => {
    if (room.safe_chat_status !== 'ACTIVE') {
      setCaptureSupported(false);
      return;
    }

    return watchAndroidSafeChatScreenshots(
      () => {
        void fadfadahClient.reportSafeChatScreenshot(room.id).catch((error: unknown) => {
          console.error('Could not report a Safe Chat screenshot:', error);
          setSafeChatNotice(
            lang === 'ar'
              ? 'تعذر إرسال تنبيه التقاط الشاشة للطرف الآخر.'
              : 'Could not notify the other participant about the screenshot.'
          );
        });
      },
      setCaptureSupported
    );
  }, [lang, room.id, room.safe_chat_status]);

  const updateSafeChat = async (
    action: 'REQUEST' | 'ACCEPT' | 'DISABLE',
    durationSeconds?: number
  ) => {
    setSafeChatBusy(true);
    setSafeChatNotice('');
    try {
      const result = await fadfadahClient.updateSafeChat(room.id, action, durationSeconds);
      if (!result.ok) {
        setSafeChatNotice(result.error || (lang === 'ar' ? 'تعذر تحديث وضع المحادثة الآمنة.' : 'Could not update Safe Chat.'));
      }
    } catch (error) {
      console.error('Could not update Safe Chat:', error);
      setSafeChatNotice(
        lang === 'ar' ? 'تعذر الاتصال لتحديث وضع المحادثة الآمنة.' : 'Could not connect to update Safe Chat.'
      );
    } finally {
      setSafeChatBusy(false);
    }
  };

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages.length, peerTyping]);

  // Mark incoming messages as READ (✓✓) on the real server
  useEffect(() => {
    const hasUnread =
      room.unread_count > 0 ||
      messages.some((m) => m.sender_id !== selfUser.id && m.status !== 'READ');
    if (hasUnread) {
      fadfadahClient.markRoomRead(room.id);
    }
  }, [room.id, room.unread_count, messages.length, selfUser.id]);

  const formatTime = (ts: number) => {
    return new Date(ts).toLocaleTimeString(lang === 'ar' ? 'ar-EG' : 'en-US', {
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const handleInputChange = (val: string) => {
    setInputText(val);
    fadfadahClient.sendTypingIndicator(room.id, val.trim().length > 0);
    if (typingTimeoutRef.current) {
      window.clearTimeout(typingTimeoutRef.current);
    }
    typingTimeoutRef.current = window.setTimeout(() => {
      fadfadahClient.sendTypingIndicator(room.id, false);
    }, 2200);
  };

  const handleSendMessage = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const clean = inputText.trim();
    if (!clean) return;

    setInputText('');
    setModerationNotice('');
    fadfadahClient.sendTypingIndicator(room.id, false);

    const res = await fadfadahClient.sendMessage(room.id, {
      content: clean,
      media_type: 'text',
    });

    if (res.isFrozen || !res.ok) {
      setModerationNotice(
        res.reason ||
          (lang === 'ar'
            ? 'تم تجميد الرسالة لمخالفتها إرشادات السلامة.'
            : 'Message blocked by safety moderation.')
      );
    }
  };

  const handleSendSticker = async (sticker: (typeof EXPRESSIVE_STICKERS)[number]) => {
    setShowStickers(false);
    const label = lang === 'ar' ? sticker.labelAr : sticker.labelEn;
    await fadfadahClient.sendMessage(room.id, {
      content: `${sticker.symbol} ${label}`,
      media_url: sticker.id,
      media_type: 'sticker',
    });
  };

  const handleImageAttach = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = '';
    if (file.size > MAX_CHAT_IMAGE_SIZE) {
      setModerationNotice(
        lang === 'ar' ? 'حجم الصورة يتجاوز الحد المسموح (2.5 ميجابايت).' : 'Image exceeds 2.5MB limit.'
      );
      return;
    }

    try {
      const dataUrl = await prepareChatImage(file);
      setModerationNotice(
        lang === 'ar' ? 'جارٍ فحص وإرسال الصورة...' : 'Scanning & sending image...'
      );
      const res = await fadfadahClient.sendMessage(room.id, {
        content: lang === 'ar' ? 'صورة مرفقة' : 'Attached Photo',
        media_url: dataUrl,
        media_type: 'image',
      });
      setModerationNotice('');
      if (res.isFrozen || !res.ok) {
        setModerationNotice(
          res.reason === 'INVALID_IMAGE_ATTACHMENT'
            ? lang === 'ar'
              ? 'الصورة غير صالحة أو يتجاوز حجمها الحد الآمن للإرسال.'
              : 'The image is invalid or exceeds the safe sending size.'
            : res.reason ||
                (lang === 'ar' ? 'تم رفض الصورة المرفقة لمعايير الأمان.' : 'Image rejected by moderation.')
        );
      }
    } catch (error) {
      const reason = error instanceof Error ? error.message : '';
      setModerationNotice(
        reason === 'UNSUPPORTED_IMAGE_TYPE'
            ? lang === 'ar'
              ? 'صيغة الصورة غير مدعومة. استخدم JPG أو PNG أو WebP.'
              : 'Unsupported image format. Use JPG, PNG, or WebP.'
            : reason === 'IMAGE_TOO_LARGE_AFTER_COMPRESSION'
              ? lang === 'ar'
                ? 'تعذر تجهيز الصورة بالحجم المناسب للإرسال.'
                : 'The image could not be reduced enough to send.'
              : lang === 'ar'
                ? 'تعذرت معالجة الصورة أو إرسالها.'
                : 'Could not process or send the image.'
      );
    }
  };

  const handleConfirmBlock = async () => {
    await fadfadahClient.blockPeer(room.id);
    setShowBlockModal(false);
    onBack();
  };

  const handleConfirmReport = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmittingReport(true);
    const res = await fadfadahClient.submitReport({
      roomId: room.id,
      reportedUserId: peerUser.id,
      target_type: 'user',
      reason: reportReason,
      details: `بلاغ إشرافي مباشر من داخل المحادثة ضد ${peerUser.nickname}`,
    });
    setSubmittingReport(false);
    setReportFeedback(res.summary);
  };

  return (
    <div className="flex flex-col h-full bg-[#F8F9FA] dark:bg-[#151221]">
      {/* Native Android Chat App Bar */}
      <header className="px-3 pt-safe min-h-[60px] shrink-0 bg-[#2D1B69] text-white flex items-center justify-between gap-2 border-b border-white/10">
        <div className="flex items-center gap-2 min-w-0">
          <button
            type="button"
            onClick={onBack}
            aria-label="Back"
            className="lg:hidden min-h-[44px] min-w-[44px] rounded-full active:bg-white/15 flex items-center justify-center transition-colors shrink-0"
          >
            {lang === 'ar' ? <ArrowRight className="w-5 h-5" /> : <ArrowLeft className="w-5 h-5" />}
          </button>
          <FramedAvatar
            avatarUrl={peerUser.avatar_url}
            frameId={peerUser.frame_id}
            nickname={peerUser.nickname}
            size="sm"
          />
          <div className="min-w-0">
            <h2 className="flex items-center gap-1 text-sm font-bold truncate">
              <span className="truncate">{peerUser.nickname}</span>
              <OfficialBadge role={peerUser.role} />
            </h2>
            <p className="text-[11px] text-purple-200/85 truncate">
              {peerTyping
                ? t.typingNow
                : `${
                    peerUser.is_online
                      ? lang === 'ar'
                        ? 'متصل الآن'
                        : 'Online'
                      : lang === 'ar'
                      ? 'غير متصل حالياً'
                      : 'Offline'
                  } · ${
                    room.type === 'LINK_BASED'
                      ? lang === 'ar'
                        ? 'رسالة رابط'
                        : 'Link Chat'
                      : lang === 'ar'
                      ? 'مطابقة عشوائية'
                      : 'Random Chat'
                  }`}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-1 shrink-0">
          <button
            type="button"
            onClick={() => {
              setReportFeedback('');
              setShowReportModal(true);
            }}
            title={t.reportUser}
            className="min-h-[44px] min-w-[44px] rounded-full active:bg-white/15 text-amber-300 flex items-center justify-center transition-colors"
          >
            <Flag className="w-4 h-4" />
          </button>
          <button
            type="button"
            onClick={() => setShowBlockModal(true)}
            title={t.blockUser}
            className="min-h-[44px] min-w-[44px] rounded-full active:bg-rose-500/25 text-rose-300 flex items-center justify-center transition-colors"
          >
            <Ban className="w-4 h-4" />
          </button>
        </div>
      </header>

      {room.status === 'ACCEPTED' && (
        <section className="shrink-0 border-b border-violet-200/70 bg-violet-50 px-4 py-3 dark:border-violet-400/15 dark:bg-[#211b36]">
          <div className="flex items-start gap-3">
            <div className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-violet-100 text-violet-700 dark:bg-violet-400/15 dark:text-violet-200">
              <ShieldCheck className="h-5 w-5" />
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                  {lang === 'ar' ? 'المحادثة الآمنة' : 'Safe Chat'}
                </h3>
                {room.safe_chat_status === 'ACTIVE' && (
                  <span className="rounded-full bg-emerald-100 px-2.5 py-1 text-xs font-bold tabular-nums text-emerald-800 dark:bg-emerald-400/15 dark:text-emerald-200">
                    {lang === 'ar' ? 'متبقٍ ' : 'Remaining '}
                    {Math.max(
                      0,
                      Math.ceil(((room.safe_chat_expires_at ?? 0) - safeChatNow) / 1000)
                    )}
                    {lang === 'ar' ? ' ث' : 's'}
                  </span>
                )}
              </div>
              <p className="mt-1 text-xs leading-relaxed text-slate-600 dark:text-slate-300">
                {room.safe_chat_status === 'ACTIVE'
                  ? lang === 'ar'
                    ? 'سيُحذف سجل رسائل هذه المحادثة عند انتهاء المؤقت، ويُعاد ضبطه مع كل رسالة. قد لا تتوفر إشعارات التقاط الشاشة على كل الأجهزة.'
                    : 'This room’s messages will be deleted when the timer expires and the timer resets with each message. Screenshot alerts are not available on every device.'
                  : room.safe_chat_status === 'PENDING'
                    ? room.safe_chat_requested_by === selfUser.id
                      ? lang === 'ar'
                        ? 'أرسلت طلبًا لتفعيل الحذف التلقائي؛ بانتظار موافقة الطرف الآخر.'
                        : 'Your auto-delete request is waiting for the other participant.'
                      : lang === 'ar'
                        ? 'الطرف الآخر يطلب تفعيل الحذف التلقائي للرسائل.'
                        : 'The other participant requested automatic message deletion.'
                    : lang === 'ar'
                      ? 'فعّلوا الوضع بموافقة الطرفين. يبدأ الحذف بعد مدة خمول تختارونها.'
                      : 'Both participants must agree. Choose how long messages remain after inactivity.'}
              </p>

              {room.safe_chat_status === 'OFF' ? (
                <div className="mt-2.5 flex flex-wrap items-center gap-2">
                  <select
                    value={safeChatDuration}
                    onChange={(event) => setSafeChatDuration(Number(event.target.value))}
                    aria-label={lang === 'ar' ? 'مدة الحذف التلقائي' : 'Auto-delete duration'}
                    className="min-h-10 rounded-xl border border-violet-200 bg-white px-3 text-xs font-semibold text-slate-800 dark:border-white/10 dark:bg-[#151221] dark:text-white"
                  >
                    <option value={60}>{lang === 'ar' ? 'دقيقة' : '1 minute'}</option>
                    <option value={300}>{lang === 'ar' ? '5 دقائق' : '5 minutes'}</option>
                    <option value={900}>{lang === 'ar' ? '15 دقيقة' : '15 minutes'}</option>
                  </select>
                  <button
                    type="button"
                    disabled={safeChatBusy}
                    onClick={() => void updateSafeChat('REQUEST', safeChatDuration)}
                    className="min-h-10 rounded-xl bg-violet-700 px-4 text-xs font-bold text-white disabled:opacity-50"
                  >
                    {lang === 'ar' ? 'طلب التفعيل' : 'Request Safe Chat'}
                  </button>
                </div>
              ) : room.safe_chat_status === 'PENDING' ? (
                <div className="mt-2.5 flex flex-wrap gap-2">
                  {room.safe_chat_requested_by !== selfUser.id && (
                    <button
                      type="button"
                      disabled={safeChatBusy}
                      onClick={() => void updateSafeChat('ACCEPT')}
                      className="min-h-10 rounded-xl bg-violet-700 px-4 text-xs font-bold text-white disabled:opacity-50"
                    >
                      {lang === 'ar' ? 'موافقة وبدء' : 'Accept & start'}
                    </button>
                  )}
                  <button
                    type="button"
                    disabled={safeChatBusy}
                    onClick={() => void updateSafeChat('DISABLE')}
                    className="min-h-10 rounded-xl border border-slate-300 px-4 text-xs font-bold text-slate-700 dark:border-white/15 dark:text-slate-200 disabled:opacity-50"
                  >
                    {lang === 'ar' ? 'رفض / إلغاء' : 'Decline / cancel'}
                  </button>
                </div>
              ) : (
                <div className="mt-2.5 flex flex-wrap items-center gap-2">
                  {captureSupported && (
                    <span className="inline-flex items-center gap-1 text-[11px] text-slate-500 dark:text-slate-400">
                      <Camera className="h-3.5 w-3.5" />
                      {lang === 'ar' ? 'تنبيه الالتقاط مدعوم على هذا الجهاز' : 'Screenshot alerts supported on this device'}
                    </span>
                  )}
                  <button
                    type="button"
                    disabled={safeChatBusy}
                    onClick={() => void updateSafeChat('DISABLE')}
                    className="min-h-9 rounded-xl border border-slate-300 px-3 text-xs font-bold text-slate-700 dark:border-white/15 dark:text-slate-200 disabled:opacity-50"
                  >
                    {lang === 'ar' ? 'إيقاف الوضع' : 'Turn off'}
                  </button>
                </div>
              )}
              {safeChatNotice && (
                <p role="status" className="mt-2 text-xs font-medium text-amber-700 dark:text-amber-300">
                  {safeChatNotice}
                </p>
              )}
            </div>
          </div>
        </section>
      )}

      {/* Real-Time Message Stream */}
      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-3">
        {room.status === 'PENDING' && (
          <div className="p-3 rounded-2xl bg-amber-50 dark:bg-amber-950/35 border border-amber-200 dark:border-amber-800/50 text-center text-xs text-amber-800 dark:text-amber-200">
            {lang === 'ar'
              ? 'بانتظار قبول الطرف الآخر لطلب المحادثة لبدء الدردشة المباشرة.'
              : 'Waiting for the other user to accept the chat request.'}
          </div>
        )}

        {messages.map((msg) => {
          const isMe = msg.sender_id === selfUser.id;
          return (
            <div key={msg.id} className={`flex flex-col ${isMe ? 'items-start' : 'items-end'}`}>
              <div
                className={`max-w-[82%] sm:max-w-[72%] rounded-2xl px-4 py-2.5 text-sm leading-relaxed selectable-text ${
                  msg.is_frozen
                    ? 'bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800/60 text-rose-700 dark:text-rose-300'
                    : isMe
                    ? 'bg-[#8B5CF6] text-white rounded-br-sm shadow-sm'
                    : 'bg-white dark:bg-[#1E1B2E] text-slate-900 dark:text-slate-100 border border-slate-200/80 dark:border-white/10 rounded-bl-sm'
                }`}
              >
                {msg.is_frozen ? (
                  <div className="flex items-start gap-2 text-xs">
                    <ShieldAlert className="w-4 h-4 shrink-0 mt-0.5" />
                    <span>
                      {msg.ai_flag_reason ||
                        (lang === 'ar'
                          ? 'تم تجميد الرسالة بواسطة نظام الحماية'
                          : 'Message frozen by safety moderation')}
                    </span>
                  </div>
                ) : msg.message_type === 'INTRO_CARD' && msg.introduction ? (
                  <div className="space-y-3">
                    <div className="flex items-center gap-2.5">
                      <FramedAvatar
                        avatarUrl={msg.introduction.avatar_url}
                        frameId={msg.introduction.frame_id}
                        nickname={msg.introduction.nickname}
                        size="sm"
                      />
                      <div className="min-w-0">
                        <p className="flex items-center gap-1 text-xs font-bold">
                          <span className="truncate">
                            {msg.introduction.is_anonymous
                              ? lang === 'ar'
                                ? 'زائر مجهول'
                                : 'Anonymous visitor'
                              : msg.introduction.nickname}
                          </span>
                          {!msg.introduction.is_anonymous && (
                            <OfficialBadge
                              role={(isMe ? selfUser.role : peerUser.role)}
                            />
                          )}
                        </p>
                        <p className="text-[10px] opacity-70">
                          {lang === 'ar' ? 'بطاقة تعارف' : 'Introduction card'}
                          {msg.introduction.age ? ` · ${msg.introduction.age}` : ''}
                        </p>
                      </div>
                    </div>
                    {msg.introduction.bio && (
                      <p className="text-xs leading-relaxed opacity-90">{msg.introduction.bio}</p>
                    )}
                    {msg.introduction.interests.length > 0 && (
                      <div className="flex flex-wrap gap-1.5">
                        {msg.introduction.interests.map((interest) => (
                          <span
                            key={interest}
                            className={`rounded-full px-2 py-1 text-[10px] ${
                              isMe
                                ? 'bg-white/15 text-white'
                                : 'bg-[#8B5CF6]/10 text-[#6D28D9] dark:text-purple-200'
                            }`}
                          >
                            {interest}
                          </span>
                        ))}
                      </div>
                    )}
                    <p className="whitespace-pre-wrap break-words border-t border-current/10 pt-2 text-sm font-medium leading-relaxed">
                      {msg.content}
                    </p>
                  </div>
                ) : msg.media_type === 'image' && msg.media_url ? (
                  <div className="space-y-1.5">
                    <img
                      src={msg.media_url}
                      alt={msg.content}
                      referrerPolicy="no-referrer"
                      className="rounded-xl max-h-60 w-auto object-cover"
                    />
                    <p className="text-xs opacity-90">{msg.content}</p>
                  </div>
                ) : msg.media_type === 'sticker' ? (
                  <p className="text-base font-semibold py-0.5">{msg.content}</p>
                ) : (
                  <p className="whitespace-pre-wrap break-words">{msg.content}</p>
                )}

                <div
                  className={`flex items-center justify-end gap-1 mt-1 text-[11px] font-mono-num ${
                    msg.is_frozen
                      ? 'text-rose-500'
                      : isMe
                      ? 'text-purple-100/85'
                      : 'text-slate-400 dark:text-slate-500'
                  }`}
                >
                  <span>{formatTime(msg.created_at)}</span>
                  {isMe &&
                    !msg.is_frozen &&
                    (msg.status === 'READ' ? (
                      <CheckCheck className="w-3.5 h-3.5 text-white" />
                    ) : (
                      <Check className="w-3.5 h-3.5 text-purple-200" />
                    ))}
                </div>
              </div>
            </div>
          );
        })}

        {peerTyping && (
          <div className="flex justify-end">
            <div className="rounded-2xl px-4 py-2 bg-white dark:bg-[#1E1B2E] border border-slate-200 dark:border-white/10 text-xs text-slate-500 dark:text-slate-400">
              {peerUser.nickname} {t.typingNow}
            </div>
          </div>
        )}

        <div ref={bottomRef} />
      </div>

      {moderationNotice && (
        <div className="mx-3 mb-2 px-3.5 py-2.5 rounded-xl bg-amber-50 dark:bg-amber-950/50 border border-amber-200 dark:border-amber-800/60 flex items-center justify-between gap-2 text-xs text-amber-800 dark:text-amber-200">
          <span>{moderationNotice}</span>
          <button
            type="button"
            onClick={() => setModerationNotice('')}
            className="min-h-[32px] min-w-[32px] flex items-center justify-center"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {showStickers && (
        <div className="px-3 py-2.5 bg-white dark:bg-[#1E1B2E] border-t border-slate-200 dark:border-white/10 flex items-center gap-2 overflow-x-auto">
          {EXPRESSIVE_STICKERS.map((st) => (
            <button
              key={st.id}
              type="button"
              onClick={() => handleSendSticker(st)}
              className="min-h-[44px] px-3.5 py-2 rounded-xl bg-slate-100 dark:bg-[#28243D] active:bg-[#8B5CF6]/20 text-xs font-medium text-slate-800 dark:text-slate-200 flex items-center gap-1.5 whitespace-nowrap shrink-0"
            >
              <span>{st.symbol}</span>
              <span>{lang === 'ar' ? st.labelAr : st.labelEn}</span>
            </button>
          ))}
        </div>
      )}

      {/* Native Android Input Action Toolbar */}
      <form
        onSubmit={handleSendMessage}
        className="px-3 pt-2 pb-safe min-h-[60px] bg-white dark:bg-[#1E1B2E] border-t border-slate-200 dark:border-white/10 flex items-center gap-1.5 shrink-0"
      >
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          onChange={handleImageAttach}
          className="hidden"
        />
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          title={lang === 'ar' ? 'إرفاق صورة' : 'Attach image'}
          className="min-h-[44px] min-w-[44px] rounded-full text-slate-500 dark:text-slate-400 active:bg-slate-100 dark:active:bg-white/10 flex items-center justify-center shrink-0"
        >
          <ImagePlus className="w-5 h-5" />
        </button>

        <button
          type="button"
          onClick={() => setShowStickers((v) => !v)}
          title={lang === 'ar' ? 'ملصقات' : 'Stickers'}
          className={`min-h-[44px] min-w-[44px] rounded-full flex items-center justify-center shrink-0 ${
            showStickers ? 'text-[#8B5CF6] bg-[#8B5CF6]/15' : 'text-slate-500 dark:text-slate-400'
          }`}
        >
          <Smile className="w-5 h-5" />
        </button>

        <input
          type="text"
          value={inputText}
          onChange={(e) => handleInputChange(e.target.value)}
          placeholder={t.writeMessage}
          className="flex-1 h-11 px-4 rounded-full bg-slate-100 dark:bg-[#151221] border border-slate-200/80 dark:border-white/10 text-sm text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-[#8B5CF6]"
        />

        <button
          type="submit"
          disabled={!inputText.trim()}
          aria-label={t.send}
          className="min-h-[44px] min-w-[44px] rounded-full bg-[#8B5CF6] active:scale-95 disabled:opacity-45 text-white flex items-center justify-center transition-transform shrink-0"
        >
          <Send className="w-4 h-4" />
        </button>
      </form>

      {showBlockModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/65 backdrop-blur-sm p-4">
          <div className="w-full max-w-sm rounded-3xl bg-white dark:bg-[#1E1B2E] border border-slate-200 dark:border-white/10 p-6 space-y-4">
            <h3 className="text-base font-bold text-slate-900 dark:text-white">
              {lang === 'ar' ? `حظر ${peerUser.nickname} نهائياً؟` : `Block ${peerUser.nickname}?`}
            </h3>
            <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
              {lang === 'ar'
                ? 'سيتم إغلاق المحادثة على الجهازين ومنع هذا المستخدم من التواصل معك نهائياً.'
                : 'This room will close on both devices and block further messages.'}
            </p>
            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setShowBlockModal(false)}
                className="min-h-[44px] px-4 py-2 rounded-xl bg-slate-100 dark:bg-white/10 text-xs font-semibold text-slate-700 dark:text-slate-200"
              >
                {lang === 'ar' ? 'إلغاء' : 'Cancel'}
              </button>
              <button
                type="button"
                onClick={handleConfirmBlock}
                className="min-h-[44px] px-4 py-2 rounded-xl bg-rose-600 text-xs font-semibold text-white"
              >
                {t.blockUser}
              </button>
            </div>
          </div>
        </div>
      )}

      {showReportModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/65 backdrop-blur-sm p-4">
          <div className="w-full max-w-md rounded-3xl bg-white dark:bg-[#1E1B2E] border border-slate-200 dark:border-white/10 p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-bold text-slate-900 dark:text-white">
                {lang === 'ar' ? 'إبلاغ إشرافي للسيرفر' : 'Submit Moderation Report'}
              </h3>
              <button
                type="button"
                onClick={() => setShowReportModal(false)}
                className="min-h-[44px] min-w-[44px] -mx-2 flex items-center justify-center"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {reportFeedback ? (
              <div className="space-y-4">
                <div className="p-4 rounded-2xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800/60 text-xs text-emerald-800 dark:text-emerald-200 space-y-1.5">
                  <p className="font-bold">
                    {lang === 'ar' ? 'تم توثيق البلاغ على السيرفر:' : 'Report saved on server:'}
                  </p>
                  <p className="leading-relaxed">{reportFeedback}</p>
                </div>
                <button
                  type="button"
                  onClick={() => setShowReportModal(false)}
                  className="w-full min-h-[44px] rounded-xl bg-[#8B5CF6] text-white text-sm font-semibold"
                >
                  {lang === 'ar' ? 'تم' : 'Done'}
                </button>
              </div>
            ) : (
              <form onSubmit={handleConfirmReport} className="space-y-4">
                <select
                  value={reportReason}
                  onChange={(e) => setReportReason(e.target.value)}
                  className="w-full h-11 px-3 rounded-xl bg-slate-50 dark:bg-[#151221] border border-slate-200 dark:border-white/10 text-sm text-slate-900 dark:text-white"
                >
                  <option value="إزعاج أو سلوك غير لائق">إزعاج أو سلوك غير لائق</option>
                  <option value="ألفاظ مسيئة أو تنمر">ألفاظ مسيئة أو تنمر</option>
                  <option value="طلب بيانات شخصية حساسة">طلب بيانات شخصية حساسة</option>
                  <option value="محتوى مزعج (Spam)">محتوى مزعج (Spam)</option>
                </select>
                <div className="flex items-center justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => setShowReportModal(false)}
                    className="min-h-[44px] px-4 py-2 rounded-xl bg-slate-100 dark:bg-white/10 text-xs font-semibold text-slate-700 dark:text-slate-200"
                  >
                    {lang === 'ar' ? 'إلغاء' : 'Cancel'}
                  </button>
                  <button
                    type="submit"
                    disabled={submittingReport}
                    className="min-h-[44px] px-5 py-2 rounded-xl bg-amber-600 text-xs font-semibold text-white"
                  >
                    {submittingReport
                      ? lang === 'ar'
                        ? 'جارٍ الإرسال...'
                        : 'Sending...'
                      : lang === 'ar'
                      ? 'تأكيد البلاغ'
                      : 'Submit'}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
