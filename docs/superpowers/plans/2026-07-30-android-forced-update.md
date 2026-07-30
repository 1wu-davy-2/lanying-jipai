# Android Forced Update Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add the Eagle Feather Seal launcher icon and a server-configured, native Android forced-update flow for newer APK releases.

**Architecture:** FastAPI exposes one public immutable-shape release manifest derived from validated environment variables. The Android shell injects a local build-time manifest URL and performs the version comparison, APK download, digest validation, unknown-sources permission handoff, and installation before the Capacitor WebView becomes usable.

**Tech Stack:** FastAPI, Pydantic Settings, pytest, Capacitor Android, Java, Android DownloadManager, Gradle, Android vector drawables.

**Execution status (2026-07-30):** Tasks 1-3 and Task 4 validation are complete. The final commit and push are the remaining administrative step.

---

### Task 1: Specify and test the backend release manifest

**Files:**
- Create: `backend/app/schemas/app_release.py`
- Create: `backend/app/routers/app_releases.py`
- Create: `backend/tests/test_app_releases.py`
- Modify: `backend/app/config.py`
- Modify: `backend/app/main.py`
- Modify: `backend/.env.example`

- [ ] **Step 1: Write the failing API tests**

```python
def test_android_latest_release_returns_null_when_no_release_is_configured(client):
    response = client.get("/api/app-releases/android/latest")
    assert response.status_code == 200
    assert response.json() == {"code": 0, "message": "ok", "data": None}


def test_android_latest_release_returns_validated_manifest(client, monkeypatch):
    monkeypatch.setenv("ANDROID_UPDATE_VERSION_CODE", "2")
    monkeypatch.setenv("ANDROID_UPDATE_VERSION_NAME", "1.1.0")
    monkeypatch.setenv("ANDROID_UPDATE_APK_URL", "https://app.example.com/releases/lanying-jipai-1.1.0.apk")
    monkeypatch.setenv("ANDROID_UPDATE_APK_SHA256", "a" * 64)
    response = client.get("/api/app-releases/android/latest")
    assert response.json()["data"]["version_code"] == 2
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `backend\.venv\Scripts\python.exe -m pytest backend\tests\test_app_releases.py -q`

Expected: `404` because the release route does not exist.

- [ ] **Step 3: Add settings, schema, and route**

```python
class AndroidReleaseManifest(BaseModel):
    platform: Literal["android"] = "android"
    version_code: int
    version_name: str
    force_update: Literal[True] = True
    release_notes: str
    apk_url: HttpUrl
    apk_sha256: str
```

The route constructs the manifest only when `android_update_version_code > 0`; every returned release has `force_update=True`, rejects a partial release configuration, and requires a 64-character lowercase SHA-256 digest.

- [ ] **Step 4: Run the focused backend test**

Run: `backend\.venv\Scripts\python.exe -m pytest backend\tests\test_app_releases.py -q`

Expected: `2 passed`.

- [ ] **Step 5: Commit the backend manifest**

```powershell
git add backend/app/config.py backend/app/main.py backend/app/schemas/app_release.py backend/app/routers/app_releases.py backend/tests/test_app_releases.py backend/.env.example
git commit -m "feat: expose Android release manifest"
```

### Task 2: Add build-time Android update configuration

**Files:**
- Create: `frontend/android/update.properties.example`
- Modify: `frontend/android/.gitignore`
- Modify: `frontend/android/app/build.gradle`

- [ ] **Step 1: Add a Gradle configuration test by inspection**

Write an assertion-oriented shell check that requires both `androidUpdateManifestUrl` and `BuildConfigField` in `frontend/android/app/build.gradle`.

```powershell
$buildFile = Get-Content -Raw frontend/android/app/build.gradle
if ($buildFile -notmatch 'androidUpdateManifestUrl' -or $buildFile -notmatch 'buildConfigField') { exit 1 }
```

- [ ] **Step 2: Run it to verify it fails**

Run the PowerShell block above.

Expected: exit code `1` because no build-time manifest URL exists.

- [ ] **Step 3: Load the ignored local property into BuildConfig**

```groovy
def updateProperties = new Properties()
def updatePropertiesFile = rootProject.file("update.properties")
if (updatePropertiesFile.exists()) {
    updatePropertiesFile.withInputStream { updateProperties.load(it) }
}
def androidUpdateManifestUrl = updateProperties.getProperty("androidUpdateManifestUrl", "")

defaultConfig {
    buildConfigField "String", "ANDROID_UPDATE_MANIFEST_URL", "\"${androidUpdateManifestUrl}\""
}
```

Create an example file containing `androidUpdateManifestUrl=https://app.example.com/api/app-releases/android/latest`, and ignore the real `update.properties`.

- [ ] **Step 4: Run the shell check to verify it passes**

Run the PowerShell block from Step 1.

Expected: exit code `0`.

- [ ] **Step 5: Commit the build-time configuration**

