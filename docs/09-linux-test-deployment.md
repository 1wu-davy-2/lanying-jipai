# Linux 测试部署手册

本文面向在 Linux 测试服务器上执行安装和验收的 Codex。部署目标是当前 `dev` 分支，采用原生 systemd、Gunicorn、Nginx 和 MinIO，不使用 Docker。Android SDK 不是服务器依赖；服务器只托管已经在 Windows 构建机生成的 APK。

## 1. 边界与输入

默认部署目录为 `/opt/lanying-jipai`，运行用户为 `deploy`，适用于 Ubuntu/Debian 系统。推荐准备两个已经解析到服务器公网 IP 的域名：

- `APP_DOMAIN`：网页、API 和 APK，例如 `app.example.com`。
- `MEDIA_DOMAIN`：MinIO 公共媒体，例如 `media.example.com`。

在写入 `backend/.env` 前，执行者必须向管理员索取以下值，不能从 Git、聊天记录或示例文件猜测：

- MariaDB `DATABASE_URL`，及数据库是否为空或已有迁移记录。
- `APP_DOMAIN`、`MEDIA_DOMAIN` 和 Let's Encrypt 通知邮箱。
- JWT 密钥、32 字节 Base64 AES 密钥。
- MinIO root 与应用访问凭据。
- 是否启用 COS 异地备份；未启用时保持 `COS_BACKUP_ENABLED=false`。

不要把任何真实凭据写回仓库、shell 历史、提交信息或文档。

## 2. 部署前检查

以具备 `sudo` 权限的用户执行。先确认系统版本、网络、域名解析和磁盘空间：

```bash
set -euo pipefail
uname -a
cat /etc/os-release
df -h /
free -h
getent hosts <APP_DOMAIN>
getent hosts <MEDIA_DOMAIN>
sudo ss -lntp
```

开放公网 `22`、`80`、`443`，但不要开放 `3306`、`8000`、`9000` 或 `9001`。MariaDB 若在远端，仅允许测试服务器访问它的 `3306`；MinIO 与后端仅监听本机回环地址。

安装基础依赖并确认版本。项目需要 Python 3.11+、Node 20+、Nginx、Certbot、Git、rsync 和 JDK 21（JDK 仅用于将来核验 APK，不用于本次服务器部署）：

```bash
sudo apt-get update
sudo apt-get install -y ca-certificates curl git nginx certbot python3 python3-venv python3-pip rsync
python3 --version
node --version
npm --version
nginx -v
```

若 `node --version` 小于 20，先按该发行版的受信任 Node.js 20 LTS 软件源安装，再继续。不要在系统 Python 上使用 `pip install --break-system-packages`。

## 3. 创建运行用户与拉取代码

```bash
sudo useradd --system --create-home --home-dir /home/deploy --shell /usr/sbin/nologin deploy 2>/dev/null || true
sudo install -d -o deploy -g deploy -m 0755 /opt/lanying-jipai
sudo -u deploy git clone --branch dev --single-branch https://github.com/1wu-davy-2/lanying-jipai.git /opt/lanying-jipai
sudo -u deploy git -C /opt/lanying-jipai status --short --branch
```

确认输出是 `dev...origin/dev`，且没有未提交的服务器改动。后续更新使用 `deploy/deploy.sh`，不要在服务器上直接修改已跟踪代码。

## 4. 后端、MariaDB 与前端

创建虚拟环境并安装依赖：

```bash
sudo -u deploy python3 -m venv /opt/lanying-jipai/backend/venv
sudo -u deploy /opt/lanying-jipai/backend/venv/bin/pip install --upgrade pip
sudo -u deploy /opt/lanying-jipai/backend/venv/bin/pip install -r /opt/lanying-jipai/backend/requirements.txt
```

由管理员手动创建 `/opt/lanying-jipai/backend/.env`，权限必须为 `600`。以下是结构示例，尖括号必须替换为真实值：

```dotenv
APP_ENV=production
CORS_ORIGINS=https://<APP_DOMAIN>,https://localhost,capacitor://localhost
DATABASE_URL=<管理员提供的 MariaDB URL>
JWT_SECRET_KEY=<随机高强度密钥>
AES_KEY=<32 字节 Base64 密钥>
BOOTSTRAP_ADMIN_ENABLED=true
BOOTSTRAP_ADMIN_PHONE=<管理员手机号>
BOOTSTRAP_ADMIN_PASSWORD=<首次登录后立即更改的强密码>
BOOTSTRAP_ADMIN_NICKNAME=超级管理员

UPLOAD_STORAGE_DRIVER=minio
MINIO_ENDPOINT=127.0.0.1:9000
MINIO_SECURE=false
MINIO_ACCESS_KEY=<MinIO 应用访问密钥>
MINIO_SECRET_KEY=<MinIO 应用密钥>
MINIO_BUCKET=lanying-media
MINIO_PUBLIC_BASE_URL=https://<MEDIA_DOMAIN>
COS_BACKUP_ENABLED=false

# 测试阶段保持 0，不对 debug APK 开启强制更新。
ANDROID_UPDATE_VERSION_CODE=0
```

