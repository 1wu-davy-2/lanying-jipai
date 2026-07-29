# 后端 API 设计（FastAPI）

## 1. 工程结构

```
backend/
  app/
    main.py                # FastAPI app 入口，挂路由、中间件、异常处理
    config.py               # 环境变量配置（Pydantic Settings）
    database.py             # SQLAlchemy engine/session
    deps.py                  # 依赖注入：get_db, get_current_user, require_role(...)
    security.py              # 密码哈希、JWT 编解码、AES 加解密工具
    models/                  # SQLAlchemy ORM 模型
      user.py / order.py / wallet.py / withdrawal.py ...
    schemas/                 # Pydantic 请求/响应模型
      user.py / order.py / wallet.py ...
    routers/
      auth.py                # 注册/登录/刷新 token
      users.py                # 个人资料、实名认证
      orders.py                # 订单发布/抢单/流转
      wallets.py                # 钱包余额、流水
      withdrawals.py             # 提现申请/审核/登记转账
      admin.py                    # 管理员专用（用户管理、争议仲裁、统计）
    services/                  # 业务逻辑层（状态机校验、结算事务等），路由层只做参数校验+调用service
      order_service.py
      wallet_service.py
    utils/
      order_no.py               # 订单号/提现单号生成
  alembic/                     # 数据库迁移
  tests/                       # pytest 测试
  requirements.txt
  .env.example
```

分层原则：**router 负责 HTTP 层（校验入参、权限依赖、组装响应）**，**service 负责业务逻辑和数据库事务**，避免把状态机判断散落在路由函数里。

## 2. 鉴权与权限

- 登录成功返回 `access_token`（30 分钟过期）+ `refresh_token`（7 天过期），前端存 `access_token` 在内存/localStorage，`refresh_token` 用于静默续期。
- `deps.get_current_user`：从 `Authorization: Bearer <token>` 解析出当前用户。
- `deps.require_role("merchant")` / `require_role("model")` / `require_role("admin")`：路由级角色校验，角色不匹配返回 403。
- 密码用 `bcrypt` 哈希存储，登录接口对同一手机号做基础的失败次数限流（防暴力破解），MVP 阶段用简单的内存+滑动窗口或数据库字段记录失败次数和锁定截止时间。

## 3. 统一响应格式

```json
{
  "code": 0,
  "message": "ok",
  "data": { ... }
}
```

- `code != 0` 表示业务错误，`message` 是给前端展示的中文提示，HTTP 状态码仍按语义使用（400/401/403/404/409/500）。
- 分页统一用 `{ "items": [...], "total": 100, "page": 1, "page_size": 20 }`。

## 4. 接口清单

### 4.1 认证 `/api/auth`

| 方法 | 路径 | 说明 | 权限 |
|---|---|---|---|
| POST | /api/auth/register | 注册（手机号+密码+角色，商家/达人自主注册；admin 账号不开放注册，由数据库种子或已有管理员创建） | 公开 |
| POST | /api/auth/login | 登录，返回 token | 公开 |
| POST | /api/auth/refresh | 刷新 access_token | 需 refresh_token |
| POST | /api/auth/logout | 登出（前端清 token，后端可选加黑名单） | 登录用户 |

### 4.2 用户资料 `/api/users`

| 方法 | 路径 | 说明 | 权限 |
|---|---|---|---|
| GET | /api/users/me | 获取当前登录用户信息+对应角色资料 | 登录用户 |
| PUT | /api/users/me | 更新昵称/头像/联系方式等基础信息 | 登录用户 |
| PUT | /api/users/me/merchant-profile | 更新商家资料（店铺名、寄件地址等） | merchant |
| PUT | /api/users/me/model-profile | 更新达人资料（三维、收货地址、作品集） | model |
| POST | /api/users/me/verify | 提交实名认证资料（真实姓名、身份证号、支付宝账号） | merchant/model |
| GET | /api/users/me/talent-status | 获取达人资料完整度、认证状态和当前等级接单额度 | model |
| GET | /api/users/model-ranking | 获取平台演示热榜和真实达人成交榜 | model |
| GET | /api/admin/users | 用户列表，支持按角色/状态/关键字筛选分页 | admin |
| PUT | /api/admin/users/{id}/status | 封禁/启用账号 | admin |
| PUT | /api/admin/users/{id}/verify | 审核实名认证（通过/驳回+原因） | admin |

### 4.3 订单 `/api/orders`

