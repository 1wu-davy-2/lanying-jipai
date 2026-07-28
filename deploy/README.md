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

## 部署

`deploy.sh` 默认假设代码位于 `/opt/lanying-jipai`，且后端虚拟环境为 `backend/venv`。前端产物已预先构建时直接运行脚本；需要服务器构建时显式设置 `BUILD_FRONTEND=true`。
