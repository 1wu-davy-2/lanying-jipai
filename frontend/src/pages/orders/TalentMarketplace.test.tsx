import { render, screen, within } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ReactNode } from "react";

import { MarketplaceOrderDetailPage } from "./MarketplaceOrderDetailPage";
import { ModelHallPage } from "./ModelHallPage";

const mocks = vi.hoisted(() => ({
  getHallOrder: vi.fn(),
  getOrderHall: vi.fn(),
  getTalentStatus: vi.fn(),
}));

vi.mock("../../api/orders", () => ({
  applyForOrder: vi.fn(),
  getHallOrder: mocks.getHallOrder,
  getOrderHall: mocks.getOrderHall,
  productSourceLabels: { merchant_ship: "商家寄样", talent_purchase: "达人自行购买", talent_owned: "达人已有同款" },
}));

vi.mock("../../api/users", () => ({
  getTalentStatus: mocks.getTalentStatus,
}));

const sampleOrder = {
  id: 8,
  order_no: "JP202607300008",
  merchant_id: 3,
  model_id: null,
  title: "夏季防晒衣平拍",
  description: "拍摄适合商品详情页展示的平拍素材，突出面料与版型。",
  product_categories: ["服饰穿搭"],
  commission_amount: "66.00",
  deposit_amount: "0.00",
  sample_images: [],
  order_type: "product_photo" as const,
  quantity: 1,
  required_media_count: 6,
  delivery_days: 3,
  deposit_required: false,
  return_required: false,
  product_source: "talent_purchase" as const,
  product_subsidy_amount: "12.00",
  self_keep_after_shoot: true,
  shoot_requirements: "提交 6 张以上清晰图片，包含正面、侧面和细节图。",
  status: "PUBLISHED" as const,
  ship_to_model_tracking_no: null,
  ship_to_model_company: null,
  return_tracking_no: null,
  return_company: null,
  submitted_media: [],
  reject_reason: null,
  created_at: null,
  application_status: null,
  merchant: { id: 3, nickname: "夏日服饰", shop_name: "夏日服饰旗舰店", shop_platform: "抖音", quality_merchant: true, guarantee_deposit_paid: true, guarantee_deposit_amount: "500.00" },
};

function renderPage(node: ReactNode) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter>{node}</MemoryRouter>
    </QueryClientProvider>,
  );
}

beforeEach(() => {
  mocks.getOrderHall.mockResolvedValue({ items: [sampleOrder], total: 1 });
  mocks.getHallOrder.mockResolvedValue(sampleOrder);
  mocks.getTalentStatus.mockResolvedValue({
    profile_complete: true,
    verified: true,
    can_claim: true,
    completed_orders: 4,
    active_orders: 1,
    level: { code: "L1", name: "新手达人", max_active_orders: 2, max_commission_amount: "100.00", next_level_completed_orders: 10 },
  });
});

describe("talent marketplace", () => {
  it("shows a scannable order hall card with category, reward, delivery time, and detail action", async () => {
    renderPage(<ModelHallPage />);

    expect(await screen.findByRole("heading", { name: "订单大厅" })).toBeVisible();
    expect(await screen.findByText("夏季防晒衣平拍")).toBeVisible();
    const orderCard = screen.getByRole("article");
    expect(orderCard.querySelector(".ant-tag")).toHaveTextContent("服饰穿搭");
    expect(within(orderCard).getByText("¥66.00")).toBeVisible();
    expect(within(orderCard).getByText("达人自行购买")).toBeVisible();
    expect(within(orderCard).getByText("拍完自留")).toBeVisible();
    expect(within(orderCard).getByText("优质商家")).toBeVisible();
    expect(within(orderCard).getByText("已缴保证金")).toBeVisible();
    expect(within(orderCard).getByText("3 天交付")).toBeVisible();
    expect(within(orderCard).getByRole("button", { name: "查看详情并申请" })).toBeVisible();
  });

  it("groups an order detail into reward, work, completion, and platform rules", async () => {
    renderPage(<MarketplaceOrderDetailPage orderId={8} />);

    expect(await screen.findByRole("heading", { name: "可获得收益" })).toBeVisible();
    expect(screen.getByRole("heading", { name: "你需要完成" })).toBeVisible();
    expect(screen.getByRole("heading", { name: "如何完成" })).toBeVisible();
    expect(screen.getByRole("heading", { name: "订单保障与规则" })).toBeVisible();
    expect(screen.getByRole("button", { name: "提交接单申请" })).toBeVisible();
  });
});
