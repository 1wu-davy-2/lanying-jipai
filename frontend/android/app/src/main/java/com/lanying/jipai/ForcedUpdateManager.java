package com.lanying.jipai;

import android.app.Activity;
import android.app.AlertDialog;
import android.app.DownloadManager;
import android.content.ActivityNotFoundException;
import android.content.Context;
import android.content.Intent;
import android.content.pm.PackageInfo;
import android.net.Uri;
import android.os.Build;
import android.os.Environment;
import android.os.Handler;
import android.os.Looper;
import android.provider.Settings;
import android.database.Cursor;

import java.io.BufferedInputStream;
import java.io.IOException;
import java.io.InputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.regex.Pattern;

import org.json.JSONException;
import org.json.JSONObject;

final class ForcedUpdateManager {
    private static final String APK_MIME_TYPE = "application/vnd.android.package-archive";
    private static final Pattern SHA256_PATTERN = Pattern.compile("^[0-9a-f]{64}$");
    private static final long DOWNLOAD_POLL_INTERVAL_MS = 500L;

    private final Activity activity;
    private final DownloadManager downloadManager;
    private final Handler mainHandler = new Handler(Looper.getMainLooper());
    private final ExecutorService executor = Executors.newSingleThreadExecutor();

    private AlertDialog updateDialog;
    private long downloadId = -1L;
    private UpdateRelease pendingRelease;
    private Uri pendingInstallUri;
    private boolean destroyed;

    ForcedUpdateManager(Activity activity) {
        this.activity = activity;
        this.downloadManager = (DownloadManager) activity.getSystemService(Context.DOWNLOAD_SERVICE);
    }

    void checkForUpdate() {
        String manifestUrl = BuildConfig.ANDROID_UPDATE_MANIFEST_URL.trim();
        if (manifestUrl.isEmpty()) {
            return;
        }

        showCheckingDialog();
        executor.execute(() -> {
            try {
                UpdateRelease release = fetchRelease(manifestUrl);
                if (release == null || !isNewerVersion(release.versionCode, localVersionCode())) {
                    dismissUpdateDialog();
                    return;
                }
                mainHandler.post(() -> showRequiredUpdateDialog(release));
            } catch (IOException | JSONException | SecurityException ignored) {
                dismissUpdateDialog();
            }
        });
    }

    void onResume() {
        if (pendingInstallUri != null && canRequestPackageInstalls()) {
            Uri installUri = pendingInstallUri;
            pendingInstallUri = null;
            launchPackageInstaller(installUri);
        }
        if (downloadId != -1L && pendingRelease != null) {
            pollDownload();
        }
    }

    void onDestroy() {
        destroyed = true;
        executor.shutdownNow();
        mainHandler.removeCallbacksAndMessages(null);
    }

    static boolean isNewerVersion(long remoteVersionCode, long localVersionCode) {
        return remoteVersionCode > localVersionCode;
    }

    static boolean isValidSha256(String value) {
        return value != null && SHA256_PATTERN.matcher(value).matches();
    }

    private void showCheckingDialog() {
        if (destroyed || activity.isFinishing()) {
            return;
        }
        updateDialog = new AlertDialog.Builder(activity)
                .setTitle(R.string.update_checking_title)
                .setMessage(R.string.update_checking_message)
                .setCancelable(false)
                .create();
        updateDialog.setCanceledOnTouchOutside(false);
        updateDialog.show();
    }

    private void showRequiredUpdateDialog(UpdateRelease release) {
        if (destroyed || activity.isFinishing()) {
            return;
        }
        dismissUpdateDialogNow();
        pendingRelease = release;
        updateDialog = new AlertDialog.Builder(activity)
                .setTitle(R.string.update_required_title)
                .setMessage(activity.getString(R.string.update_required_message, release.versionName, release.releaseNotes))
                .setPositiveButton(R.string.update_now, null)
                .setCancelable(false)
                .create();
        updateDialog.setCanceledOnTouchOutside(false);
        updateDialog.setOnShowListener(ignored -> updateDialog.getButton(AlertDialog.BUTTON_POSITIVE)
                .setOnClickListener(view -> beginDownload(release)));
        updateDialog.show();
    }