`MINIO_SECURE=false` 是正确的：后端到同机 MinIO 使用回环 HTTP，浏览器通过 Nginx 的 `https://<MEDIA_DOMAIN>` 访问公开对象。配置完成后执行迁移和后端测试：

```bash
cd /opt/lanying-jipai/backend
sudo -u deploy ./venv/bin/alembic upgrade head
sudo -u deploy ./venv/bin/python -m pytest -q
```

构建前端并安装 systemd 服务：

```bash
sudo -u deploy npm --prefix /opt/lanying-jipai/frontend ci
sudo -u deploy npm --prefix /opt/lanying-jipai/frontend test
sudo -u deploy npm --prefix /opt/lanying-jipai/frontend run build
sudo install -d -o deploy -g deploy -m 0755 /opt/lanying-jipai/frontend-dist
sudo -u deploy rsync -a --delete /opt/lanying-jipai/frontend/dist/ /opt/lanying-jipai/frontend-dist/
sudo install -m 0644 /opt/lanying-jipai/deploy/lanying-backend.service /etc/systemd/system/lanying-backend.service
sudo systemctl daemon-reload
sudo systemctl enable --now lanying-backend
sudo systemctl status lanying-backend --no-pager
curl -fsS http://127.0.0.1:8000/api/health
```

若 MariaDB 连接失败，停止在迁移步骤，不要以 SQLite 替代生产测试数据库，也不要修改迁移文件。先由管理员修正网络白名单、数据库 URL 或帐号权限。

## 5. MinIO 主存储

安装 MinIO 二进制、服务用户和数据目录：

```bash
curl -fsSLo /tmp/minio https://dl.min.io/server/minio/release/linux-amd64/minio
sudo install -m 0755 /tmp/minio /usr/local/bin/minio
sudo useradd --system --create-home --home-dir /srv/lanying-minio --shell /usr/sbin/nologin minio 2>/dev/null || true
sudo install -d -o minio -g minio -m 0750 /srv/lanying-minio
sudo install -d -o root -g minio -m 0750 /etc/lanying-jipai
```

由管理员写入 `/etc/lanying-jipai/minio.env`，至少包含 `MINIO_ROOT_USER` 与 `MINIO_ROOT_PASSWORD`，并限制为 `root:minio`、`640`。然后安装服务：

```bash
sudo install -m 0644 /opt/lanying-jipai/deploy/lanying-minio.service /etc/systemd/system/lanying-minio.service
sudo systemctl daemon-reload
sudo systemctl enable --now lanying-minio
sudo systemctl status lanying-minio --no-pager
curl -fsSI http://127.0.0.1:9000/minio/health/live
```

安装 MinIO Client 后，用 root 帐号只做初始化。执行前由管理员在当前 shell 输入 root 凭据；不要把这两个变量写入后端 `.env` 或 shell 历史：

```bash
curl -fsSLo /tmp/mc https://dl.min.io/client/mc/release/linux-amd64/mc
sudo install -m 0755 /tmp/mc /usr/local/bin/mc
read -r -p 'MinIO root user: ' MINIO_ROOT_USER
read -r -s -p 'MinIO root password: ' MINIO_ROOT_PASSWORD; echo
sudo /usr/local/bin/mc alias set local http://127.0.0.1:9000 "$MINIO_ROOT_USER" "$MINIO_ROOT_PASSWORD"
unset MINIO_ROOT_USER MINIO_ROOT_PASSWORD
sudo /usr/local/bin/mc mb --ignore-existing local/lanying-media
sudo /usr/local/bin/mc anonymous set download local/lanying-media
```

创建只限该桶的应用帐号。将下列策略保存为临时文件 `/tmp/lanying-media-policy.json`：

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {"Effect": "Allow", "Action": ["s3:ListBucket"], "Resource": ["arn:aws:s3:::lanying-media"]},
    {"Effect": "Allow", "Action": ["s3:GetObject", "s3:PutObject", "s3:DeleteObject"], "Resource": ["arn:aws:s3:::lanying-media/*"]}
  ]
}
```

```bash
sudo /usr/local/bin/mc admin policy create local lanying-media-rw /tmp/lanying-media-policy.json
read -r -p 'MinIO app access key: ' MINIO_APP_ACCESS_KEY
read -r -s -p 'MinIO app secret key: ' MINIO_APP_SECRET_KEY; echo
sudo /usr/local/bin/mc admin user add local "$MINIO_APP_ACCESS_KEY" "$MINIO_APP_SECRET_KEY"
sudo /usr/local/bin/mc admin policy attach local lanying-media-rw --user "$MINIO_APP_ACCESS_KEY"
unset MINIO_APP_SECRET_KEY
sudo rm -f /tmp/lanying-media-policy.json
```

将应用帐号与密钥填入后端 `.env`，不要使用 MinIO root 帐号。完成后从后端上传一张测试图片，确认对象通过 `https://<MEDIA_DOMAIN>/...` 能访问且 9000/9001 未暴露公网。

## 6. TLS、Nginx 与公网入口

在复制 Nginx 模板前，先替换两个文件中的域名和证书路径：

