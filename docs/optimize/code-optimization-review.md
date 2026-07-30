# 代码优化审查清单

## 范围与验证

本次审查覆盖当前工作区的 FastAPI 后端、React Web 前端、数据库迁移与部署脚本；不包含 Android 或 APK 打包产物。审查时后端 `pytest -q` 通过 46 项测试，前端 `npm test` 通过 24 项测试，`npm run build` 通过。前端测试仍存在 JSDOM/Ant Design 警告，见 R13。

## P0：立即处理

### R1. 移除版本库中的默认管理员账号和密码

默认管理员凭据同时存在于运行时配置和初始化迁移。新库会产生可预测管理员，即使之后修改环境变量，已创建的账号也不会变化。

- 证据：`backend/app/config.py`、`backend/alembic/versions/20260804_12_initial_platform_data.py`。
- 建议：改为显式运维初始化命令；生产环境默认关闭 bootstrap；拒绝弱密码；已部署环境立即轮换该账号密码。

### R2. 保护个人和支付信息的静态存储与返回字段

身份证号已加密，但支付宝账号、姓名、收货地址和手机号仍以明文保存，`/users/me` 默认会返回支付资料。

- 证据：`backend/app/models/user.py`、`backend/app/routers/users.py`。
- 建议：对敏感字段采用可轮换密钥的加密；按角色最小化 DTO；记录管理员查看、解密和导出操作。

### R3. 建立媒体资产所有权与访问分级

上传内容仅以 URL 字符串写入业务数据，服务端不验证上传者归属；本地媒体目录和生产 `/uploads/` 路径均公开访问。

- 证据：`backend/app/routers/uploads.py`、`backend/app/routers/orders.py`、`backend/app/main.py`。
- 建议：新增 `media_assets` 记录上传者、用途、对象键和状态；订单使用资产 ID；区分公开商品图与受控的作品、交付和实名资料，受控资源使用鉴权下载或短期签名 URL。

## P1：高优先级

### R4. 补全令牌刷新、撤销和登出机制

后端签发刷新令牌，前端却在任意 `401` 时清空会话；登出不产生服务端状态，泄露的刷新令牌无法提前撤销。

- 证据：`backend/app/routers/auth.py`、`frontend/src/api/client.ts`。
- 建议：实现单飞刷新、刷新令牌轮换与服务端 JTI/会话撤销；优先将刷新令牌移出 `localStorage`，采用 `HttpOnly` Cookie 时补充 CSRF 防护。

### R5. 将登录限流迁移至共享限流层

登录失败记录保存在 Python 内存中，服务重启即失效，多 Gunicorn worker 之间也不共享；随机手机号可能使字典持续增长。

- 证据：`backend/app/security.py`、`deploy/lanying-backend.service`。
- 建议：使用 Redis 或 Nginx 限流，结合 IP、手机号和接口设置 TTL、总量上限及指数退避。

### R6. 让订单承诺进入真正的服务端状态机与资金账本

素材数量、交付期限、是否回寄和押金字段已展示并持久化，但未得到完整执行：提交仅要求一份素材，未回寄订单仍要求回寄单号，押金没有冻结、退回或扣除闭环。

- 证据：`backend/app/schemas/order.py`、`backend/app/routers/orders.py`、`backend/app/services/wallet_service.py`。
- 建议：先明确押金规则；真实资金必须进入钱包流水与幂等结算；否则移除未执行的字段和界面承诺。

### R7. 补齐订单分配后的受控收货信息交付

订单被分配后商家需要寄样品，但订单详情没有向对应商家提供达人收货信息。

- 证据：`backend/app/routers/orders.py`、`backend/app/routers/users.py`。
- 建议：新增仅对已分配订单的对应商家开放的收货 DTO，并对查看行为写审计日志；不要通过通用用户接口暴露地址。

### R8. 在数据库完成订单大厅的过滤与分页

订单大厅会先读取全部 `PUBLISHED` 订单，再在 Python 内存中按 JSON 分类过滤和分页，数据增长后会拖慢接口并占用内存。

