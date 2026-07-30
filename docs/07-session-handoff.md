# 会话交接记录：MinIO 主存储、达人移动端与 Android

> 用途：这是当前开发会话的结构化续接记录。回家后可直接打开本文件，或在新会话中引用它继续提问。
>
> 范围：记录需求、已完成实现、验证、部署和遗留事项。不会保存平台无法导出的逐字工具输出、登录凭证、访问密钥或本地 `.env` 内容。

## 当前状态

- 分支：`dev`
- 已推送提交：`3d78c98 feat: add minio primary media and talent mobile app`
- 远端：`origin/dev`
- 创建 PR：<https://github.com/1wu-davy-2/lanying-jipai/pull/new/dev>
- 本地工作区：业务代码干净；`.idea/` 为未跟踪的本地 IDE 配置，未提交。
- 本地网页服务：`http://127.0.0.1:5180/`
- 本地后端服务：`http://127.0.0.1:8002/api/health`

## 原始需求与已确认决策

用户提出：

1. 已切换到 `dev` 分支，媒体存储改为直接使用 MinIO。
2. 保留腾讯云 COS，以便未来切换或作为备份。
3. MinIO 将部署在用户自己的服务器上，服务器网络带宽最高为 12.5 Gbps。
4. 达人端需要支持手机网页，网页同时兼容原有业务模式与达人模式。
5. 需要 Android App。

本次采用的决策：

- MinIO 是生产主存储；应用上传后首先写入 MinIO。
- COS 保留为可选的异步备份。默认关闭，只有设置 `COS_BACKUP_ENABLED=true` 才会启用。
- 原有 COS 主存储实现没有删除，可通过 `UPLOAD_STORAGE_DRIVER=cos` 回退。
- MinIO 服务绑定服务器回环地址，由 Nginx 暴露 HTTPS 媒体域名，不直接公开 9000/9001 端口。
- 达人移动网页采用响应式布局；Android 使用 Capacitor WebView，构建时固定进入达人模式。

## 已完成的后端实现

### 存储与备份

- `backend/app/services/media_storage.py`
  - 新增 `MinioCosMediaStorage`：MinIO 主存储、COS 可选备份。
  - 上传 URL 通过 `MINIO_PUBLIC_BASE_URL` 生成，路径会 URL 编码。
  - 在 `COS_BACKUP_ENABLED=false` 时，不要求 COS 配置，也不会初始化 COS 客户端。
  - 保留原 `CosMinioMediaStorage`，支持 COS 主存储与 MinIO 备份的旧模式。
  - 新增按备份任务方向恢复存储实例的逻辑，避免切换主存储后重试旧任务时方向错误。

- `backend/app/services/media_backup.py`
  - 备份任务保存 `primary_storage` 与 `backup_storage`。
  - 新上传任务按当前实际方向创建备份记录。
  - 重试任务按任务保存的方向执行，因此历史 COS -> MinIO 任务和新 MinIO -> COS 任务可以共存。

- `backend/app/models/media.py`
  - `MediaBackupJob` 增加主存储和备份存储字段。

- `backend/alembic/versions/20260731_08_media_backup_directions.py`
  - 新增数据库迁移，给历史备份任务赋予 `cos` -> `minio` 方向。

- `backend/scripts/migrate_cos_media_to_minio.py`
  - 历史 URL 迁移工具。
  - 默认 dry-run；使用 `--apply` 才会上传 COS 对象并在成功后改写数据库 URL。
  - 只处理精确匹配 COS 公共 URL 前缀的媒体地址；支持 `--limit`。

### 配置与跨域

- `backend/app/config.py` 新增 `MINIO_PUBLIC_BASE_URL`、`COS_BACKUP_ENABLED` 和 `CORS_ORIGINS` 配置。
- `backend/app/main.py` 配置显式 CORS 来源，包含 `https://localhost` 和 `capacitor://localhost`，用于 Capacitor Android WebView。
- `backend/.env.example` 默认以 MinIO 为主存储，同时保留 COS 配置说明。

