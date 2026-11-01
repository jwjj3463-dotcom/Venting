import React, { useEffect, useState } from 'react';
import { Capacitor } from '@capacitor/core';
import {
  androidApkUpdaterEvents,
  AndroidAppUpdate,
  canInstallAndroidPackages,
  checkForAndroidAppUpdate,
  dismissAndroidAppUpdate,
  downloadAndInstallAndroidUpdate,
  openAndroidInstallPermissionSettings,
} from '../services/androidAppUpdater';

export const AndroidAppUpdatePrompt: React.FC = () => {
  const [update, setUpdate] = useState<AndroidAppUpdate | null>(null);
  const [checking, setChecking] = useState(true);
  const [downloading, setDownloading] = useState(false);
  const [progress, setProgress] = useState<number | null>(null);
  const [message, setMessage] = useState('');

  useEffect(() => {
    if (!Capacitor.isNativePlatform() || Capacitor.getPlatform() !== 'android') {
      setChecking(false);
      return;
    }

    let active = true;
    let removeProgress: (() => Promise<void>) | undefined;
    let removeFailure: (() => Promise<void>) | undefined;

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
        setMessage(errorMessage || 'تعذر تنزيل التحديث. حاول مرة أخرى.');
      })
      .then((listener) => {
        if (active) removeFailure = listener.remove;
        else void listener.remove();
      })
      .catch((error: unknown) => console.error('Android update failure listener failed:', error));

    void checkForAndroidAppUpdate()
      .then((availableUpdate) => {
        if (active) setUpdate(availableUpdate);
      })
      .catch((error: unknown) => {
        console.warn('Android update check failed:', error);
      })
      .finally(() => {
        if (active) setChecking(false);
      });

    return () => {
      active = false;
      void removeProgress?.();
      void removeFailure?.();
    };
  }, []);

  if (checking || !update) return null;

  const startUpdate = async () => {
    setMessage('');
    try {
      if (!(await canInstallAndroidPackages())) {
        await openAndroidInstallPermissionSettings();
        setMessage('اسمح لفضفضة بتثبيت التطبيقات من هذا المصدر، ثم ارجع واضغط تحديث الآن.');
        return;
      }
      setDownloading(true);
      setProgress(0);
      await downloadAndInstallAndroidUpdate(update.apkUrl);
    } catch (error) {
      setDownloading(false);
      setMessage(error instanceof Error ? error.message : 'تعذر بدء تنزيل التحديث.');
    }
  };

  const dismiss = () => {
    dismissAndroidAppUpdate(update.tag);
    setUpdate(null);
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/70 p-5">
      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby="android-update-title"
        className="w-full max-w-md space-y-4 rounded-3xl border border-white/10 bg-[#1E1B2E] p-6 text-white shadow-2xl"
      >
        <div className="space-y-1 text-center">
          <p className="text-xs font-semibold text-purple-200">فضفضة · إصدار {update.version}</p>
          <h2 id="android-update-title" className="text-xl font-bold">
            يتوفر تحديث جديد
          </h2>
          <p className="text-sm leading-relaxed text-purple-100">
            يحتوي هذا الإصدار على تحسينات وميزات جديدة. سيتم تنزيله ثم فتح نافذة Android الرسمية لتأكيد التثبيت.
          </p>
        </div>

        {update.notes && (
          <div className="max-h-44 overflow-y-auto rounded-2xl bg-black/25 p-4">
            <h3 className="mb-2 text-sm font-bold">ما الجديد؟</h3>
            <p className="whitespace-pre-wrap text-xs leading-relaxed text-purple-100">
              {update.notes}
            </p>
          </div>
        )}

        {downloading && (
          <div className="space-y-2" role="status" aria-live="polite">
            <div className="h-2 overflow-hidden rounded-full bg-white/10">
              <div
                className="h-full rounded-full bg-[#8B5CF6] transition-[width]"
                style={{ width: `${progress ?? 35}%` }}
              />
            </div>
            <p className="text-center text-xs text-purple-200">
              {progress === null ? 'جارٍ تنزيل التحديث...' : `جارٍ التنزيل: ${progress}%`}
            </p>
          </div>
        )}

        {message && <p role="alert" className="text-center text-xs text-amber-200">{message}</p>}

        <div className="grid grid-cols-2 gap-3">
          <button
            type="button"
            disabled={downloading}
            onClick={dismiss}
            className="min-h-12 rounded-xl bg-white/10 text-sm font-semibold disabled:opacity-50"
          >
            لاحقًا
          </button>
          <button
            type="button"
            disabled={downloading}
            onClick={() => void startUpdate()}
            className="min-h-12 rounded-xl bg-[#8B5CF6] text-sm font-bold disabled:opacity-50"
          >
            {downloading ? 'جارٍ التنزيل...' : 'تحديث الآن'}
          </button>
        </div>
      </section>
    </div>
  );
};
