import { describe, expect, it } from "vitest";

import type { FulfillmentStatus, OrderStatus } from "../../api/orders";
import { talentOrderNextAction } from "./talentOrderProgress";

const nextActionMatrix: Record<string, string> = {
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
  PUBLISHED: "等待运营分配",
};

describe("talentOrderNextAction", () => {
  it.each(Object.entries(nextActionMatrix))("maps %s to a Chinese next action", (status, expected) => {
    expect(talentOrderNextAction(status as OrderStatus | FulfillmentStatus)).toBe(expected);
  });

  it("keeps an unknown status visible instead of hiding it", () => {
    expect(talentOrderNextAction("UNKNOWN_STATUS" as OrderStatus)).toBe("UNKNOWN_STATUS");
  });
});
