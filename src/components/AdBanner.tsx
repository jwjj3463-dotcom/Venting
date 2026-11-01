/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useState } from 'react';
import { ExternalLink, Sparkles, X } from 'lucide-react';
import { Capacitor } from '@capacitor/core';
import { RealmUser } from '../db/realmLocalDB';
import { adService, AdConfig } from '../services/adService';
import { AppLang } from '../i18n/translations';
import { acquireAdMobBanner } from '../services/nativeAdMob';

interface AdBannerProps {
  selfUser: RealmUser | null;
  lang: AppLang;
  position?: 'bottom' | 'inline';
  onOpenUpgrade?: () => void;
}

export const AdBanner: React.FC<AdBannerProps> = ({
  selfUser,
  lang,
  position = 'bottom',
  onOpenUpgrade,
}) => {
  const [config, setConfig] = useState<AdConfig>(adService.getConfig());
  const [dismissed, setDismissed] = useState(false);
  const [adSenseError, setAdSenseError] = useState(false);

  useEffect(() => {
    return adService.subscribe(() => {
      setConfig(adService.getConfig());
    });
  }, []);

  useEffect(() => {
    if (
      !Capacitor.isNativePlatform() ||
      config.ad_provider !== 'admob' ||
      !adService.shouldShowBanner(selfUser) ||
      dismissed ||
      !config.admob_banner_id.trim()
    ) {
      return;
    }

    let cancelled = false;
    let releaseBanner: (() => void) | undefined;

    acquireAdMobBanner(config.admob_banner_id, config.test_mode)
      .then((release) => {
        if (cancelled) {
          release();
        } else {
          releaseBanner = release;
        }
      })
      .catch((error: unknown) => {
        console.error('Failed to show AdMob banner:', error);
      });

    return () => {
      cancelled = true;
      releaseBanner?.();
    };
  }, [
    config.ad_provider,
    config.admob_banner_id,
    config.banner_enabled,
    config.enabled,
    config.test_mode,
    dismissed,
    selfUser,
  ]);

  useEffect(() => {
    if (
      Capacitor.isNativePlatform() ||
      config.ad_provider !== 'adsense' ||
      !config.adsense_publisher_id.trim()
    ) {
      return;
    }

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

    try {
      const adsWindow = window as Window & { adsbygoogle?: unknown[] };
      adsWindow.adsbygoogle = adsWindow.adsbygoogle || [];
      window.setTimeout(() => {
        try {
          adsWindow.adsbygoogle?.push({});
        } catch (error) {
          console.error('Failed to request AdSense banner:', error);
          setAdSenseError(true);
        }
      }, 300);
    } catch (error) {
      console.error('Failed to initialize AdSense banner:', error);
      setAdSenseError(true);
    }
  }, [config.ad_provider, config.adsense_publisher_id, config.adsense_banner_slot_id]);

  if (!adService.shouldShowBanner(selfUser) || dismissed) return null;

  if (Capacitor.isNativePlatform()) return null;

  const containerClass =
    position === 'bottom'
      ? 'w-full px-3 py-2 border-t border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-[#181528]'
      : 'my-3 px-3 py-2.5 rounded-2xl border border-slate-200 dark:border-white/10 bg-slate-100 dark:bg-[#1B182A]';

  if (
    config.ad_provider === 'adsense' &&
    config.adsense_publisher_id.trim() &&
    config.adsense_banner_slot_id.trim() &&
    !adSenseError &&
    !config.test_mode
  ) {
    return (
      <div className={containerClass}>
        <div className="max-w-3xl mx-auto">
          <div className="flex items-center justify-between pb-1 text-[9px] text-slate-400 font-mono-num">
            <span>إعلان</span>
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
          <ins
            className="adsbygoogle"
            style={{ display: 'block', minHeight: '50px' }}
            data-ad-client={config.adsense_publisher_id}
            data-ad-slot={config.adsense_banner_slot_id}
            data-ad-format="auto"
            data-full-width-responsive="true"
          />
        </div>
      </div>
    );
  }

  if (
    (config.ad_provider === 'monetag' || config.ad_provider === 'custom') &&
    config.custom_banner_code.trim() &&
    !config.test_mode
  ) {
    return (
      <div className={containerClass}>
        <div className="max-w-3xl mx-auto">
          <div className="flex items-center justify-between pb-1 text-[9px] text-slate-400 font-mono-num">
            <span>إعلان</span>
            <button
              type="button"
              onClick={() => setDismissed(true)}
              aria-label={lang === 'ar' ? 'إغلاق الإعلان' : 'Dismiss ad'}
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

  return null;
};
