# T05 达人订单与独立履约

## 目标

统一“我的订单”、新多人履约详情和旧订单详情的状态、下一步、素材、物流与留言体验。重点保证多达人隐私隔离和每个状态只有一个主操作。

## 依赖与允许文件

- 依赖：T03，可与 T04 在不同文件上实施。
- 允许修改：`frontend/src/pages/orders/ModelOrdersPage.tsx`、`frontend/src/pages/orders/ModelFulfillmentDetailPage.tsx`、`frontend/src/pages/orders/OrderDetailPage.tsx`、`frontend/src/pages/orders/talentOrderProgress.ts`、`frontend/src/components/OrderStatusTag.tsx`、`frontend/src/components/OrderMediaUpload.tsx`、`frontend/src/components/FulfillmentMessageBoard.tsx`、对应测试、`frontend/src/styles/talent-orders.css`。本页面断点写在该模块末尾。
- 不允许修改：订单 API、状态枚举、状态转换、媒体校验规则、查询 key、路由或其他角色详情页。

## 列表规格

- Tabs 顺序、状态过滤值和分页保持不变；手机 Tabs 横向滚动，选中项始终可见。
- 桌面保留表格，列顺序为订单、收益、状态、下一步；状态使用统一中文标签。
- 手机使用整行可点击任务卡，顺序为标题+状态、订单号/名额、下一步、收益；点击路径保持现有新旧订单分流。
- 加载卡高度稳定；空状态写“暂无符合当前状态的订单”，接口失败提供重新加载。

## 履约详情规格

- 标题区显示名额、订单标题、仅本人可见说明和状态。
- 首区为当前阶段：中文状态、下一步说明、交付/物流条件、唯一主操作。
- 中区按当前状态展示物流、最近素材版本、审核反馈和所需凭证；不可用操作不占位。
- 后区为历史时间线与 `FulfillmentMessageBoard`，留言发送逻辑和参与者可见范围不变。
- 素材缩略图为固定 4:3，图片和视频都显示类型；视频保留原生 controls。
- `REVISION_REQUIRED` 的反馈紧邻上传区；新版本提交后旧版本仍可在历史中核对。

## 旧订单详情

- 继续兼容没有 fulfillment id 的订单，不移除旧组件。
- 使用同一状态标签和“下一步”展示，但不将父订单状态强行映射为新履约状态。
- 商家/管理端调用该组件的现有路径与操作不得受影响；若共享结构无法隔离，保留其旧布局并只改达人分支。

## 状态验收矩阵

至少为当前代码支持的下列状态建立展示断言：待寄样/待处理、待收货、拍摄中、已提交待审核、要求修改、待返货/待验收、已完成、争议、取消。不得为了补矩阵创建新的后端状态。

## 实施步骤

- [ ] 先为 `talentOrderNextAction` 和状态标签建立完整中文映射测试。
- [ ] 调整列表 DOM 与移动卡，不改变 navigate 条件。
- [ ] 调整详情信息区，再处理上传、留言、时间线等次级区。
- [ ] 将 JSX 中固定媒体尺寸和颜色迁入 CSS class，业务产生的 URL 保持动态。
- [ ] 验证达人页面不会渲染其他申请者或其他名额的姓名、物流、素材、消息和金额。

## 验收

- 新旧订单都能从列表进入正确详情，返回到 `/model/orders`。
- 每个状态最多一个主按钮，禁用原因就近可见。
- 390px 的素材、物流单号、长反馈和留言不溢出。
- 现有媒体数量、视频时长/类型、物流字段和提交参数不变。
- 相关测试、`npm test`、`npm run build`、`git diff --check` 通过。

## 完成反馈

使用统一模板，并附状态矩阵：状态、中文标签、下一步、主操作、测试名称。最后写：

> T05 已停止扩展，等待主审检查后再进入下一任务。
