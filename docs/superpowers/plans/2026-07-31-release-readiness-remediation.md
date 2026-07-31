# Release Readiness Remediation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make database initialization, order-delivery regression coverage, Android APK signing and public download distribution safe for deployment to the Linux test server.

**Architecture:** FastAPI continues to publish only Android release metadata. The public homepage reads that manifest and redirects the browser to its immutable HTTPS `apk_url`; Nginx serves the APK statically. Android release signing is configured from local ignored files so the signing key and passwords never enter Git.

**Tech Stack:** FastAPI, Alembic, SQLAlchemy, Pytest, React, TypeScript, Vitest, Capacitor Android, Gradle, Nginx.

---

## File Map

| File | Responsibility |
| --- | --- |
| `backend/app/config.py` | Escape a URL only when it is handed to Alembic's ConfigParser. |
| `backend/alembic/env.py` | Use the Alembic-safe database URL. |
| `backend/tests/test_config.py` | Lock the encoded-password behavior with a unit test. |
| `backend/tests/test_admin_api.py` | Supply real owned media assets in admin order lifecycle helpers. |
| `backend/tests/test_wallet_api.py` | Supply real owned media assets in wallet settlement lifecycle helper. |
| `backend/tests/test_init_sql.py` | Require the generated SQL to reach `20260805_13`. |
| `backend/sql/init-mariadb.sql` | Regenerated complete schema and seed data. |
| `frontend/src/api/appReleases.ts` | Typed public Android release-manifest request. |
| `frontend/src/pages/OfficialHomePage.tsx` | Download loading, unavailable and request-error states; browser redirect on release. |
| `frontend/src/pages/OfficialHomePage.test.tsx` | Website download behavior tests. |
| `frontend/android/app/build.gradle` | Release-signing configuration loaded from ignored local settings. |
| `.gitignore` | Protect Android keystore, signing properties and production Android build env. |
| `deploy/nginx.conf` | Static HTTPS APK location. |
| `docs/08-android-apk-release.md` | Final build, upload, publication, rollback and verification instructions. |

### Task 1: Make Alembic Safe for Encoded Database Passwords

**Files:**
- Modify: `backend/app/config.py`
- Modify: `backend/alembic/env.py`
- Modify: `backend/tests/test_config.py`

- [ ] **Step 1: Write the failing encoded-URL test**

Add this test to `backend/tests/test_config.py`:

```python
def test_alembic_url_preserves_percent_encoded_database_password() -> None:
    from app.config import alembic_database_url

    database_url = "mysql+pymysql://demo:demo%40123456@db.example:3306/jipai?charset=utf8mb4"

    assert alembic_database_url(database_url) == "mysql+pymysql://demo:demo%%40123456@db.example:3306/jipai?charset=utf8mb4"
```

- [ ] **Step 2: Verify the test fails for the missing helper**

Run:

```powershell
Set-Location backend
.\.venv\Scripts\python.exe -m pytest -q tests/test_config.py
```

Expected: failure because `alembic_database_url` is not importable.

- [ ] **Step 3: Implement the smallest explicit escape helper**

Add this function to `backend/app/config.py`:

```python
def alembic_database_url(database_url: str) -> str:
    """Escape percent signs for Alembic's ConfigParser boundary only."""
    return database_url.replace("%", "%%")
```

Change `backend/alembic/env.py` to pass `alembic_database_url(Settings().database_url)` to `config.set_main_option`. Do not change `Settings.database_url` itself; SQLAlchemy must keep receiving the regular `%40` URL in the running API.

- [ ] **Step 4: Verify the focused test passes**

Run the Step 2 command again.

Expected: `test_config.py` passes.

- [ ] **Step 5: Verify migration against the real encoded password without schema changes**

Run `alembic current` with `DATABASE_URL` set to the real URL using `%40`, plus temporary JWT/AES values. It must report `20260805_13` and must not report ConfigParser interpolation errors.

- [ ] **Step 6: Commit the isolated migration compatibility change**

```powershell
git add backend/app/config.py backend/alembic/env.py backend/tests/test_config.py
git commit -m "fix: support encoded database passwords in alembic"
```

### Task 2: Restore Delivery and Settlement Regression Coverage

