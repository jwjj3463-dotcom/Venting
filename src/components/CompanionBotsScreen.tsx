import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Send, Sparkles, MessageCircle, Heart } from 'lucide-react';
import { AppLang } from '../i18n/translations';
import {
  CompanionBotConversationDTO,
  CompanionBotsResponseDTO,
  fadfadahClient,
} from '../services/fadfadahNetworkClient';

interface CompanionBotsScreenProps {
  lang: AppLang;
}

export const CompanionBotsScreen: React.FC<CompanionBotsScreenProps> = ({ lang }) => {
  const isArabic = lang === 'ar';
  const [data, setData] = useState<CompanionBotsResponseDTO | null>(null);
  const [selectedBotId, setSelectedBotId] = useState('');
  const [draft, setDraft] = useState('');
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState('');
  const [errorAction, setErrorAction] = useState<'load' | 'send'>('load');
  const bottomRef = useRef<HTMLDivElement | null>(null);

  const loadBots = async () => {
    setLoading(true);
    setErrorAction('load');
    setError('');
    try {
      const response = await fadfadahClient.fetchCompanionBots(lang);
      setData(response);
      setSelectedBotId((current) =>
        response.bots.some((bot) => bot.id === current) ? current : response.bots[0]?.id || ''
      );
    } catch (loadError) {
      setError(
        loadError instanceof Error
          ? loadError.message
          : isArabic
            ? 'تعذر تحميل قائمة الأعضاء المتصلين.'
            : 'Could not load active community members.'
      );
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadBots();
  }, [lang]);

  const selectedBot = data?.bots.find((bot) => bot.id === selectedBotId);
  const conversation: CompanionBotConversationDTO | undefined = useMemo(
    () => data?.conversations.find((item) => item.bot_id === selectedBotId),
    [data?.conversations, selectedBotId]
  );
  const turns = conversation?.turns ?? [];

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [turns, sending]);

  const sendMessage = async (event?: React.FormEvent) => {
    event?.preventDefault();
    const content = draft.trim();
    if (!content || !selectedBotId || sending) return;

    setSending(true);
    setErrorAction('send');
    setError('');
    setDraft('');
    try {
      const result = await fadfadahClient.sendBotMessage(selectedBotId, content, lang);
      setData((prev) => {
        if (!prev) return prev;
        const exists = prev.conversations.some((c) => c.bot_id === selectedBotId);
        const updatedConversations = exists
          ? prev.conversations.map((c) => (c.bot_id === selectedBotId ? result.conversation : c))
          : [...prev.conversations, result.conversation];
        return {
          ...prev,
          conversations: updatedConversations,
        };
      });
    } catch (sendError) {
      setError(
        sendError instanceof Error
          ? sendError.message
          : isArabic
            ? 'تعذر إرسال الرسالة، أعد المحاولة.'
            : 'Could not send the message. Try again.'
      );
    } finally {
      setSending(false);
    }
  };

  if (loading) {
    return (
      <div className="p-8 text-center text-xs text-slate-500">
        {isArabic ? 'جارٍ الاتصال بالأعضاء المتصلين...' : 'Connecting to active members...'}
      </div>
    );
  }

  return (
    <div className="mx-auto flex h-full max-w-3xl flex-col gap-3 p-4 sm:p-5">
      {/* Header Banner */}
      <header className="rounded-3xl bg-gradient-to-br from-[#2D1B69] via-[#462d8c] to-[#7c3aed] p-4 text-white shadow-lg shadow-purple-950/20">
        <div className="flex items-center gap-3">
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-white/15 backdrop-blur-md">
            <Sparkles className="h-5 w-5 text-amber-300" />
          </span>
          <div>
            <h2 className="text-sm font-extrabold flex items-center gap-2">
              <span>{isArabic ? 'أعضاء متصلون ومستعدون للمحادثة' : 'Active Members Online'}</span>
              <span className="inline-block h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />
            </h2>
            <p className="mt-0.5 text-[11px] leading-relaxed text-purple-100/90">
              {isArabic
                ? 'مساحة عفوية للفضفضة والتعرف على أصدقاء جدد من مختلف البلدان بأمان وود'
                : 'Connect, chat, and share stories with friendly community members.'}
            </p>
          </div>
        </div>
      </header>

      {error && (
        <div role="alert" className="rounded-xl border border-rose-200 bg-rose-50 p-3 text-xs text-rose-700 dark:border-rose-900/50 dark:bg-rose-950/30 dark:text-rose-200">
          {error}
          <button
            type="button"
            onClick={() => void (errorAction === 'send' ? sendMessage() : loadBots())}
            className="ms-2 font-bold underline"
          >
            {isArabic ? 'إعادة المحاولة' : 'Retry'}
          </button>
        </div>
      )}

      {/* Personas Carousel Strip */}
      <div className="flex gap-2.5 overflow-x-auto pb-1 pt-0.5 scrollbar-thin">
        {data?.bots.map((bot) => {
          const active = selectedBotId === bot.id;
          return (
            <button
              key={bot.id}
              type="button"
              onClick={() => setSelectedBotId(bot.id)}
              className={`min-h-[68px] min-w-[155px] rounded-2xl border px-3.5 py-2.5 text-start transition-all relative flex flex-col justify-between ${
                active
                  ? 'border-[#8B5CF6] bg-violet-50/90 shadow-md ring-2 ring-[#8B5CF6]/30 dark:bg-violet-950/40 dark:border-violet-500'
                  : 'border-slate-200 bg-white hover:border-slate-300 dark:border-white/10 dark:bg-[#1E1B2E] dark:hover:border-white/20'
              }`}
            >
              <div className="flex items-center justify-between w-full">
                <span className="text-xs font-black text-slate-900 dark:text-white flex items-center gap-1.5">
                  <span>{isArabic ? bot.name_ar : bot.name_en}</span>
                  {(bot as any).flag && <span className="text-sm">{(bot as any).flag}</span>}
                </span>
                <span className="h-2 w-2 rounded-full bg-emerald-500 ring-2 ring-white dark:ring-slate-900" title="متصل الآن" />
              </div>
              <span className="mt-1 block text-[10px] font-medium text-slate-500 dark:text-slate-400 line-clamp-1">
                {isArabic ? bot.style_ar : bot.style_en}
              </span>
            </button>
          );
        })}
      </div>

      {/* Main Chat Interface */}
      <section className="flex min-h-[320px] flex-1 flex-col overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm dark:border-white/10 dark:bg-[#1E1B2E]">
        {/* Active Persona Header */}
        <div className="flex items-center justify-between border-b border-slate-100 bg-slate-50/60 px-4 py-3 dark:border-white/10 dark:bg-[#151221]/60">
          <div className="flex items-center gap-3">
            <div className="relative">
              <div className="h-10 w-10 rounded-2xl bg-gradient-to-tr from-violet-600 to-fuchsia-500 flex items-center justify-center text-white font-black text-base shadow">
                {selectedBot?.name_ar?.[0] || 'ص'}
              </div>
              <span className="absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full bg-emerald-500 border-2 border-white dark:border-[#1E1B2E]" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-sm font-black text-slate-900 dark:text-white">
                  {selectedBot ? (isArabic ? selectedBot.name_ar : selectedBot.name_en) : ''}
                </h3>
                {(selectedBot as any)?.flag && <span>{(selectedBot as any).flag}</span>}
                {(selectedBot as any)?.age && (
                  <span className="text-[10px] text-slate-400 font-bold">{(selectedBot as any).age} سنة</span>
                )}
              </div>
              <p className="text-[10px] text-emerald-600 dark:text-emerald-400 font-bold flex items-center gap-1">
                <span>●</span>
                <span>{isArabic ? 'متصل الآن ومتاح للدردشة' : 'Online now'}</span>
              </p>
            </div>
          </div>
          <div className="text-slate-400 dark:text-slate-500 text-xs">
            <Heart className="h-4 w-4 text-rose-400/80 fill-rose-400/20" />
          </div>
        </div>

        {/* Conversation Turns */}
        <div className="flex-1 space-y-3 overflow-y-auto p-4">
          {turns.map((turn) => {
            const fromBot = turn.role === 'BOT';
            return (
              <div key={turn.id} className={`flex ${fromBot ? 'justify-start' : 'justify-end'}`}>
                <div
                  className={`max-w-[88%] whitespace-pre-wrap rounded-2xl px-4 py-2.5 text-sm leading-relaxed shadow-sm ${
                    fromBot
                      ? 'rounded-br-sm bg-slate-100 text-slate-900 dark:bg-[#151221] dark:text-slate-100 border border-slate-200/50 dark:border-white/5'
                      : 'rounded-bl-sm bg-gradient-to-r from-violet-600 to-indigo-600 text-white font-medium'
                  }`}
                >
                  {turn.content}
                </div>
              </div>
            );
          })}
          {sending && (
            <div className="flex items-center gap-1.5 px-3 py-2 text-xs text-slate-400 italic">
              <span className="inline-block h-1.5 w-1.5 rounded-full bg-slate-400 animate-bounce" />
              <span className="inline-block h-1.5 w-1.5 rounded-full bg-slate-400 animate-bounce [animation-delay:0.2s]" />
              <span className="inline-block h-1.5 w-1.5 rounded-full bg-slate-400 animate-bounce [animation-delay:0.4s]" />
              <span className="ms-1">{isArabic ? 'يكتب الآن...' : 'typing...'}</span>
            </div>
          )}
          <div ref={bottomRef} />
        </div>

        {/* Input Form */}
        <form onSubmit={sendMessage} className="flex items-end gap-2 border-t border-slate-100 p-3 dark:border-white/10 bg-slate-50/40 dark:bg-[#151221]/30">
          <textarea
            rows={1}
            maxLength={2000}
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Enter' && !event.shiftKey) {
                event.preventDefault();
                void sendMessage();
              }
            }}
            placeholder={isArabic ? 'اكتب رسالتك وفضفض بحرية...' : 'Write your thoughts freely...'}
            className="max-h-28 min-h-11 flex-1 resize-y rounded-2xl border border-slate-200 bg-white px-4 py-2.5 text-sm text-slate-900 outline-none focus:border-[#8B5CF6] dark:border-white/10 dark:bg-[#1E1B2E] dark:text-white placeholder:text-slate-400"
          />
          <button
            type="submit"
            disabled={sending || !draft.trim() || !selectedBotId}
            aria-label={isArabic ? 'إرسال' : 'Send'}
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-[#8B5CF6] hover:bg-[#7c3aed] text-white disabled:opacity-40 transition-colors shadow-md shadow-violet-500/20 active:scale-95"
          >
            <Send className="h-4 w-4" />
          </button>
        </form>
      </section>

      <p className="text-center text-[10px] leading-relaxed text-slate-400 dark:text-slate-500">
        {isArabic
          ? 'فضفضة مساحة راقية وآمنة للجميع.. شارك مشاعرك وأفكارك براحة وبدون أحكام.'
          : 'Fadfadah is a safe, friendly space for everyone.. Share your thoughts freely.'}
      </p>
    </div>
  );
};
