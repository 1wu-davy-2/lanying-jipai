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
| 抢单大厅 | /model/hall | 卡片流展示 PUBLISHED 订单（图+佣金+标题），点击抢单二次确认弹窗，抢单失败（已被抢）提示并自动刷新列表 |
| 我的订单 | /model/orders | 按状态分组，操作入口：确认收货/上传素材+寄回单号 |
| 订单详情 | /model/orders/:id | 同商家端 Steps + 留言板，按当前状态显示可执行操作 |
| 钱包 | /model/wallet | 可提现余额/冻结余额展示，流水列表，"申请提现"按钮 |
| 申请提现 | /model/wallet/withdraw | 表单：金额（校验≤可提现余额）、支付宝账号（默认取资料里的，可修改，提示会作为本次提现的收款账号快照） |
| 个人资料 | /model/profile | 三维数据/技能标签/收货地址/作品集，实名认证入口 |

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
- **图片/文件上传**：前端用 Ant Design `Upload` 组件直传后端 `/api/uploads` 接口（后端存本地磁盘 `backend/uploads/{year}/{month}/`，返回可访问 URL），限制单文件大小（如 10MB）和类型（图片/视频）。
- **状态徽标颜色映射**：统一在 `OrderStatusTag.tsx` 维护一份 `status → {text, color}` 映射，避免各页面各写一套。
- **金额展示**：所有金额前端展示保留 2 位小数，输入框用 `InputNumber` 限制精度，提交前后端仍需再校验一次（不信任前端）。

## 5. 本模块执行清单

- [x] 搭建 Vite + React + TS 项目骨架，接入 Ant Design、React Router、TanStack Query、Zustand
- [x] 实现 axios 封装（token 注入、401 自动跳登录、统一错误提示）
- [x] 实现登录/注册页 + 角色守卫路由
- [x] 实现商家端三个页面
- [x] 实现达人端四个页面
- [x] 实现管理员端五个页面
- [x] 联调后端接口，处理边界情况（抢单失败提示、余额不足提示等）
