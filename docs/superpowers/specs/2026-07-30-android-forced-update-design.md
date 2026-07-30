# Android 强制更新与应用图标设计

## 目标

为 `com.lanying.jipai` 提供一枚正式、可裁切的 Android 启动图标，并在启动阶段阻止旧 APK 进入业务页面，直到用户下载并交由 Android 系统安装当前发布版本。

## 已确认的产品决策

- 图标方向为“鹰羽印章”：浅雾绿底、深海青鹰羽、行动绿羽轴、白色完成勾。
- 更新策略为强制更新。服务端发布更高版本后，旧版本不得继续使用。
- 当前部署为单实例，不维护多个 API 版本的兼容窗口。
- APK 由当前服务器或其 HTTPS 静态文件域名提供；本次不构建 APK。

## 图标

Android 7+ 使用 Adaptive Icon。`ic_launcher_background.xml` 仅提供浅雾绿背景，前景矢量绘制鹰羽和完成勾，确保在圆形、圆角方形与系统蒙版下仍保留安全边距。API 24-25 使用同一前景图形的普通矢量资源回退，不依赖固定尺寸位图。

颜色固定为：

- 深海青：`#14373A`
- 行动绿：`#117A72`
- 浅雾绿：`#DCECE8`
- 白色：`#FFFFFF`

## 版本接口

新增匿名只读接口：`GET /api/app-releases/android/latest`。

无已发布版本时：

```json
{"code": 0, "message": "ok", "data": null}
```

有版本时：

```json
{
  "code": 0,
  "message": "ok",
  "data": {
    "platform": "android",
    "version_code": 2,
    "version_name": "1.1.0",
    "force_update": true,
    "release_notes": "修复并优化寄拍接单体验",
    "apk_url": "https://app.example.com/releases/lanying-jipai-1.1.0.apk",
    "apk_sha256": "64 位小写 SHA-256 十六进制摘要"
  }
}
```

接口从环境变量读取发布元数据，不建立数据库表，也不需要管理后台：

```dotenv
ANDROID_UPDATE_VERSION_CODE=2
ANDROID_UPDATE_VERSION_NAME=1.1.0
ANDROID_UPDATE_APK_URL=https://app.example.com/releases/lanying-jipai-1.1.0.apk
ANDROID_UPDATE_APK_SHA256=<sha256sum 输出的小写摘要>
ANDROID_UPDATE_RELEASE_NOTES=修复并优化寄拍接单体验
```

`ANDROID_UPDATE_VERSION_CODE` 未设置或小于等于 0 时代表未发布，接口返回 `null`。若已设置版本号但 APK 地址或 SHA-256 不完整，服务端启动即报出明确配置错误，避免向客户端下发不可安装的更新。

## Android 更新链路

1. `MainActivity.onCreate()` 在 Capacitor 容器初始化后立刻请求已配置的版本接口，并以不可取消的原生遮罩阻止 WebView 交互。
2. 接口的 `version_code` 大于应用 `versionCode` 时，展示不可取消的原生更新界面，只有“立即更新”。
3. 按下后用 `DownloadManager` 下载 HTTPS APK；下载期间仍维持更新界面并展示进度。
4. 完成下载后计算 APK 的 SHA-256，与接口摘要不一致则删除下载记录并保留错误提示，不能进入业务页面。
5. 摘要匹配后，以 `ACTION_VIEW` 和 `application/vnd.android.package-archive` 启动系统安装器。
6. Android 未授权本应用安装未知来源 APK 时，打开本应用对应的系统授权页；用户返回后继续触发安装器。
7. 系统安装会验证 APK 的签名与现有包签名一致。安装成功后的新进程重新检查版本，再加载 WebView。

Android 版本接口 URL 不写死在源码：`frontend/android/update.properties` 仅存本地或构建机，并被 Git 忽略。构建时 Gradle 读取其中的 `androidUpdateManifestUrl` 注入 `BuildConfig`；文件不存在或地址为空时跳过检查，便于本地 Web 调试。

## 发布操作

1. 递增 `frontend/android/app/build.gradle` 中的 `versionCode` 与 `versionName`。
2. 使用固定签名证书生成 release APK，上传至 HTTPS 地址。
3. 在 Linux 上执行 `sha256sum <apk>`，将结果填入后端环境变量。
4. 更新 `ANDROID_UPDATE_*` 并重启后端。此时旧版本下次启动立即被拦截。
5. 通过已安装旧 APK 的实体 Android 设备验证下载、未知来源授权、签名覆盖安装与重新启动。

## 非目标

- 不实现灰度发布、渠道分发、应用商店更新或多版本 API 路由。
- 不在本次生成、签名或上传 APK。
- 不将 APK、签名密钥、生产 URL 或 `update.properties` 提交到 Git。
