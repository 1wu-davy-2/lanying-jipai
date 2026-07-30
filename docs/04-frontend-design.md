# 前端页面设计（React + TypeScript）

## 1. 工程结构

```
frontend/
  src/
    main.tsx
    App.tsx                    # 路由挂载
    api/                        # axios 封装 + 各模块请求函数
      client.ts                    # axios 实例，请求拦截加 token，响应拦截统一处理 code/401
      auth.ts / orders.ts / wallets.ts / withdrawals.ts / admin.ts
    stores/
      authStore.ts                # zustand，登录态、当前用户、角色
    routes/
      index.tsx                    # 路由表 + 角色守卫 ProtectedRoute
    layouts/
      MerchantLayout.tsx
      ModelLayout.tsx
      AdminLayout.tsx
    pages/
      auth/Login.tsx  Register.tsx
      merchant/OrderList.tsx  OrderCreate.tsx  OrderDetail.tsx
      model/OrderHall.tsx  MyOrders.tsx  OrderDetail.tsx  Wallet.tsx  WithdrawalApply.tsx
      admin/UserList.tsx  OrderMonitor.tsx  DisputeList.tsx  WithdrawalReview.tsx  Dashboard.tsx
    components/
      OrderStatusTag.tsx           # 状态徽标（统一颜色映射）
      OrderTimeline.tsx             # 订单流转时间线（Steps 组件）
      UploadImages.tsx               # 图片上传组件（样品图/素材图）
    types/
      index.ts                      # 与后端 schema 对齐的 TS 类型
  vite.config.ts
  package.json
```

## 2. 路由与角色守卫

- 登录后按 `user.role` 跳转默认首页：merchant → `/merchant/orders`，model → `/model/hall`，admin → `/admin/dashboard`。
- `ProtectedRoute` 包一层：未登录跳 `/login`；角色不匹配跳到自己角色的首页（不允许 URL 越权访问其他角色页面，前端拦一层，后端接口权限是最终防线）。
- Vite 打包成单个 dist，Nginx 按 `try_files $uri /index.html` 处理前端路由的刷新 404 问题。

## 3. 页面清单

### 3.1 公共

- **登录页**：手机号+密码，登录成功后跳转对应角色首页。
- **注册页**：选择角色（商家/达人）+ 手机号+密码，注册后引导去完善资料/实名认证。

### 3.2 商家端 `/merchant/*`

| 页面 | 路径 | 功能要点 |
|---|---|---|
| 我的订单 | /merchant/orders | Tab 按状态分组（待抢单/进行中/待验收/已完成/争议/已取消），表格+分页 |
| 发布订单 | /merchant/orders/create | 表单：标题、描述、样品图上传、佣金金额、拍摄要求 |
| 订单详情 | /merchant/orders/:id | 顶部 Steps 展示状态流转，下方按当前状态显示可执行操作按钮（填寄件单号/验收通过/验收拒绝），留言板 |
| 店铺资料 | /merchant/profile | 店铺名/联系方式/默认寄件地址，实名认证入口 |

### 3.3 达人端 `/model/*`

| 页面 | 路径 | 功能要点 |
|---|---|---|
| 订单大厅 | /model/hall | 深海青工作台首屏；按商品分类筛选，卡片展示商品图、分类、收益、交付时限、要求摘要和进入详情的路径 |
| 大厅订单详情 | /model/hall/:id | 按“可获得收益、你需要完成、如何完成、订单保障与规则”组织，申请状态与唯一主操作清楚可见 |
| 我的订单 | /model/orders | 桌面高密度列表、手机紧凑列表；每单展示状态、收益和下一步动作 |
| 订单详情 | /model/orders/:id | 展示当前状态、下一步、物流、时间线、素材和留言；按状态显示唯一可执行操作 |
| 资金账户 | /model/wallet | 区分可提现、处理中提现和账单记录；下方保留资金明细、提现进度与“申请提现”入口 |
| 申请提现 | /model/wallet/withdraw | 表单：金额（校验≤可提现余额）、支付宝账号（默认取资料里的，可修改，提示会作为本次提现的收款账号快照） |
| 个人资料 | /model/profile | 身份与认证、接单能力、受控收件信息和作品集；浏览态不展示电话和详细地址 |
| 达人入驻 | /model/onboarding、/model/onboarding/verify | 两步完成接单资料与实名认证；资料分为基本资料、接单能力、收货信息和作品集，作品集保持 6 至 12 张限制 |

