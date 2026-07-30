# 达人端正规化体验改版执行计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 以“深海青 · 稳妥亲和”为统一视觉体系，重做达人端的订单大厅、订单详情、我的订单、钱包、个人资料和入驻流程；网页在桌面及手机浏览器可用，并同步作为 Android WebView 的界面来源。

**Architecture:** 保留现有 React 页面路由、FastAPI 接口、SQLite/MariaDB 数据模型和 Capacitor 容器。改版以页面语义重组、共享样式令牌和响应式布局为主；状态、金额、审核与订单动作继续使用现有接口，不改变业务权限。

**Tech Stack:** React + TypeScript、Vite、现有 CSS、Vitest、Playwright、Capacitor Android、FastAPI。

---

## 范围与约束

- 目标用户：学生与宝妈等兼职达人。页面优先传达订单可信度、收益、下一步动作和平台保障。
- 视觉令牌：深海青 `#14373A`、主色 `#117A72`、浅青 `#DCECE8`、背景 `#F5F8F8`、正文 `#17272A`、次要文字 `#617174`、金额强调 `#C4531B`、边框 `#D9E6E4`。
- 桌面端继续使用左侧导航；手机网页及 Android 使用 56px 顶部栏和 68px 底部导航。
- 卡片圆角最大 6px，使用明确边框和留白，不引入营销式大卡片、渐变背景或装饰性图形。
- Android 是 Capacitor 对网页产物的封装，本期不新增原生页面、原生数据接口或第二套路由。
- 不修改订单发布、抢单、审核、结算、提现的后端接口和数据库字段；管理员代商家发单能力保持不变。

## 执行状态（2026-07-30）

| 任务 | 状态 | 验证 |
| --- | --- | --- |
| 1-5：达人端视觉、订单、账户与入驻 | 已完成 | Vitest、生产构建、桌面与手机浏览器截图 |
| 6：Capacitor Android 同步与构建 | 已完成 | `npm run android:sync` 与 `gradlew.bat assembleDebug` 通过；使用 OpenJDK 21.0.11 和本地 Android SDK 生成 Debug APK（不提交产物） |
| 7：本地端到端验收 | 已完成 | SQLite 下管理员代发单至达人提现转账完整流程通过；后端 pytest 通过 |

## 相关文件

| 责任 | 文件 |
| --- | --- |
| 达人端框架与导航 | `frontend/src/pages/RoleWorkspace.tsx` |
| 订单大厅 | `frontend/src/pages/orders/ModelHallPage.tsx` |
| 订单详情 | `frontend/src/pages/orders/MarketplaceOrderDetailPage.tsx` |
| 我的订单与详情 | `frontend/src/pages/orders/ModelOrdersPage.tsx`、现有订单详情页 |
| 钱包 | `frontend/src/pages/wallet/WalletPage.tsx` |
| 个人资料 | `frontend/src/pages/ProfilePage.tsx` |
| 入驻与资料表单 | `frontend/src/pages/TalentOnboardingPage.tsx`、`frontend/src/components/TalentProfileFields.tsx` |
| 样式 | `frontend/src/styles.css`，新增达人端专用样式模块（实施时确定最终路径） |
| Android 容器 | `frontend/capacitor.config.ts`、`frontend/android/` |

## 实施任务

### 任务 1：建立共享视觉令牌与响应式壳层

**文件：**
- 修改：`frontend/src/pages/RoleWorkspace.tsx`
- 修改：`frontend/src/styles.css`
- 新增：`frontend/src/pages/RoleWorkspace.test.tsx`

- [ ] 先写渲染测试，断言达人端桌面导航包含“订单大厅、订单、钱包、我的”，移动端保留五项导航，并且当前页面标题可识别。
- [ ] 运行 `npm test -- RoleWorkspace.test.tsx`，确认测试在改版前因缺少目标语义而失败。
- [ ] 在达人端壳层定义颜色、间距、边框和移动安全区变量；将“抢单大厅”导航文案改为“订单大厅”，保留原有路由值和权限判断。

```tsx
const talentNavigation = [
  { key: 'hall', label: '订单大厅' },
  { key: 'orders', label: '订单' },
  { key: 'wallet', label: '钱包' },
  { key: 'profile', label: '我的' },
];
```

- [ ] 为桌面侧栏、56px 移动标题栏和 68px 底部导航设置稳定高度，确保文字、图标和安全区不挤压内容。
- [ ] 再次运行该测试及 `npm run build`。
- [ ] 提交：`git add frontend/src/pages/RoleWorkspace.tsx frontend/src/pages/RoleWorkspace.test.tsx frontend/src/styles.css && git commit -m "feat: establish talent workspace visual system"`。

### 任务 2：重构订单大厅与订单详情的信息层级

