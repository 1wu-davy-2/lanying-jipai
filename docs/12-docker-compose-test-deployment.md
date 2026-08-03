# Docker Compose 测试环境部署

本方案只发布达人端和管理端。访问 `/` 会进入 `/entry`，可继续前往达人登录/注册或管理端登录；介绍官网不在应用路由中。Compose 只运行前后端，不创建 MariaDB 或 MinIO 容器；数据库和对象存储使用现有外部服务。Docker 对外只发布前端 `0.0.0.0:5173`，浏览器经同源 `/api` 访问后端，后端端口不暴露到宿主机。

## 1. 前置条件

在 Linux 安装 Docker Engine 和 Compose plugin，确认：

```bash
docker compose version
git --version
```

拉取代码后，根目录只需创建一份 `.env`。不要复制或填写 `backend/.env`，Compose 会把根目录配置传给后端容器。`DATABASE_URL` 必须指向已有的 MariaDB，`MINIO_*` 必须指向已有的 MinIO。注意容器内的 `127.0.0.1` 指向后端容器自身；外部服务在宿主机或另一台机器时，应填写容器可达的内网地址。

```bash
cd /opt/lanying-jipai
cp .env.example .env
chmod 600 .env
```

编辑 `.env` 中的 `DATABASE_URL`、MinIO 配置、JWT、AES 和首次管理员信息。生成密钥：

```bash
openssl rand -hex 32        # JWT_SECRET_KEY
openssl rand -base64 32     # AES_KEY，必须保留末尾 =
```

`CORS_ORIGINS` 保留本机 `5173` 地址即可，因为网页和 API 同源；只有 Android 或独立前端域名访问 API 时才追加对应来源。

## 2. 启动与验收

```bash
docker compose up -d --build
docker compose ps
curl -fsS http://127.0.0.1:5173/api/health
```

首次启动会连接已有 MariaDB，执行 Alembic 迁移并创建配置的管理员账户。验收页面：`http://<服务器IP>:5173/entry`、`/talent/login`、`/talent/register`、`/admin/login`。上传的图片和 MP4 由前端容器转发到后端，再写入外部 MinIO，最大请求体为 25 MB，符合当前 20 MB 视频限制。

排查日志：

```bash
docker compose logs -f backend
docker compose logs -f frontend
docker compose exec backend alembic current
```

## 3. 更新与数据

```bash
git pull --ff-only
docker compose up -d --build
```

`uploads_data` 是本地存储回退用的命名卷；使用 MinIO 时媒体文件写入外部对象存储。对公网开放前，应由宿主机或上游反向代理提供 HTTPS；不要将 `3306`、`8000` 或 MinIO 的 `9000/9001` 端口直接映射到公网。
