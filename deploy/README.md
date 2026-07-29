# 部署资产

这些文件是 Linux 服务器的可执行模板，部署前必须替换域名和路径，并按最小权限创建 `deploy` 用户。

## 安装

1. 将 `lanying-backend.service` 安装到 `/etc/systemd/system/`，随后执行 `systemctl daemon-reload && systemctl enable --now lanying-backend`。
2. 将 `nginx.conf` 中的 `server_name` 替换为真实域名，安装到 Nginx 站点配置后执行 `nginx -t && systemctl reload nginx`。
3. 在 `/opt/lanying-jipai/backend/.env` 配置数据库、JWT 和 AES 密钥，并限制权限为 `600`。
4. 为 `deploy.sh`、`backup.sh`、`healthcheck.sh` 增加执行权限：`chmod 750 deploy/*.sh`。

## 定时任务

使用部署专用的受限环境文件提供数据库备份变量，不要把密码写入 crontab：

```cron
0 3 * * * . /etc/lanying-jipai/backup.env && /opt/lanying-jipai/deploy/backup.sh
*/5 * * * * . /etc/lanying-jipai/health.env && /opt/lanying-jipai/deploy/healthcheck.sh
```

`backup.env` 至少包含 `MYSQL_HOST`、`MYSQL_DATABASE`、`MYSQL_USER`、`MYSQL_PASSWORD`；`health.env` 可选包含 `ALERT_WEBHOOK_URL`。两个文件均应为 `root:deploy`、权限 `640`。

## COS 与 MinIO 媒体存储

生产环境将 `backend/.env` 中的 `UPLOAD_STORAGE_DRIVER` 设为 `cos`，并填写 `COS_*` 与 `MINIO_*` 配置。COS 桶使用公有读、私有写；`COS_PUBLIC_BASE_URL` 应设置为 COS 公网域名或 CDN 域名。COS 的 SecretId/SecretKey 只能保存在 `.env`，绝不能写入前端代码或 Nginx。

每个文件先写入 COS，再以相同对象键写入内部 MinIO 桶。MinIO 不对浏览器返回 URL，也不应配置公开域名或 Nginx `location`。MinIO 桶应在部署前创建，并限制为后端服务账号可写。

`MINIO_ENDPOINT` 只填写 `host:port`，不带 `http://` 或 `https://`；是否 TLS 由 `MINIO_SECURE` 控制。为脚本增加执行权限：`chmod 750 /opt/lanying-jipai/deploy/media_backup_retry.sh`。

MinIO 必须使用与应用服务器不同的磁盘或主机；部署在同一块磁盘不能提供故障冗余。COS 子账号仅授予该桶前缀的读写权限，生产环境不要使用根账号密钥。

为失败的 MinIO 备份安装重试任务：

```cron
*/10 * * * * /opt/lanying-jipai/deploy/media_backup_retry.sh
```

脚本从 COS 读取待备份对象后写入 MinIO；成功后将数据库任务标记为 `SYNCED`。失败任务按指数退避保留为 `PENDING`，可手动执行 `backend/venv/bin/python -m scripts.retry_media_backups --force` 立即重试。

## 部署

`deploy.sh` 默认假设代码位于 `/opt/lanying-jipai`，且后端虚拟环境为 `backend/venv`。前端产物已预先构建时直接运行脚本；需要服务器构建时显式设置 `BUILD_FRONTEND=true`。
