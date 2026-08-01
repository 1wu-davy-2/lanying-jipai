# 多达人订单履约与审核展示优化技术 Task

**状态**：待实施

**审查日期**：2026-08-01

**适用范围**：商家端、运营管理端、达人端；覆盖订单发布数量大于 1 时的申请、分配、寄样、拍摄、返图、审核、返货、结算和申诉。

## 1. 审查结论

当前实现的 `quantity` 只是订单表上的数量字段，没有对应的履约槽位。订单实际只能绑定一个达人：

| 现状 | 当前实现 | 造成的问题 |
| --- | --- | --- |
| 接单人 | `orders.model_id` 单值 | 一个订单无法同时绑定多名达人 |
| 订单状态 | `orders.status` 单值 | 任一达人的状态会代表整单状态，无法区分每个人的进度 |
| 返图 | `orders.submitted_media` 单值 | 多名达人会互相覆盖或无法分别审核 |
| 物流 | `orders.ship_to_model_*`、`orders.return_*` 单组字段 | 无法分别记录每位达人的寄样和返货单号 |
| 申请审核 | `approve_order_application()` 审核一个申请后，把同订单其他 `PENDING` 申请全部改为 `REJECTED` | 数量大于 1 时只会分配一个达人，并误伤其他申请 |
| 结算 | 钱包流水只关联 `order_id` | 无法保证每位达人一份独立结算和幂等键 |
| 商家详情页 | `OrderDetailPage` 只读取当前 `model_id` 对应申请 | 商家看不到申请人列表、每人返图和审核状态 |
| 运营申请页 | `AdminApplicationsPage` 为平铺表格 | 订单与申请人缺少分组，无法快速看完一单的名额进度 |
| 达人订单页 | `ModelOrdersPage` 以订单为一行 | 不能区分同一父订单下自己的履约实例 |

相关代码位置：

- 后端模型：[backend/app/models/order.py](../backend/app/models/order.py)
- 后端状态流转：[backend/app/services/order_service.py](../backend/app/services/order_service.py)
- 后端订单接口：[backend/app/routers/orders.py](../backend/app/routers/orders.py)
- 运营审核接口：[backend/app/routers/admin.py](../backend/app/routers/admin.py)
- 商家订单页：[frontend/src/pages/orders/MerchantOrdersPage.tsx](../frontend/src/pages/orders/MerchantOrdersPage.tsx)
- 订单详情页：[frontend/src/pages/orders/OrderDetailPage.tsx](../frontend/src/pages/orders/OrderDetailPage.tsx)
- 运营申请页：[frontend/src/pages/admin/AdminApplicationsPage.tsx](../frontend/src/pages/admin/AdminApplicationsPage.tsx)

## 2. 优化目标

1. 一个父订单可以招募 `quantity` 名达人，每名达人拥有独立的申请、履约状态、物流、返图版本、审核记录、申诉和结算。
2. 商家打开订单后，第一屏看到名额进度，例如 `已分配 2/5`，并可以按达人逐人处理，不需要在多个页面之间猜测状态。
3. 运营可以按订单分组查看申请，审核一个申请不会改变其他达人的履约数据；名额满后申请进入候补或明确结束，不再被静默驳回。
4. 达人只看到自己的履约实例和自己的返图审核结果，不暴露其他达人的隐私信息。
5. 保留已有单达人订单的兼容能力，历史订单迁移后行为不变。

## 3. 推荐领域模型

### 3.1 父订单 `orders`

父订单继续保存商家发布的共同规则：标题、商品说明、样图、拍摄要求、佣金、数量、商品来源、返货规则和招募状态。

新增或调整以下只读汇总字段（可实时计算，必要时缓存）：

- `approved_quantity`：已创建履约实例的数量。
- `active_quantity`：未取消且未完成的履约实例数量。
- `submitted_quantity`：已提交返图、等待商家审核的数量。
- `completed_quantity`：已完成并结算的数量。
- `available_quantity`：`quantity - approved_quantity`，不能小于 0。
- `recruitment_status`：`OPEN`、`FULL`、`CLOSED`，与单个达人履约状态分离。

旧的 `model_id`、物流字段和 `submitted_media` 在迁移期保留，读取新履约数据；新建订单不再依赖这些字段。

### 3.2 达人履约实例 `order_fulfillments`

一条记录代表一位达人在父订单中的一个名额。

建议字段：

