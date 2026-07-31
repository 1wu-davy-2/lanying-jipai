# 部署资产

这些文件是 Linux 服务器的可执行模板，部署前必须替换域名和路径，并按最小权限创建 `deploy` 用户。

## 安装

1. 将 `lanying-backend.service` 安装到 `/etc/systemd/system/`，随后执行 `systemctl daemon-reload && systemctl enable --now lanying-backend`。
2. 将 `nginx.conf` 中的 `server_name` 替换为真实域名，安装到 Nginx 站点配置后执行 `nginx -t && systemctl reload nginx`。
3. 在 `/opt/lanying-jipai/backend/.env` 配置数据库、JWT 和 AES 密钥，并限制权限为 `600`。
4. 为 `deploy.sh`、`backup.sh`、`healthcheck.sh` 增加执行权限：`chmod 750 deploy/*.sh`。

## HTTPS 与 Android APK

`nginx.conf` 是 HTTPS 模板：先用 80 端口的 `/.well-known/acme-challenge/` 申请证书，再将证书路径和 `server_name` 替换为真实值。确认 `nginx -t` 通过后才加载 443 站点。80 端口除 ACME 校验外只跳转 HTTPS。

将版本化 APK 放在 `/opt/lanying-jipai/releases/`，目录建议使用 `deploy:www-data` 与 `0750` 权限。`/releases/` 只在 HTTPS 虚拟主机下提供，支持断点续传且禁用目录列表。完整的构建、签名、清单配置和真机验收流程见 [`docs/08-android-apk-release.md`](../docs/08-android-apk-release.md)。

## 定时任务

使用部署专用的受限环境文件提供数据库备份变量，不要把密码写入 crontab：

```cron
0 3 * * * . /etc/lanying-jipai/backup.env && /opt/lanying-jipai/deploy/backup.sh
*/5 * * * * . /etc/lanying-jipai/health.env && /opt/lanying-jipai/deploy/healthcheck.sh
```

`backup.env` 至少包含 `MYSQL_HOST`、`MYSQL_DATABASE`、`MYSQL_USER`、`MYSQL_PASSWORD`；`health.env` 可选包含 `ALERT_WEBHOOK_URL`。两个文件均应为 `root:deploy`、权限 `640`。

## MinIO 主媒体存储

生产环境将 `backend/.env` 中的 `UPLOAD_STORAGE_DRIVER` 设为 `minio`。`MINIO_ENDPOINT` 填写同机回环地址 `127.0.0.1:9000`，`MINIO_PUBLIC_BASE_URL` 填写浏览器可访问的 HTTPS 域名，例如 `https://media.example.com`。端口 9000 和 9001 不对公网开放；Nginx 使用 `nginx-media.conf` 将公开域名转发到 MinIO 的 `lanying-media` 桶。

供手机网页和 Android WebView 调用 API 时，将网站域名、`https://localhost`、`capacitor://localhost` 写入后端 `.env` 的 `CORS_ORIGINS`，例如 `CORS_ORIGINS=https://app.example.com,https://localhost,capacitor://localhost`。媒体域名和 API 域名都必须使用 HTTPS。

安装 MinIO 二进制、创建 `minio` 系统用户和数据目录后，将 `lanying-minio.service` 安装到 `/etc/systemd/system/`。将 `MINIO_ROOT_USER`、`MINIO_ROOT_PASSWORD` 写入 `/etc/lanying-jipai/minio.env` 并设为 `root:minio`、权限 `640`，然后执行 `systemctl daemon-reload && systemctl enable --now lanying-minio`。

首次初始化桶后只允许匿名下载，不开放匿名写入、列表或控制台：`mc mb --ignore-existing local/lanying-media && mc anonymous set download local/lanying-media`。应用的 `MINIO_ACCESS_KEY` 应使用单独的最小权限账号，不能使用 Root 凭据。

COS 是可选异地备份。默认 `COS_BACKUP_ENABLED=false` 时不需要 COS 凭据；设为 `true` 后，主上传完成会同步写 COS，失败任务持久化后由下列任务重试：

```cron
*/10 * * * * /opt/lanying-jipai/deploy/media_backup_retry.sh
```

脚本按任务记录的主/备方向补偿：新任务从 MinIO 写入 COS，历史 `COS -> MinIO` 任务仍可继续完成。失败任务按指数退避保留为 `PENDING`，可手动执行 `backend/venv/bin/python -m scripts.retry_media_backups --force` 立即重试。

已有订单若保存了 COS 公网 URL，先执行 `backend/venv/bin/python -m scripts.migrate_cos_media_to_minio` 查看迁移数量；确认后加 `--apply`。脚本只处理订单媒体字段中精确匹配 `COS_PUBLIC_BASE_URL` 的对象，复制到 MinIO 成功后才更新 URL，非 COS URL 保持不变。

## 部署

`deploy.sh` 默认假设代码位于 `/opt/lanying-jipai`，且后端虚拟环境为 `backend/venv`。前端产物已预先构建时直接运行脚本；需要服务器构建时显式设置 `BUILD_FRONTEND=true`。