## 已完成的部署配置

- `deploy/lanying-minio.service`
  - systemd 服务模板：以 `minio` 用户运行，数据目录 `/srv/lanying-minio`。
  - MinIO API/Console 仅监听 `127.0.0.1:9000` / `127.0.0.1:9001`。

- `deploy/nginx-media.conf`
  - Nginx 媒体域名代理模板，支持 Range 请求和 30 天媒体缓存。
  - 部署前必须替换 `server_name`。
  - 默认代理 bucket `lanying-media`；若 `MINIO_BUCKET` 改名，必须同步修改此文件。

- `deploy/README.md`
  - 已补充 MinIO 安装、bucket 初始化、Nginx、应用环境变量、COS 备份、历史迁移和 CORS 的部署步骤。

部署时需要的关键环境变量示例：

```dotenv
UPLOAD_STORAGE_DRIVER=minio
MINIO_ENDPOINT=127.0.0.1:9000
MINIO_ACCESS_KEY=<应用专用最小权限账号>
MINIO_SECRET_KEY=<密钥>
MINIO_BUCKET=lanying-media
MINIO_SECURE=false
MINIO_PUBLIC_BASE_URL=https://media.example.com
COS_BACKUP_ENABLED=false
CORS_ORIGINS=https://app.example.com,https://localhost,capacitor://localhost
```

说明：示例中的 MinIO 是通过本机 HTTP 访问，由 Nginx 对外提供 HTTPS。不要用 MinIO root 账号作为应用账号；应建立只拥有目标 bucket 权限的专用账号。

## 已完成的前端与 Android 实现

### 达人移动网页

- `frontend/src/pages/RoleWorkspace.tsx`
  - 达人模式新增手机顶部栏和固定底部导航：抢单、订单、钱包、我的。
  - 移动端退出登录返回 `/talent/login`，其他角色保持 `/login`。

- `frontend/src/pages/orders/ModelOrdersPage.tsx`
  - 桌面端保留订单表格；手机端切换为可点击的订单卡片。

- `frontend/src/styles.css`
  - 小于等于 760px 时，达人端隐藏桌面侧栏/顶部栏，使用移动导航。
  - 抢单大厅、订单详情和订单列表适配单列显示；无法卡片化的表格保留横向滚动能力。

### Capacitor Android

- 已安装并锁定 Capacitor 8：`@capacitor/core`、`@capacitor/android`、`@capacitor/cli`。
- `frontend/capacitor.config.ts`
  - App ID：`com.lanying.jipai`
  - App 名称：`蓝影寄拍`
  - Android scheme：`https`

- `frontend/android/`
  - 已生成完整 Android 原生工程；Manifest 含 `INTERNET` 权限。

- `frontend/.env.android.example`
  - Android 构建必须提供 `VITE_API_BASE_URL` 与 `VITE_APP_MODE=talent`。

- `frontend/vite.config.ts`
  - `android` 构建模式缺失 API 地址会直接失败，避免生成指向错误后端的 App。

- `frontend/src/App.tsx`
  - `VITE_APP_MODE=talent` 时，根路径进入达人抢单大厅，未登录用户进入达人登录页。

- `frontend/package.json` 可用命令：

```bash
npm run build:android
npm run android:sync
npm run android:open
```

详细操作见 `frontend/ANDROID.md`。

## 已完成验证

| 范围 | 结果 |
| --- | --- |
| 后端测试 | `35 passed` |
| 前端测试 | `10 passed` |
| 数据库迁移 | 已到达 `20260731_08 (head)` |
| 标准 Web 构建 | 成功；仅有 Ant Design 产物体积提示 |
| Android Web 资源同步 | `npm run android:sync` 成功 |
| 后端健康检查 | `GET /api/health` 返回 200 |
| Capacitor CORS 预检 | 来自 `https://localhost` 的 OPTIONS 返回 200，允许 GET/POST/PUT/OPTIONS |
| Vite 代理 | `http://127.0.0.1:5180/api/health` 返回 200 |
| Git 空白检查 | `git diff --check` 和暂存检查通过 |

