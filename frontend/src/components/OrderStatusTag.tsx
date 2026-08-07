import { Tag } from "antd";

// 状态语义色见 docs/ui-redesign/01-prd.md 6.3：
// 履约待动作金色、进行中蓝色、已完成翡翠色、争议/取消红色或中性灰。
const statusMap: Record<string, { label: string; color: string }> = {
  DRAFT: { label: "草稿", color: "default" },
  PUBLISHED: { label: "招募中", color: "blue" },
  CLAIMED: { label: "待寄样", color: "gold" },
  WAITING_SHIPMENT: { label: "待寄样", color: "gold" },
  OWNED_PRODUCT_REVIEW: { label: "待审核同款", color: "gold" },
  SHIPPED_TO_MODEL: { label: "寄送中", color: "blue" },
  IN_PROGRESS: { label: "拍摄中", color: "blue" },
  SUBMITTED: { label: "待审核返图", color: "gold" },
  REVISION_REQUIRED: { label: "待修改返图", color: "gold" },
  WAITING_RETURN: { label: "待返货", color: "gold" },
  RETURNED: { label: "待验收", color: "gold" },
  COMPLETED: { label: "已完成", color: "green" },
  DISPUTED: { label: "争议中", color: "error" },
  CANCELLED: { label: "已取消", color: "default" },
};

const statusFallback = { label: "状态未知", color: "default" };

export function orderStatusLabel(status: string) {
  return statusMap[status]?.label ?? statusFallback.label;
}

export function OrderStatusTag({ status }: { status: string }) {
  const config = statusMap[status] ?? statusFallback;
  return <Tag color={config.color}>{config.label}</Tag>;
}
