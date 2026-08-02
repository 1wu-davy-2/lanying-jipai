# Linux 测试环境部署手册（达人端与管理端）

本文用于把当前 `dev` 分支部署到 Ubuntu/Debian 测试 Linux。部署内容只包含达人端与管理端业务入口，不发布介绍官网：访问 `/` 会自动进入 `/entry`，用户可选择达人登录/注册或运营管理端登录。

## 1. 服务组成

| 组件 | 作用 | 默认地址 |
| --- | --- | --- |
| FastAPI + Gunicorn | 订单、履约、用户、钱包和管理 API | `127.0.0.1:8000` |
| Nginx | HTTPS、静态前端、`/api/` 反向代理 | `443` |
| MariaDB | 业务数据库 | `3306`，不要暴露公网 |
| MinIO（推荐） | 图片和视频对象存储 | `127.0.0.1:9000` |

主要页面：

- `/entry`：达人端与管理端入口
- `/talent/login`、`/talent/register`：达人登录和注册
- `/model/hall`：达人抢单大厅（登录后）
- `/admin/login`：运营管理端登录
- `/admin/operations`：管理端发布订单、申请审核和履约运营

介绍官网源码仍保留在前端目录，但已经从应用路由剥离，不会从 `/` 访问到。

## 2. 服务器准备

建议配置：2 vCPU、4 GB RAM、Ubuntu 22.04+，开放 `22/80/443`，不开放 `3306/8000/9000/9001`。

```bash
sudo apt-get update
sudo apt-get install -y ca-certificates curl git nginx python3 python3-venv python3-pip rsync mariadb-client
python3 --version       # 3.11+
node --version          # 构建前端需要 Node 20+
npm --version
```

创建运行用户并拉取代码：

```bash
sudo useradd --system --create-home --home-dir /home/deploy --shell /usr/sbin/nologin deploy 2>/dev/null || true
sudo install -d -o deploy -g deploy -m 0755 /opt/lanying-jipai
sudo -u deploy git clone --branch dev --single-branch <GIT_URL> /opt/lanying-jipai
```

已有代码时只执行：

```bash
sudo -u deploy git -C /opt/lanying-jipai pull --ff-only
```

## 3. MariaDB 与后端配置

先用 MariaDB 管理账户创建测试库和专用账号：

```sql
CREATE DATABASE lanying_jipai CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
CREATE USER 'lanying_app'@'127.0.0.1' IDENTIFIED BY '<strong-password>';
GRANT ALL PRIVILEGES ON lanying_jipai.* TO 'lanying_app'@'127.0.0.1';
FLUSH PRIVILEGES;
```

安装后端依赖：

```bash
cd /opt/lanying-jipai/backend
sudo -u deploy python3 -m venv venv
sudo -u deploy venv/bin/pip install --upgrade pip
sudo -u deploy venv/bin/pip install -r requirements.txt
```

创建 `/opt/lanying-jipai/backend/.env`，不要提交 Git，权限必须为 `600`：

```dotenv
APP_ENV=production
CORS_ORIGINS=https://<APP_DOMAIN>
DATABASE_URL=mysql+pymysql://lanying_app:<URL_ENCODED_PASSWORD>@127.0.0.1:3306/lanying_jipai?charset=utf8mb4
JWT_SECRET_KEY=<random-long-secret>
AES_KEY=<32-byte-base64-key>
UPLOADS_DIR=/opt/lanying-jipai/backend/uploads

# 单机测试可用 local；多人测试或大文件建议改为 minio。
UPLOAD_STORAGE_DRIVER=local
BOOTSTRAP_ADMIN_ENABLED=true
BOOTSTRAP_ADMIN_PHONE=<admin-phone>
BOOTSTRAP_ADMIN_PASSWORD=<temporary-strong-password>
BOOTSTRAP_ADMIN_NICKNAME=测试管理员
ANDROID_UPDATE_VERSION_CODE=0
```

```bash
sudo chown deploy:deploy /opt/lanying-jipai/backend/.env
sudo chmod 600 /opt/lanying-jipai/backend/.env
sudo -u deploy /opt/lanying-jipai/backend/venv/bin/alembic -c /opt/lanying-jipai/backend/alembic.ini upgrade head
sudo -u deploy /opt/lanying-jipai/backend/venv/bin/python -m pytest -q
```

首次登录管理端后立即修改 bootstrap 管理员密码。MinIO 配置见 [`deploy/README.md`](../deploy/README.md)。

## 4. 启动后端 systemd