- `deploy/nginx.conf`：`your-domain.example` 替换为 `APP_DOMAIN`。
- `deploy/nginx-media.conf`：`media.your-domain.example` 替换为 `MEDIA_DOMAIN`。

首次签发证书时，模板中的 443 证书文件尚不存在。使用 standalone 模式签发，确保 80 端口可达且 Nginx 已停止：

```bash
sudo systemctl stop nginx
sudo certbot certonly --standalone --non-interactive --agree-tos \
  --email <LETSENCRYPT_EMAIL> \
  -d <APP_DOMAIN>
sudo certbot certonly --standalone --non-interactive --agree-tos \
  --email <LETSENCRYPT_EMAIL> \
  -d <MEDIA_DOMAIN>
```

安装站点配置、检查并启动 Nginx：

```bash
sudo install -m 0644 /opt/lanying-jipai/deploy/nginx.conf /etc/nginx/sites-available/lanying-jipai
sudo install -m 0644 /opt/lanying-jipai/deploy/nginx-media.conf /etc/nginx/sites-available/lanying-media
sudo ln -sfn /etc/nginx/sites-available/lanying-jipai /etc/nginx/sites-enabled/lanying-jipai
sudo ln -sfn /etc/nginx/sites-available/lanying-media /etc/nginx/sites-enabled/lanying-media
sudo rm -f /etc/nginx/sites-enabled/default
sudo nginx -t
sudo systemctl enable --now nginx
```

完成公网验收：

```bash
curl -fI https://<APP_DOMAIN>/
curl -fsS https://<APP_DOMAIN>/api/health
curl -fI https://<MEDIA_DOMAIN>/
curl -I http://<APP_DOMAIN>/
```

最后一条必须返回 HTTPS 跳转。证书续期后应使用 `sudo certbot renew --dry-run` 验证；standalone 续期需要在续期时释放 80 端口，或改为 webroot 方式。

## 7. 已有 APK 的测试与正式发布边界

仓库工作区当前存在的 APK 是：

```text
frontend/android/app/build/outputs/apk/debug/app-debug.apk
```

它位于 `debug` 输出目录，适合安装和连通性测试，不是正式 release 工件。该文件被 Git 忽略，因此 Linux `git clone` 后不会拥有它，必须从 Windows 构建机单独传送：

```powershell
scp .\frontend\android\app\build\outputs\apk\debug\app-debug.apk `
  deploy@<SERVER_HOST>:/tmp/lanying-jipai-debug.apk
```

服务器上只将它作为测试下载文件部署，不在版本清单中启用强制更新：

```bash
sudo install -d -o deploy -g www-data -m 0750 /opt/lanying-jipai/releases/testing
sudo install -o deploy -g www-data -m 0640 /tmp/lanying-jipai-debug.apk \
  /opt/lanying-jipai/releases/testing/lanying-jipai-debug.apk
curl -fI https://<APP_DOMAIN>/releases/testing/lanying-jipai-debug.apk
```

在 Android 真机浏览器下载并安装后，先验证登录、抢单大厅、订单详情、上传和退出。测试 `debug` 包与未来的正式签名包不能互相覆盖安装；切换到正式 release APK 前需卸载 debug 包。

正式发布只接受来自可信构建机、使用固定 release keystore 签名的 APK。上传版本化文件、计算摘要、填写 `ANDROID_UPDATE_*` 后重启后端：

```bash
sha256sum /opt/lanying-jipai/releases/lanying-jipai-<VERSION>.apk
sudo systemctl restart lanying-backend
curl -fsS https://<APP_DOMAIN>/api/app-releases/android/latest
curl -fI https://<APP_DOMAIN>/releases/lanying-jipai-<VERSION>.apk
```

仅当 `ANDROID_UPDATE_VERSION_CODE` 高于已安装 release APK 的 `versionCode`，且 URL 为 HTTPS、摘要为 64 位小写 SHA-256 时，才开启强制更新。详细规则见 [`08-android-apk-release.md`](08-android-apk-release.md)。

## 8. 运行检查、更新与故障记录

每次部署后执行：

```bash
sudo systemctl is-active lanying-backend nginx lanying-minio
sudo journalctl -u lanying-backend -n 100 --no-pager
sudo journalctl -u lanying-minio -n 100 --no-pager
curl -fsS http://127.0.0.1:8000/api/health
curl -fsS https://<APP_DOMAIN>/api/health
```

以后更新代码使用：

```bash
cd /opt/lanying-jipai
sudo APP_ROOT=/opt/lanying-jipai BUILD_FRONTEND=true ./deploy/deploy.sh
```

执行者应在变更前记录当前提交、迁移版本和服务状态：

```bash
git -C /opt/lanying-jipai rev-parse HEAD
sudo -u deploy /opt/lanying-jipai/backend/venv/bin/alembic -c /opt/lanying-jipai/backend/alembic.ini current
sudo systemctl status lanying-backend nginx lanying-minio --no-pager
```

出现故障时先保留 `journalctl`、Nginx error log、当前提交和迁移版本，再判断是环境、数据库、TLS、对象存储还是应用问题。不要通过删除数据库、覆盖 APK 或重建签名 keystore 来“恢复”。
