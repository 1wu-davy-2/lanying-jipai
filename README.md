# 蓝鹰寄拍

蓝鹰寄拍是面向商家、达人和平台管理员的寄拍接单平台。系统覆盖从商家发单、达人抢单与交付，到商家验收、佣金结算和人工提现登记的完整业务流程。

## 主要功能

- 账号与权限：商家、达人、管理员三种角色；JWT 登录、刷新令牌、角色路由守卫与登录限流。
- 资料与认证：商家店铺资料、达人接单资料、实名认证审核；身份证号使用 AES-256-GCM 加密存储并按需掩码返回。
- 订单闭环：发布订单、抢单大厅、原子抢单、物流信息、素材提交、验收、争议、订单日志与留言板。
- 媒体上传：支持 JPG、PNG、WEBP 和 MP4，包含大小、声明类型及文件内容校验。
- 资金流水：订单验收与佣金入账同事务；提现冻结、审核、驳回退款、人工转账登记，以及可追溯的钱包流水。
- 管理能力：管理员审核认证、管理提现、监控订单并处理争议。

## 架构

```text
浏览器
  |
  +-- React 18 + TypeScript + Ant Design
  |       |  Zustand: 登录态
  |       +-- TanStack Query: 服务端数据缓存
  |
  +-- /api --> FastAPI + SQLAlchemy + Alembic --> MariaDB
  |
  +-- 媒体 --> 开发环境本地 uploads；生产环境 MinIO 媒体域名（COS 可选异地备份）
```

后端按 `router -> service -> model` 分层。订单状态转换和钱包余额变动由服务层控制；订单抢单、状态迁移和余额冻结都使用数据库条件更新，防止并发下重复抢单、重复结算或超额提现。

## 目录

```text
backend/   FastAPI API、SQLAlchemy 模型、Alembic 迁移与 pytest 用例
frontend/  React SPA、角色工作台与 Ant Design 页面
docs/      产品流程、数据库、API、前端和部署设计
deploy/    部署脚本与服务配置模板
```

## 本地运行

前置条件：Python 3.11+、Node.js 20+、MariaDB 11.4+。

1. 配置后端环境变量：复制 `backend/.env.example` 为 `backend/.env`，填入 MariaDB 连接、JWT 密钥和 AES 密钥。
2. 启动后端：

```powershell
cd backend
python -m venv .venv
.\.venv\Scripts\pip install -r requirements.txt
.\.venv\Scripts\alembic upgrade head
.\.venv\Scripts\uvicorn app.main:app --reload

# 可选：创建演示管理员、商家、达人账号
.\.venv\Scripts\python -m scripts.seed --password replace-with-demo-password
```

3. 启动前端：

```powershell
cd frontend
npm install
npm run dev
```

默认 API 地址为 `/api`。前后端分开调试时，可通过 `VITE_API_BASE_URL` 指向后端服务地址。

## 验证

```powershell
cd backend
.\.venv\Scripts\python -m pytest -q
.\.venv\Scripts\python -m scripts.verify_wallets

cd ..\frontend
npm test
npm run build
```

## 部署与设计文档

- [业务流程与状态机](docs/01-business-flow.md)
- [数据库设计](docs/02-database-design.md)
- [API 设计](docs/03-api-design.md)
- [前端设计](docs/04-frontend-design.md)
- [部署方案](docs/05-deployment.md)
- [Linux 测试部署手册](docs/09-linux-test-deployment.md)
- [执行计划](docs/06-execution-plan.md)

生产环境使用 Nginx 托管前端与上传文件，并将 `/api` 反向代理给 Gunicorn/Uvicorn。详细的环境、Nginx、systemd、备份与安全要求见部署文档。

仓库提供 `deploy/deploy.sh`、`deploy/lanying-backend.service`、`deploy/nginx.conf`、`deploy/backup.sh` 和 `deploy/healthcheck.sh` 作为生产部署模板。将健康检查脚本加入 crontab，并配置 `ALERT_WEBHOOK_URL` 后，可在服务不可用时发送基础告警。