- 证据：`backend/app/routers/orders.py`。
- 建议：将分类规范化为关联表，或使用 MariaDB JSON/生成列索引；在数据库进行过滤、计数与分页；前端传递并显示分页参数。

### R9. 消除 N+1 查询并按真实查询建立复合索引

申请列表逐项查询订单，订单详情逐项查询操作人，管理员申请列表逐项计算达人状态；列表筛选和排序也主要依赖单列索引。

- 证据：`backend/app/routers/orders.py`、`backend/app/routers/admin.py`、`backend/app/services/talent_level.py`。
- 建议：使用 `selectinload`、`join` 和批量聚合；使用 `EXPLAIN` 设计 `(status, created_at)`、`(merchant_id, status, created_at)`、`(model_id, status, created_at)` 等复合索引。

### R10. 将媒体备份移出请求链路并加入任务租约

上传请求会同步创建任务、同步传输备份并多次提交事务；重试任务没有领取租约，并发 cron 可能重复处理同一对象。

- 证据：`backend/app/services/media_backup.py`、`deploy/media_backup_retry.sh`。
- 建议：请求只完成主存储和待处理任务；由 worker 用 `IN_PROGRESS` 状态、租约或 `SKIP LOCKED` 领取任务并执行退避重试，保证幂等。

## P2：计划性优化

### R11. 区分 liveness/readiness，并记录未处理异常

健康接口始终成功，部署脚本据此判定发布成功，即使数据库或媒体存储不可用；全局 500 处理器未记录异常。

- 证据：`backend/app/routers/health.py`、`backend/app/main.py`、`deploy/deploy.sh`。
- 建议：保留轻量 liveness；新增检查数据库和必需存储的 readiness；接入结构化日志、请求 ID 与错误告警。

### R12. 按角色和路由拆分前端包

工作台静态导入所有角色页面，构建结果的 Ant Design 主块约 1.25 MB，gzip 后约 394 KB，超过当前告警阈值。

- 证据：`frontend/src/pages/RoleWorkspace.tsx`、`frontend/vite.config.ts`。
- 建议：使用 `React.lazy` 和 `Suspense` 按角色、后台页面和订单详情延迟加载。

### R13. 清理前端测试噪声，保证测试失败可信

Vitest 虽然通过，但会输出 `window.getComputedStyle` 未实现和网络 `AggregateError`。当前 setup 只模拟了 `matchMedia`。

- 证据：`frontend/src/testSetup.ts`。
- 建议：补充 Ant Design/JSDOM 所需 polyfill；使用 MSW 或稳定 Axios mock；测试 QueryClient 关闭 retry 和定时 refetch；将未处理错误视为测试失败。

### R14. 统一 UTC 时间与平台配置真源

订单逾期、统计、服务时间和数据库时间混用 UTC、无时区时间与数据库默认时间；迁移插入了 `talent_portfolio_min_count`，业务规则却仍固定为 6。

- 证据：`backend/app/routers/admin.py`、`backend/app/services/talent_level.py`、`backend/alembic/versions/20260804_12_initial_platform_data.py`。
- 建议：数据库与应用统一 UTC；明确该配置是数据库驱动还是删除，避免伪配置。

## P3：工程质量

### R15. 提升依赖、迁移和部署的可复现性

Python 依赖使用范围版本，生产部署时可能解析到不同版本；话术迁移依赖仓库文档文件存在且内容未变化，精简部署包可能迁移失败。

- 证据：`backend/requirements.txt`、`backend/alembic/versions/20260803_11_script_library.py`。
- 建议：锁定 Python 依赖；CI 执行测试、Web build、迁移升级/降级与静态检查；将迁移数据随迁移或专用版本化 seed 包发布。

## 需要确认的业务前提

1. 商品样图、作品集、交付素材、实名资料中，哪些应公开，哪些必须受控访问？
2. 押金是展示信息，还是实际资金托管、退还和扣罚规则？
3. 商家应直接查看达人完整收货信息，还是由平台代寄？
