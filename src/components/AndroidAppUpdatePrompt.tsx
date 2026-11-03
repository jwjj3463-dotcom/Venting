import React, { useEffect, useState } from 'react';
import { App } from '@capacitor/app';
import { Capacitor } from '@capacitor/core';
import { Sparkles } from 'lucide-react';
import {
  androidApkUpdaterEvents,
  AndroidAppUpdate,
  canInstallAndroidPackages,
  checkForAndroidAppUpdate,
  dismissAndroidAppUpdate,
  downloadAndInstallAndroidUpdate,
  installDownloadedAndroidUpdate,
  openAndroidInstallPermissionSettings,
} from '../services/androidAppUpdater';

function formatUpdateSize(bytes: number): string {
  const megabytes = bytes / 1_000_000;
  return `${megabytes.toLocaleString('ar-EG', { maximumFractionDigits: 1 })} ميجابايت`;
}

function getUpdateErrorMessage(error: unknown): string {
  const details = error instanceof Error ? error.message : '';
  if (/INSTALL_PERMISSION_REQUIRED|السماح لفضفضة بتثبيت|السماح بتثبيت/i.test(details)) {
    return 'لإكمال التحديث، فعّل السماح بتثبيت التطبيقات من هذا المصدر في إعدادات أندرويد، ثم ارجع واضغط «تنزيل التحديث».';
  }
  if (/ملف التحديث لا يخص|ليس أحدث من الإصدار|التحقق من النسخة|رابط APK غير موثوق/i.test(details)) {
    return 'تعذّر التحقق من ملف التحديث. أعد المحاولة لاحقًا، وإذا استمرت المشكلة فتواصل مع الدعم.';
  }
  if (/فتح نافذة تثبيت|فتح مُثبّت/i.test(details)) {
    return 'تعذّر فتح نافذة التثبيت. لم يُحذف الملف؛ اضغط «متابعة التثبيت» للمحاولة مجددًا.';
  }
  return 'تعذّر تنزيل التحديث. تحقّق من اتصال الإنترنت، ثم اضغط «تنزيل التحديث» للمحاولة مجددًا.';
}

