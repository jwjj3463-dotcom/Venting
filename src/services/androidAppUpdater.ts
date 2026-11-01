import { App } from '@capacitor/app';
import { Capacitor, registerPlugin } from '@capacitor/core';

interface AndroidApkUpdaterPlugin {
  canInstallPackages(): Promise<{ canInstall: boolean }>;
  openInstallPermissionSettings(): Promise<void>;
  downloadAndInstall(options: { url: string }): Promise<void>;
  addListener(
    eventName: 'downloadProgress',
    listener: (event: { bytesDownloaded: number; totalBytes: number }) => void
  ): Promise<{ remove: () => Promise<void> }>;
  addListener(
    eventName: 'downloadFailed',
    listener: (event: { message: string }) => void
  ): Promise<{ remove: () => Promise<void> }>;
}

export interface AndroidAppUpdate {
  tag: string;
  version: string;
  notes: string;
  apkUrl: string;
}

const ANDROID_APK_UPDATER = registerPlugin<AndroidApkUpdaterPlugin>('AndroidApkUpdater');
const LATEST_RELEASE_URL = 'https://api.github.com/repos/jwjj3463-dotcom/Venting/releases/latest';
const DISMISSED_RELEASE_KEY = 'fadfada.dismissed-app-update';

function compareVersions(left: string, right: string): number {
  const leftParts = left.split('.').map(Number);
  const rightParts = right.split('.').map(Number);
  for (let index = 0; index < Math.max(leftParts.length, rightParts.length); index += 1) {
    const difference = (leftParts[index] || 0) - (rightParts[index] || 0);
    if (difference !== 0) return Math.sign(difference);
  }
  return 0;
}

export async function checkForAndroidAppUpdate(): Promise<AndroidAppUpdate | null> {
  if (!Capacitor.isNativePlatform() || Capacitor.getPlatform() !== 'android') return null;

  const [installed, response] = await Promise.all([
    App.getInfo(),
    fetch(LATEST_RELEASE_URL, {
      headers: { Accept: 'application/vnd.github+json' },
      cache: 'no-store',
    }),
  ]);
  if (!response.ok) {
    throw new Error(`تعذر التحقق من التحديثات (HTTP ${response.status}).`);
  }

  const release: unknown = await response.json();
  if (
    typeof release !== 'object' ||
    release === null ||
    !('tag_name' in release) ||
    typeof release.tag_name !== 'string' ||
    !/^v\d+\.\d+\.\d+$/.test(release.tag_name) ||
    !('draft' in release) ||
    release.draft !== false ||
    !('prerelease' in release) ||
    release.prerelease !== false ||
    !('assets' in release) ||
    !Array.isArray(release.assets)
  ) {
    throw new Error('بيانات إصدار التحديث من GitHub غير مكتملة.');
  }

  const version = release.tag_name.slice(1);
  if (compareVersions(version, installed.version) <= 0) return null;

  const apk = release.assets.find(
    (asset: unknown) =>
      typeof asset === 'object' &&
      asset !== null &&
      'name' in asset &&
      asset.name === 'app-release.apk' &&
      'browser_download_url' in asset &&
      typeof asset.browser_download_url === 'string'
  ) as { browser_download_url: string } | undefined;
  if (!apk || !apk.browser_download_url.startsWith('https://github.com/')) {
    throw new Error('ملف APK الموقّع غير متوفر في إصدار GitHub.');
  }

  const dismissedTag = window.localStorage.getItem(DISMISSED_RELEASE_KEY);
  if (dismissedTag === release.tag_name) return null;

  return {
    tag: release.tag_name,
    version,
    notes: 'body' in release && typeof release.body === 'string' ? release.body : '',
    apkUrl: apk.browser_download_url,
  };
}

export function dismissAndroidAppUpdate(tag: string): void {
  window.localStorage.setItem(DISMISSED_RELEASE_KEY, tag);
}

export async function canInstallAndroidPackages(): Promise<boolean> {
  const result = await ANDROID_APK_UPDATER.canInstallPackages();
  return result.canInstall;
}

export async function openAndroidInstallPermissionSettings(): Promise<void> {
  await ANDROID_APK_UPDATER.openInstallPermissionSettings();
}

export async function downloadAndInstallAndroidUpdate(url: string): Promise<void> {
  await ANDROID_APK_UPDATER.downloadAndInstall({ url });
}

export const androidApkUpdaterEvents = ANDROID_APK_UPDATER;
