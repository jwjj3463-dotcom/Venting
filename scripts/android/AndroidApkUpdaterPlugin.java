package __PACKAGE__;

import android.content.Intent;
import android.content.pm.PackageInfo;
import android.content.pm.PackageManager;
import android.net.Uri;
import android.os.Build;
import android.provider.Settings;
import androidx.core.content.FileProvider;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import java.io.File;
import java.io.FileOutputStream;
import java.io.InputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;

@CapacitorPlugin(name = "AndroidApkUpdater")
public class AndroidApkUpdaterPlugin extends Plugin {
    private final ExecutorService executor = Executors.newSingleThreadExecutor();
    private volatile boolean downloadActive = false;

    @PluginMethod
    public void canInstallPackages(PluginCall call) {
        boolean canInstall = Build.VERSION.SDK_INT < Build.VERSION_CODES.O
            || getContext().getPackageManager().canRequestPackageInstalls();
        JSObject result = new JSObject();
        result.put("canInstall", canInstall);
        call.resolve(result);
    }

    @PluginMethod
    public void openInstallPermissionSettings(PluginCall call) {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) {
            call.resolve();
            return;
        }
        Intent intent = new Intent(
            Settings.ACTION_MANAGE_UNKNOWN_APP_SOURCES,
            Uri.parse("package:" + getContext().getPackageName())
        );
        getActivity().startActivity(intent);
        call.resolve();
    }

    @PluginMethod
    public void isDownloadedUpdateReady(PluginCall call) {
        String version = call.getString("version");
        long expectedSizeBytes = call.getInt("size", 0);
        File apkFile = getUpdateFile();
        JSObject result = new JSObject();
        if (downloadActive) {
            result.put("ready", false);
            result.put("downloading", true);
            call.resolve(result);
            return;
        }
        if (version == null || expectedSizeBytes <= 0
            || expectedSizeBytes > 100L * 1024L * 1024L || !apkFile.isFile()) {
            result.put("ready", false);
            result.put("downloading", false);
            call.resolve(result);
            return;
        }
        try {
            verifyPackage(apkFile, version, expectedSizeBytes);
            result.put("ready", true);
        } catch (IllegalStateException exception) {
            apkFile.delete();
            result.put("ready", false);
        }
        result.put("downloading", false);
        call.resolve(result);
    }

    @PluginMethod
    public synchronized void installDownloadedUpdate(PluginCall call) {
        String version = call.getString("version");
        long expectedSizeBytes = call.getInt("size", 0);
        if (downloadActive) {
            call.reject("جارٍ تنزيل التحديث بالفعل.", "DOWNLOAD_IN_PROGRESS");
            return;
        }
        if (version == null || expectedSizeBytes <= 0
            || expectedSizeBytes > 100L * 1024L * 1024L) {
            call.reject("تعذّر التحقق من معلومات ملف التحديث.");
            return;
        }
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O
            && !getContext().getPackageManager().canRequestPackageInstalls()) {
            call.reject("يجب السماح لفضفضة بتثبيت التطبيقات أولًا.", "INSTALL_PERMISSION_REQUIRED");
            return;
        }

        File apkFile = getUpdateFile();
        try {
            verifyPackage(apkFile, version, expectedSizeBytes);
            getActivity().runOnUiThread(() -> {
                try {
                    openInstaller(apkFile);
                    call.resolve();
                } catch (Exception exception) {
                    call.reject(
                        exception.getMessage() == null ? "تعذّر فتح نافذة تثبيت التحديث." : exception.getMessage(),
                        exception
                    );
                }
            });
        } catch (IllegalStateException exception) {
            apkFile.delete();
            call.reject(exception.getMessage(), exception);
        }
    }

    @PluginMethod
    public synchronized void downloadAndInstall(PluginCall call) {
        String rawUrl = call.getString("url");
        String version = call.getString("version");
        long expectedSizeBytes = call.getInt("size", 0);
        if (rawUrl == null || !isAllowedReleaseUrl(rawUrl)) {
            call.reject("رابط APK غير موثوق.");
            return;
        }
        if (version == null || expectedSizeBytes <= 0
            || expectedSizeBytes > 100L * 1024L * 1024L) {
            call.reject("تعذّر التحقق من معلومات ملف التحديث.");
            return;
        }
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O
            && !getContext().getPackageManager().canRequestPackageInstalls()) {
            call.reject("يجب السماح لفضفضة بتثبيت التطبيقات أولًا.", "INSTALL_PERMISSION_REQUIRED");
            return;
        }
        if (downloadActive) {
            call.reject("يوجد تنزيل تحديث جارٍ بالفعل.", "DOWNLOAD_IN_PROGRESS");
            return;
        }

        downloadActive = true;
        call.resolve();
        executor.execute(() -> downloadAndOpenInstaller(rawUrl, version, expectedSizeBytes));
    }

    private boolean isAllowedReleaseUrl(String rawUrl) {
        try {
            URL url = new URL(rawUrl);
            return "https".equals(url.getProtocol())
                && "github.com".equalsIgnoreCase(url.getHost())
                && url.getPath().startsWith("/jwjj3463-dotcom/Venting/releases/download/");
        } catch (Exception exception) {
            return false;
        }
    }

    private File getUpdateFile() {
        return new File(
            new File(getContext().getCacheDir(), "fadfada-updates"),
            "fadfada-update.apk"
        );
    }

    private void downloadAndOpenInstaller(String rawUrl, String version, long expectedSizeBytes) {
        HttpURLConnection connection = null;
        File apkFile = getUpdateFile();
        try {
            File updateDirectory = apkFile.getParentFile();
            if (updateDirectory == null) {
                throw new IllegalStateException("تعذّر تجهيز مجلد تحديث التطبيق.");
            }
            if (!updateDirectory.isDirectory() && !updateDirectory.mkdirs()) {
                throw new IllegalStateException("تعذر تجهيز مجلد تحديث التطبيق.");
            }

            connection = (HttpURLConnection) new URL(rawUrl).openConnection();
            connection.setConnectTimeout(20000);
            connection.setReadTimeout(30000);
            connection.setInstanceFollowRedirects(true);
            int status = connection.getResponseCode();
            if (status < 200 || status >= 300) {
                throw new IllegalStateException("تعذر تنزيل ملف التحديث (HTTP " + status + ").");
            }

            long totalBytes = connection.getContentLengthLong();
            if (totalBytes > 100L * 1024L * 1024L) {
                throw new IllegalStateException("حجم ملف التحديث أكبر من الحد المسموح.");
            }
            if (totalBytes > 0 && totalBytes != expectedSizeBytes) {
                throw new IllegalStateException("حجم ملف التحديث لا يطابق الإصدار المنشور.");
            }
            long bytesDownloaded = 0;
            byte[] buffer = new byte[64 * 1024];
            try (InputStream input = connection.getInputStream();
                 FileOutputStream output = new FileOutputStream(apkFile, false)) {
                int count;
                while ((count = input.read(buffer)) != -1) {
                    bytesDownloaded += count;
                    if (bytesDownloaded > 100L * 1024L * 1024L) {
                        throw new IllegalStateException("حجم ملف التحديث أكبر من الحد المسموح.");
                    }
                    output.write(buffer, 0, count);
                    JSObject progress = new JSObject();
                    progress.put("bytesDownloaded", bytesDownloaded);
                    progress.put("totalBytes", totalBytes);
                    notifyListeners("downloadProgress", progress);
                }
            }

            verifyPackage(apkFile, version, expectedSizeBytes);
            getActivity().runOnUiThread(() -> {
                try {
                    openInstaller(apkFile);
                } catch (Exception exception) {
                    JSObject failure = new JSObject();
                    failure.put(
                        "message",
                        exception.getMessage() == null
                            ? "تعذّر فتح نافذة تثبيت التحديث."
                            : exception.getMessage()
                    );
                    notifyListeners("downloadFailed", failure);
                }
            });
        } catch (Exception exception) {
            apkFile.delete();
            JSObject failure = new JSObject();
            failure.put("message", exception.getMessage() == null ? "تعذر تنزيل التحديث." : exception.getMessage());
            notifyListeners("downloadFailed", failure);
        } finally {
            if (connection != null) connection.disconnect();
            downloadActive = false;
        }
    }

    private void openInstaller(File apkFile) {
        Uri apkUri = FileProvider.getUriForFile(
            getContext(),
            getContext().getPackageName() + ".fileprovider",
            apkFile
        );
        Intent installIntent = new Intent(Intent.ACTION_VIEW);
        installIntent.setDataAndType(apkUri, "application/vnd.android.package-archive");
        installIntent.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION | Intent.FLAG_ACTIVITY_NEW_TASK);
        getContext().startActivity(installIntent);
    }

    private void verifyPackage(File apkFile, String expectedVersion, long expectedSizeBytes) {
        if (!apkFile.isFile() || apkFile.length() != expectedSizeBytes) {
            throw new IllegalStateException("ملف التحديث غير مكتمل أو لا يطابق الإصدار المنشور.");
        }
        PackageManager packageManager = getContext().getPackageManager();
        PackageInfo archive = packageManager.getPackageArchiveInfo(apkFile.getAbsolutePath(), 0);
        if (archive == null || !getContext().getPackageName().equals(archive.packageName)) {
            throw new IllegalStateException("ملف التحديث لا يخص تطبيق فضفضة.");
        }
        if (!expectedVersion.equals(archive.versionName)) {
            throw new IllegalStateException("ملف التحديث لا يطابق رقم الإصدار المطلوب.");
        }
        PackageInfo installed;
        try {
            installed = packageManager.getPackageInfo(getContext().getPackageName(), 0);
        } catch (PackageManager.NameNotFoundException exception) {
            throw new IllegalStateException("تعذر التحقق من النسخة المثبتة.", exception);
        }
        long newVersion = Build.VERSION.SDK_INT >= Build.VERSION_CODES.P
            ? archive.getLongVersionCode()
            : archive.versionCode;
        long installedVersion = Build.VERSION.SDK_INT >= Build.VERSION_CODES.P
            ? installed.getLongVersionCode()
            : installed.versionCode;
        if (newVersion <= installedVersion) {
            throw new IllegalStateException("الإصدار الذي تم تنزيله ليس أحدث من الإصدار المثبت.");
        }
    }

    @Override
    protected void handleOnDestroy() {
        executor.shutdownNow();
        super.handleOnDestroy();
    }
}
