import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Bot, Send, Sparkles } from 'lucide-react';
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
            ? 'تعذر تحميل الشخصيات الذكية.'
            : 'Could not load AI characters.'
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
  }, [turns.length]);

  const sendMessage = async (event?: React.FormEvent) => {
    event?.preventDefault();
    const content = draft.trim();
    if (!selectedBotId || !content || sending) return;
    setSending(true);
    setErrorAction('send');
    setError('');
    setDraft('');
    try {
      const result = await fadfadahClient.sendBotMessage(selectedBotId, content, lang);
      setData((current) =>
        current
          ? {
              ...current,
              conversations: current.conversations.map((item) =>
                item.bot_id === result.conversation.bot_id ? result.conversation : item
              ),
            }
          : current
      );
    } catch (sendError) {
      setDraft(content);
      setError(
        sendError instanceof Error
          ? sendError.message
          : isArabic
            ? 'تعذر إرسال الرسالة. حاول مجددًا.'
            : 'Could not send the message. Try again.'
      );
    } finally {
      setSending(false);
    }
  };

  if (loading) {
    return (
      <div className="p-8 text-center text-xs text-slate-500">
        {isArabic ? 'جارٍ تجهيز الشخصيات...' : 'Loading characters...'}
      </div>
    );
  }

  return (
    <div className="mx-auto flex h-full max-w-3xl flex-col gap-3 p-4 sm:p-5">
      <header className="rounded-3xl bg-gradient-to-br from-[#2D1B69] to-[#6547b4] p-4 text-white">
        <div className="flex items-center gap-3">
          <span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-white/15">
            <Sparkles className="h-5 w-5" />
          </span>
          <div>
            <h2 className="text-sm font-extrabold">
              {isArabic ? 'شخصيات فضفضة الذكية' : 'Fadfada AI characters'}
            </h2>
            <p className="mt-1 text-[11px] leading-relaxed text-violet-100">
              {data?.disclosure ||
                (isArabic
                  ? 'هذه شخصيات ذكاء اصطناعي وليست أشخاصًا حقيقيين. عند تهيئة الخدمة، تُرسل رسائلك وسياق المحادثة إلى OpenRouter لتوليد الردود.'
                  : 'These are AI characters, not real people. When configured, your messages and conversation context are sent to OpenRouter to generate replies.')}
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

      <div className="flex gap-2 overflow-x-auto pb-1">
        {data?.bots.map((bot) => {
          const active = selectedBotId === bot.id;
          return (
            <button
              key={bot.id}
              type="button"
              onClick={() => setSelectedBotId(bot.id)}
              className={`min-h-[64px] min-w-[145px] rounded-2xl border px-3 py-2 text-start transition-colors ${
                active
                  ? 'border-[#8B5CF6] bg-violet-50 dark:bg-violet-950/35'
                  : 'border-slate-200 bg-white dark:border-white/10 dark:bg-[#1E1B2E]'
              }`}
            >
              <span className="flex items-center gap-2">
                <Bot className={`h-4 w-4 ${active ? 'text-[#8B5CF6]' : 'text-slate-400'}`} />
                <span className="text-xs font-bold text-slate-900 dark:text-white">
                  {isArabic ? bot.name_ar : bot.name_en}
                </span>
              </span>
              <span className="mt-1 block text-[10px] text-slate-500 dark:text-slate-400">
                {isArabic ? bot.style_ar : bot.style_en}
              </span>
            </button>
          );
        })}
      </div>

      <section className="flex min-h-[260px] flex-1 flex-col overflow-hidden rounded-3xl border border-slate-200 bg-white dark:border-white/10 dark:bg-[#1E1B2E]">
        <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3 dark:border-white/10">
          <div>
            <h3 className="text-sm font-bold text-slate-900 dark:text-white">
              {selectedBot ? (isArabic ? selectedBot.name_ar : selectedBot.name_en) : ''}
            </h3>
            <p className="text-[10px] text-slate-500 dark:text-slate-400">
              {isArabic ? 'شخصية ذكاء اصطناعي · ليست إنسانًا' : 'AI character · not a human'}
            </p>
          </div>
          <Bot className="h-5 w-5 text-[#8B5CF6]" />
        </div>

        <div className="flex-1 space-y-3 overflow-y-auto p-4">
          {turns.map((turn) => {
            const fromBot = turn.role === 'BOT';
            return (
              <div key={turn.id} className={`flex ${fromBot ? 'justify-start' : 'justify-end'}`}>
                <div
                  className={`max-w-[88%] whitespace-pre-wrap rounded-2xl px-3.5 py-2.5 text-sm leading-relaxed ${
                    fromBot
                      ? 'rounded-br-sm bg-slate-100 text-slate-800 dark:bg-[#151221] dark:text-slate-100'
                      : 'rounded-bl-sm bg-[#8B5CF6] text-white'
                  }`}
                >
                  {turn.content}
                </div>
              </div>
            );
          })}
          {sending && (
            <div className="text-start text-xs text-slate-500" aria-live="polite">
              {isArabic ? 'تفكر الشخصية...' : 'The character is thinking...'}
            </div>
          )}
          <div ref={bottomRef} />
        </div>

        <form onSubmit={sendMessage} className="flex items-end gap-2 border-t border-slate-100 p-3 dark:border-white/10">
          <textarea
            rows={1}
            maxLength={2000}
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            placeholder={isArabic ? 'اكتب ما تحب مشاركته...' : 'Share what is on your mind...'}
            className="max-h-28 min-h-11 flex-1 resize-y rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm text-slate-900 outline-none focus:border-[#8B5CF6] dark:border-white/10 dark:bg-[#151221] dark:text-white"
          />
          <button
            type="submit"
            disabled={sending || !draft.trim() || !selectedBotId}
            aria-label={isArabic ? 'إرسال' : 'Send'}
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-[#8B5CF6] text-white disabled:opacity-45"
          >
            <Send className="h-4 w-4" />
          </button>
        </form>
      </section>

      <p className="text-center text-[10px] leading-relaxed text-slate-500 dark:text-slate-400">
        {isArabic
          ? 'لا تشارك كلمات المرور أو بيانات التواصل أو أي معلومات حساسة. الشخصيات ليست بديلًا عن الدعم المهني أو الطوارئ.'
          : 'Do not share passwords, contact details, or sensitive information. AI characters are not a substitute for professional or emergency support.'}
      </p>
    </div>
  );
};