export const AndroidAppUpdatePrompt: React.FC = () => {
  const [update, setUpdate] = useState<AndroidAppUpdate | null>(null);
  const [checking, setChecking] = useState(true);
  const [downloading, setDownloading] = useState(false);
  const [openingInstaller, setOpeningInstaller] = useState(false);
  const [progress, setProgress] = useState<number | null>(null);
  const [message, setMessage] = useState('');

  useEffect(() => {
    if (!Capacitor.isNativePlatform() || Capacitor.getPlatform() !== 'android') {
      setChecking(false);
      return;
    }

    let active = true;
    let updateCheckInProgress = false;
    let removeProgress: (() => Promise<void>) | undefined;
    let removeFailure: (() => Promise<void>) | undefined;
    let removeAppState: (() => Promise<void>) | undefined;
    let refreshTimeout: number | undefined;

    const refreshUpdate = async (initialCheck = false, preserveMessage = false) => {
      if (updateCheckInProgress) return;
      updateCheckInProgress = true;
      try {
        const availableUpdate = await checkForAndroidAppUpdate();
        if (!active) return;
        setUpdate(availableUpdate);
        if (!preserveMessage) setMessage('');
        setOpeningInstaller(false);
        setDownloading(availableUpdate?.downloadInProgress ?? false);
        setProgress((current) => (availableUpdate?.downloadInProgress ? current : null));
      } catch (error) {
        console.warn('Android update check failed:', error);
      } finally {
        updateCheckInProgress = false;
        if (initialCheck && active) setChecking(false);
      }
    };

    void androidApkUpdaterEvents
      .addListener('downloadProgress', ({ bytesDownloaded, totalBytes }) => {
        if (!active) return;
        setDownloading(true);
        setProgress(totalBytes > 0 ? Math.min(100, Math.floor((bytesDownloaded / totalBytes) * 100)) : null);
      })
      .then((listener) => {
        if (active) removeProgress = listener.remove;
        else void listener.remove();
      })
      .catch((error: unknown) => console.error('Android update progress listener failed:', error));

    void androidApkUpdaterEvents
      .addListener('downloadFailed', ({ message: errorMessage }) => {
        if (!active) return;
        setDownloading(false);
        setMessage(getUpdateErrorMessage(new Error(errorMessage)));
        refreshTimeout = window.setTimeout(() => {
          if (active) void refreshUpdate(false, true);
        }, 500);
      })
      .then((listener) => {
        if (active) removeFailure = listener.remove;
        else void listener.remove();
      })
      .catch((error: unknown) => console.error('Android update failure listener failed:', error));

    void App.addListener('appStateChange', ({ isActive }) => {
      if (active && isActive) void refreshUpdate();
    })
      .then((listener) => {
        if (active) removeAppState = listener.remove;
        else void listener.remove();
      })
      .catch((error: unknown) => console.error('Android update resume listener failed:', error));

    void refreshUpdate(true);

    return () => {
      active = false;
      void removeProgress?.();
      void removeFailure?.();
      void removeAppState?.();
      if (refreshTimeout !== undefined) window.clearTimeout(refreshTimeout);
    };
  }, []);

  if (checking || !update) return null;

  const startUpdate = async () => {
    setMessage('');
    try {
      if (!(await canInstallAndroidPackages())) {
        await openAndroidInstallPermissionSettings();
        setMessage('لإكمال التحديث، فعّل السماح بتثبيت التطبيقات من هذا المصدر في إعدادات أندرويد، ثم ارجع واضغط «تنزيل التحديث».');
        return;
      }
      if (update.downloaded) {
        setOpeningInstaller(true);
        await installDownloadedAndroidUpdate(update);
        return;
      }
      setDownloading(true);
      setProgress(0);
      await downloadAndInstallAndroidUpdate(update);
    } catch (error) {
      console.error('Could not start Android app update:', error);
      setDownloading(false);
      setOpeningInstaller(false);
      setMessage(getUpdateErrorMessage(error));
      if (update.downloaded) {
        void checkForAndroidAppUpdate()
          .then((availableUpdate) => setUpdate(availableUpdate))
          .catch((refreshError: unknown) =>
            console.warn('Could not refresh cached Android update status:', refreshError)
          );
      }
    }
  };

  const busy = downloading || openingInstaller;

  const dismiss = () => {
    dismissAndroidAppUpdate(update.tag);
    setUpdate(null);
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-[#080613]/75 p-5 backdrop-blur-sm">
      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby="android-update-title"
        className="border-beam relative w-full max-w-md space-y-5 rounded-3xl border border-white/10 bg-gradient-to-br from-[#292044] via-[#1E1B2E] to-[#171326] p-6 text-white shadow-2xl shadow-purple-950/50"
      >
        <div className="space-y-3 text-center">
          <div className="mx-auto flex w-fit items-center gap-2 rounded-full border border-purple-200/20 bg-purple-300/10 px-3 py-1.5">
            <Sparkles className="h-4 w-4 text-amber-300" aria-hidden="true" />
            <p className="text-xs font-semibold text-purple-100">فضفضة · الإصدار الجديد {update.version}</p>
          </div>
          <h2 id="android-update-title" className="text-2xl font-bold tracking-tight">
            تحديث جديد لتجربة أفضل
          </h2>
          <p className="text-sm leading-relaxed text-purple-100/85">
            الإصدار الحالي: {update.currentVersion} · الإصدار الجديد: {update.version} · حجم ملف التحديث: {formatUpdateSize(update.apkSizeBytes)}.
            {' '}{update.downloaded
              ? 'تم تنزيل التحديث مسبقًا. اضغط «متابعة التثبيت» لفتح نافذة التثبيت الرسمية في نظام أندرويد.'
              : 'عند اختيار «تنزيل التحديث»، سيبدأ تنزيل الملف، ثم ستظهر نافذة التثبيت الرسمية في نظام أندرويد لإكمال التثبيت.'}
          </p>
        </div>

        {update.notes && (
          <div className="max-h-44 overflow-y-auto rounded-2xl border border-white/10 bg-black/20 p-4">
            <h3 className="mb-2 text-sm font-bold text-amber-200">ما الجديد؟</h3>
            <p className="whitespace-pre-wrap text-xs leading-relaxed text-purple-100/90">
              {update.notes}
            </p>
          </div>
        )}

        {downloading && (
          <div className="space-y-2" role="status" aria-live="polite">
            <div className="h-2 overflow-hidden rounded-full bg-white/10">
              <div
                className="h-full rounded-full bg-gradient-to-r from-[#8B5CF6] to-amber-300 transition-[width]"
                style={{ width: `${progress ?? 35}%` }}
              />
            </div>
            <p className="text-center text-xs text-purple-200">
              {progress === null ? 'جارٍ تنزيل ملف التحديث...' : `نسبة اكتمال التنزيل: ${progress}٪`}
            </p>
          </div>
        )}

        {message && <p role="alert" className="text-center text-xs text-amber-200">{message}</p>}

        <div className="grid grid-cols-2 gap-3">
          <button
            type="button"
            disabled={busy}
            onClick={dismiss}
            className="min-h-12 rounded-xl border border-white/10 bg-white/5 text-sm font-semibold transition-colors hover:bg-white/10 disabled:opacity-50"
          >
            لاحقًا
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={() => void startUpdate()}
            className="min-h-12 rounded-xl bg-gradient-to-r from-[#8B5CF6] to-[#6D4BE8] text-sm font-bold shadow-lg shadow-purple-950/30 transition-transform active:scale-[0.98] disabled:opacity-50"
          >
            {downloading
              ? 'جارٍ تنزيل التحديث...'
              : openingInstaller
                ? 'جارٍ فتح مُثبّت أندرويد...'
                : update.downloaded
                  ? 'متابعة التثبيت'
                  : 'تنزيل التحديث'}
          </button>
        </div>
      </section>
    </div>
  );
};
