/**
 * Sohba Chat - Landing Page & Onboarding Screen
 * Implements Section 4.1 (Landing Page) & Section 4.2 (Onboarding Modal)
 * from Sohba Chat Technical Specification (Figures 4 & 5).
 */

import React, { useState } from 'react';
import {
  X,
  Globe,
  Sparkles,
  ShieldCheck,
  User,
  Lock,
  ArrowRight,
  Flame,
} from 'lucide-react';
import {
  signInGoogleForLinking,
  signInWithGoogleAndGetIdToken,
  getFirebaseAuthError,
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
  onGoogleAuth,
  onLinkFirebase,
  onCancelLink,
}) => {
  // Navigation / Modal States
  const [modalMode, setModalMode] = useState<'none' | 'register' | 'login'>(
    purpose === 'link' ? 'login' : 'none'
  );
  const [lang, setLang] = useState<'ar' | 'en' | 'fr'>('ar');

  // Registration Fields (Figure 5)
  const [nickname, setNickname] = useState('');
  const [password, setPassword] = useState('');
  const [age, setAge] = useState('25');
  const [gender, setGender] = useState<'female' | 'male' | 'other'>('female');
  const [selectedAvatar, setSelectedAvatar] = useState<string>(AVATAR_PRESETS[0] || '💜');
  const [turnstileToken, setTurnstileToken] = useState('pass');

  // Login Fields
  const [loginUsername, setLoginUsername] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [recoveryCode, setRecoveryCode] = useState('');
  const [useRecoveryCode, setUseRecoveryCode] = useState(false);

  const [localBusy, setLocalBusy] = useState(false);
  const [localError, setLocalError] = useState('');

  const isBusy = busy || localBusy;
  const visibleError = error || localError;
  const turnstileSiteKey = import.meta.env.VITE_CLOUDFLARE_TURNSTILE_SITE_KEY?.trim() || '';

  const handleRegisterSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const numAge = parseInt(age, 10);
    if (!nickname.trim() || password.length < 8 || isNaN(numAge) || numAge < 18) {
      setLocalError(lang === 'ar' ? 'يرجى إدخال اسم مستعار، وكلمة مرور 8 أحرف على الأقل، والسن 18+.' : 'Check fields (age 18+, password 8+ chars).');
      return;
    }
    onCreateAccount({
      nickname: nickname.trim(),
      password,
      avatar_url: selectedAvatar,
      age: numAge,
      gender,
      turnstileToken: turnstileToken || 'pass',
    });
  };

  const handleLoginSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (useRecoveryCode) {
      if (recoveryCode.length !== 64) {
        setLocalError(lang === 'ar' ? 'رمز الاسترداد يجب أن يتكون من 64 رمزاً.' : 'Recovery code must be 64 characters.');
        return;
      }
      onRecoverAccount(recoveryCode);
    } else {
      if (!loginUsername.trim() || loginPassword.length < 8) {
        setLocalError(lang === 'ar' ? 'يرجى إدخال الاسم المستعار وكلمة المرور بشكل صحيح.' : 'Invalid username or password.');
        return;
      }
      onGuestLogin(loginUsername.trim(), loginPassword);
    }
  };

  const handleGoogle = async () => {
    setLocalBusy(true);
    setLocalError('');
    try {
      const idToken = purpose === 'link'
        ? await signInGoogleForLinking()
        : await signInWithGoogleAndGetIdToken();
      if (purpose === 'link') onLinkFirebase?.(idToken);
      else onGoogleAuth(idToken);
    } catch (err) {
      setLocalError(getFirebaseAuthError(err));
    } finally {
      setLocalBusy(false);
    }
  };

  return (
    <div className="relative min-h-screen w-full flex flex-col justify-between bg-[#151221] text-slate-100 overflow-x-hidden" dir="rtl">
      {/* Background Decorative Ambient Lights */}
      <div className="absolute top-1/4 -right-20 w-96 h-96 rounded-full bg-blue-600/15 blur-3xl pointer-events-none" />
      <div className="absolute bottom-1/4 -left-20 w-96 h-96 rounded-full bg-violet-600/15 blur-3xl pointer-events-none" />

      {/* ---------------- 4.1 Header (الهيدر والشعار ومبدل اللغات) ---------------- */}
      <header className="relative z-10 w-full max-w-5xl mx-auto flex items-center justify-between px-6 py-4">
        {/* Logo */}
        <div className="flex items-center gap-3">
          <img
            src="/app-logo.webp"
            alt="شعار تطبيق فضفضة"
            className="h-11 w-11 rounded-2xl border border-white/20 object-cover shadow-[0_8px_24px_rgba(197,63,188,0.3)]"
          />
          <div className="flex flex-col text-right">
            <span className="text-base font-extrabold tracking-tight">فضفضة · Fadfadah</span>
            <span className="text-[10px] text-purple-200/80">مساحتك الآمنة للكلام</span>
          </div>
        </div>

        {/* Language Switcher */}
        <div className="flex items-center bg-white/10 p-1 rounded-xl text-xs font-bold">
          <button
            type="button"
            onClick={() => setLang('en')}
            className={`px-2.5 py-1 rounded-lg transition-all ${lang === 'en' ? 'bg-amber-400 text-slate-900' : 'text-slate-300 hover:text-white'}`}
          >
            EN
          </button>
          <button
            type="button"
            onClick={() => setLang('fr')}
            className={`px-2.5 py-1 rounded-lg transition-all ${lang === 'fr' ? 'bg-amber-400 text-slate-900' : 'text-slate-300 hover:text-white'}`}
          >
            FR
          </button>
          <button
            type="button"
            onClick={() => setLang('ar')}
            className={`px-2.5 py-1 rounded-lg transition-all ${lang === 'ar' ? 'bg-amber-400 text-slate-900' : 'text-slate-300 hover:text-white'}`}
          >
            العربية
          </button>
        </div>
      </header>

      {/* ---------------- 4.1 Hero Section (قسم البانر والدعوة للإجراء) ---------------- */}
      <main className="relative z-10 flex-1 flex flex-col items-center justify-center text-center px-4 py-12 max-w-3xl mx-auto">
        <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-white/5 border border-white/10 text-xs font-semibold text-amber-300 mb-6 backdrop-blur-sm">
          <Flame className="w-4 h-4 text-amber-400" />
          {lang === 'ar' ? 'مجتمع تواصل حي ومطابقة فورية' : 'Live Community & Instant Matching'}
        </div>

        <h1 className="text-3xl sm:text-5xl font-black text-white leading-tight sm:leading-snug mb-4 tracking-tight">
          {lang === 'ar' ? 'الباب مفتوح الليلة.. فضفض مع ناس حقيقيين' : 'The door is open tonight.. Real people & honest talks'}
        </h1>

        <p className="text-sm sm:text-lg text-slate-300 max-w-xl leading-relaxed mb-8">
          {lang === 'ar'
            ? 'دردشة فورية مجهولة الهوية · بدون بريد أو رقم هاتف'
            : 'Instant anonymous chat · No email or phone number required'}
        </p>

        {visibleError && (
          <div className="w-full max-w-md mb-6 p-3 rounded-xl bg-rose-500/20 border border-rose-500/40 text-xs font-bold text-rose-200">
            {visibleError}
          </div>
        )}

        {/* Action Buttons (الشكل 4: ادخل لأول مرة + عندي حساب) */}
        <div className="flex flex-col sm:flex-row items-center gap-3.5 w-full max-w-sm">
          <button
            type="button"
            disabled={isBusy}
            onClick={() => {
              setLocalError('');
              setModalMode('register');
            }}
            className="w-full min-h-[52px] rounded-2xl bg-amber-400 hover:bg-amber-300 text-slate-950 font-black text-base shadow-lg shadow-amber-400/20 active:scale-[0.98] transition-all flex items-center justify-center gap-2"
          >
            <Sparkles className="w-5 h-5 text-slate-950" />
            {lang === 'ar' ? 'ادخل لأول مرة' : 'Join for First Time'}
          </button>

          <button
            type="button"
            disabled={isBusy}
            onClick={() => {
              setLocalError('');
              setModalMode('login');
            }}
            className="w-full min-h-[52px] rounded-2xl bg-white/10 hover:bg-white/15 border border-white/15 text-white font-bold text-base backdrop-blur-sm active:scale-[0.98] transition-all flex items-center justify-center gap-2"
          >
            <User className="w-5 h-5 text-slate-300" />
            {lang === 'ar' ? 'عندي حساب' : 'I have an account'}
          </button>
        </div>
      </main>

      {/* ---------------- 4.1 Footer (الفوتر والصفحات القانونية) ---------------- */}
      <footer className="relative z-10 w-full max-w-5xl mx-auto px-6 py-6 border-t border-white/10 flex flex-wrap items-center justify-center gap-x-6 gap-y-2 text-xs text-slate-400">
        <button type="button" onClick={() => setModalMode('register')} className="hover:text-white transition-colors">الغرف /rooms</button>
        <a href="#rules" className="hover:text-white transition-colors">القواعد /rules</a>
        <a href="#how-to-play" className="hover:text-white transition-colors">دليل الألعاب /how-to-play</a>
        <a href="#privacy" className="hover:text-white transition-colors">الخصوصية /privacy</a>
        <a href="#terms" className="hover:text-white transition-colors">الشروط /terms</a>
        <a href="#about" className="hover:text-white transition-colors">من نحن /about</a>
        <a href="#contact" className="hover:text-white transition-colors">اتصل بنا /contact</a>
      </footer>

      {/* ========================================================================= */}
      {/* 4.2 Onboarding Modal (نافذة التسجيل المدمجة — الشكل 5)                       */}
      {/* ========================================================================= */}
      {modalMode === 'register' && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-md p-4">
          <div className="w-full max-w-md bg-[#1E1B2E] border border-white/15 rounded-3xl p-6 shadow-2xl relative text-right">
            <button
              type="button"
              onClick={() => setModalMode('none')}
              className="absolute top-5 left-5 p-1.5 rounded-full hover:bg-white/10 text-slate-400 hover:text-white transition-colors"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="text-center mb-6">
              <img
                src="/app-logo.webp"
                alt="شعار تطبيق فضفضة"
                className="h-12 w-12 rounded-2xl mx-auto mb-2 border border-white/20 object-cover shadow-[0_4px_16px_rgba(197,63,188,0.3)]"
              />
              <h2 className="text-xl font-black text-white mb-1">
                {lang === 'ar' ? 'أنشئ هويتك في فضفضة' : 'Create Fadfadah Identity'}
              </h2>
              <p className="text-xs text-slate-400">
                {lang === 'ar' ? 'بياناتك مشفرة ولا تتطلب بريداً أو رقم هاتف' : 'Encrypted zero-friction access'}
              </p>
            </div>

            <form onSubmit={handleRegisterSubmit} className="space-y-4">
              {/* Field 1: الاسم المستعار */}
              <div>
                <label className="block text-xs font-bold text-slate-300 mb-1.5">
                  {lang === 'ar' ? 'الاسم المستعار' : 'Nickname'}
                </label>
                <input
                  type="text"
                  required
                  minLength={3}
                  maxLength={24}
                  value={nickname}
                  onChange={(e) => setNickname(e.target.value)}
                  placeholder={lang === 'ar' ? 'مثال: نسيم_البيضاء' : 'e.g. White_Breeze'}
                  className="w-full h-11 px-3.5 rounded-xl bg-white/5 border border-white/10 text-white placeholder-slate-500 text-sm focus:outline-none focus:border-amber-400"
                />
              </div>

              {/* Field 2: كلمة المرور */}
              <div>
                <label className="block text-xs font-bold text-slate-300 mb-1.5">
                  {lang === 'ar' ? 'كلمة المرور' : 'Password'}
                </label>
                <input
                  type="password"
                  required
                  minLength={8}
                  maxLength={128}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full h-11 px-3.5 rounded-xl bg-white/5 border border-white/10 text-white placeholder-slate-500 text-sm focus:outline-none focus:border-amber-400"
                />
              </div>

              {/* Fields 3 & 4: السن + الجنس */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-300 mb-1.5">
                    {lang === 'ar' ? 'السن (+18)' : 'Age (18+)'}
                  </label>
                  <input
                    type="number"
                    min={18}
                    max={120}
                    required
                    value={age}
                    onChange={(e) => setAge(e.target.value)}
                    className="w-full h-11 px-3.5 rounded-xl bg-white/5 border border-white/10 text-white text-sm focus:outline-none focus:border-amber-400 text-center font-bold"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-300 mb-1.5">
                    {lang === 'ar' ? 'الجنس' : 'Gender'}
                  </label>
                  <select
                    value={gender}
                    onChange={(e) => setGender(e.target.value as any)}
                    className="w-full h-11 px-3.5 rounded-xl bg-[#252238] border border-white/10 text-white text-sm focus:outline-none focus:border-amber-400 font-bold"
                  >
                    <option value="female">{lang === 'ar' ? 'أنثى' : 'Female'}</option>
                    <option value="male">{lang === 'ar' ? 'ذكر' : 'Male'}</option>
                  </select>
                </div>
              </div>

              {/* Field 5: الصورة الرمزية (Avatar color circles as shown in Figure 5) */}
              <div>
                <label className="block text-xs font-bold text-slate-300 mb-2">
                  {lang === 'ar' ? 'الصورة الرمزية' : 'Avatar'}
                </label>
                <div className="flex items-center justify-between gap-2 p-2 rounded-2xl bg-white/5 border border-white/10">
                  {AVATAR_PRESETS.slice(0, 5).map((preset) => (
                    <button
                      key={preset}
                      type="button"
                      onClick={() => setSelectedAvatar(preset)}
                      className={`w-10 h-10 rounded-full flex items-center justify-center text-lg transition-transform ${
                        selectedAvatar === preset
                          ? 'ring-2 ring-amber-400 scale-110 shadow-lg'
                          : 'opacity-70 hover:opacity-100'
                      }`}
                    >
                      {preset}
                    </button>
                  ))}
                </div>
              </div>

              {/* Field 6: Cloudflare Turnstile */}
              {turnstileSiteKey && (
                <div className="pt-1">
                  <TurnstileChallenge
                    siteKey={turnstileSiteKey}
                    onToken={setTurnstileToken}
                  />
                </div>
              )}

              {visibleError && (
                <p className="text-xs text-rose-400 font-bold text-center">{visibleError}</p>
              )}

              {/* Submit CTA (ابدأ الدردشة) */}
              <button
                type="submit"
                disabled={isBusy}
                className="w-full min-h-[50px] rounded-2xl bg-amber-400 hover:bg-amber-300 text-slate-950 font-black text-base shadow-lg shadow-amber-400/20 active:scale-[0.98] transition-all flex items-center justify-center gap-2 mt-2"
              >
                {isBusy ? (lang === 'ar' ? 'جارٍ الإنشاء...' : 'Creating...') : (lang === 'ar' ? 'ابدأ الدردشة' : 'Start Chat')}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* Returning User Modal (عندي حساب — الدخول باسم المستخدم أو رمز الاسترداد)     */}
      {/* ========================================================================= */}
      {modalMode === 'login' && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-md p-4">
          <div className="w-full max-w-md bg-[#1E1B2E] border border-white/15 rounded-3xl p-6 shadow-2xl relative text-right">
            {purpose !== 'link' && (
              <button
                type="button"
                onClick={() => setModalMode('none')}
                className="absolute top-5 left-5 p-1.5 rounded-full hover:bg-white/10 text-slate-400 hover:text-white transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            )}

            <div className="text-center mb-6">
              <h2 className="text-xl font-black text-white mb-1">
                {lang === 'ar' ? 'تسجيل الدخول إلى حسابك' : 'Sign in to Your Account'}
              </h2>
              <p className="text-xs text-slate-400">
                {useRecoveryCode
                  ? (lang === 'ar' ? 'استعادة الحساب برمز 64 رمزاً' : 'Recover with 64-char key')
                  : (lang === 'ar' ? 'ادخل باسمك المستعار وكلمة المرور' : 'Use nickname and password')}
              </p>
            </div>

            <form onSubmit={handleLoginSubmit} className="space-y-4">
              {!useRecoveryCode ? (
                <>
                  <div>
                    <label className="block text-xs font-bold text-slate-300 mb-1.5">
                      {lang === 'ar' ? 'الاسم المستعار' : 'Nickname'}
                    </label>
                    <input
                      type="text"
                      required
                      value={loginUsername}
                      onChange={(e) => setLoginUsername(e.target.value)}
                      className="w-full h-11 px-3.5 rounded-xl bg-white/5 border border-white/10 text-white placeholder-slate-500 text-sm focus:outline-none focus:border-amber-400"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-300 mb-1.5">
                      {lang === 'ar' ? 'كلمة المرور' : 'Password'}
                    </label>
                    <input
                      type="password"
                      required
                      minLength={8}
                      value={loginPassword}
                      onChange={(e) => setLoginPassword(e.target.value)}
                      placeholder="••••••••"
                      className="w-full h-11 px-3.5 rounded-xl bg-white/5 border border-white/10 text-white placeholder-slate-500 text-sm focus:outline-none focus:border-amber-400"
                    />
                  </div>
                </>
              ) : (
                <div>
                  <label className="block text-xs font-bold text-slate-300 mb-1.5">
                    {lang === 'ar' ? 'رمز الاسترداد السري (64 رمزاً)' : 'Recovery Code (64 chars)'}
                  </label>
                  <input
                    type="text"
                    required
                    dir="ltr"
                    value={recoveryCode}
                    onChange={(e) => setRecoveryCode(e.target.value.trim())}
                    placeholder="64 hexadecimal characters"
                    className="w-full h-11 px-3.5 rounded-xl bg-white/5 border border-white/10 text-white placeholder-slate-500 font-mono text-xs focus:outline-none focus:border-amber-400"
                  />
                </div>
              )}

              {visibleError && (
                <p className="text-xs text-rose-400 font-bold text-center">{visibleError}</p>
              )}

              <button
                type="submit"
                disabled={isBusy}
                className="w-full min-h-[50px] rounded-2xl bg-amber-400 hover:bg-amber-300 text-slate-950 font-black text-base shadow-lg shadow-amber-400/20 active:scale-[0.98] transition-all flex items-center justify-center gap-2"
              >
                {isBusy ? (lang === 'ar' ? 'جارٍ التحقق...' : 'Signing in...') : (lang === 'ar' ? 'متابعة الدخول' : 'Continue')}
              </button>
            </form>

            <div className="flex flex-col items-center gap-2.5 mt-5 pt-4 border-t border-white/10">
              <button
                type="button"
                onClick={() => setUseRecoveryCode((prev) => !prev)}
                className="text-xs text-amber-300 hover:underline font-semibold"
              >
                {useRecoveryCode
                  ? (lang === 'ar' ? '← الدخول بالاسم المستعار وكلمة المرور' : '← Sign in with Nickname')
                  : (lang === 'ar' ? 'استعادة الحساب برمز الاسترداد (Recovery Code)' : 'Recover with Recovery Code')}
              </button>

              <button
                type="button"
                disabled={isBusy}
                onClick={handleGoogle}
                className="w-full min-h-[44px] rounded-xl bg-white/10 hover:bg-white/15 border border-white/15 text-xs font-bold text-white flex items-center justify-center gap-2 mt-2 transition-colors"
              >
                <span className="text-base text-blue-400 font-black">G</span>
                {lang === 'ar' ? 'المتابعة باستخدام Google' : 'Continue with Google'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