**Files:**
- Modify: `backend/tests/test_admin_api.py`
- Modify: `backend/tests/test_wallet_api.py`
- Verify: `backend/tests/test_order_api.py`

- [ ] **Step 1: Update the two stale lifecycle helpers to express the real rule**

Before calling `PUT /api/orders/{id}/submit`, each helper must insert seven `MediaAsset` rows owned by the model: six `image/jpeg` assets and one `video/mp4` asset with `duration_seconds=Decimal("6.000")`. Submit exactly those seven generated URLs, not a fictional `/uploads/asset.jpg` path.

Use the existing proven pattern from `backend/tests/test_order_api.py`:

```python
session.add_all(
    [MediaAsset(owner_id=model.id, url=url, content_type="image/jpeg") for url in image_urls]
    + [MediaAsset(owner_id=model.id, url=video_url, content_type="video/mp4", duration_seconds=Decimal("6.000"))]
)
session.commit()
```

The helper must obtain the model user from the test database before creating the assets. The submitted media list must be `[*image_urls, video_url]`.

- [ ] **Step 2: Run the two tests before modifying helpers**

Run:

```powershell
Set-Location backend
.\.venv\Scripts\python.exe -m pytest -q tests/test_admin_api.py::test_admin_can_arbitrate_a_dispute_and_view_dashboard tests/test_admin_api.py::test_admin_can_operate_orders_for_a_selected_merchant tests/test_wallet_api.py::test_order_settlement_and_withdrawal_lifecycle
```

Expected: all three fail with the current `422` submission response.

- [ ] **Step 3: Implement the media setup in both helpers**

Import `Decimal` and `MediaAsset` where required. Keep the production validation unchanged: it correctly rejects media that was not uploaded by the order owner.

- [ ] **Step 4: Verify the focused lifecycle tests pass**

Run the Step 2 command again.

Expected: all three tests pass and still exercise arbitration and settlement after valid delivery.

- [ ] **Step 5: Commit the regression test repair**

```powershell
git add backend/tests/test_admin_api.py backend/tests/test_wallet_api.py
git commit -m "test: provide valid media for delivery flows"
```

### Task 3: Regenerate the MariaDB Bootstrap SQL at Head

**Files:**
- Modify: `backend/tests/test_init_sql.py`
- Modify: `backend/sql/init-mariadb.sql`

- [ ] **Step 1: Write the expected latest revision assertion**

Replace all `20260804_12` revision assertions in `backend/tests/test_init_sql.py` with `20260805_13`:

```python
assert "UPDATE alembic_version SET version_num='20260805_13'" in sql
```

- [ ] **Step 2: Verify the test fails because the tracked SQL is stale**

Run:

```powershell
Set-Location backend
.\.venv\Scripts\python.exe -m pytest -q tests/test_init_sql.py
```

Expected: generated output reaches `20260805_13`, while `sql/init-mariadb.sql` remains at `20260804_12`.

- [ ] **Step 3: Regenerate the tracked SQL from Alembic**

Run:

```powershell
Set-Location backend
.\.venv\Scripts\python.exe -m scripts.export_mariadb_init_sql
```

Confirm the generated SQL contains the `20260804_12 -> 20260805_13` upgrade, the `media_assets` table, and the new fulfillment columns.

- [ ] **Step 4: Verify the freshness test passes**

Run the Step 2 command again.

Expected: generated and tracked SQL are byte-for-byte equal.

- [ ] **Step 5: Commit generated schema and test expectation together**

```powershell
git add backend/tests/test_init_sql.py backend/sql/init-mariadb.sql
git commit -m "fix: refresh MariaDB initialization SQL"
```

### Task 4: Make the Public Android Download Button Use the Release Manifest

**Files:**
- Create: `frontend/src/api/appReleases.ts`
- Modify: `frontend/src/pages/OfficialHomePage.tsx`
- Modify: `frontend/src/pages/OfficialHomePage.test.tsx`

- [ ] **Step 1: Replace the placeholder behavior with a failing user-facing test**

Mock a `getLatestAndroidRelease` module function in `OfficialHomePage.test.tsx`. Add one test where it resolves an APK URL and assert a click invokes the navigation function with that URL. Add one test where it resolves `null` and assert the page status says `Android App 暂未发布，请稍后再试。`.

