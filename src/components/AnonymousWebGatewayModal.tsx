import React, { useEffect, useState } from 'react';
import { ShieldCheck, Lock, Send, X, AlertTriangle } from 'lucide-react';
import { AVATAR_PRESETS, FramedAvatar, OfficialBadge } from './FramedAvatar';
import { RealmUser } from '../db/realmLocalDB';
import { fadfadahClient } from '../services/fadfadahNetworkClient';
import { AppLang, TRANSLATIONS } from '../i18n/translations';

interface AnonymousWebGatewayModalProps {
  isOpen: boolean;
  targetSlug: string;
  fallbackTargetUser?: RealmUser;
  onClose: () => void;
  lang: AppLang;
  onMessageCreatedRoom: (roomId: string) => void;
}

export const AnonymousWebGatewayModal: React.FC<AnonymousWebGatewayModalProps> = ({
  isOpen,
  targetSlug,
  fallbackTargetUser,
  onClose,
  lang,
  onMessageCreatedRoom,
}) => {
  const t = TRANSLATIONS[lang];
  const [loadingTarget, setLoadingTarget] = useState(false);
  const [targetUser, setTargetUser] = useState<RealmUser | null>(fallbackTargetUser ?? null);
  const [notFoundError, setNotFoundError] = useState(false);

  const [senderAlias, setSenderAlias] = useState(
    () => `زائر_${Math.floor(100 + Math.random() * 899)}`
  );
  const [selectedAvatar, setSelectedAvatar] = useState<string>('moon');
  const [secretText, setSecretText] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [moderationWarning, setModerationWarning] = useState('');

  useEffect(() => {
    if (!isOpen || !targetSlug) return;
    let active = true;
    setLoadingTarget(true);
    setNotFoundError(false);

    fadfadahClient.fetchPublicLinkInfo(targetSlug).then((info) => {
      if (!active) return;
      setLoadingTarget(false);
      if (info?.targetUser) {
        setTargetUser(info.targetUser);
      } else if (fallbackTargetUser) {
        setTargetUser(fallbackTargetUser);
      } else {
        setNotFoundError(true);
      }
    });

    return () => {
      active = false;
    };
  }, [isOpen, targetSlug, fallbackTargetUser]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanText = secretText.trim();
    if (!cleanText || !targetSlug) return;

    setSubmitting(true);
    setModerationWarning('');

    const result = await fadfadahClient.sendSecretLinkMessage(targetSlug, {
      content: cleanText,
      senderAlias: senderAlias.trim() || `Anon_${Math.floor(100 + Math.random() * 899)}`,
      senderAvatar: selectedAvatar,
    });

    setSubmitting(false);
    if (!result.ok) {
      setModerationWarning(
        result.error ||
          (lang === 'ar' ? 'تعذر إرسال الرسالة، حاول مجدداً.' : 'Could not send secret message.')
      );
      return;
    }

    setSecretText('');
    onClose();
    if (result.roomId) {
      onMessageCreatedRoom(result.roomId);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/65 backdrop-blur-sm p-0 sm:p-4">
      <div className="w-full max-w-lg rounded-t-3xl sm:rounded-3xl bg-white dark:bg-[#1E1B2E] border border-slate-200 dark:border-white/10 shadow-2xl overflow-hidden pb-safe">
        <div className="bg-[#2D1B69] px-5 py-4 flex items-center justify-between text-white">
          <div className="flex items-center gap-2.5">
            <Lock className="w-4 h-4 text-[#A78BFA] shrink-0" />
            <h2 className="text-base font-bold whitespace-nowrap">{t.gatewayHeader}</h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="min-h-[44px] min-w-[44px] -mx-2 flex items-center justify-center rounded-full active:bg-white/15 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {loadingTarget ? (
          <div className="p-10 text-center text-xs text-slate-500 dark:text-slate-400">
            {lang === 'ar' ? 'جارٍ التحقق من الرابط الشخصي...' : 'Loading recipient link...'}
          </div>
        ) : notFoundError || !targetUser ? (
          <div className="p-8 text-center space-y-3">
            <p className="text-sm font-bold text-rose-600 dark:text-rose-400">
              {lang === 'ar'
                ? 'هذا الرابط الشخصي غير موجود أو لم يعد متاحاً.'
                : 'This personal link does not exist.'}
            </p>
            <button
              type="button"
              onClick={onClose}
              className="min-h-[44px] px-5 rounded-xl bg-[#2D1B69] text-white text-xs font-bold"
            >
              {lang === 'ar' ? 'إغلاق' : 'Close'}
            </button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="p-5 sm:p-6 space-y-4">
            <div className="flex items-center gap-4 pb-4 border-b border-slate-200 dark:border-white/10">
              <FramedAvatar
                avatarUrl={targetUser.avatar_url}
                frameId={targetUser.frame_id}
                nickname={targetUser.nickname}
                size="lg"
              />
              <div className="min-w-0">
                <p className="text-xs text-slate-500 dark:text-slate-400">{t.gatewaySendTo}</p>
                <p className="flex items-center gap-1 text-lg font-bold text-slate-900 dark:text-white">
                  <span className="truncate">{targetUser.nickname}</span>
                  <OfficialBadge role={targetUser.role} />
                </p>
                <p className="text-xs text-[#8B5CF6] font-mono-num truncate" dir="ltr">
                  /u/{targetSlug}
                </p>
              </div>
            </div>

            <div className="space-y-2">
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300">
                {t.gatewayAliasLabel}
              </label>
              <input
                type="text"
                value={senderAlias}
                onChange={(e) => setSenderAlias(e.target.value)}
                maxLength={24}
                className="w-full h-11 px-3.5 rounded-xl bg-slate-50 dark:bg-[#151221] border border-slate-200 dark:border-white/10 text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-[#8B5CF6]"
              />
              <div className="flex items-center gap-2 pt-1 overflow-x-auto pb-1">
                {AVATAR_PRESETS.slice(0, 5).map((preset) => (
                  <button
                    key={preset}
                    type="button"
                    onClick={() => setSelectedAvatar(preset)}
                    className={`min-h-[44px] min-w-[44px] rounded-full flex items-center justify-center transition-transform ${
                      selectedAvatar === preset
                        ? 'scale-105 ring-2 ring-[#8B5CF6]'
                        : 'opacity-65 active:opacity-100'
                    }`}
                  >
                    <FramedAvatar avatarUrl={preset} frameId={0} nickname={preset} size="sm" />
                  </button>
                ))}
              </div>
            </div>

            <textarea
              rows={4}
              value={secretText}
              onChange={(e) => setSecretText(e.target.value)}
              placeholder={t.gatewayMsgPlaceholder}
              required
              className="w-full p-3.5 rounded-2xl bg-slate-50 dark:bg-[#151221] border border-slate-200 dark:border-white/10 text-sm text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-[#8B5CF6] resize-none"
            />

            {moderationWarning && (
              <div className="p-3 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800/60 flex items-start gap-2.5 text-xs text-rose-700 dark:text-rose-300">
                <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
                <span>{moderationWarning}</span>
              </div>
            )}

            <div className="flex items-center justify-between gap-3 pt-1">
              <div className="flex items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400">
                <ShieldCheck className="w-4 h-4 text-emerald-500 shrink-0" />
                <span>
                  {lang === 'ar'
                    ? 'إرسال فوري حقيقي إلى هاتف المستلم'
                    : 'Delivered live to recipient device'}
                </span>
              </div>
              <button
                type="submit"
                disabled={submitting || !secretText.trim()}
                className="min-h-[46px] px-5 py-2.5 rounded-xl bg-[#8B5CF6] active:scale-[0.98] disabled:opacity-50 text-white text-sm font-bold flex items-center gap-2 transition-transform whitespace-nowrap shrink-0"
              >
                <Send className="w-4 h-4" />
                <span>
                  {submitting
                    ? lang === 'ar'
                      ? 'جارٍ الإرسال...'
                      : 'Sending...'
                    : t.gatewaySubmit}
                </span>
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
};