```bash
sudo install -m 0644 /opt/lanying-jipai/deploy/lanying-backend.service /etc/systemd/system/lanying-backend.service
sudo systemctl daemon-reload
sudo systemctl enable --now lanying-backend
sudo systemctl status lanying-backend --no-pager
curl -fsS http://127.0.0.1:8000/api/health
```

健康检查应返回 `code=0` 且 `data.status=healthy`。启动失败时查看：

```bash
sudo journalctl -u lanying-backend -n 100 --no-pager
```

## 5. 构建前端

浏览器版通过 Nginx 访问 `/api/`，不需要设置 `VITE_API_BASE_URL`：

```bash
cd /opt/lanying-jipai/frontend
sudo -u deploy npm ci
sudo -u deploy npm test -- --run
sudo -u deploy npm run build
sudo install -d -o deploy -g deploy -m 0755 /opt/lanying-jipai/frontend-dist
sudo -u deploy rsync -a --delete dist/ /opt/lanying-jipai/frontend-dist/
```

不要把 `node_modules`、`.env` 或源码测试文件复制到 Nginx 静态目录。

## 6. Nginx 与 HTTPS

复制 `deploy/nginx.conf`，替换：

- `server_name your-domain.example` 为 `<APP_DOMAIN>`
- `ssl_certificate` 和 `ssl_certificate_key` 为测试域名证书路径
- 保留 `try_files $uri $uri/ /index.html`，否则刷新 `/model/*` 或 `/admin/*` 会 404

```bash
sudo install -m 0644 /opt/lanying-jipai/deploy/nginx.conf /etc/nginx/sites-available/lanying-jipai
sudo sed -i 's/your-domain.example/<APP_DOMAIN>/g' /etc/nginx/sites-available/lanying-jipai
sudo ln -sfn /etc/nginx/sites-available/lanying-jipai /etc/nginx/sites-enabled/lanying-jipai
sudo rm -f /etc/nginx/sites-enabled/default
sudo nginx -t
sudo systemctl enable --now nginx
sudo systemctl reload nginx
```

验收入口和 API：

```bash
curl -fI http://<APP_DOMAIN>/
curl -fsS https://<APP_DOMAIN>/api/health
curl -fI https://<APP_DOMAIN>/entry
curl -fI https://<APP_DOMAIN>/talent/login
curl -fI https://<APP_DOMAIN>/admin/login
```

HTTP 应跳转 HTTPS；若测试环境暂时没有证书，应先为测试域名签发证书或使用内部 CA，不要把生产密码通过 HTTP 传输。

## 7. 一键更新

确认服务器工作区没有本地改动后：

```bash
cd /opt/lanying-jipai
sudo APP_ROOT=/opt/lanying-jipai BUILD_FRONTEND=true ./deploy/deploy.sh
```

脚本会执行 `git pull --ff-only`、安装后端依赖、执行 Alembic 迁移、构建前端、同步 `frontend-dist`、重启后端并检查 `/api/health`。`deploy/*.sh` 已使用 LF 换行，上传 Linux 前不要转换回 CRLF。

## 8. 发布验收清单

- [ ] `/` 自动进入 `/entry`，不显示介绍官网
- [ ] 达人登录、注册、订单大厅和移动端底部导航正常
- [ ] 达人可以申请订单、查看履约、上传图片/MP4、提交返货物流
- [ ] 管理员可以发布订单、审核申请、处理返图/争议/提现
- [ ] `curl -fsS https://<APP_DOMAIN>/api/health` 返回健康
- [ ] 图片和 MP4 上传后可以预览
- [ ] `sudo systemctl is-active lanying-backend nginx` 返回 `active`
- [ ] `sudo nginx -t` 通过，后端日志无启动异常

## 9. 常见故障

| 现象 | 检查 |
| --- | --- |
| 刷新 `/model/*` 或 `/admin/*` 404 | Nginx 是否保留 `try_files ... /index.html` |
| 页面能开但 API 失败 | 检查 `/api/health`、`proxy_pass` 和 `CORS_ORIGINS` |
| 后端启动失败 | `journalctl -u lanying-backend`，重点检查 `.env`、数据库 URL 和 AES key |
| 上传失败 | 检查 `UPLOAD_STORAGE_DRIVER`、`uploads` 权限；MinIO 模式检查 bucket 和公有 URL |
| 迁移失败 | 检查数据库账号权限和 `alembic current`，不要直接删除数据库重试 |

不要在测试服务器提交真实密码、JWT/AES 密钥、MinIO root 凭据或用户媒体文件。
