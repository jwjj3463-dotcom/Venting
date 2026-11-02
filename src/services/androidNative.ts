import { Capacitor } from '@capacitor/core';
import { App as CapApp } from '@capacitor/app';
import { StatusBar, Style } from '@capacitor/status-bar';
import { Haptics, ImpactStyle } from '@capacitor/haptics';
import { Share } from '@capacitor/share';
import { Clipboard } from '@capacitor/clipboard';

export function isRunningInsideNativeAndroid(): boolean {
  return Capacitor.isNativePlatform();
}

export async function initNativeAndroidSystemBars(isDark: boolean): Promise<void> {
  if (!Capacitor.isNativePlatform()) return;
  try {
    await StatusBar.setOverlaysWebView({ overlay: false });
    await StatusBar.setBackgroundColor({ color: '#2D1B69' });
    await StatusBar.setStyle({ style: isDark ? Style.Dark : Style.Dark });
  } catch {
    // Ignore on unsupported webviews
  }
}

export function registerAndroidHardwareBackButton(onBackPress: () => boolean): () => void {
  let listenerHandle: { remove: () => Promise<void> } | null = null;

  if (Capacitor.isNativePlatform()) {
    CapApp.addListener('backButton', ({ canGoBack }) => {
      const handledByScreen = onBackPress();
      if (!handledByScreen && !canGoBack) {
        CapApp.minimizeApp();
      }
    }).then((h) => {
      listenerHandle = h;
    });
  }

  return () => {
    if (listenerHandle) {
      listenerHandle.remove();
    }
  };
}

export async function triggerLightHaptic(): Promise<void> {
  if (!Capacitor.isNativePlatform()) return;
  try {
    await Haptics.impact({ style: ImpactStyle.Light });
  } catch {
    // Ignore if device lacks vibrator
  }
}

export async function nativeCopyText(value: string): Promise<boolean> {
  try {
    if (Capacitor.isNativePlatform()) {
      await Clipboard.write({ string: value });
      await triggerLightHaptic();
      return true;
    }
    await navigator.clipboard.writeText(value);
    return true;
  } catch {
    return false;
  }
}

export async function nativeShareUrl(params: {
  title: string;
  text: string;
  url: string;
}): Promise<boolean> {
  try {
    if (Capacitor.isNativePlatform()) {
      await Share.share({
        title: params.title,
        text: params.text,
        url: params.url,
        dialogTitle: params.title,
      });
      return true;
    }
    if (navigator.share) {
      await navigator.share(params);
      return true;
    }
    return false;
  } catch {
    return false;
  }
}

export async function openExternalUrl(url: string): Promise<void> {
  const parsedUrl = new URL(url);
  if (parsedUrl.protocol !== 'https:') {
    throw new Error('Only HTTPS external links are allowed.');
  }
  const { Browser } = await import('@capacitor/browser');
  await Browser.open({ url: parsedUrl.toString() });
}