| 字段 | 说明 |
| --- | --- |
| `id` | 履约实例主键 |
| `order_id` | 父订单 ID |
| `application_id` | 来源申请，唯一关联 |
| `model_id` | 达人 ID |
| `slot_no` | 父订单内的 1-based 名额序号，唯一 |
| `status` | 独立履约状态，见状态机 |
| `product_source` | 创建时快照，避免父订单规则修改影响历史实例 |
| `return_required` / `self_keep_after_shoot` | 履约规则快照 |
| `commission_amount` / `product_subsidy_amount` | 本实例应结算金额快照 |
| `ship_to_model_company` / `ship_to_model_tracking_no` | 寄样物流 |
| `return_company` / `return_tracking_no` | 返货物流 |
| `claimed_at`、`in_progress_at`、`submitted_at`、`completed_at` | 状态时间 |
| `reject_reason` | 该达人实例的争议或驳回原因 |

约束和索引：

- `UNIQUE(order_id, model_id)`：同一达人不能重复占用同一父订单。
- `UNIQUE(order_id, slot_no)`：一个名额只能有一个履约实例。
- `INDEX(order_id, status)`、`INDEX(model_id, status)`：支持商家聚合和达人订单筛选。
- 通过事务锁定父订单并校验 `approved_quantity < quantity`，防止并发审核超卖名额。

### 3.3 返图提交 `fulfillment_submissions`

不要再把返图放在父订单上。每次达人提交一组返图产生一个版本，支持审核不通过后重新提交。

建议字段：

- `id`、`fulfillment_id`、`version`、`status`（`PENDING_REVIEW`、`APPROVED`、`REVISION_REQUIRED`）。
- `media_urls` 或关联 `MediaAsset` 的明细表；服务端继续校验图片数量和 MP4 时长大于 5 秒。
- `remark`、`review_reason`、`reviewer_id`、`submitted_at`、`reviewed_at`。
- `UNIQUE(fulfillment_id, version)`，结算只允许引用已通过的最新版本。

### 3.4 履约事件与沟通

- 扩展 `OrderLog` 增加可空 `fulfillment_id`；父订单事件保留为空，达人级事件必须带履约实例。
- 扩展 `OrderMessage` 增加可空 `fulfillment_id`。父订单公告仍写父订单，关于某位达人的沟通写履约实例。
- 钱包流水增加可空 `fulfillment_id`，结算幂等键改为 `fulfillment:{id}:settlement`。
- 如现有争议模型不能承载达人级争议，新增 `fulfillment_disputes`，禁止继续用父订单的 `DISPUTED` 覆盖其他达人的正常进度。

## 4. 履约状态机

### 4.1 申请状态

`PENDING -> APPROVED -> FULFILLMENT_CREATED`

`PENDING -> REJECTED`

名额已满但商家仍开放候补时：`PENDING -> WAITLISTED`。名额释放时按申请时间升序晋级，晋级必须再次检查达人等级、实名认证和订单规则。

不再执行“通过一个申请后批量驳回所有其他申请”。关闭招募时才将剩余 `PENDING` 明确改为 `CLOSED`，并记录原因。

### 4.2 单个履约实例状态

| 状态 | 含义 | 下一步 |
| --- | --- | --- |
| `WAITING_SHIPMENT` | 商家寄样待处理 | 商家填写寄样物流 |
| `SHIPPED_TO_MODEL` | 样品已寄出 | 达人确认收货 |
| `OWNED_PRODUCT_REVIEW` | 达人已有同款，等待商家审核 | 商家通过或驳回 |
| `IN_PROGRESS` | 达人可以拍摄 | 达人提交返图 |
| `SUBMITTED` | 返图版本等待商家审核 | 商家通过、要求修改或发起争议 |
| `REVISION_REQUIRED` | 返图需修改 | 达人提交下一版本 |
| `WAITING_RETURN` | 返图通过，等待返货（仅需返货订单） | 达人填写返货物流 |
| `RETURNED` | 已返货，等待商家最终验收 | 商家验收或发起争议 |
| `COMPLETED` | 验收完成并结算 | 终态 |
| `DISPUTED` | 该达人履约进入申诉 | 运营仲裁后回到完成或取消 |
| `CANCELLED` | 该名额取消并释放 | 终态 |

商品来源分支：

- 商家寄样：`WAITING_SHIPMENT -> SHIPPED_TO_MODEL -> IN_PROGRESS`。
- 达人自购：运营审核通过后直接进入 `IN_PROGRESS`。
- 达人已有同款：运营审核通过后进入 `OWNED_PRODUCT_REVIEW`，商家通过后进入 `IN_PROGRESS`。
- `return_required=false` 时返图审核通过后可直接 `COMPLETED`，无需创建返货物流。

## 5. 后端实施 Task

### T1. 数据库迁移

