import type { FulfillmentStatus, OrderStatus } from "../../api/orders";

const talentNextActionByStatus: Record<OrderStatus, string> = {
  DRAFT: "等待订单发布",
  PUBLISHED: "等待运营分配",
  CLAIMED: "等待商家寄样",
  OWNED_PRODUCT_REVIEW: "等待商家审核同款",
  SHIPPED_TO_MODEL: "确认收货",
  IN_PROGRESS: "提交推广内容",
  SUBMITTED: "等待商家审核返图",
  REVISION_REQUIRED: "修改后重新提交返图",
  WAITING_RETURN: "填写返货物流",
  RETURNED: "等待商家验收",
  COMPLETED: "查看结算明细",
  DISPUTED: "等待争议处理",
  CANCELLED: "订单已取消",
};

const fulfillmentNextActionByStatus: Partial<Record<FulfillmentStatus, string>> = {
  WAITING_SHIPMENT: "等待商家寄样",
  CLAIMED: "等待商家寄样",
  SHIPPED_TO_MODEL: "确认收货",
  OWNED_PRODUCT_REVIEW: "等待商家审核同款",
  IN_PROGRESS: "提交推广内容",
  SUBMITTED: "等待商家审核返图",
  REVISION_REQUIRED: "修改后重新提交返图",
  WAITING_RETURN: "填写返货物流",
  RETURNED: "等待商家验收",
  COMPLETED: "查看结算明细",
  DISPUTED: "等待争议处理",
  CANCELLED: "履约已取消",
};

export function talentOrderNextAction(status: OrderStatus | FulfillmentStatus) {
  return fulfillmentNextActionByStatus[status as FulfillmentStatus] || talentNextActionByStatus[status as OrderStatus] || status;
}
