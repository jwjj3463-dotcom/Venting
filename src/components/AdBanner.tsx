/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useState } from 'react';
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
}) => {
  const [config, setConfig] = useState<AdConfig>(adService.getConfig());

  useEffect(() => {
    return adService.subscribe(() => {
      setConfig(adService.getConfig());
    });
  }, []);

  useEffect(() => {
    if (
      !Capacitor.isNativePlatform() ||
      !adService.shouldShowBanner(selfUser) ||
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
    config.admob_banner_id,
    config.banner_enabled,
    config.enabled,
    config.test_mode,
    selfUser,
  ]);

  if (!adService.shouldShowBanner(selfUser)) return null;

  if (Capacitor.isNativePlatform()) return null;
  return null;
};
