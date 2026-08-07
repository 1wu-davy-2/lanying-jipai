# UI 重设计任务清单

每次只派发一个任务文件。执行者必须先阅读上级目录的 PRD 与实施契约，并在完成后停止扩展、按统一模板反馈。任务编号表示推荐顺序，不表示可以跳过依赖。

## 任务与文件所有权

| 任务 | 主要范围 | 主要样式文件 | 前置任务 |
| --- | --- | --- | --- |
| [T01](./T01-foundation.md) | 主题、令牌、CSS 拆分 | `tokens.css`、`base.css`、全部空模块 | 无 |
| [T02](./T02-brand-entry-auth.md) | Logo、入口、登录、注册 | `auth.css` | T01 |
| [T03](./T03-workspace-shell.md) | 三角色壳层、桌面/手机导航 | `workspace.css`、`responsive.css` | T01、T02 |
| [T04](./T04-talent-marketplace.md) | 达人大厅、详情、申请 | `talent-marketplace.css` | T03 |
| [T05](./T05-talent-orders-fulfillment.md) | 达人订单、新旧履约详情 | `talent-orders.css` | T03 |
| [T06](./T06-wallet-withdrawal.md) | 钱包、提现 | `wallet.css` | T03 |
| [T07](./T07-profile-onboarding-ranking.md) | 达人资料、入驻、榜单及共享商家资料页 | `talent-account.css` | T03 |
| [T08](./T08-merchant-orders.md) | 商家订单、发布、履约工作台 | `merchant.css` | T03 |
| [T09](./T09-admin-order-operations.md) | 发单、申请、监控、争议 | `admin-orders.css` | T03、T08 |
| [T10](./T10-admin-support.md) | 看板、用户、提现、话术 | `admin-support.css` | T03 |
| [T11](./T11-official-android-brand.md) | 官网组件、Web/Android 品牌 | `official.css`、Android `res/` | T02、T03 |
| [T12](./T12-regression-review.md) | 全量回归、页面矩阵、发布结论 | 原则上不新增样式 | T01-T11 |

## 可并行边界

T04、T05、T06、T07、T08、T10 在 T03 完成后可并行，但必须保证没有两项同时修改 `main.tsx`、`styles.css`、`workspace.css` 或 `responsive.css`。任务内响应式规则写入各自页面样式模块。

T09 等待 T08，是因为管理端订单详情复用商家多人履约工作台。T11 等待 T02，是因为官网、favicon 与 Android 必须复用同一品牌标记。

## 状态记录

主审可在派发系统中记录状态，不在任务文档内直接勾选，避免多个执行者同时改文档：

```text
pending -> in_progress -> review -> accepted
                         -> changes_requested -> in_progress
```

任务只有在代码、测试、构建、允许的页面检查和完整反馈都交付后才能进入 `accepted`。可视化环境缺失不等于伪造通过，应在 `review` 中保留“视觉未验收”风险。

## 派发与回收

派发时使用 `../02-execution-contract.md` 第 8 节话术，并替换实际任务编号。回收时先检查修改文件是否越界，再看测试和页面结果，最后检查视觉细节；若越界修改业务，先要求回退越界部分，不继续下一个任务。