- 新增 `order_fulfillments`、`fulfillment_submissions`；扩展 `order_logs`、`order_messages`、钱包流水关联字段。
- 为旧订单做兼容回填：`model_id` 非空的订单生成 `slot_no=1` 的履约实例；旧 `submitted_media` 生成版本 1 提交记录；物流字段同步到履约实例。
- 不删除旧字段，至少保留一个发布版本用于回滚和历史详情读取。
- 为 SQLite、MariaDB 分别验证唯一约束、索引和 JSON 字段迁移。

### T2. 模型与序列化

- 在 `backend/app/models/order.py` 增加履约、提交、履约事件模型，定义外键和唯一约束。
- 将订单序列化拆成 `serialize_order_summary()`、`serialize_fulfillment()`、`serialize_application()`，避免一个序列化函数混入单人和多人语义。
- 返回达人基础快照：头像、昵称、等级、实名认证状态、已完成单数、作品数；敏感手机号只对商家和运营返回。

### T3. 容量与审核服务

- 重写 `approve_order_application()` 为事务服务：锁父订单，计算已占用名额，分配最小可用 `slot_no`，创建履约实例，仅更新当前申请。
- 审核通过、驳回、候补晋级、履约取消必须写履约级 `OrderLog`。
- 并发审核同一父订单时，第二个事务必须收到明确的“名额已满”或进入候补，不能创建重复履约实例。
- 父订单的 `recruitment_status` 根据实际履约数量统一计算，避免页面显示与数据不一致。

### T4. 履约接口

新增以履约实例为主键的接口，保留旧接口作为兼容层并在内部定位到履约实例：

- `GET /api/orders/{order_id}/workspace`：返回订单规则、名额汇总、申请列表、履约列表、最近事件。
- `GET /api/orders/{order_id}/applications`：商家查看本订单申请，支持 `status`、关键词、分页。
- `GET /api/orders/{order_id}/fulfillments`：商家查看每位达人的履约进度，支持状态筛选。
- `GET /api/fulfillments/{fulfillment_id}`：达人、商家、运营按权限查看单个履约详情。
- `PUT /api/fulfillments/{fulfillment_id}/ship`、`/receive`、`/owned-product-review`：迁移现有单人动作。
- `POST /api/fulfillments/{fulfillment_id}/submissions`：提交返图版本，复用 `MediaAsset` 所有权和视频时长校验。
- `PUT /api/fulfillments/{fulfillment_id}/submissions/{submission_id}/review`：商家通过、要求修改或发起争议。
- `PUT /api/fulfillments/{fulfillment_id}/return`、`/accept`、`/dispute`：返货、验收、申诉均只影响当前达人。
- `GET /api/admin/order-applications?order_id=...`：运营按父订单聚合申请，不再只有全局平铺列表。

所有写接口需要：角色校验、履约归属校验、状态校验、幂等保护和审计日志。

### T5. 结算与申诉

- `complete_order_and_settle()` 改为接收履约实例，佣金和商品补贴使用实例快照。
- 结算前必须确认返图审核已通过；需返货的订单还必须完成返货验收。
- 一个达人结算失败不能阻断同一父订单其他达人；父订单汇总金额由履约实例聚合。
- 申诉、仲裁、取消只改变当前履约实例，并释放该名额或进入候补晋级流程。

## 6. 前端实施 Task

### T6. 商家订单列表

修改 `MerchantOrdersPage`：

- 增加“名额进度”列：`已分配/总数`、`待审核申请数`、`待返图数`、`待验收数`。
- 增加“多人履约”标签和筛选：招募中、部分进行中、全部完成、存在待处理。
- 点击订单进入统一工作台，不再直接把父订单当成某一个达人的详情。

### T7. 商家订单工作台

新增 `MerchantOrderWorkspacePage` 或将 `OrderDetailPage` 拆分为父订单工作台和履约详情：

- 顶部展示订单规则、样图、数量进度、佣金/补贴预算和招募状态。
- “申请人”页签：按申请状态分组，显示头像、用户名、达人等级、实名认证、作品缩略图、申请留言和申请时间；支持查看申请快照、通过、驳回、候补。
- “履约中”页签：每位达人一张卡片或一行可展开列表，显示 `slot_no`、达人信息、当前状态、寄样物流、返图版本、审核倒计时、返货状态和结算金额。
- “待处理”页签：只聚合需要商家动作的达人，例如同款审核、返图审核、返货验收、争议。
- 点击达人打开右侧 Drawer/详情页，查看其完整时间线、每个返图版本、图片/视频预览、审核记录和留言；任何操作都带明确的达人姓名和名额号。
- 桌面端使用可展开表格，移动端使用纵向卡片，避免把多人数据塞入横向宽表。

### T8. 运营管理端

