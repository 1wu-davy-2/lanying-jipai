# T03 工作台壳层与导航

## 目标

让达人、商家和管理端共享统一品牌壳层，同时保留各角色现有导航项、顺序、路径、权限和详情页高亮逻辑。达人手机端保持五项底部导航，商家与管理端手机端改为抽屉导航。

## 依赖与允许文件

- 依赖：T01、T02；复用 T02 的 `AppLogo`，不得复制一个临时 Logo。
- 允许修改：`frontend/src/pages/RoleWorkspace.tsx`、`frontend/src/pages/RoleWorkspace.test.tsx`、`frontend/src/styles/workspace.css`、`frontend/src/styles/responsive.css`。
- 允许新增：仅限通用导航小组件及对应测试。
- 不允许修改：导航 key、数组顺序、路由判断、页面组件、退出逻辑或 ProtectedRoute。

## 桌面规格

- 侧栏 232px，背景 `#24212B`，Logo 区高 72px；导航项高 44px、间距 4px、图标 19px。
- 当前项使用 `#B33B5A`，hover 使用半透明白；文字和图标左对齐。
- 顶栏 64px，白色背景、底边框；显示当前用户和退出，不放营销文案。
- 内容最大宽 1200px，1440px 页面内边距 32px，1024px 为 24px。
- 管理端可用不可点击的小标题视觉分组，但不得改变导航数组、Tab 顺序或 DOM 可访问顺序。

## 手机规格

- 小于 768px 时不显示固定侧栏。
- 达人：56px 顶栏 + `64px + safe-area` 底部导航，顺序仍是大厅、榜单、订单、钱包、我的；图标 22px，文字 12px，触控区至少 44px。
- 商家/管理端：56px 顶栏显示菜单图标、Logo、用户；点击打开左侧 Drawer，Drawer 内使用同一导航，不缩成 224px 常驻栏。
- 正文左右 16px，底部预留不被达人导航遮挡；详情页父导航高亮保持正确。

## 图标映射

- 商家订单 `FileTextOutlined`，店铺 `ShopOutlined`。
- 达人使用 PRD 4.5 的五项映射。
- 管理端：运营发单 `FormOutlined`、申请 `AuditOutlined`、话术 `ReadOutlined`、看板 `DashboardOutlined`、用户 `TeamOutlined`、监控 `EyeOutlined`、争议 `WarningOutlined`、提现 `WalletOutlined`。
- 退出使用 `LogoutOutlined`，纯图标按钮必须有 `aria-label`。

## 实施步骤

- [ ] 扩充测试，逐角色断言导航文本、图标可访问名称、点击路径和当前高亮。
- [ ] 先实现桌面共享壳层，再实现商家/管理端抽屉，最后调整达人移动导航。
- [ ] 抽屉打开后菜单点击应导航并关闭；退出行为完全沿用现有函数。
- [ ] 移除壳层中的硬编码旧青色，用主题令牌；不改具体页面颜色。
- [ ] 检查 360、390、768、1024、1440px 及长昵称。

## 验收

- 三类角色的现有导航项数量、顺序、路径完全不变。
- `/model/hall/:id`、`/model/fulfillments/:id`、`/model/wallet/withdraw` 和订单详情正确高亮父项。
- 商家和管理端在 390px 不再被固定侧栏挤压。
- 达人底部导航不遮挡最后一个操作；安全区有效。
- `npm test -- src/pages/RoleWorkspace.test.tsx src/App.test.tsx`、全量测试和构建通过。

## 完成反馈

使用统一模板，额外列出三类角色每个验收路径和对应高亮项。最后写：

> T03 已停止扩展，等待主审检查后再进入下一任务。
