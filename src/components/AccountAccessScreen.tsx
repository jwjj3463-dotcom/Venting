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
import { AVATAR_PRESETS } from './FramedAvatar';
import { TurnstileChallenge } from './TurnstileChallenge';

interface AccountAccessScreenProps {
  busy: boolean;
  error: string;
  purpose?: 'access' | 'link';
  onCreateAccount: (profile: {
    nickname: string;
    password: string;
    avatar_url: string;
    age: number;
    gender: 'female' | 'male' | 'other';
    turnstileToken: string;
  }) => void;
  onGuestLogin: (username: string, password: string) => void;
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
  onGuestLogin,
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
  const [guestSignupOpen, setGuestSignupOpen] = useState(false);
  const [guestAge, setGuestAge] = useState('');
  const [guestGender, setGuestGender] = useState<'female' | 'male' | 'other' | ''>('');
  const [guestNickname, setGuestNickname] = useState('');
  const [guestPassword, setGuestPassword] = useState('');
  const [guestAvatar, setGuestAvatar] = useState<string>(AVATAR_PRESETS[0]);
  const [turnstileToken, setTurnstileToken] = useState('');
  const [username, setUsername] = useState('');
  const [usernamePassword, setUsernamePassword] = useState('');
  const isLinking = purpose === 'link';
  const isBusy = busy || localBusy;
  const visibleError = error || localError;
  const turnstileSiteKey = import.meta.env.VITE_CLOUDFLARE_TURNSTILE_SITE_KEY?.trim() || '';
  const turnstileRequired = !import.meta.env.DEV;

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
    <main className="relative flex min-h-[100dvh] items-center justify-center overflow-hidden bg-[#100d1c] px-4 py-8 text-white sm:px-6">
      <div aria-hidden="true" className="pointer-events-none absolute -left-24 -top-28 h-72 w-72 rounded-full bg-fuchsia-600/20 blur-[100px]" />
      <div aria-hidden="true" className="pointer-events-none absolute -bottom-32 -right-20 h-80 w-80 rounded-full bg-violet-600/25 blur-[110px]" />
      <section className="relative z-10 w-full max-w-md space-y-4 rounded-[30px] border border-white/15 bg-white/[0.07] p-5 shadow-[0_24px_80px_rgba(0,0,0,0.42)] backdrop-blur-2xl sm:p-7">
        <header className="space-y-3 text-center">
          <div className="flex items-center justify-center gap-3">
            <img
              src="/app-logo.webp"
              alt="شعار تطبيق فضفضة"
              className="h-14 w-14 rounded-2xl border border-white/20 object-cover shadow-[0_8px_24px_rgba(197,63,188,0.3)]"
            />
            <div className="text-right">
              <p className="text-lg font-extrabold tracking-tight">فضفضة</p>
              <p className="text-xs text-purple-200/80">مساحتك الآمنة للكلام</p>
            </div>
          </div>
          <div className="space-y-1">
            <h1 className="text-2xl font-bold tracking-tight">
              {isLinking ? 'تأمين حساب فضفضة' : 'الدخول إلى فضفضة'}
            </h1>
            <p className="text-sm leading-relaxed text-purple-100/75">
              {isLinking
                ? 'اربط بريدك الإلكتروني أو حساب Google بحسابك الحالي لتتمكن من استعادته على جهاز آخر. لن تتغير محادثاتك أو صلاحياتك.'
                : 'استخدم Google أو بريدك الإلكتروني. لاستعادة حساب فضفضة قديم، استخدم رمز استرداده أولًا أو اربطه من إعدادات الحساب أثناء تسجيل الدخول.'}
            </p>
          </div>
        </header>

