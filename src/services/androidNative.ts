import { Capacitor, registerPlugin } from '@capacitor/core';
import { FirebaseMessaging } from '@capacitor-firebase/messaging';
import { App as CapApp } from '@capacitor/app';
import { StatusBar, Style } from '@capacitor/status-bar';
import { Haptics, ImpactStyle } from '@capacitor/haptics';
import { Share } from '@capacitor/share';
import { Clipboard } from '@capacitor/clipboard';
import { LocalNotifications } from '@capacitor/local-notifications';

interface SafeChatCapturePlugin {
  enable(): Promise<{ supported: boolean }>;
  disable(): Promise<void>;
  addListener(eventName: 'screenshotDetected', listener: () => void): Promise<{ remove: () => Promise<void> }>;
}

const SafeChatCapture = registerPlugin<SafeChatCapturePlugin>('SafeChatCapture');

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

export async function showLocalNotification(
  title: string,
  body: string,
  extra: Record<string, string>
): Promise<void> {
  if (!Capacitor.isNativePlatform()) {
    if (!('Notification' in window)) return;
    const permission =
      Notification.permission === 'default'
        ? await Notification.requestPermission()
        : Notification.permission;
    if (permission === 'granted') new Notification(title, { body });
    return;
  }

  let permission = await LocalNotifications.checkPermissions();
  if (permission.display !== 'granted') {
    permission = await LocalNotifications.requestPermissions();
  }
  if (permission.display !== 'granted') return;

  await LocalNotifications.schedule({
    notifications: [
      {
        id: Math.floor(Date.now() % 2_000_000_000),
        title,
        body,
        extra,
        schedule: { at: new Date(Date.now() + 500) },
      },
    ],
  });
}

export function subscribeToLocalNotificationActions(
  onAction: (extra: Record<string, unknown> | undefined) => void
): () => void {
  if (!Capacitor.isNativePlatform()) return () => {};
  let handle: { remove: () => Promise<void> } | undefined;
  void LocalNotifications.addListener('localNotificationActionPerformed', ({ notification }) => {
    onAction(notification.extra as Record<string, unknown> | undefined);
  }).then((listener) => {
    handle = listener;
  });
  return () => {
    if (handle) void handle.remove();
  };
}

export function watchAndroidSafeChatScreenshots(
  onScreenshot: () => void,
  onSupport: (supported: boolean) => void
): () => void {
  if (!Capacitor.isNativePlatform()) {
    onSupport(false);
    return () => {};
  }

  let disposed = false;
  let removeListener: (() => Promise<void>) | undefined;
  void SafeChatCapture.addListener('screenshotDetected', onScreenshot)
    .then(async (listener) => {
      if (disposed) {
        await listener.remove();
        return;
      }
      removeListener = listener.remove;
      const { supported } = await SafeChatCapture.enable();
      if (!disposed) onSupport(supported);
    })
    .catch((error: unknown) => {
      if (!disposed) onSupport(false);
      console.error('Could not enable Android screenshot detection:', error);
    });

  return () => {
    disposed = true;
    if (removeListener) void removeListener();
    void SafeChatCapture.disable().catch((error: unknown) => {
      console.error('Could not disable Android screenshot detection:', error);
    });
  };
}

export async function initializeFirebasePushNotifications(
  onToken: (token: string) => Promise<void>,
  onNotificationAction: () => void
): Promise<() => void> {
  if (!Capacitor.isNativePlatform()) return () => {};

  const listeners: Array<{ remove: () => Promise<void> }> = [];
  try {
    listeners.push(
      await FirebaseMessaging.addListener('tokenReceived', ({ token }) => {
        void onToken(token).catch((error: unknown) => {
          console.error('Could not register the refreshed FCM token:', error);
        });
      })
    );
    listeners.push(
      await FirebaseMessaging.addListener('notificationActionPerformed', onNotificationAction)
    );

    let permission = await FirebaseMessaging.checkPermissions();
    if (permission.receive !== 'granted') {
      permission = await FirebaseMessaging.requestPermissions();
    }
    if (permission.receive !== 'granted') {
      return () => {
        for (const listener of listeners) void listener.remove();
      };
    }

    const { token } = await FirebaseMessaging.getToken();
    if (token) await onToken(token);
  } catch (error) {
    for (const listener of listeners) void listener.remove();
    throw error;
  }

  return () => {
    for (const listener of listeners) void listener.remove();
  };
}
