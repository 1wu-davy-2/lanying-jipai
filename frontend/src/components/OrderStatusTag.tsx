import { Tag } from "antd";

const statusMap: Record<string, { label: string; color: string }> = {
  DRAFT: { label: "草稿", color: "default" }, PUBLISHED: { label: "待抢单", color: "blue" }, CLAIMED: { label: "待寄出", color: "cyan" }, OWNED_PRODUCT_REVIEW: { label: "待审核同款", color: "purple" }, SHIPPED_TO_MODEL: { label: "寄送中", color: "processing" }, IN_PROGRESS: { label: "拍摄中", color: "gold" }, RETURNED: { label: "待验收", color: "orange" }, COMPLETED: { label: "已完成", color: "success" }, DISPUTED: { label: "争议中", color: "error" }, CANCELLED: { label: "已取消", color: "default" },
};

export function orderStatusLabel(status: string) {
  return statusMap[status]?.label ?? status;
}

export function OrderStatusTag({ status }: { status: string }) {
  const config = statusMap[status] ?? { label: status, color: "default" };
  return <Tag color={config.color}>{config.label}</Tag>;
}
