import React, { useState } from 'react';

interface AccountAccessScreenProps {
  busy: boolean;
  error: string;
  onCreateAccount: () => void;
  onRecoverAccount: (recoveryCode: string) => void;
}

export const AccountAccessScreen: React.FC<AccountAccessScreenProps> = ({
  busy,
  error,
  onCreateAccount,
  onRecoverAccount,
}) => {
  const [recoveryCode, setRecoveryCode] = useState('');

  return (
    <main className="min-h-[100dvh] flex items-center justify-center p-5 bg-[#2D1B69] text-white">
      <section className="w-full max-w-md rounded-3xl bg-[#1E1B2E] border border-white/10 p-6 space-y-5 shadow-2xl">
        <header className="text-center space-y-2">
          <div className="w-14 h-14 mx-auto rounded-2xl bg-[#8B5CF6] flex items-center justify-center text-2xl font-bold">
            ف
          </div>
          <h1 className="text-xl font-bold">استعادة حساب فضفضة</h1>
          <p className="text-sm text-purple-200 leading-relaxed">
            أدخل رمز الاسترداد لاسترجاع حسابك ومحادثاتك وإعداداتك. إذا كان هذا
            أول استخدام لك، يمكنك إنشاء حساب جديد.
          </p>
        </header>

        <form
          className="space-y-3"
          onSubmit={(event) => {
            event.preventDefault();
            onRecoverAccount(recoveryCode);
          }}
        >
          <label htmlFor="account-recovery-code" className="block text-xs font-semibold">
            رمز استرداد الحساب
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
            disabled={busy || recoveryCode.length !== 64}
            className="w-full min-h-[46px] rounded-xl bg-[#8B5CF6] disabled:opacity-50 font-bold text-sm"
          >
            {busy ? 'جارٍ استعادة الحساب...' : 'استعادة حسابي'}
          </button>
        </form>

        <div className="border-t border-white/10 pt-4 space-y-3">
          <p className="text-xs text-slate-300 text-center">
            إنشاء حساب جديد لا يستعيد الحساب السابق. لا تستخدمه إذا كنت تريد
            استرجاع حسابك الحالي.
          </p>
          <button
            type="button"
            disabled={busy}
            onClick={onCreateAccount}
            className="w-full min-h-[44px] rounded-xl bg-white/10 disabled:opacity-50 font-semibold text-sm"
          >
            إنشاء حساب جديد
          </button>
        </div>

        {error && (
          <p role="alert" className="text-xs text-rose-300 text-center break-words">
            {error}
          </p>
        )}
      </section>
    </main>
  );
};
