/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useRef, useState } from 'react';
import { ExternalLink, Sparkles, X, ShieldCheck, Globe, DollarSign } from 'lucide-react';
import { RealmUser } from '../db/realmLocalDB';
import { adService, AdConfig } from '../services/adService';
import { AppLang } from '../i18n/translations';

interface AdBannerProps {
  selfUser: RealmUser | null;
  lang: AppLang;
  position?: 'bottom' | 'inline';
  onOpenUpgrade?: () => void;
}

// Official Live Sponsors for direct monetization & fallback
const SPONSORS = [
  {
    brand: 'Google AdSense الرسمي',
    title: 'اربح أموالاً حقيقية من زوار موقعك وتطبيقك مع شبكة جوجل الإعلانية المجانية',
    tag: 'شبكة جوجل الرسمية',
    cta: 'ابدأ الربح مجاناً',
    url: 'https://adsense.google.com',
    bg: 'from-blue-950/70 to-blue-900/40',
    accent: 'text-blue-400',
    network: 'Google AdSense',
  },
  {
    brand: 'شبكة Monetag للأرباح الفورية',
    title: 'قبول فوري وبدون شروط للمواقع وتطبيقات PWA مع دفع عبر PayPal والحساب البنكي',
    tag: 'قبول فوري 100%',
    cta: 'سجل مجاناً',
    url: 'https://monetag.com',
    bg: 'from-emerald-950/70 to-emerald-900/40',
    accent: 'text-emerald-400',
    network: 'Monetag Publisher',
  },
  {
    brand: 'تطبيق هدوء — التأمل والنوم',
    title: 'تخلص من التوتر وضغوط اليوم مع جلسات استرخاء صوتية مجانية',
    tag: 'صحة نفسية',
    cta: 'جرب التطبيق',
    url: 'https://play.google.com',
    bg: 'from-purple-950/70 to-purple-900/40',
    accent: 'text-purple-300',
    network: 'Live Sponsor',
  },
];