### 3.4 管理员端 `/admin/*`

| 页面 | 路径 | 功能要点 |
|---|---|---|
| 数据看板 | /admin/dashboard | 关键指标卡片：今日新增订单、成交金额、待审核提现数、待处理争议数 |
| 用户管理 | /admin/users | 列表（角色/状态/实名状态筛选），封禁/启用，实名审核（查看身份证号需二次确认+掩码显示，审计留痕） |
| 订单监控 | /admin/orders | 全平台订单列表，筛选状态/超时订单高亮 |
| 争议处理 | /admin/disputes | 争议订单列表，进详情看双方留言和素材，仲裁按钮（判达人/判商家+备注） |
| 提现审核 | /admin/withdrawals | 按状态分 Tab：待审核（通过/驳回）、待转账（登记转账流水号表单）、已完成、已驳回 |

## 4. 关键交互细节

- **抢单大厅实时性**：MVP 阶段用 TanStack Query 的轮询（`refetchInterval` 15s）刷新列表和详情状态，暂不引入 WebSocket。后续订单量大/需要秒抢体验时再升级为 WebSocket 推送，接口层已经是分离的，替换成本低。
- **图片/文件上传**：前端用 Ant Design `Upload` 组件提交到 `/api/uploads`。开发环境写入本地 `backend/uploads/{year}/{month}/`；生产环境写入 MinIO 并返回媒体域名 URL。COS 仅在启用异地备份时写入同对象键，COS 地址不进入前端数据，限制单文件大小（如 10MB）和类型（图片/视频）。
- **状态徽标颜色映射**：统一在 `OrderStatusTag.tsx` 维护一份 `status → {text, color}` 映射，避免各页面各写一套。
- **金额展示**：所有金额前端展示保留 2 位小数，输入框用 `InputNumber` 限制精度，提交前后端仍需再校验一次（不信任前端）。
- **达人端视觉体系**：使用深海青 `#14373A` 作为工作台框架、主色 `#117A72` 作为操作与状态强调、浅青 `#DCECE8` 与背景 `#F5F8F8` 区分内容层级；正文 `#17272A`、次要文字 `#617174`、收益 `#C4531B`。卡片圆角不超过 6px，以边框和留白组织信息。
- **响应式与 Android**：桌面保留侧栏；390px 手机网页和 Capacitor Android WebView 使用 56px 顶部栏、68px 安全区底部导航。Android 仅承载同一套网页路由与接口，不维护第二套原生业务页面。

## 5. 本模块执行清单

- [x] 搭建 Vite + React + TS 项目骨架，接入 Ant Design、React Router、TanStack Query、Zustand
- [x] 实现 axios 封装（token 注入、401 自动跳登录、统一错误提示）
- [x] 实现登录/注册页 + 角色守卫路由
- [x] 实现商家端三个页面
- [x] 实现达人端四个页面
- [x] 实现管理员端五个页面
- [x] 联调后端接口，处理边界情况（抢单失败提示、余额不足提示等）

## 6. 达人端改版验证

- 已完成订单大厅、订单详情、我的订单、资金账户、个人资料和入驻流程的“深海青 · 稳妥亲和”改版；管理员代商家发单和达人独立入口保持不变。
- 使用独立 SQLite 数据库完成管理员代发单、达人入驻认证、申请、寄样、收货、素材提交、验收、入账、提现审核和转账的浏览器 E2E。
- 已通过 Capacitor `android:sync` 和 Debug APK 构建。使用 OpenJDK 21.0.11 与 Android SDK 构建的本地产物为 `frontend/android/app/build/outputs/apk/debug/app-debug.apk`（versionCode 1、minSdk 24）；APK 不提交到仓库。
