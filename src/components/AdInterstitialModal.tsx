import React, { useEffect, useRef } from 'react';
import { adService } from '../services/adService';
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
  const closeRef = useRef(onClose);

  useEffect(() => {
    closeRef.current = onClose;
  }, [onClose]);

  useEffect(() => {
    if (!isOpen) return;

    let cancelled = false;
    adService.recordInterstitialShown();
    adService
      .showInterstitial()
      .catch((error: unknown) => {
        console.error(
          lang === 'ar'
            ? 'تعذر عرض إعلان AdMob البيني:'
            : 'Failed to show AdMob interstitial:',
          error
        );
      })
      .finally(() => {
        if (!cancelled) closeRef.current();
      });

    return () => {
      cancelled = true;
    };
  }, [isOpen, lang]);

  return null;
};