export const AdBanner: React.FC<AdBannerProps> = ({
  selfUser,
  lang,
  position = 'bottom',
  onOpenUpgrade,
}) => {
  const [config, setConfig] = useState<AdConfig>(adService.getConfig());
  const [dismissed, setDismissed] = useState(false);
  const [sponsorIndex, setSponsorIndex] = useState(0);
  const [adSenseError, setAdSenseError] = useState(false);
  const adSenseSlotRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const unsub = adService.subscribe(() => {
      setConfig(adService.getConfig());
    });
    setSponsorIndex(Math.floor(Math.random() * SPONSORS.length));
    return unsub;
  }, []);

  // Dynamically load Google AdSense script if publisher ID is configured
  useEffect(() => {
    if (config.ad_provider === 'adsense' && config.adsense_publisher_id?.trim()) {
      const pubId = config.adsense_publisher_id.trim();
      const scriptId = 'google-adsense-script';
      if (!document.getElementById(scriptId)) {
        const script = document.createElement('script');
        script.id = scriptId;
        script.src = `https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${encodeURIComponent(
          pubId
        )}`;
        script.async = true;
        script.crossOrigin = 'anonymous';
        script.onerror = () => setAdSenseError(true);
        document.head.appendChild(script);
      }

      // Try pushing adsbygoogle once mounted
      try {
        const w = window as any;
        if (typeof w !== 'undefined') {
          w.adsbygoogle = w.adsbygoogle || [];
          setTimeout(() => {
            try {
              w.adsbygoogle.push({});
            } catch {
              // Ignore duplicate push or adblocker
            }
          }, 300);
        }
      } catch {
        setAdSenseError(true);
      }
    }
  }, [config.ad_provider, config.adsense_publisher_id, config.adsense_banner_slot_id]);

  // Premium VIP subscribers NEVER see any ads
  if (!adService.shouldShowBanner(selfUser) || dismissed) {
    return null;
  }

  // 1. Google AdSense Official Live Slot
  const hasLiveAdSense =
    config.ad_provider === 'adsense' &&
    Boolean(config.adsense_publisher_id?.trim()) &&
    !adSenseError &&
    !config.test_mode;

  if (hasLiveAdSense) {
    return (
      <div
        className={`w-full overflow-hidden transition-all duration-300 ${
          position === 'bottom'
            ? 'px-3 py-2 border-t border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-[#181528]'
            : 'my-3 px-3 py-2.5 rounded-2xl border border-slate-200 dark:border-white/10 bg-slate-100 dark:bg-[#1B182A]'
        }`}
      >
        <div className="max-w-3xl mx-auto" ref={adSenseSlotRef}>
          <div className="flex items-center justify-between pb-1 text-[9px] text-slate-400 font-mono-num">
            <span className="flex items-center gap-1 text-amber-500 font-bold">
              <DollarSign className="w-3 h-3" />
              إعلان جوجل الرسمي (AdSense Live)
            </span>
            {onOpenUpgrade && (
              <button
                type="button"
                onClick={onOpenUpgrade}
                className="text-purple-600 dark:text-purple-300 hover:underline flex items-center gap-1"
              >
                <Sparkles className="w-3 h-3 text-amber-400" />
                <span>إزالة الإعلانات مع VIP</span>
              </button>
            )}
          </div>
          {/* Official AdSense ins container */}
          <ins
            className="adsbygoogle"
            style={{ display: 'block', minHeight: '50px' }}
            data-ad-client={config.adsense_publisher_id}
            data-ad-slot={config.adsense_banner_slot_id || 'default'}
            data-ad-format="auto"
            data-full-width-responsive="true"
          />
        </div>
      </div>
    );
  }

  // 2. Custom Script / Monetag Live Embed
  const hasCustomCode =
    (config.ad_provider === 'monetag' || config.ad_provider === 'custom') &&
    Boolean(config.custom_banner_code?.trim()) &&
    !config.test_mode;

  if (hasCustomCode) {
    return (
      <div
        className={`w-full overflow-hidden transition-all duration-300 ${
          position === 'bottom'
            ? 'px-3 py-2 border-t border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-[#181528]'
            : 'my-3 px-3 py-2.5 rounded-2xl border border-slate-200 dark:border-white/10 bg-slate-100 dark:bg-[#1B182A]'
        }`}
      >
        <div className="max-w-3xl mx-auto">
          <div className="flex items-center justify-between pb-1 text-[9px] text-slate-400 font-mono-num">
            <span className="flex items-center gap-1 text-emerald-500 font-bold">
              <Globe className="w-3 h-3" />
              {config.ad_provider === 'monetag' ? 'Monetag Ad Tag' : 'Official Ad Network'}
            </span>
            <button
              type="button"
              onClick={() => setDismissed(true)}
              className="p-0.5 text-slate-400 hover:text-slate-600"
            >
              <X className="w-3 h-3" />
            </button>
          </div>
          <div
            className="min-h-[50px] flex items-center justify-center overflow-hidden"
            dangerouslySetInnerHTML={{ __html: config.custom_banner_code }}
          />
        </div>
      </div>
    );
  }

  // 3. Official Live / Test Interactive Sponsored Banner
  const sponsor = SPONSORS[sponsorIndex] || SPONSORS[0];

  return (
    <div
      className={`w-full transition-all duration-300 ${
        position === 'bottom'
          ? 'px-3 py-2 border-t border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-[#181528]'
          : 'my-3 px-3 py-2.5 rounded-2xl border border-slate-200 dark:border-white/10 bg-gradient-to-r ' +
            sponsor.bg
      }`}
    >
      <div className="max-w-3xl mx-auto flex items-center justify-between gap-3">
        {/* Ad Tag & Sponsor Info */}
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="flex flex-col items-center justify-center shrink-0">
            <span className="px-1.5 py-0.5 rounded text-[9px] font-mono-num font-bold uppercase bg-amber-500/20 text-amber-500 dark:text-amber-300 border border-amber-500/30">
              Ad · إعلان
            </span>
            <span className="text-[8px] font-mono-num text-slate-400 mt-0.5">
              {config.test_mode
                ? 'وضع تجريبي'
                : config.ad_provider === 'adsense'
                ? 'Google AdSense'
                : 'Live Ad'}
            </span>
          </div>

          <div className="min-w-0">
            <div className="flex items-center gap-1.5">
              <span className="text-[11px] font-bold text-slate-800 dark:text-white truncate">
                {sponsor.brand}
              </span>
              <span className="text-[9px] px-1 rounded bg-purple-500/20 text-purple-600 dark:text-purple-300">
                {sponsor.tag}
              </span>
            </div>
            <p className="text-[10px] text-slate-600 dark:text-slate-300 truncate leading-snug">
              {sponsor.title}
            </p>
          </div>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-2 shrink-0">
          {onOpenUpgrade && (
            <button
              type="button"
              onClick={onOpenUpgrade}
              title={lang === 'ar' ? 'إزالة الإعلانات مع باقة VIP' : 'Remove ads with VIP'}
              className="hidden sm:inline-flex items-center gap-1 text-[10px] text-purple-600 dark:text-purple-300 hover:underline"
            >
              <Sparkles className="w-3 h-3 text-amber-400" />
              <span>{lang === 'ar' ? 'إزالة الإعلانات' : 'Remove Ads'}</span>
            </button>
          )}

          <a
            href={sponsor.url}
            target="_blank"
            rel="noopener noreferrer"
            className="min-h-[30px] px-3 py-1 rounded-xl bg-[#8B5CF6] hover:bg-[#7C3AED] text-white text-[11px] font-bold flex items-center gap-1.5 shadow-sm active:scale-95 transition-transform"
          >
            <span>{sponsor.cta}</span>
            <ExternalLink className="w-3 h-3" />
          </a>

          <button
            type="button"
            onClick={() => setDismissed(true)}
            aria-label="Dismiss"
            className="p-1 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-white"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    </div>
  );
};
