# Android APK 构建与 Nginx 发布手册

本文用于发布蓝鹰寄拍 Android APK。APK 在 Windows 构建机生成，Linux 服务器通过 Nginx 提供 HTTPS 下载；后端仅发布版本清单，不转发 APK 文件。

## 1. 发布架构

```text
官网“下载 Android App”
  -> GET /api/app-releases/android/latest
  -> 返回 APK 的 HTTPS 地址
  -> Nginx /releases/ 静态下载

Android 客户端启动
  -> 同一个版本清单
  -> 新 versionCode 时强制下载并安装新 APK
```

不要把 APK 存入 MariaDB，也不要让 FastAPI 读取文件后再转发。Nginx 能直接处理大文件、Range 请求与断点续传，适合服务器带宽较高的场景。

## 2. 首次构建机准备

本项目 Android 工程位于 `frontend/android/`，当前要求：

- JDK 21，当前构建机可使用 `D:\jdk21\openjdk-21.0.11+10`。
- Android SDK Platform 36。
- Android SDK Build-Tools 36.x。
- Node.js 与仓库 `frontend/node_modules`。

安装 Android Studio 后，在 SDK Manager 安装上述 Platform 和 Build-Tools。然后创建 `frontend/android/local.properties`，其中 SDK 路径必须按 Windows 转义：

```properties
sdk.dir=C\:\\Users\\<Windows 用户>\\AppData\\Local\\Android\\Sdk
```

`local.properties` 只属于本机，已经由 Android 工程忽略，不能提交。

## 3. 首次创建签名密钥

首个正式 APK 发布前执行一次。后续升级必须使用同一个 keystore，否则 Android 不允许覆盖安装。

```powershell
Set-Location frontend\android
New-Item -ItemType Directory -Force signing
& 'D:\jdk21\openjdk-21.0.11+10\bin\keytool.exe' -genkeypair `
  -keystore signing\lanying-jipai-release.jks `
  -alias lanying-jipai `
  -keyalg RSA -keysize 4096 -validity 9125
```

按提示填写密码与证书信息。将 keystore 与密码保存在受控的离线密码库或加密备份中。丢失 keystore 后，已发布 APK 无法原地升级。

在 `frontend/android/signing.properties` 创建本机签名配置：

```properties
storeFile=signing/lanying-jipai-release.jks
storePassword=<keystore 密码>
keyAlias=lanying-jipai
keyPassword=<key 密码>
```

该文件和 keystore 必须被 Git 忽略，不能发送到 GitHub、聊天工具或服务器日志。

## 4. 配置 Android 的生产接口

复制 `frontend/.env.android.example` 为 `frontend/.env.android`，填写生产 HTTPS API 地址：

```dotenv
VITE_API_BASE_URL=https://<APP_DOMAIN>/api
VITE_APP_MODE=talent
```

在 `frontend/android/update.properties` 设置 Android 客户端查询的同一版本清单：

```properties
androidUpdateManifestUrl=https://<APP_DOMAIN>/api/app-releases/android/latest
```

Android WebView 和更新 APK URL 都必须使用 HTTPS。不能把本机 `127.0.0.1`、云服务器裸 IP 的 HTTP 地址或开发端口写入正式 APK。

## 5. 构建签名 APK

每次发布前先递增 `frontend/android/app/build.gradle` 的 `versionCode` 和 `versionName`。首次版本使用 `1` 与 `1.0.0`。

```powershell
Set-Location frontend
npm run android:sync

Set-Location android
$env:JAVA_HOME = 'D:\jdk21\openjdk-21.0.11+10'
.\gradlew.bat clean assembleRelease
```

构建成功后的 APK 路径为：

```text
frontend/android/app/build/outputs/apk/release/app-release.apk
```

生成 SHA-256，并保留输出供后端发布清单使用：

```powershell
Get-FileHash .\app\build\outputs\apk\release\app-release.apk -Algorithm SHA256
```

## 6. 上传到 Linux 与 Nginx 配置

在服务器创建只供部署用户写入的目录：

```bash
sudo install -d -o deploy -g www-data -m 0750 /opt/lanying-jipai/releases
```

将 APK 以不可变版本名上传。示例中的域名替换为实际 HTTPS 域名：

```powershell
scp .\app\build\outputs\apk\release\app-release.apk deploy@<SERVER_HOST>:/opt/lanying-jipai/releases/lanying-jipai-1.0.0.apk
```

在 Nginx HTTPS 虚拟主机中加入：

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

加载前检查并重载：

```bash
sudo nginx -t
sudo systemctl reload nginx
```

服务器上应再次计算摘要，必须与构建机一致：

```bash
sha256sum /opt/lanying-jipai/releases/lanying-jipai-1.0.0.apk
```

## 7. 发布后端版本清单

编辑生产 `backend/.env`。APK URL 必须是上一步 Nginx 能访问的 HTTPS 地址，摘要为 64 位小写 SHA-256：

```dotenv
ANDROID_UPDATE_VERSION_CODE=1
ANDROID_UPDATE_VERSION_NAME=1.0.0
ANDROID_UPDATE_APK_URL=https://<APP_DOMAIN>/releases/lanying-jipai-1.0.0.apk
ANDROID_UPDATE_APK_SHA256=<APK 的 sha256>
ANDROID_UPDATE_RELEASE_NOTES=首次发布蓝鹰寄拍 Android 客户端
```

重启后端并确认版本清单：

```bash
sudo systemctl restart lanying-backend
curl -fsS https://<APP_DOMAIN>/api/app-releases/android/latest
curl -fI https://<APP_DOMAIN>/releases/lanying-jipai-1.0.0.apk
```

接口返回 `data` 为 `null` 表示未发布版本；页面不应尝试下载。接口返回版本对象后，官网 Android 按钮会跳转到 `apk_url`。

## 8. 发布验收

1. 在浏览器点击官网 Android 下载入口，确认开始下载版本化 APK。
2. 对下载后的文件再次计算 SHA-256，必须与后端清单一致。
3. 在未安装设备上安装 APK，确认可以登录、访问订单大厅和上传素材。
4. 将旧 APK 安装到真机，发布更高 `versionCode` 后重新启动，确认强制更新页出现、下载完成、系统覆盖安装成功。
5. 用不同网络访问 APK，确认 Nginx 返回 `200` 或续传场景下返回 `206`。

## 9. 回滚与故障处理

- 不要覆盖已发布 APK。需要修复时发布更高 `versionCode` 的新文件与新 URL。
- 新版本发布前先在一台真机验证安装，再更新后端环境变量。
- 若新清单错误，在修复期间将 `ANDROID_UPDATE_VERSION_CODE=0` 并重启后端，暂时停止强制更新。
- 若 keystore 丢失，不要发布相同 `applicationId` 的所谓“更新包”；必须保留原 keystore 的受控备份后才能继续升级。