```typescript
vi.mock("../api/appReleases", () => ({ getLatestAndroidRelease: vi.fn() }));
```

The existing mini-program test must remain: it is still a QR-code/URL-Scheme placeholder, not an APK download.

- [ ] **Step 2: Run the focused component test and confirm failure**

Run:

```powershell
Set-Location frontend
npm test -- src/pages/OfficialHomePage.test.tsx
```

Expected: the Android download assertions fail because the page only calls `showDevelopmentNotice`.

- [ ] **Step 3: Add a typed public release API module**

Create `frontend/src/api/appReleases.ts`:

```typescript
import { client, request } from "./client";

export interface AndroidReleaseManifest {
  platform: "android";
  version_code: number;
  version_name: string;
  force_update: true;
  release_notes: string;
  apk_url: string;
  apk_sha256: string;
}

export function getLatestAndroidRelease() {
  return request<AndroidReleaseManifest | null>(client.get("/app-releases/android/latest"));
}
```

- [ ] **Step 4: Implement one-click manifest lookup and redirect**

In `OfficialHomePage.tsx`, add `downloadingAndroid` state and an async `downloadAndroidApp` handler. It must disable the Android button while loading, call `getLatestAndroidRelease()`, show `Android App 暂未发布，请稍后再试。` for `null`, show `暂时无法获取下载地址，请稍后再试。` for request errors, and call an injected/testable navigation function with `release.apk_url` for a valid manifest. Keep the WeChat button on its existing development notice until the user supplies Mini Program delivery details.

- [ ] **Step 5: Verify focused tests and complete frontend suite**

Run:

```powershell
npm test -- src/pages/OfficialHomePage.test.tsx
npm test
npm run build
```

Expected: homepage tests, complete suite, TypeScript compilation and Vite production build pass.

- [ ] **Step 6: Commit the public download behavior**

```powershell
git add frontend/src/api/appReleases.ts frontend/src/pages/OfficialHomePage.tsx frontend/src/pages/OfficialHomePage.test.tsx
git commit -m "feat: download Android releases from public homepage"
```

### Task 5: Enforce Signed Android Releases and Protect Local Secrets

**Files:**
- Modify: `.gitignore`
- Modify: `frontend/android/app/build.gradle`
- Modify: `docs/08-android-apk-release.md`

- [ ] **Step 1: Add a failing repository ignore check**

Create temporary files outside Git and run these checks before changing ignore rules:

```powershell
New-Item -ItemType Directory -Force frontend\android\signing | Out-Null
New-Item -ItemType File frontend\android\signing\lanying-jipai-release.jks | Out-Null
New-Item -ItemType File frontend\android\signing.properties | Out-Null
New-Item -ItemType File frontend\.env.android | Out-Null
git check-ignore -q frontend/android/signing/lanying-jipai-release.jks
git check-ignore -q frontend/android/signing.properties
git check-ignore -q frontend/.env.android
```

Expected: at least the keystore and signing-properties checks fail with the current ignore rules. Remove only these temporary empty files after the test.

- [ ] **Step 2: Add explicit ignored local Android secrets**

Add these entries to root `.gitignore`:

```gitignore
# Android release signing and production build configuration
frontend/android/signing/
frontend/android/signing.properties
frontend/.env.android
```

- [ ] **Step 3: Verify Git cannot stage local Android secrets**

Repeat the `git check-ignore` commands from Step 1.

Expected: all checks return success and `git status --short` does not list the temporary files.

- [ ] **Step 4: Add release-only Gradle signing configuration**

Load `frontend/android/signing.properties` when present. A release task must fail with an actionable `GradleException` when the properties file or any of `storeFile`, `storePassword`, `keyAlias`, `keyPassword` is absent. When all values exist, assign `signingConfigs.release` to `buildTypes.release`. Debug builds must remain usable without signing configuration.

- [ ] **Step 5: Verify the Gradle guard after Android SDK installation**

Run without `signing.properties`:

```powershell
Set-Location frontend\android
$env:JAVA_HOME = 'D:\jdk21\openjdk-21.0.11+10'
.\gradlew.bat :app:assembleRelease
```