    private void beginDownload(UpdateRelease release) {
        if (downloadManager == null) {
            showDownloadFailure();
            return;
        }
        DownloadManager.Request request = new DownloadManager.Request(Uri.parse(release.apkUrl))
                .setTitle(activity.getString(R.string.app_name))
                .setDescription(activity.getString(R.string.update_downloading_message, 0))
                .setMimeType(APK_MIME_TYPE)
                .setNotificationVisibility(DownloadManager.Request.VISIBILITY_VISIBLE)
                .setAllowedOverMetered(true)
                .setAllowedOverRoaming(false)
                .setDestinationInExternalFilesDir(
                        activity,
                        Environment.DIRECTORY_DOWNLOADS,
                        "lanying-jipai-update-" + release.versionCode + ".apk"
                );
        downloadId = downloadManager.enqueue(request);
        pendingRelease = release;
        updateDialog.getButton(AlertDialog.BUTTON_POSITIVE).setEnabled(false);
        updateDialog.setMessage(activity.getString(R.string.update_downloading_message, 0));
        pollDownload();
    }

    private void pollDownload() {
        if (destroyed || downloadManager == null || downloadId == -1L) {
            return;
        }
        DownloadManager.Query query = new DownloadManager.Query().setFilterById(downloadId);
        try (Cursor cursor = downloadManager.query(query)) {
            if (!cursor.moveToFirst()) {
                return;
            }
            int status = cursor.getInt(cursor.getColumnIndexOrThrow(DownloadManager.COLUMN_STATUS));
            if (status == DownloadManager.STATUS_RUNNING || status == DownloadManager.STATUS_PENDING || status == DownloadManager.STATUS_PAUSED) {
                updateDownloadProgress(cursor);
                mainHandler.postDelayed(this::pollDownload, DOWNLOAD_POLL_INTERVAL_MS);
                return;
            }
            if (status == DownloadManager.STATUS_SUCCESSFUL) {
                Uri apkUri = downloadManager.getUriForDownloadedFile(downloadId);
                if (apkUri == null || pendingRelease == null) {
                    showDownloadFailure();
                    return;
                }
                verifyAndInstall(apkUri, pendingRelease);
                return;
            }
            showDownloadFailure();
        }
    }

    private void updateDownloadProgress(Cursor cursor) {
        long downloaded = cursor.getLong(cursor.getColumnIndexOrThrow(DownloadManager.COLUMN_BYTES_DOWNLOADED_SO_FAR));
        long total = cursor.getLong(cursor.getColumnIndexOrThrow(DownloadManager.COLUMN_TOTAL_SIZE_BYTES));
        int progress = total > 0L ? (int) Math.min(100L, downloaded * 100L / total) : 0;
        if (updateDialog != null) {
            updateDialog.setMessage(activity.getString(R.string.update_downloading_message, progress));
        }
    }

    private void verifyAndInstall(Uri apkUri, UpdateRelease release) {
        if (updateDialog != null) {
            updateDialog.setMessage(activity.getString(R.string.update_verifying_message));
        }
        executor.execute(() -> {
            boolean checksumMatches = false;
            try {
                checksumMatches = release.apkSha256.equals(sha256ForUri(apkUri));
            } catch (IOException | NoSuchAlgorithmException ignored) {
                // The old app remains blocked and offers a fresh download below.
            }
            boolean verified = checksumMatches;
            mainHandler.post(() -> {
                if (verified) {
                    launchOrRequestInstallPermission(apkUri);
                } else {
                    removeDownloadedApk();
                    showDownloadFailure();
                }
            });
        });
    }

    private String sha256ForUri(Uri uri) throws IOException, NoSuchAlgorithmException {
        InputStream inputStream = activity.getContentResolver().openInputStream(uri);
        if (inputStream == null) {
            throw new IOException("Downloaded APK is unavailable");
        }
        try (BufferedInputStream stream = new BufferedInputStream(inputStream)) {
            return sha256ForStream(stream);
        }
    }

    static String sha256ForStream(InputStream stream) throws IOException, NoSuchAlgorithmException {
        MessageDigest digest = MessageDigest.getInstance("SHA-256");
        byte[] buffer = new byte[8192];
        int bytesRead;
        while ((bytesRead = stream.read(buffer)) != -1) {
            digest.update(buffer, 0, bytesRead);
        }
        StringBuilder value = new StringBuilder(64);
        for (byte current : digest.digest()) {
            value.append(Character.forDigit((current >> 4) & 0xF, 16));
            value.append(Character.forDigit(current & 0xF, 16));
        }
        return value.toString();
    }

    private void launchOrRequestInstallPermission(Uri apkUri) {
        if (!canRequestPackageInstalls()) {
            pendingInstallUri = apkUri;
            Intent settingsIntent = new Intent(
                    Settings.ACTION_MANAGE_UNKNOWN_APP_SOURCES,
                    Uri.parse("package:" + activity.getPackageName())
            );
            activity.startActivity(settingsIntent);
            return;
        }
        launchPackageInstaller(apkUri);
    }

