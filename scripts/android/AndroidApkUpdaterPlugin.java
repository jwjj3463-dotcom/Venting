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
    public synchronized void downloadAndInstall(PluginCall call) {
        String rawUrl = call.getString("url");
        if (rawUrl == null || !isAllowedReleaseUrl(rawUrl)) {
            call.reject("رابط APK غير موثوق.");
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
        executor.execute(() -> downloadAndOpenInstaller(rawUrl));
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

    private void downloadAndOpenInstaller(String rawUrl) {
        HttpURLConnection connection = null;
        File updateDirectory = new File(getContext().getCacheDir(), "fadfada-updates");
        File apkFile = new File(updateDirectory, "fadfada-update.apk");
        try {
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

            verifyPackage(apkFile);
            Uri apkUri = FileProvider.getUriForFile(
                getContext(),
                getContext().getPackageName() + ".fileprovider",
                apkFile
            );
            Intent installIntent = new Intent(Intent.ACTION_VIEW);
            installIntent.setDataAndType(apkUri, "application/vnd.android.package-archive");
            installIntent.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION | Intent.FLAG_ACTIVITY_NEW_TASK);
            getActivity().runOnUiThread(() -> getContext().startActivity(installIntent));
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

    private void verifyPackage(File apkFile) {
        PackageManager packageManager = getContext().getPackageManager();
        PackageInfo archive = packageManager.getPackageArchiveInfo(apkFile.getAbsolutePath(), 0);
        if (archive == null || !getContext().getPackageName().equals(archive.packageName)) {
            throw new IllegalStateException("ملف التحديث لا يخص تطبيق فضفضة.");
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