Expected: configuration fails before producing an unsigned APK and names the missing signing properties.

Create the local keystore and properties as documented, then run the same command again.

Expected: a signed `app-release.apk` is produced.

- [ ] **Step 6: Update the manual with the exact signing property names and guard behavior**

Keep the keystore generation and backup guidance in `docs/08-android-apk-release.md` aligned with the implementation.

- [ ] **Step 7: Commit safe release signing support**

```powershell
git add .gitignore frontend/android/app/build.gradle docs/08-android-apk-release.md
git commit -m "build: require local signing for Android releases"
```

### Task 6: Add Nginx APK Hosting and Perform Deployment Verification

**Files:**
- Modify: `deploy/nginx.conf`
- Modify: `docs/05-deployment.md`
- Modify: `docs/08-android-apk-release.md`

- [ ] **Step 1: Add an APK static-location configuration test by inspection**

Before editing `deploy/nginx.conf`, run:

```powershell
$nginx = Get-Content -Raw deploy/nginx.conf
if ($nginx -match 'location /releases/') { throw 'Expected current template to be missing releases location' }
```

Expected: the command succeeds because the location is absent.

- [ ] **Step 2: Add the immutable APK location to the Nginx template**

Add this block inside the `server` block after `/uploads/`:

```nginx
location /releases/ {
    alias /opt/lanying-jipai/releases/;
    autoindex off;
    default_type application/vnd.android.package-archive;
    add_header X-Content-Type-Options nosniff always;
    add_header Accept-Ranges bytes always;
    try_files $uri =404;
}
```

The production virtual host must be upgraded to valid HTTPS before publishing an Android manifest. The `ANDROID_UPDATE_APK_URL` validator and Android client both require HTTPS.

- [ ] **Step 3: Verify template content and server syntax**

Run locally:

```powershell
$nginx = Get-Content -Raw deploy/nginx.conf
if ($nginx -notmatch 'location /releases/' -or $nginx -notmatch 'application/vnd.android.package-archive') { exit 1 }
```

On the Linux server after installation:

```bash
sudo nginx -t
sudo systemctl reload nginx
curl -fI https://<APP_DOMAIN>/releases/lanying-jipai-1.0.0.apk
```

- [ ] **Step 4: Publish and verify the first manifest**

After the signed APK has been uploaded and its SHA-256 verified, set `ANDROID_UPDATE_VERSION_CODE=1`, `ANDROID_UPDATE_VERSION_NAME=1.0.0`, `ANDROID_UPDATE_APK_URL`, `ANDROID_UPDATE_APK_SHA256` and `ANDROID_UPDATE_RELEASE_NOTES` in production `backend/.env`. Restart the service and verify:

```bash
curl -fsS https://<APP_DOMAIN>/api/app-releases/android/latest
curl -fI https://<APP_DOMAIN>/releases/lanying-jipai-1.0.0.apk
```

- [ ] **Step 5: Perform real device acceptance and update the manual**

Verify fresh installation, login, order hall access, media upload, website-triggered APK download, and forced update from an earlier signed APK. Record exact server paths and the selected domain in deployment documentation without committing secrets.

- [ ] **Step 6: Run the final project verification suite**

```powershell
Set-Location backend
.\.venv\Scripts\python.exe -m pytest -q

Set-Location ..\frontend
npm test
npm run build
```

Expected: all backend and frontend tests pass; production frontend build succeeds.

- [ ] **Step 7: Commit Nginx and documentation changes**

```powershell
git add deploy/nginx.conf docs/05-deployment.md docs/08-android-apk-release.md
git commit -m "deploy: serve Android releases through nginx"
```

## Final Release Checklist

- [ ] `git diff --check HEAD` passes.
- [ ] Backend test suite has no failures.
- [ ] Frontend test suite and production build pass.
- [ ] `alembic current` handles the production encoded password and reports `20260805_13`.
- [ ] Fresh MariaDB initialization SQL reaches `20260805_13`.
- [ ] A signed APK exists, its keystore is backed up, and its SHA-256 is recorded.
- [ ] Nginx serves the versioned APK over valid HTTPS.
- [ ] Public homepage starts the manifest-backed Android download.
- [ ] A real Android device completes a forced update from a lower signed version.