修改 `AdminApplicationsPage` 和 `AdminOperationsPage`：

- 申请列表按父订单分组，显示 `2/5` 的分配进度和申请人数。
- 进入订单后复用履约工作台，运营可以按申请时间、等级、实名认证、店铺要求筛选。
- 审核通过只创建当前履约实例；支持批量选择时逐条返回成功/失败结果，不使用整单批量覆盖。
- 增加候补和名额释放提示，避免运营误以为申请已经被驳回。

### T9. 达人端

修改 `ModelOrdersPage`、`OrderDetailPage`：

- 以履约实例为列表项，显示父订单标题 + 名额号 + 自己的状态和下一步。
- 返图上传改为按提交版本展示，明确图片数量、视频时长和审核反馈。
- 只展示当前达人的物流、审核和结算数据，不显示同一父订单其他达人信息。

### T10. API 类型和缓存

- 在 `frontend/src/api/orders.ts` 增加 `OrderSummary`、`OrderApplication`、`OrderFulfillment`、`FulfillmentSubmission` 类型。
- 将 React Query key 从 `order/{id}` 扩展为 `order-workspace/{id}`、`fulfillment/{id}`，审核或提交后只刷新受影响实例和父订单汇总。
- `OrderStatusTag`、进度文案和筛选项补齐履约级状态，旧状态只在兼容接口中使用。

## 7. 测试与验收 Task

### T11. 后端回归测试

- 发布 `quantity=3`，创建 5 个达人申请；通过 3 个后只能产生 3 个不同履约实例，其他申请进入候补或明确待处理状态。
- 并发通过两个申请时，名额不超卖，`slot_no` 不重复。
- 驳回 A 的返图不会改变 B 的返图、状态、日志或物流。
- A、B 分别提交图片和视频，服务端分别校验每人的图片数和视频大于 5 秒。
- A 完成结算后，B 仍可继续拍摄；钱包流水、幂等键和金额分别关联 A/B 履约实例。
- 历史单达人订单迁移后可正常查看、提交、审核和结算。

### T12. 前端回归测试

- 商家工作台正确显示 `2/5`、申请数和各状态人数。
- 展开 A 的履约详情只显示 A 的素材和物流；切换到 B 后数据不串行。
- 通过、驳回、要求修改、验收后，父订单汇总和当前履约卡片同时更新。
- 运营申请列表按订单分组，分页和筛选不会重复或丢失申请。
- 移动端卡片不出现横向溢出，图片和视频预览入口可用。

### T13. 验收标准

以下场景全部通过才可发布：

1. 商家发布数量 3 的订单，5 位达人申请，运营通过 3 位；商家工作台能看到 3 个独立履约卡片、2 个候补/待处理申请。
2. 3 位达人同时处于不同阶段时，商家可在同一父订单内分别处理寄样、返图审核和返货验收。
3. 商家驳回达人 A 的返图并要求修改，达人 B 的状态和素材完全不受影响。
4. 达人 A 的视频小于等于 5 秒时只能得到 A 的校验错误，不影响其他达人提交。
5. 只有当前履约实例返图通过且返货条件满足时才允许结算；结算重复请求不会重复入账。
6. 历史 `quantity=1` 订单的旧 URL 仍能打开，并自动展示为一个履约实例。

## 8. 实施顺序与交付拆分

建议拆成 4 个可独立评审的提交：

1. **数据层**：T1、T2，完成迁移、回填和序列化，不改变前端入口。
2. **履约服务层**：T3、T4、T5，完成多人分配、状态机、返图版本、结算和兼容接口。
3. **商家/运营工作台**：T6、T7、T8、T10，先解决“每个人的申请和审核可见”。
4. **达人端与回归**：T9、T11、T12、T13，完成完整闭环后再切换默认入口。

上线策略：

- 先通过配置开关对新工作台灰度，只允许内部订单使用。
- 监控名额分配冲突、返图审核失败、结算幂等冲突和父子汇总不一致。
- 确认历史订单读取无误后，再将商家和运营默认路由切换到新工作台。
- 保留旧接口至少一个发布周期，确认无客户端调用后再移除单人字段写入逻辑。

## 9. 非目标与风险

- 本 Task 不重新设计订单发布表单中的商品规则；只负责把规则正确应用到每位达人。
- 不在本期引入复杂的自动匹配算法，候补晋级先按申请时间和运营确认处理。
- 旧订单的单人字段与新履约字段可能短期出现双写，必须统一由服务层写入并增加一致性检查脚本。
- SQLite 对并发锁的表现与 MariaDB 不同，容量分配必须使用条件更新和唯一约束，不能只依赖 ORM 的 `with_for_update()`。