**文件：**
- 修改：`frontend/src/pages/orders/ModelHallPage.tsx`
- 修改：`frontend/src/pages/orders/MarketplaceOrderDetailPage.tsx`
- 修改：达人端样式文件
- 新增或修改：对应页面测试

- [ ] 先写页面测试：订单大厅卡片应展示分类、佣金、交付时间、商品名称和“查看详情”；详情页应展示订单概览、交付要求、平台规则和明确主操作。
- [ ] 运行对应 Vitest 测试，确认新层级尚未存在时失败。
- [ ] 将大厅首屏改为可信任务列表：顶部标题与筛选、分类标签、金额、交付时限、商品图和简短要求；原分类筛选及轮询逻辑保持。
- [ ] 将详情页按“可获得收益 - 要做什么 - 如何完成 - 订单保障与规则”排列，并保留入驻状态校验、抢单成功关闭弹层和已有 API 调用。

```tsx
<article className="talent-order-card">
  <OrderCategoryTags categories={order.categories} />
  <p className="talent-order-card__commission">{formatCurrency(order.commission)}</p>
  <h2>{order.title}</h2>
  <OrderFacts deliveryDays={order.deliveryDays} platform={order.platform} />
</article>
```

- [ ] 移动端将筛选固定为可横向滚动的紧凑控制条，订单卡片单列显示，避免使用悬浮遮挡底部导航。
- [ ] 运行页面测试、`npm run build`，并在 390px 与 1440px 视口人工检查截断与溢出。
- [ ] 提交：`git add frontend/src/pages/orders/ModelHallPage.tsx frontend/src/pages/orders/MarketplaceOrderDetailPage.tsx frontend/src && git commit -m "feat: refine talent marketplace experience"`。提交前只保留本任务相关文件。

### 任务 3：让我的订单明确呈现状态和下一步动作

**文件：**
- 修改：`frontend/src/pages/orders/ModelOrdersPage.tsx`
- 修改：现有达人订单详情页
- 修改：达人端样式文件
- 新增或修改：对应页面测试

- [ ] 先为每个已有订单状态写测试：待审核、待收货、待提交、审核中、已完成均有中文状态、进度提示和正确的下一步操作。
- [ ] 使用现有状态枚举形成展示映射，不新增后端状态或通过前端猜测结算结果。

```ts
const nextActionByStatus: Partial<Record<OrderStatus, string>> = {
  pending_review: '等待平台审核',
  pending_delivery: '等待商家发货',
  pending_submission: '提交推广内容',
  review_submitted: '等待内容审核',
  completed: '查看结算明细',
};
```

- [ ] 改造列表为“状态 + 商品 + 收益 + 下一步”的紧凑信息单元；移动端采用列表，桌面端保留高信息密度表格或列表，不让同一条订单重复出现多个主按钮。
- [ ] 在订单详情中突出当前阶段、截止时间、所需凭证和唯一主操作，历史记录保持次级信息。
- [ ] 运行单测、`npm run build`，并用已有订单数据检查所有状态。
- [ ] 提交：`git add frontend/src/pages/orders frontend/src && git commit -m "feat: clarify talent order progress"`。提交前排除无关工作区变更。

### 任务 4：重构钱包和个人资料为可核对的账户页面

**文件：**
- 修改：`frontend/src/pages/wallet/WalletPage.tsx`
- 修改：`frontend/src/pages/ProfilePage.tsx`
- 修改：达人端样式文件
- 新增或修改：对应页面测试

- [ ] 先写钱包测试，覆盖可提现余额、处理中提现、明细筛选和提现主操作；写资料测试，覆盖认证状态、资料完整度和编辑入口。
- [ ] 钱包首屏按“可提现、处理中、累计收益”排序，金额使用唯一强调色；交易和提现记录保留现有分页、筛选和状态接口。
- [ ] 个人资料首屏改为身份与认证状态摘要，随后展示接单能力、内容领域、作品集和资料维护入口；不在公开区增加证件号、银行卡或联系方式。
- [ ] 统一空状态、加载状态、错误提示和成功反馈，语气客观直接。
- [ ] 运行测试及 `npm run build`。
- [ ] 提交：`git add frontend/src/pages/wallet/WalletPage.tsx frontend/src/pages/ProfilePage.tsx frontend/src && git commit -m "feat: improve talent account pages"`。提交前排除无关工作区变更。

### 任务 5：将入驻流程改为可完成、可预期的步骤体验

**文件：**
- 修改：`frontend/src/pages/TalentOnboardingPage.tsx`
- 修改：`frontend/src/components/TalentProfileFields.tsx`
- 修改：达人端样式文件
- 修改：`frontend/src/components/TalentProfileFields.test.tsx`
- 新增或修改：入驻流程测试