| 方法 | 路径 | 说明 | 权限 |
|---|---|---|---|
| POST | /api/orders | 商家发布订单 | merchant |
| GET | /api/orders/hall | 抢单大厅列表（status=PUBLISHED，支持分页/筛选） | model |
| POST | /api/orders/{id}/claim | 抢单（资料完成、实名认证通过、等级额度校验及原子更新） | model |
| GET | /api/orders | 我的订单列表（商家看自己发布的，达人看自己抢的，按 status 筛选） | merchant/model |
| GET | /api/orders/{id} | 订单详情 | 订单双方 + admin |
| PUT | /api/orders/{id}/ship | 商家填寄件单号，状态 CLAIMED→SHIPPED_TO_MODEL | merchant（订单所有者） |
| PUT | /api/orders/{id}/receive | 达人确认收货，SHIPPED_TO_MODEL→IN_PROGRESS | model（订单所有者） |
| PUT | /api/orders/{id}/submit | 达人上传素材+寄回单号，IN_PROGRESS→RETURNED | model（订单所有者） |
| PUT | /api/orders/{id}/accept | 商家验收通过，RETURNED→COMPLETED（触发结算） | merchant（订单所有者） |
| PUT | /api/orders/{id}/reject | 商家验收不通过+原因，RETURNED→DISPUTED | merchant（订单所有者） |
| PUT | /api/orders/{id}/cancel | 商家撤回未被抢的订单，PUBLISHED→CANCELLED | merchant（订单所有者） |
| POST | /api/orders/{id}/messages | 发留言 | 订单双方 |
| GET | /api/orders/{id}/messages | 留言列表 | 订单双方 + admin |
| GET | /api/admin/orders | 全部订单（含筛选：状态/超时/关键字），后台监控用 | admin |
| GET | /api/admin/orders/disputed | 争议订单列表 | admin |
| PUT | /api/admin/orders/{id}/arbitrate | 仲裁（判达人/判商家+说明） | admin |

订单状态机跳转校验统一在 `services/order_service.py` 里维护一张 `ALLOWED_TRANSITIONS: dict[status, set[status]]`，每个写操作先查当前状态是否在允许集合里，不允许则抛 409。

### 4.4 钱包 `/api/wallets`

| 方法 | 路径 | 说明 | 权限 |
|---|---|---|---|
| GET | /api/wallets/me | 我的余额（可提现/冻结） | model |
| GET | /api/wallets/me/transactions | 我的流水分页列表 | model |
| GET | /api/admin/wallets | 所有达人余额总览（用于财务对账） | admin |

### 4.5 提现 `/api/withdrawals`

| 方法 | 路径 | 说明 | 权限 |
|---|---|---|---|
| POST | /api/withdrawals | 达人发起提现申请 | model |
| GET | /api/withdrawals/me | 我的提现记录 | model |
| GET | /api/admin/withdrawals | 提现申请列表（按状态筛选：待审核/待转账/已完成/已驳回） | admin |
| PUT | /api/admin/withdrawals/{id}/approve | 审核通过 | admin |
| PUT | /api/admin/withdrawals/{id}/reject | 驳回+原因（退回余额） | admin |
| PUT | /api/admin/withdrawals/{id}/complete | 登记转账流水号，标记完成 | admin |

### 4.6 平台统计 `/api/admin/dashboard`

| 方法 | 路径 | 说明 |
|---|---|---|
| GET | /api/admin/dashboard/summary | 今日/本月订单数、成交金额、待审核提现数、待处理争议数等看板数据 |

## 5. 错误码约定

| code | 说明 |
|---|---|
| 0 | 成功 |
| 1001 | 参数校验失败 |
| 1002 | 未登录/token 失效 |
| 1003 | 权限不足 |
| 1004 | 资源不存在 |
| 1005 | 订单状态不允许该操作（状态机冲突，如订单已被抢） |
| 1006 | 余额不足 |
| 1007 | 账号已被禁用 |

## 6. API 文档

FastAPI 自带 Swagger UI（`/docs`）和 ReDoc（`/redoc`），MVP 阶段直接用它做接口文档，不需要额外维护 Postman/Yapi。生产环境建议关闭 `/docs` 对外暴露或加访问密码（在 Nginx 层加 Basic Auth），避免暴露内部接口结构给未授权用户。

## 7. 本模块执行清单

- [x] 搭建 FastAPI 项目骨架（config/database/deps/security）
- [x] 实现 auth 模块（注册/登录/refresh），编写单测
- [x] 实现订单状态机 service 层 + 全部订单接口，编写状态跳转的单测（覆盖非法跳转应被拒绝）
- [x] 实现钱包/提现模块，编写并发提现的测试（防止超提）
- [x] 实现管理员模块（用户管理、争议仲裁、提现审核）
- [x] 生产环境关闭 `/docs`、`/redoc`（`APP_ENV=production`）
