# 部署方案（Linux 云服务器）

## 1. 前提假设

以下按「单台 Linux 云服务器（如 Ubuntu 22.04/CentOS/Alibaba Cloud Linux 均可）+ 已有或新装 MariaDB 11.4.12」来设计。如果 MariaDB 是独立的云数据库实例（如阿里云 RDS），把下文「本机 MariaDB」替换为对应的连接地址即可，架构不变。

## 2. 服务器软件清单

| 软件 | 用途 |
|---|---|
| Python 3.11+ | 运行后端 |
| Nginx | 反向代理 + 静态文件托管 + HTTPS |
| MariaDB 11.4.12 | 数据库 |
| systemd | 管理后端进程（开机自启、崩溃重启） |
| certbot | 申请/续期 Let's Encrypt 免费 HTTPS 证书（需要域名） |
| Node.js（仅构建时需要，可在本机/CI 构建后上传 dist，不必装在服务器） | 构建前端静态文件 |

## 3. 部署目录规划

```
/opt/lanying-jipai/
  backend/                  # 后端代码（git clone 或 CI 产物）
    venv/                     # Python 虚拟环境
    .env                       # 环境变量（数据库密码、JWT 密钥等，权限 600，不进 git）
    uploads/                    # 用户上传文件
  frontend-dist/             # 前端构建产物（npm run build 后的 dist 内容）
/var/log/lanying-jipai/
  backend.log                # 应用日志（或用 systemd journal）
```

## 4. 后端部署步骤

1. 服务器创建部署用户（不用 root 跑服务），如 `deploy`。
2. `git clone` 代码到 `/opt/lanying-jipai`，后端目录为 `/opt/lanying-jipai/backend`。
3. 创建虚拟环境并安装依赖：
   ```bash
   python3.11 -m venv venv
   ./venv/bin/pip install -r requirements.txt gunicorn uvicorn[standard]
   ```
4. 配置 `.env`（数据库连接串、JWT_SECRET、AES 加密密钥、上传目录路径等），权限设为 `600`。
5. 执行数据库迁移：`./venv/bin/alembic upgrade head`。
6. 复制仓库中的 `deploy/lanying-backend.service` 到 `/etc/systemd/system/lanying-backend.service`，确认 `User`、路径和虚拟环境名称与服务器一致：
   ```ini
   [Unit]
   Description=Lanying Jipai Backend
   After=network.target mariadb.service

   [Service]
   User=deploy
   WorkingDirectory=/opt/lanying-jipai/backend
   EnvironmentFile=/opt/lanying-jipai/backend/.env
   ExecStart=/opt/lanying-jipai/backend/venv/bin/gunicorn app.main:app \
       -k uvicorn.workers.UvicornWorker \
       -w 4 \
       -b 127.0.0.1:8000 \
       --access-logfile /var/log/lanying-jipai/access.log \
       --error-logfile /var/log/lanying-jipai/error.log
   Restart=always
   RestartSec=5

   [Install]
   WantedBy=multi-user.target
   ```
7. `systemctl daemon-reload && systemctl enable --now lanying-backend`。

## 5. 前端部署步骤

1. 本机或 CI 执行 `npm run build`，产出 `dist/`。
2. 把 `dist/` 内容上传到服务器 `/opt/lanying-jipai/frontend-dist/`（用 `scp`/`rsync`，避免在生产服务器上直接 `npm install` 增加攻击面和依赖体积，除非资源允许）。

## 6. Nginx 配置

```nginx
server {
    listen 80;
    server_name your-domain.com;

    location / {
        root /opt/lanying-jipai/frontend-dist;
        try_files $uri $uri/ /index.html;
    }

    location /api/ {
        proxy_pass http://127.0.0.1:8000/api/;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        client_max_body_size 20m;  # 允许上传较大的拍摄素材
    }

    location /uploads/ {
        alias /opt/lanying-jipai/backend/uploads/;
    }

    # APP_ENV=production 时应用已禁用 /docs、/redoc 和 /openapi.json。
    # Nginx 模板同时返回 404，形成双层保护。
}
```

后续用 `certbot --nginx` 一键升级到 443 HTTPS 并配置自动续期。除 `/api/health` 和 `/api/auth/*` 外，现有 API 均要求登录；抢单大厅也要求达人登录。

## 7. MariaDB 配置要点

- 建议新建专用数据库和账号，不用 root：
  ```sql
  CREATE DATABASE lanying_jipai CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
  CREATE USER 'lanying_app'@'127.0.0.1' IDENTIFIED BY '<强密码>';
  GRANT ALL PRIVILEGES ON lanying_jipai.* TO 'lanying_app'@'127.0.0.1';
  FLUSH PRIVILEGES;
  ```
- 若 MariaDB 和后端在同一台机器，`bind-address` 保持 `127.0.0.1`，不对公网暴露 3306 端口。若分离部署，务必配置防火墙白名单仅放行后端服务器 IP，并考虑开启 TLS 连接。
- 定时备份：`mysqldump` + crontab 每日打包上传到对象存储或异地服务器，资金相关数据（wallets/wallet_transactions/withdrawals）备份优先级最高。

## 8. 安全清单（部署阶段必须落实）

- [ ] `.env` 文件权限 600，不提交到 git（`.gitignore` 加 `.env`）
- [ ] JWT_SECRET、AES 加密密钥用随机生成的高强度字符串，两个环境（开发/生产）不复用同一密钥
- [ ] 数据库账号最小权限，不用 root 账号连接
- [ ] 3306/8000 端口不对公网开放，只经 Nginx 转发
- [ ] HTTPS 强制（HTTP 自动跳转 HTTPS）
- [ ] 管理员账号首次登录强制修改初始密码
- [ ] 身份证号等敏感字段加密存储+接口返回掩码（见 02-database-design.md）
- [ ] 登录接口限流防暴力破解
- [ ] 上传文件类型/大小校验，防任意文件上传导致的安全问题

## 9. CI/CD（MVP 阶段简化版）

MVP 阶段不强制上完整 CI/CD 流水线，先用最小手动/半自动流程：

1. 本地开发通过后，push 到 git 仓库（GitHub/Gitee/自建 Gitlab）。
2. 服务器上 `git pull` + 后端 `alembic upgrade head` + `systemctl restart lanying-backend`；前端本地 build 后 `rsync` 上传替换 `frontend-dist`。
3. 使用仓库提供的 `deploy/deploy.sh` 脚本把上述步骤脚本化，减少手动出错。部署、备份和监控变量及 cron 示例见 [`deploy/README.md`](../deploy/README.md)。

后续订单量/团队规模上来后，可以升级为 GitHub Actions 自动构建+部署，这里先不做，避免过度设计。

## 10. 本模块执行清单

- [ ] 准备服务器（系统更新、创建 deploy 用户、安装 Python/Nginx/MariaDB/certbot）- 需在真实服务器执行
- [ ] 配置 MariaDB 专用账号和数据库 - 需在真实 MariaDB 执行
- [x] 编写 `deploy/deploy.sh` 脚本与部署模板
- [x] 提供 systemd 服务模板；开机自启、崩溃自动重启需在真实服务器验证
- [x] 提供 Nginx 模板；HTTPS 证书申请需绑定真实域名后执行
- [x] 提供数据库定时备份与健康检查脚本、crontab 示例
- [ ] 走一遍安全清单 - 需在生产环境逐项验收
