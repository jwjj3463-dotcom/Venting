/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useState } from 'react';
import { ExternalLink, X, ShieldCheck } from 'lucide-react';
import { adService, AdConfig } from '../services/adService';
import { AppLang } from '../i18n/translations';

interface AdInterstitialModalProps {
  isOpen: boolean;
  lang: AppLang;
  onClose: () => void;
}

export const AdInterstitialModal: React.FC<AdInterstitialModalProps> = ({
  isOpen,
  lang,
  onClose,
}) => {
  const [secondsLeft, setSecondsLeft] = useState(5);
  const [canSkip, setCanSkip] = useState(false);
  const adConfig = adService.getConfig();

  useEffect(() => {
    if (!isOpen) {
      setSecondsLeft(5);
      setCanSkip(false);
      return;
    }

    adService.recordInterstitialShown();
    setSecondsLeft(5);
    setCanSkip(false);

    const interval = setInterval(() => {
      setSecondsLeft((s) => {
        if (s <= 1) {
          clearInterval(interval);
          setCanSkip(true);
          return 0;
        }
        return s - 1;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/90 backdrop-blur-md animate-fadeIn">
      <div className="w-full max-w-sm rounded-3xl bg-[#1E1B2E] border border-white/10 shadow-2xl overflow-hidden flex flex-col text-white">
        {/* Header */}
        <div className="px-4 py-3 bg-[#151221] border-b border-white/10 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="px-2 py-0.5 rounded text-[10px] font-mono-num font-bold uppercase bg-amber-500/20 text-amber-300 border border-amber-500/40">
              AdMob Interstitial
            </span>
            {adConfig.test_mode && (
              <span className="text-[10px] text-slate-400 font-mono-num">
                (Test Mode)
              </span>
            )}
          </div>

          <div>
            {canSkip ? (
              <button
                type="button"
                onClick={onClose}
                className="px-2.5 py-1 rounded-lg bg-white/20 hover:bg-white/30 text-white text-xs font-bold flex items-center gap-1 active:scale-95 transition-transform"
              >
                <span>{lang === 'ar' ? 'تخطي' : 'Skip'}</span>
                <X className="w-3.5 h-3.5" />
              </button>
            ) : (
              <div className="px-2.5 py-1 rounded-full bg-black/50 text-[11px] font-mono-num font-bold text-slate-300">
                {secondsLeft}s
              </div>
            )}
          </div>
        </div>

        {/* Visual Content */}
        <div className="p-6 text-center space-y-4 bg-gradient-to-b from-[#2D1B69] to-[#1E1B2E]">
          <div className="w-16 h-16 rounded-3xl bg-[#8B5CF6] text-white flex items-center justify-center mx-auto shadow-lg text-2xl font-bold">
            ف
          </div>

          <div className="space-y-1.5">
            <h3 className="text-base font-bold text-white">فضفضة VIP — تواصل بدون إعلانات</h3>
            <p className="text-xs text-purple-200/80 leading-relaxed">
              استمتع بتجربة كاملة هادئة بدون إعلانات، محادثات عشوائية غير محدودة، وإطارات ملكية حصرية.
            </p>
          </div>

          <a
            href="https://google.com"
            target="_blank"
            rel="noopener noreferrer"
            className="w-full min-h-[44px] rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-slate-950 text-xs font-bold flex items-center justify-center gap-1.5 shadow-md active:scale-98 transition-transform"
          >
            <span>{lang === 'ar' ? 'زيارة الرابط الإعلاني' : 'Visit Sponsored Link'}</span>
            <ExternalLink className="w-3.5 h-3.5" />
          </a>
        </div>
      </div>
    </div>
  );
};