        {!emailVerificationPending && !emailLinkVerificationPending && (
          <>
            <form className="space-y-3.5" onSubmit={handleEmailSubmit}>
              <div>
                <label htmlFor="firebase-email" className="mb-1.5 block text-xs font-semibold text-purple-50">
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
                  placeholder="name@example.com"
                  className="h-12 w-full rounded-2xl border border-white/15 bg-[#11101e]/65 px-4 text-sm text-white outline-none transition placeholder:text-white/35 focus:border-fuchsia-300/70 focus:ring-2 focus:ring-violet-400/20"
                />
              </div>
              <div>
                <label htmlFor="firebase-password" className="mb-1.5 block text-xs font-semibold text-purple-50">
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
                  placeholder="••••••••"
                  className="h-12 w-full rounded-2xl border border-white/15 bg-[#11101e]/65 px-4 text-sm text-white outline-none transition placeholder:text-white/35 focus:border-fuchsia-300/70 focus:ring-2 focus:ring-violet-400/20"
                />
              </div>
              <button
                type="submit"
                disabled={isBusy || !email.trim() || password.length < 6}
                className="auth-animated-border min-h-[48px] w-full rounded-2xl bg-gradient-to-l from-fuchsia-600 to-violet-600 text-sm font-bold shadow-[0_10px_28px_rgba(142,67,211,0.32)] disabled:opacity-50"
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
                className="w-full min-h-[32px] text-xs font-semibold text-fuchsia-200 transition hover:text-white disabled:opacity-50"
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
                className="w-full min-h-[36px] text-xs font-semibold text-purple-100/90 transition hover:text-white"
              >
                {mode === 'login' ? 'ليس لديك حساب؟ أنشئ حسابًا جديدًا' : 'لديك حساب؟ سجّل الدخول'}
              </button>
            )}

            <div className="flex items-center gap-3 text-xs text-purple-100/55">
              <span className="h-px flex-1 bg-white/15" />
              <span>أو تابع باستخدام</span>
              <span className="h-px flex-1 bg-white/15" />
            </div>

