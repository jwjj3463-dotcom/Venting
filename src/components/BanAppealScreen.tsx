import React, { useEffect, useState } from 'react';
import { AlertTriangle, Send } from 'lucide-react';
import { fadfadahClient, BanAppealDTO } from '../services/fadfadahNetworkClient';
import { AppLang } from '../i18n/translations';

interface BanAppealScreenProps {
  lang: AppLang;
}

export const BanAppealScreen: React.FC<BanAppealScreenProps> = ({ lang }) => {
  const [appeal, setAppeal] = useState<BanAppealDTO | null>(null);
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const isArabic = lang === 'ar';
  const isFrench = lang === 'fr';
  const text = {
    title: isArabic ? 'طلب مراجعة الحظر' : isFrench ? 'Contester le bannissement' : 'Appeal this ban',
    description: isArabic
      ? 'يمكنك تقديم طلب استئناف واحد ليُراجعه مالك المنصة. لن يُرفع الحظر تلقائيًا بمجرد الإرسال.'
      : isFrench
        ? 'Vous pouvez envoyer un seul recours au propriétaire de la plateforme. L’envoi ne lève pas automatiquement le bannissement.'
        : 'You may submit one appeal for the platform owner to review. Submitting it does not automatically lift the ban.',
    placeholder: isArabic
      ? 'اشرح سبب طلبك للمراجعة (20 حرفًا على الأقل)...'
      : isFrench
        ? 'Expliquez votre demande de réexamen (20 caractères minimum)...'
        : 'Explain why you are requesting a review (at least 20 characters)...',
    submitted: isArabic ? 'تم إرسال طلب الاستئناف' : isFrench ? 'Recours envoyé' : 'Appeal submitted',
    pending: isArabic ? 'قيد مراجعة مالك المنصة' : isFrench ? 'En attente du propriétaire' : 'Awaiting owner review',
    accepted: isArabic ? 'تم قبول الاستئناف ورفع الحظر' : isFrench ? 'Recours accepté, bannissement levé' : 'Appeal accepted; ban lifted',
    rejected: isArabic ? 'تم رفض الاستئناف' : isFrench ? 'Recours refusé' : 'Appeal rejected',
    note: isArabic ? 'ملاحظة المراجعة:' : isFrench ? 'Note de décision :' : 'Review note:',
    send: isArabic ? 'إرسال طلب الاستئناف' : isFrench ? 'Envoyer le recours' : 'Submit appeal',
    loading: isArabic ? 'جارٍ تحميل حالة الاستئناف...' : isFrench ? 'Chargement du recours...' : 'Loading appeal status...',
    error: isArabic ? 'تعذر تحميل حالة الاستئناف.' : isFrench ? 'Impossible de charger le recours.' : 'Could not load appeal status.',
    sendError: isArabic ? 'تعذر إرسال الاستئناف.' : isFrench ? 'Impossible d’envoyer le recours.' : 'Could not submit the appeal.',
    length: isArabic ? 'اكتب من 20 إلى 2000 حرف.' : isFrench ? 'Saisissez entre 20 et 2000 caractères.' : 'Enter between 20 and 2000 characters.',
  };

  useEffect(() => {
    let active = true;
    fadfadahClient
      .getMyBanAppeal()
      .then((result) => {
        if (active) setAppeal(result);
      })
      .catch((loadError: unknown) => {
        if (active) setError(loadError instanceof Error ? loadError.message : text.error);
      })
      .finally(() => {
        if (active) setBusy(false);
      });
    return () => {
      active = false;
    };
  }, []);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    const clean = message.trim();
    if (clean.length < 20 || clean.length > 2000) {
      setError(text.length);
      return;
    }
    setSubmitting(true);
    setError('');
    try {
      setAppeal(await fadfadahClient.submitBanAppeal(clean));
      setMessage('');
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : text.sendError);
    } finally {
      setSubmitting(false);
    }
  };

  const statusLabel = appeal?.status === 'PENDING'
    ? text.pending
    : appeal?.status === 'ACCEPTED'
      ? text.accepted
      : text.rejected;

  return (
    <section className="space-y-3 rounded-2xl border border-slate-200 p-4 text-start dark:border-white/10">
      <div className="flex items-center gap-2 text-sm font-bold">
        <AlertTriangle className="h-4 w-4 text-amber-500" />
        <h3>{text.title}</h3>
      </div>
      <p className="text-xs leading-relaxed text-slate-500 dark:text-slate-400">{text.description}</p>
      {busy ? (
        <p className="text-xs text-slate-500">{text.loading}</p>
      ) : appeal ? (
        <div className="space-y-2 rounded-xl bg-slate-50 p-3 text-xs dark:bg-white/5">
          <p className="font-bold">{text.submitted} · {statusLabel}</p>
          <p className="whitespace-pre-wrap">{appeal.message}</p>
          {appeal.review_note && (
            <p className="border-t border-slate-200 pt-2 dark:border-white/10">
              <strong>{text.note} </strong>{appeal.review_note}
            </p>
          )}
        </div>
      ) : (
        <form onSubmit={submit} className="space-y-2">
          <textarea
            required
            minLength={20}
            maxLength={2000}
            rows={4}
            value={message}
            onChange={(event) => setMessage(event.target.value)}
            placeholder={text.placeholder}
            className="w-full rounded-xl border border-slate-200 bg-slate-50 p-3 text-xs leading-relaxed dark:border-white/10 dark:bg-[#151221]"
          />
          <div className="flex items-center justify-between text-[10px] text-slate-400">
            <span>{message.trim().length}/2000</span>
            <button
              type="submit"
              disabled={submitting || message.trim().length < 20}
              className="inline-flex min-h-10 items-center gap-2 rounded-xl bg-[#2D1B69] px-4 font-bold text-white disabled:opacity-50"
            >
              <Send className="h-3.5 w-3.5" />
              {text.send}
            </button>
          </div>
        </form>
      )}
      {error && <p role="alert" className="text-xs text-rose-600">{error}</p>}
    </section>
  );
};
