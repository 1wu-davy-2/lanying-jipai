# Android Build

The Android app is a Capacitor shell around the talent web application. It opens directly into the talent workflow, while the ordinary web build retains the separate operations and talent entry points. Both share React routes, authentication state, and API contracts.

1. Copy `.env.android.example` to `.env.android` and set `VITE_API_BASE_URL` to the public HTTPS API endpoint.
2. Run `npm run android:sync` to build the web bundle and copy it into the Android project.
3. Open the generated project with `npm run android:open`, then build a signed release APK/AAB in Android Studio.

The backend must list `https://localhost` and `capacitor://localhost` in `CORS_ORIGINS`. Do not use a cleartext HTTP API or media domain in the Android application.