            <button
              type="button"
              disabled={isBusy}
              onClick={handleGoogle}
              className="flex min-h-[48px] w-full items-center justify-center gap-2 rounded-2xl border border-white/20 bg-white/[0.94] text-sm font-bold text-slate-800 shadow-lg transition hover:bg-white disabled:opacity-50"
            >
              <span aria-hidden="true" className="text-lg font-extrabold text-[#4285F4]">G</span>
              {isBusy ? 'جارٍ الاتصال...' : 'المتابعة باستخدام Google'}
            </button>
          </>
        )}

        {emailVerificationPending && (
          <div className="space-y-3 text-center">
            <p className="text-sm leading-relaxed text-purple-100">
              أرسلنا رسالة تحقق إلى بريدك. افتحها واضغط رابط التحقق، ثم ارجع إلى التطبيق.
            </p>
            <button
              type="button"
              disabled={isBusy}
              onClick={() => continueAfterEmailVerification(false)}
              className="auth-animated-border w-full min-h-[46px] rounded-2xl bg-gradient-to-l from-fuchsia-600 to-violet-600 text-sm font-bold shadow-lg disabled:opacity-50"
            >
              تم التحقق، متابعة
            </button>
            <button
              type="button"
              disabled={isBusy}
              onClick={() => void runLocal(resendEmailVerification)}
              className="w-full min-h-[40px] text-xs font-semibold text-fuchsia-200 underline"
            >
              إعادة إرسال رسالة التحقق
            </button>
          </div>
        )}

        {emailLinkVerificationPending && (
          <div className="space-y-3 text-center">
            <p className="text-sm leading-relaxed text-purple-100">
              أرسلنا رسالة تحقق إلى بريدك. افتحها واضغط الرابط، ثم ارجع لإكمال ربط الحساب.
            </p>
            <button
              type="button"
              disabled={isBusy}
              onClick={() => continueAfterEmailVerification(true)}
              className="auth-animated-border w-full min-h-[46px] rounded-2xl bg-gradient-to-l from-fuchsia-600 to-violet-600 text-sm font-bold shadow-lg disabled:opacity-50"
            >
              تم التحقق، متابعة الربط
            </button>
            <button
              type="button"
              disabled={isBusy}
              onClick={() => void runLocal(resendEmailVerification)}
              className="w-full min-h-[40px] text-xs font-semibold text-fuchsia-200 underline"
            >
              إعادة إرسال رسالة التحقق
            </button>
          </div>
        )}

        {!isLinking && (
          <>
            <form
              className="space-y-3 border-t border-white/15 pt-4"
              onSubmit={(event) => {
                event.preventDefault();
                onGuestLogin(username, usernamePassword);
              }}
            >
              <p className="text-xs font-bold text-purple-50">الدخول باسم المستخدم</p>
              <label className="block space-y-1.5 text-xs font-semibold text-purple-50">
                <span>الاسم المستعار</span>
                <input
                  required
                  minLength={3}
                  maxLength={24}
                  autoComplete="username"
                  value={username}
                  onChange={(event) => setUsername(event.target.value)}
                  className="h-11 w-full rounded-xl border border-white/15 bg-[#11101e]/65 px-3 text-sm text-white"
                />
              </label>
              <label className="block space-y-1.5 text-xs font-semibold text-purple-50">
                <span>كلمة المرور</span>
                <input
                  required
                  type="password"
                  minLength={8}
                  maxLength={128}
                  autoComplete="current-password"
                  value={usernamePassword}
                  onChange={(event) => setUsernamePassword(event.target.value)}
                  className="h-11 w-full rounded-xl border border-white/15 bg-[#11101e]/65 px-3 text-sm text-white"
                />
              </label>
              <button
                type="submit"
                disabled={isBusy || !username.trim() || usernamePassword.length < 8}
                className="min-h-11 w-full rounded-xl border border-white/20 bg-white/10 text-sm font-bold disabled:opacity-50"
              >
                {isBusy ? 'جارٍ تسجيل الدخول...' : 'تسجيل الدخول'}
              </button>
            </form>
            <form
              className="space-y-3 border-t border-white/15 pt-4"
              onSubmit={(event) => {
                event.preventDefault();
                onRecoverAccount(recoveryCode);
              }}
            >
              <label htmlFor="account-recovery-code" className="block text-xs font-semibold text-purple-50">
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
                className="h-12 w-full rounded-2xl border border-white/15 bg-[#11101e]/65 px-4 font-mono text-sm tracking-wider text-white outline-none transition placeholder:text-white/35 focus:border-fuchsia-300/70 focus:ring-2 focus:ring-violet-400/20"
              />
              <button
                type="submit"
                disabled={isBusy || recoveryCode.length !== 64}
                className="w-full min-h-[46px] rounded-2xl border border-white/15 bg-white/10 text-sm font-bold transition hover:bg-white/15 disabled:opacity-50"
              >
                استعادة حسابي
              </button>
            </form>
            <p className="text-center text-xs leading-relaxed text-purple-100/65">
              الحساب الجديد لا يستعيد حسابًا سابقًا أو محادثاته. اربط تسجيل الدخول من إعدادات الحساب القديم قبل الانتقال إلى جهاز آخر.
            </p>
            <button
              type="button"
              disabled={isBusy}
              onClick={() => setGuestSignupOpen((open) => !open)}
              className="w-full min-h-[42px] rounded-2xl text-xs text-fuchsia-200 underline disabled:opacity-50"
            >
              {guestSignupOpen ? 'إلغاء إنشاء الحساب' : 'إنشاء حساب باسم مستعار وكلمة مرور'}
            </button>
            {guestSignupOpen && (
              <form
                className="space-y-3 rounded-2xl border border-white/15 bg-black/15 p-3"
                onSubmit={(event) => {
                  event.preventDefault();
                  const age = Number(guestAge);
                  if (Number.isInteger(age) && age >= 18 && age <= 120 && guestGender) {
                    onCreateAccount({
                      nickname: guestNickname.trim(),
                      password: guestPassword,
                      avatar_url: guestAvatar,
                      age,
                      gender: guestGender,
                      turnstileToken,
                    });
                  }
                }}
              >
                  <label className="block space-y-1.5 text-xs font-semibold text-purple-50">
                    <span>الاسم المستعار</span>
                    <input
                      required
                      minLength={3}
                      maxLength={24}
                      autoComplete="username"
                      value={guestNickname}
                      onChange={(event) => setGuestNickname(event.target.value)}
                      className="h-11 w-full rounded-xl border border-white/15 bg-[#11101e]/65 px-3 text-sm text-white"
                    />
                  </label>
                  <label className="block space-y-1.5 text-xs font-semibold text-purple-50">
                    <span>كلمة المرور (8 أحرف على الأقل)</span>
                    <input
                      required
                      type="password"
                      minLength={8}
                      maxLength={128}
                      autoComplete="new-password"
                      value={guestPassword}
                      onChange={(event) => setGuestPassword(event.target.value)}
                      className="h-11 w-full rounded-xl border border-white/15 bg-[#11101e]/65 px-3 text-sm text-white"
                    />
                  </label>
                  <label className="block space-y-1.5 text-xs font-semibold text-purple-50">
                    <span>الصورة الرمزية</span>
                    <select
                      value={guestAvatar}
                      onChange={(event) => setGuestAvatar(event.target.value)}
                      className="h-11 w-full rounded-xl border border-white/15 bg-[#11101e]/65 px-3 text-sm text-white"
                    >
                      {AVATAR_PRESETS.map((preset) => (
                        <option key={preset} value={preset}>{preset}</option>
                      ))}
                    </select>
                  </label>
                  {turnstileSiteKey ? (
                    <TurnstileChallenge
                      siteKey={turnstileSiteKey}
                      onToken={setTurnstileToken}
                    />
                  ) : turnstileRequired ? (
                    <p role="alert" className="text-xs leading-relaxed text-amber-200">
                      تعذر إنشاء الحساب: لم يُضبط تحقق Cloudflare Turnstile لهذا الإصدار.
                    </p>
                  ) : null}
                  <label className="block space-y-1.5 text-xs font-semibold text-purple-50">
                  <span>العمر (18 عامًا أو أكثر)</span>
                  <input
                    type="number"
                    inputMode="numeric"
                    min={18}
                    max={120}
                    required
                    value={guestAge}
                    onChange={(event) => setGuestAge(event.target.value)}
                    className="h-11 w-full rounded-xl border border-white/15 bg-[#11101e]/65 px-3 text-sm text-white"
                  />
                </label>
                <label className="block space-y-1.5 text-xs font-semibold text-purple-50">
                  <span>الجنس</span>
                  <select
                    required
                    value={guestGender}
                    onChange={(event) => {
                      const value = event.target.value;
                      if (value === 'female' || value === 'male' || value === 'other') {
                        setGuestGender(value);
                      } else {
                        setGuestGender('');
                      }
                    }}
                    className="h-11 w-full rounded-xl border border-white/15 bg-[#11101e]/65 px-3 text-sm text-white"
                  >
                    <option value="">اختر</option>
                    <option value="female">أنثى</option>
                    <option value="male">ذكر</option>
                    <option value="other">أفضل عدم التحديد</option>
                  </select>
                </label>
                <button
                  type="submit"
                  disabled={
                    isBusy ||
                    !guestAge ||
                    !guestGender ||
                    guestNickname.trim().length < 3 ||
                    guestPassword.length < 8 ||
                    (turnstileRequired && !turnstileToken)
                  }
                  className="min-h-11 w-full rounded-xl bg-amber-400 text-sm font-bold text-slate-950 disabled:opacity-50"
                >
                  {isBusy ? 'جارٍ إنشاء الحساب...' : 'متابعة'}
                </button>
              </form>
            )}
          </>
        )}

        {visibleError && (
          <p role="alert" className="break-words text-center text-xs text-rose-300">
            {visibleError}
          </p>
        )}
        {localMessage && (
          <p role="status" className="text-center text-xs text-emerald-300">
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