- [ ] 先增加测试：用户可看到资料步骤、认证步骤、必填说明、作品图片数量限制与审核中状态，且上传图片字段能跟随表单提交。
- [ ] 将流程呈现为两个清晰步骤：完善接单资料、提交身份认证。将资料字段分组为基本信息、接单偏好、内容领域和作品集。
- [ ] 保持现有表单字段、作品集最少 6 张且最多 12 张的校验、上传接口及审核提交接口；不更改认证规则。
- [ ] 对未完成、审核中、审核驳回和已通过状态提供可理解的说明与唯一可执行操作。
- [ ] 运行组件测试、流程测试、`npm run build`。
- [ ] 提交：`git add frontend/src/pages/TalentOnboardingPage.tsx frontend/src/components/TalentProfileFields.tsx frontend/src/components/TalentProfileFields.test.tsx frontend/src && git commit -m "feat: streamline talent onboarding"`。提交前排除无关工作区变更。

### 任务 6：同步 Android 容器并验证手机网页

**文件：**
- 检查：`frontend/capacitor.config.ts`
- 检查：`frontend/android/app/src/main/AndroidManifest.xml`
- 生成：`frontend/dist/` 与 Android 构建产物（不提交）

- [ ] 在开始 Android 构建前检查 `java -version` 和 `javac -version`。Gradle 配置要求 JDK 21；当前开发环境的 JDK 17 不能作为通过条件。
- [ ] 在 JDK 21 与 Android SDK 可用后运行 `npm run build`、`npm run android:sync`、`cd android; .\gradlew.bat assembleDebug`。
- [ ] 检查 Capacitor 仍以 `dist` 为 `webDir`、Android 保留网络权限，且同步后的页面在模拟器或真机显示移动导航、列表、详情、钱包、资料和入驻流程。
- [ ] 验证 WebView 安全区、键盘弹出、图片加载、长文本换行和返回行为；原生层仅作为网页容器。
- [ ] 记录构建的 JDK/SDK 版本和 APK 路径，不提交 APK、`dist` 或本地 SDK 配置。

### 任务 7：端到端验收、文档与发布前检查

**文件：**
- 修改：`frontend/e2e_complete_flow.py`（仅在界面文案断言需要同步时）
- 修改：`docs/04-frontend-design.md`（记录最终视觉规范）
- 修改：`README.md`（若现有截图或端说明需要更新）

- [ ] 使用 SQLite 本地环境执行完整业务链：管理员代商家发布订单、达人完成入驻及认证、达人抢单、审核、发货、收货、提交内容、结算、提现审核与转账。
- [ ] 运行后端测试、前端单测、构建及 E2E；界面文案变更仅更新相关断言，不能弱化业务断言。

```text
backend:  pytest
frontend: npm test
frontend: npm run build
e2e:      python e2e_complete_flow.py
android:  npm run android:sync; gradlew assembleDebug (JDK 21)
```

- [ ] 用 Playwright 在 1440px 和 390px 采集大厅、详情、订单、钱包、资料、入驻的截图；检查信息层级、金额可读性、底部导航不遮挡、表单不溢出和空状态。
- [ ] 对照本计划完成验收：管理员仍可代商家发单；达人端保持独立入口；分类、订单、钱包和认证数据无丢失；网页和 Android 使用同一视觉体验。
- [ ] 最终提交仅包含本次改版的源代码、测试与文档：`git add <changed-files> && git commit -m "feat: redesign talent experience"`。推送前确认远端分支和工作区没有无关文件。

## 验收标准

- 学生或宝妈首次进入订单大厅，可在一屏内识别商品分类、收益、交付时限、任务概要和进入详情的路径。
- 订单详情和我的订单均能明确回答“现在处于什么阶段、下一步做什么、收益何时结算”。
- 钱包余额、处理中金额、明细和提现动作可区分，且没有误导性“已到账”表述。
- 入驻流程保持现有业务校验，作品集最少 6 张、最多 12 张的约束在网页与 Android 中一致。
- 390px 手机网页、桌面浏览器和 JDK 21 构建出的 Android 包均无导航遮挡、文字溢出、不可点击主操作或图片空白。
- 全量测试、构建及端到端流程通过；JDK 21 缺失时，Android 验收明确标记为环境阻塞，不以 JDK 17 的失败结果判定代码失败。

## 风险与回退

- 样式改动集中在达人端命名空间，避免影响管理员和商家代发单页面。
- 订单状态文案必须映射现有枚举；新增状态需要先确认后端契约。
- 图片访问仍走已配置的 MinIO/COS 抽象，页面只消费 URL，不增加存储耦合。
- 出现高风险视觉或流程回归时，可按任务提交逐个回退，不触及订单与钱包数据。