## 尚未完成或需注意的事项

1. 本机没有 Android SDK、`adb` 和全局 Gradle，因此未实际执行原生 APK/AAB 构建。Java 17 已存在，Android Studio 安装 SDK 后可打开 `frontend/android/` 构建。
2. `npm audit --omit=dev` 对当前 registry 的 `react-router-dom@7.18.2` 仍报告 2 个高危 RSC 相关告警。项目是 BrowserRouter SPA，未使用 React Router RSC/Server Actions；降级会引入更多旧依赖告警，因此本次没有进行与需求无关的路由迁移。
3. MinIO 的真实生产部署、DNS、TLS 证书、bucket 访问策略和专用应用账号需要在服务器上完成。
4. 迁移历史 COS 媒体前，先运行 dry-run 并备份生产数据库；只在验证输出正确后使用 `--apply`。
5. 线上环境切换 MinIO 前，需要执行 `alembic upgrade head`。

## 继续工作时的建议顺序

1. 在服务器部署 MinIO、Nginx 和应用环境变量，先验证一个新上传文件能通过 HTTPS 媒体域名访问。
2. 决定是否启用 `COS_BACKUP_ENABLED=true`；开启后确认 COS 专用账号只具有必要的写入权限。
3. 在预生产环境 dry-run 历史 COS URL 迁移，然后小批量 `--apply` 验证。
4. 安装 Android SDK，在 Android Studio 里运行真机/模拟器测试登录、媒体上传、订单流和返回行为。
5. 根据真实网络与 MinIO 磁盘吞吐，设置上传大小限制、备份重试与监控告警。

## 继续提问可直接使用的上下文

可直接把下面这段发送到新会话：

```text
请读取 docs/07-session-handoff.md。项目在 dev 分支，已提交并推送 3d78c98。
当前是 MinIO 主存储、COS 可选异步备份；达人端有移动网页和 Capacitor Android 工程。
请基于该交接记录继续处理：<在这里写新的问题>。
```

## Git 推送备注

当前环境首次使用 Windows Schannel 推送 GitHub 时出现 TLS 握手失败；以下单次命令成功推送了 `dev`：

```bash
git -c http.sslBackend=openssl push -u origin dev
```

该选项只作用于该次命令，未修改全局 Git TLS 配置，也未关闭证书校验。

## 2026-07-30 补充：平台初始化与管理端话术库

- 管理端新增“话术库”菜单与 `/admin/scripts` 页面：按分类查看话术文档，支持文档搜索、12 个章节目录检索、话术全文检索、每页 6 条分页和一键复制。
- 后端新增管理员话术库接口：`GET /api/admin/scripts/categories`、`GET /api/admin/scripts`、`GET /api/admin/scripts/{id}`；全部要求 `admin` 角色。
- 新增 `20260804_12_initial_platform_data` 迁移，初始化默认管理员 `1111111112 / admin@123`、平台名称以及最少 6 张作品照配置。应用启动也会在已完成建表的数据库中补建该管理员，但不会覆盖既有密码。
- `backend/sql/init-mariadb.sql` 由 `python -m scripts.export_mariadb_init_sql` 从 Alembic 生成，包含完整表结构、初始管理员、平台配置和全部话术库数据。全新 MariaDB 可直接导入；已有库应执行 `alembic upgrade head`。
- 修复 `order_applications` 在 MariaDB 下的外键 ID 类型，使其与 `users`、`orders` 的 `BIGINT` 主键一致。
- 本轮验证：后端 `46 passed`，前端 `26 passed`，`npm run build` 成功，`POST /api/auth/login` 使用默认管理员返回 200。
