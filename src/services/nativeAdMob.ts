import { Capacitor } from '@capacitor/core';
import {
  AdMob,
  AdmobConsentStatus,
  BannerAdPosition,
  BannerAdSize,
  MaxAdContentRating,
} from '@capacitor-community/admob';

let initialization: Promise<boolean> | null = null;
let bannerCount = 0;
let bannerTask: Promise<void> | null = null;

async function initializeAdMob(): Promise<boolean> {
  if (!Capacitor.isNativePlatform()) return false;
  if (!initialization) {
    initialization = (async () => {
      let consent = await AdMob.requestConsentInfo();
      if (
        consent.isConsentFormAvailable &&
        consent.status === AdmobConsentStatus.REQUIRED
      ) {
        consent = await AdMob.showConsentForm();
      }
      if (!consent.canRequestAds) return false;

      await AdMob.initialize({
        maxAdContentRating: MaxAdContentRating.Teen,
      });
      return true;
    })().catch((error: unknown) => {
      initialization = null;
      throw error;
    });
  }
  return initialization;
}

export async function acquireAdMobBanner(
  adId: string,
  isTesting: boolean
): Promise<() => void> {
  if (!(await initializeAdMob())) return () => undefined;

  bannerCount += 1;
  if (!bannerTask) {
    bannerTask = AdMob.showBanner({
      adId,
      adSize: BannerAdSize.ADAPTIVE_BANNER,
      position: BannerAdPosition.BOTTOM_CENTER,
      margin: 64,
      isTesting,
    }).catch((error: unknown) => {
      bannerTask = null;
      bannerCount = 0;
      throw error;
    });
  }

  try {
    await bannerTask;
  } catch (error) {
    throw error;
  }

  let released = false;
  return () => {
    if (released) return;
    released = true;
    bannerCount = Math.max(0, bannerCount - 1);
    if (bannerCount === 0) {
      bannerTask = null;
      void AdMob.removeBanner().catch((error: unknown) => {
        console.error('Failed to remove AdMob banner:', error);
      });
    }
  };
}

export async function showAdMobInterstitial(
  adId: string,
  isTesting: boolean
): Promise<void> {
  if (!(await initializeAdMob())) return;
  await AdMob.prepareInterstitial({ adId, isTesting });
  await AdMob.showInterstitial();
}