    private boolean canRequestPackageInstalls() {
        return Build.VERSION.SDK_INT < Build.VERSION_CODES.O
                || activity.getPackageManager().canRequestPackageInstalls();
    }

    private void launchPackageInstaller(Uri apkUri) {
        Intent installIntent = new Intent(Intent.ACTION_VIEW)
                .setDataAndType(apkUri, APK_MIME_TYPE)
                .addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION)
                .addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
        try {
            activity.startActivity(installIntent);
        } catch (ActivityNotFoundException exception) {
            showDownloadFailure();
        }
    }

    private void showDownloadFailure() {
        removeDownloadedApk();
        downloadId = -1L;
        if (updateDialog == null || destroyed || activity.isFinishing()) {
            return;
        }
        updateDialog.setMessage(activity.getString(R.string.update_download_failed_message));
        updateDialog.getButton(AlertDialog.BUTTON_POSITIVE).setEnabled(true);
        updateDialog.getButton(AlertDialog.BUTTON_POSITIVE).setText(R.string.update_retry);
        updateDialog.getButton(AlertDialog.BUTTON_POSITIVE).setOnClickListener(view -> {
            if (pendingRelease != null) {
                beginDownload(pendingRelease);
            }
        });
    }

    private void removeDownloadedApk() {
        if (downloadManager != null && downloadId != -1L) {
            downloadManager.remove(downloadId);
        }
    }

    private void dismissUpdateDialog() {
        mainHandler.post(this::dismissUpdateDialogNow);
    }

    private void dismissUpdateDialogNow() {
        if (updateDialog != null && updateDialog.isShowing()) {
            updateDialog.dismiss();
        }
    }

    private long localVersionCode() {
        try {
            PackageInfo packageInfo = activity.getPackageManager().getPackageInfo(activity.getPackageName(), 0);
            return Build.VERSION.SDK_INT >= Build.VERSION_CODES.P
                    ? packageInfo.getLongVersionCode()
                    : packageInfo.versionCode;
        } catch (Exception exception) {
            return Long.MAX_VALUE;
        }
    }

    private UpdateRelease fetchRelease(String manifestUrl) throws IOException, JSONException {
        HttpURLConnection connection = (HttpURLConnection) new URL(manifestUrl).openConnection();
        connection.setConnectTimeout(10_000);
        connection.setReadTimeout(10_000);
        connection.setRequestMethod("GET");
        connection.setRequestProperty("Accept", "application/json");
        try {
            if (connection.getResponseCode() != HttpURLConnection.HTTP_OK) {
                return null;
            }
            StringBuilder response = new StringBuilder();
            try (BufferedInputStream stream = new BufferedInputStream(connection.getInputStream())) {
                byte[] buffer = new byte[4096];
                int bytesRead;
                while ((bytesRead = stream.read(buffer)) != -1) {
                    response.append(new String(buffer, 0, bytesRead, java.nio.charset.StandardCharsets.UTF_8));
                }
            }
            return UpdateRelease.fromJson(new JSONObject(response.toString()));
        } finally {
            connection.disconnect();
        }
    }

    private static final class UpdateRelease {
        final long versionCode;
        final String versionName;
        final String releaseNotes;
        final String apkUrl;
        final String apkSha256;

        UpdateRelease(long versionCode, String versionName, String releaseNotes, String apkUrl, String apkSha256) {
            this.versionCode = versionCode;
            this.versionName = versionName;
            this.releaseNotes = releaseNotes;
            this.apkUrl = apkUrl;
            this.apkSha256 = apkSha256;
        }

        static UpdateRelease fromJson(JSONObject envelope) throws JSONException {
            if (envelope.optInt("code", -1) != 0 || envelope.isNull("data")) {
                return null;
            }
            JSONObject data = envelope.getJSONObject("data");
            long versionCode = data.optLong("version_code", 0L);
            String apkUrl = data.optString("apk_url", "");
            String apkSha256 = data.optString("apk_sha256", "");
            if (versionCode <= 0L || !apkUrl.startsWith("https://") || !isValidSha256(apkSha256) || !data.optBoolean("force_update", false)) {
                return null;
            }
            return new UpdateRelease(
                    versionCode,
                    data.optString("version_name", ""),
                    data.optString("release_notes", ""),
                    apkUrl,
                    apkSha256
            );
        }
    }
}