```powershell
git add frontend/android/.gitignore frontend/android/app/build.gradle frontend/android/update.properties.example
git commit -m "feat: configure Android update manifest"
```

### Task 3: Add the launcher icon and native update gate

**Files:**
- Create: `frontend/android/app/src/main/java/com/lanying/jipai/ForcedUpdateManager.java`
- Create: `frontend/android/app/src/main/res/mipmap-anydpi-v24/ic_launcher.xml`
- Create: `frontend/android/app/src/main/res/mipmap-anydpi-v24/ic_launcher_round.xml`
- Modify: `frontend/android/app/src/main/java/com/lanying/jipai/MainActivity.java`
- Modify: `frontend/android/app/src/main/AndroidManifest.xml`
- Modify: `frontend/android/app/src/main/res/drawable/ic_launcher_background.xml`
- Modify: `frontend/android/app/src/main/res/drawable-v24/ic_launcher_foreground.xml`
- Modify: `frontend/android/app/src/main/res/mipmap-anydpi-v26/ic_launcher.xml`
- Modify: `frontend/android/app/src/main/res/mipmap-anydpi-v26/ic_launcher_round.xml`
- Modify: `frontend/android/app/src/main/res/values/strings.xml`

- [ ] **Step 1: Write Android unit tests for version decision and SHA-256 validation**

Create `ForcedUpdateManagerTest` verifying the pure helpers:

```java
assertTrue(ForcedUpdateManager.isNewerVersion(2, 1));
assertFalse(ForcedUpdateManager.isNewerVersion(1, 1));
assertTrue(ForcedUpdateManager.isValidSha256("a".repeat(64)));
assertFalse(ForcedUpdateManager.isValidSha256("not-a-digest"));
```

- [ ] **Step 2: Run the Android unit test to verify it fails**

Run: `cd frontend/android; .\gradlew.bat testDebugUnitTest --tests com.lanying.jipai.ForcedUpdateManagerTest`

Expected: compilation failure because `ForcedUpdateManager` does not exist.

- [ ] **Step 3: Implement the minimal native manager**

`ForcedUpdateManager` must:

```java
void checkForUpdate();
static boolean isNewerVersion(int remoteVersionCode, long localVersionCode);
static boolean isValidSha256(String value);
```

It uses `HttpURLConnection` on a worker executor, checks `BuildConfig.ANDROID_UPDATE_MANIFEST_URL`, parses the standard API envelope, and compares the remote integer against `PackageInfoCompat.getLongVersionCode`.

On an update it presents a non-cancelable `AlertDialog` with one positive button. It enqueues the APK with `DownloadManager`, polls download state for progress, verifies the downloaded file digest, and opens the package installer through a `content://` URI. It opens `Settings.ACTION_MANAGE_UNKNOWN_APP_SOURCES` if package installs are not allowed. Network failures and malformed manifests do not block startup; a detected newer valid release always does.

`MainActivity` invokes `checkForUpdate()` immediately after `super.onCreate(savedInstanceState)` and the manager attaches a non-cancelable native overlay before making its network request. The manifest adds `REQUEST_INSTALL_PACKAGES`. The launcher XML changes only icon art and resource references.

- [ ] **Step 4: Run the Android unit test to verify it passes**

Run: `cd frontend/android; .\gradlew.bat testDebugUnitTest --tests com.lanying.jipai.ForcedUpdateManagerTest`

Expected: `BUILD SUCCESSFUL`.

- [ ] **Step 5: Commit the icon and native gate**

```powershell
git add frontend/android/app/src/main
git commit -m "feat: add Android forced update gate"
```

### Task 4: Verify the complete source change without packaging

**Files:**
- Modify: `docs/04-frontend-design.md`
- Modify: `docs/05-deployment.md`
- Modify: `docs/superpowers/plans/2026-07-30-android-forced-update.md`

- [ ] **Step 1: Document deployment configuration and icon choice**

Add `ANDROID_UPDATE_*` configuration examples, the HTTPS hosting requirement, the SHA-256 command, and the requirement that the release APK use the same signing certificate as the installed app.

- [ ] **Step 2: Run backend suite**

Run: `backend\.venv\Scripts\python.exe -m pytest -q`

Expected: all backend tests pass.

- [ ] **Step 3: Run frontend tests and production web build**

Run: `npm test -- --run` and `npm run build` from `frontend`.

Expected: all tests pass and the build completes.

- [ ] **Step 4: Compile Android sources without producing an APK release artifact**

Run: `cd frontend/android; .\gradlew.bat compileDebugJavaWithJavac testDebugUnitTest`

Expected: `BUILD SUCCESSFUL`; no `assembleDebug` or `assembleRelease` command is run.

- [ ] **Step 5: Commit and push documentation and verification changes**

```powershell
git add docs/04-frontend-design.md docs/05-deployment.md docs/superpowers/plans/2026-07-30-android-forced-update.md
git commit -m "docs: document Android forced update release flow"
git push origin dev
```
