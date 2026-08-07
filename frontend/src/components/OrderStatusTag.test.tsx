import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { OrderStatusTag, orderStatusLabel } from "./OrderStatusTag";

// 状态矩阵：见 docs/ui-redesign/tasks/T05 验收矩阵。
const matrix: Record<string, { label: string; color: string }> = {
  WAITING_SHIPMENT: { label: "待寄样", color: "gold" },
  CLAIMED: { label: "待寄样", color: "gold" },
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

describe("OrderStatusTag", () => {
  it.each(Object.entries(matrix))("maps %s to a Chinese label with the PRD semantic color", (status, { label, color }) => {
    render(<OrderStatusTag status={status} />);

    expect(screen.getByText(label)).toBeInTheDocument();
    expect(orderStatusLabel(status)).toBe(label);
    expect(screen.getByText(label).closest(".ant-tag")).toHaveClass(`ant-tag-${color}`);
  });

  it("falls back to a neutral Chinese label for unknown statuses", () => {
    render(<OrderStatusTag status="SOME_UNKNOWN_STATUS" />);
    expect(screen.getByText("状态未知")).toBeInTheDocument();
    expect(orderStatusLabel("SOME_UNKNOWN_STATUS")).toBe("状态未知");
  });
});
