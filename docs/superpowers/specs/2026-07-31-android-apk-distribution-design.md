# Android APK Public Distribution Design

**Status:** Approved for first release

## Goal

Build the first signed Android APK locally, distribute it over HTTPS through Nginx, and make the public website obtain the current download address from the existing backend release-manifest API.

## Decisions

1. Nginx serves APK files directly from `/opt/lanying-jipai/releases/`. FastAPI only returns signed-release metadata, so large downloads do not occupy application workers and standard HTTP range requests remain available.
2. Every release uses an immutable versioned filename, for example `lanying-jipai-1.0.0.apk`. A released file is never replaced in place.
3. The existing endpoint `GET /api/app-releases/android/latest` remains the source of truth. When the API returns a manifest, the website redirects the browser to `apk_url`; when it returns `data: null`, the website explains that no Android release is available.
4. The first public Android version is `versionCode=1`, `versionName=1.0.0`. Subsequent releases increment `versionCode` and reuse the same signing keystore.
5. The release keystore and `signing.properties` stay under `frontend/android/` on the build machine, are ignored by Git, and are backed up outside the repository. They must never be regenerated after an APK has been published.
6. This scope changes Android APK distribution only. A WeChat Mini Program requires its own AppID and QR-code/URL-Scheme delivery flow and is not represented as an APK download.

## Data Flow

```text
Public website download button
  -> GET /api/app-releases/android/latest
  -> backend validates and returns APK HTTPS URL + SHA-256
  -> browser redirects to https://<app-domain>/releases/lanying-jipai-<version>.apk
  -> Nginx serves the static file

Installed Android client
  -> GET /api/app-releases/android/latest at launch
  -> compares versionCode and forces update when a newer manifest is published
```

## Implementation Boundaries

- Android Gradle configuration reads local signing settings only for release builds.
- The public homepage owns the download-button loading, unavailable, and request-failure states.
- The backend release endpoint remains configuration-driven; no APK bytes are stored in MariaDB or streamed through FastAPI.
- `deploy/nginx.conf` gains an explicit `/releases/` location with HTTPS-only access in production.
- `docs/08-android-apk-release.md` is the operational source for building, uploading, publishing, rollback, and recovery.

## Acceptance Criteria

- A signed `app-release.apk` installs on a real Android device.
- The deployed APK is retrievable over HTTPS with a SHA-256 equal to the configured release manifest.
- The homepage starts an APK download when a manifest exists and gives a clear unavailable message when it does not.
- A previously installed APK is forced to update when the manifest has a greater `versionCode`.
- No keystore, signing password, `signing.properties`, APK, or build directory is committed.
