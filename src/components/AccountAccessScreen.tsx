import React, { useState } from 'react';
import {
  completeEmailLinkVerification,
  completeEmailVerification,
  createEmailAccount,
  createOrLinkEmailAccount,
  getFirebaseAuthError,
  resendEmailVerification,
  sendPasswordReset,
  signInGoogleForLinking,
  signInWithEmailAndGetIdToken,
  signInWithGoogleAndGetIdToken,
} from '../services/firebaseAuthentication';

interface AccountAccessScreenProps {
  busy: boolean;
  error: string;
  purpose?: 'access' | 'link';
  onCreateAccount: () => void;
  onRecoverAccount: (recoveryCode: string) => void;
  onFirebaseLogin: (idToken: string) => void;
  onFirebaseRegister: (idToken: string) => void;
  onGoogleAuth: (idToken: string) => void;
  onLinkFirebase?: (idToken: string) => void;
  onCancelLink?: () => void;
}

export const AccountAccessScreen: React.FC<AccountAccessScreenProps> = ({
  busy,
  error,
  purpose = 'access',
  onCreateAccount,
  onRecoverAccount,
  onFirebaseLogin,
  onFirebaseRegister,
  onGoogleAuth,
  onLinkFirebase,
  onCancelLink,
}) => {
  const [recoveryCode, setRecoveryCode] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [localBusy, setLocalBusy] = useState(false);
  const [localError, setLocalError] = useState('');
  const [localMessage, setLocalMessage] = useState('');
  const [emailVerificationPending, setEmailVerificationPending] = useState(false);
  const [emailLinkVerificationPending, setEmailLinkVerificationPending] = useState(false);
  const isLinking = purpose === 'link';
  const isBusy = busy || localBusy;
  const visibleError = error || localError;

  const runLocal = async (action: () => Promise<void>) => {
    setLocalBusy(true);
    setLocalError('');
    setLocalMessage('');
    try {
      await action();
    } catch (actionError) {
      setLocalError(getFirebaseAuthError(actionError));
    } finally {
      setLocalBusy(false);
    }
  };

  const handleGoogle = () =>
    void runLocal(async () => {
      const idToken = isLinking
        ? await signInGoogleForLinking()
        : await signInWithGoogleAndGetIdToken();
      if (isLinking) onLinkFirebase?.(idToken);
      else onGoogleAuth(idToken);
    });

  const handleEmailSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    if (isLinking) {
      void runLocal(async () => {
        const alreadyVerified = await createOrLinkEmailAccount(email, password);
        if (alreadyVerified) {
          onLinkFirebase?.(await completeEmailLinkVerification());
        } else {
          setEmailLinkVerificationPending(true);
        }
      });
      return;
    }

    if (mode === 'register') {
      void runLocal(async () => {
        await createEmailAccount(email, password);
        setEmailVerificationPending(true);
      });
      return;
    }

    void runLocal(async () => {
      const idToken = await signInWithEmailAndGetIdToken(email, password);
      onFirebaseLogin(idToken);
    });
  };

  const continueAfterEmailVerification = (forLinking: boolean) =>
    void runLocal(async () => {
      const idToken = forLinking
        ? await completeEmailLinkVerification()
        : await completeEmailVerification();
      if (forLinking) onLinkFirebase?.(idToken);
      else onFirebaseRegister(idToken);
    });

  return (
    <main className="min-h-[100dvh] flex items-center justify-center p-5 bg-[#2D1B69] text-white">
      <section className="w-full max-w-md rounded-3xl bg-[#1E1B2E] border border-white/10 p-6 space-y-5 shadow-2xl">
        <header className="text-center space-y-2">
          <div className="w-14 h-14 mx-auto rounded-2xl bg-[#8B5CF6] flex items-center justify-center text-2xl font-bold">
            ف
          </div>
          <h1 className="text-xl font-bold">
            {isLinking ? 'تأمين حساب فضفضة' : 'الدخول إلى فضفضة'}
          </h1>
          <p className="text-sm text-purple-200 leading-relaxed">
            {isLinking
              ? 'اربط بريدك الإلكتروني أو حساب Google بحسابك الحالي لتتمكن من استعادته على جهاز آخر. لن تتغير محادثاتك أو صلاحياتك.'
              : 'استخدم Google أو بريدك الإلكتروني. لاستعادة حساب فضفضة قديم، استخدم رمز استرداده أولًا أو اربطه من إعدادات الحساب أثناء تسجيل الدخول.'}
          </p>
        </header>

        {!emailVerificationPending && !emailLinkVerificationPending && (
          <>
            <button
              type="button"
              disabled={isBusy}
              onClick={handleGoogle}
              className="w-full min-h-[48px] rounded-xl bg-white text-slate-800 disabled:opacity-50 font-bold text-sm"
            >
              {isBusy ? 'جارٍ الاتصال...' : 'المتابعة باستخدام Google'}
            </button>

            <div className="flex items-center gap-3 text-xs text-purple-200/70">
              <span className="h-px flex-1 bg-white/10" />
              <span>أو بالبريد الإلكتروني</span>
              <span className="h-px flex-1 bg-white/10" />
            </div>

            <form className="space-y-3" onSubmit={handleEmailSubmit}>
              <label htmlFor="firebase-email" className="block text-xs font-semibold">
                البريد الإلكتروني
              </label>
              <input
                id="firebase-email"
                type="email"
                autoComplete="email"
                inputMode="email"
                required
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                dir="ltr"
                className="w-full h-12 px-3 rounded-xl bg-black/30 border border-white/15 text-sm"
              />
              <label htmlFor="firebase-password" className="block text-xs font-semibold">
                كلمة المرور
              </label>
              <input
                id="firebase-password"
                type="password"
                autoComplete={mode === 'register' || isLinking ? 'new-password' : 'current-password'}
                minLength={6}
                required
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                dir="ltr"
                className="w-full h-12 px-3 rounded-xl bg-black/30 border border-white/15 text-sm"
              />
              <button
                type="submit"
                disabled={isBusy || !email.trim() || password.length < 6}
                className="w-full min-h-[46px] rounded-xl bg-[#8B5CF6] disabled:opacity-50 font-bold text-sm"
              >
                {isBusy
                  ? 'جارٍ التحقق...'
                  : isLinking
                    ? 'ربط البريد بالحساب'
                    : mode === 'register'
                      ? 'إنشاء حساب بالبريد'
                      : 'تسجيل الدخول بالبريد'}
              </button>
            </form>

            {!isLinking && mode === 'login' && (
              <button
                type="button"
                disabled={isBusy || !email.trim()}
                onClick={() =>
                  void runLocal(() => sendPasswordReset(email).then(() => {
                    setLocalMessage('أرسلنا رابط إعادة تعيين كلمة المرور إلى بريدك.');
                  }))
                }
                className="w-full min-h-[40px] text-xs font-semibold text-purple-200 underline disabled:opacity-50"
              >
                نسيت كلمة المرور؟
              </button>
            )}

            {!isLinking && (
              <button
                type="button"
                disabled={isBusy}
                onClick={() => {
                  setMode(mode === 'login' ? 'register' : 'login');
                  setLocalError('');
                }}
                className="w-full min-h-[40px] text-xs font-semibold text-purple-200"
              >
                {mode === 'login' ? 'ليس لديك حساب؟ أنشئ حسابًا جديدًا' : 'لديك حساب؟ سجّل الدخول'}
              </button>
            )}
          </>
        )}

        {emailVerificationPending && (
          <div className="space-y-3 text-center">
            <p className="text-sm text-purple-100 leading-relaxed">
              أرسلنا رسالة تحقق إلى بريدك. افتحها واضغط رابط التحقق، ثم ارجع إلى التطبيق.
            </p>
            <button
              type="button"
              disabled={isBusy}
              onClick={() => continueAfterEmailVerification(false)}
              className="w-full min-h-[46px] rounded-xl bg-[#8B5CF6] disabled:opacity-50 font-bold text-sm"
            >
              تم التحقق، متابعة
            </button>
            <button
              type="button"
              disabled={isBusy}
              onClick={() => void runLocal(resendEmailVerification)}
              className="w-full min-h-[40px] text-xs font-semibold text-purple-200 underline"
            >
              إعادة إرسال رسالة التحقق
            </button>
          </div>
        )}

        {emailLinkVerificationPending && (
          <div className="space-y-3 text-center">
            <p className="text-sm text-purple-100 leading-relaxed">
              أرسلنا رسالة تحقق إلى بريدك. افتحها واضغط الرابط، ثم ارجع لإكمال ربط الحساب.
            </p>
            <button
              type="button"
              disabled={isBusy}
              onClick={() => continueAfterEmailVerification(true)}
              className="w-full min-h-[46px] rounded-xl bg-[#8B5CF6] disabled:opacity-50 font-bold text-sm"
            >
              تم التحقق، متابعة الربط
            </button>
            <button
              type="button"
              disabled={isBusy}
              onClick={() => void runLocal(resendEmailVerification)}
              className="w-full min-h-[40px] text-xs font-semibold text-purple-200 underline"
            >
              إعادة إرسال رسالة التحقق
            </button>
          </div>
        )}

        {!isLinking && (
          <>
            <form
              className="border-t border-white/10 pt-4 space-y-3"
              onSubmit={(event) => {
                event.preventDefault();
                onRecoverAccount(recoveryCode);
              }}
            >
              <label htmlFor="account-recovery-code" className="block text-xs font-semibold">
                أو استعادة الحساب برمز الاسترداد
              </label>
              <input
                id="account-recovery-code"
                autoComplete="off"
                autoCapitalize="none"
                spellCheck={false}
                dir="ltr"
                value={recoveryCode}
                onChange={(event) =>
                  setRecoveryCode(event.target.value.replace(/[^a-fA-F0-9]/g, '').slice(0, 64))
                }
                placeholder="64 hexadecimal characters"
                className="w-full h-12 px-3 rounded-xl bg-black/30 border border-white/15 text-sm font-mono tracking-wider"
              />
              <button
                type="submit"
                disabled={isBusy || recoveryCode.length !== 64}
                className="w-full min-h-[46px] rounded-xl bg-white/10 disabled:opacity-50 font-bold text-sm"
              >
                استعادة حسابي
              </button>
            </form>
            <p className="text-xs text-slate-300 text-center">
              الحساب الجديد لا يستعيد حسابًا سابقًا أو محادثاته. اربط تسجيل الدخول من إعدادات الحساب القديم قبل الانتقال إلى جهاز آخر.
            </p>
            <button
              type="button"
              disabled={isBusy}
              onClick={onCreateAccount}
              className="w-full min-h-[42px] rounded-xl text-xs text-purple-200 underline disabled:opacity-50"
            >
              إنشاء حساب مؤقت على هذا الجهاز
            </button>
          </>
        )}

        {visibleError && (
          <p role="alert" className="text-xs text-rose-300 text-center break-words">
            {visibleError}
          </p>
        )}
        {localMessage && (
          <p role="status" className="text-xs text-emerald-300 text-center">
            {localMessage}
          </p>
        )}

        {isLinking && (
          <button
            type="button"
            disabled={isBusy}
            onClick={onCancelLink}
            className="w-full min-h-[40px] text-xs text-purple-200 underline disabled:opacity-50"
          >
            رجوع دون ربط
          </button>
        )}
      </section>
    </main>
  );
};
