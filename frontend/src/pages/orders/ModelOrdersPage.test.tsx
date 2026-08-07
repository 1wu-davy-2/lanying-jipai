import { render, screen } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { ModelOrdersPage } from "./ModelOrdersPage";
import { OrderDetailPage } from "./OrderDetailPage";

const mocks = vi.hoisted(() => ({
  acceptOrder: vi.fn(),
  cancelOrder: vi.fn(),
  getMessages: vi.fn(),
  getMyOrders: vi.fn(),
  getOrder: vi.fn(),
  postMessage: vi.fn(),
  receiveOrder: vi.fn(),
  rejectOrder: vi.fn(),
  shipOrder: vi.fn(),
  submitOrder: vi.fn(),
}));

vi.mock("../../api/orders", () => mocks);

const orders = [
  { id: 1, order_no: "JP001", title: "待寄样订单", commission_amount: "66.00", status: "CLAIMED" },
  { id: 2, order_no: "JP002", title: "待收货订单", commission_amount: "88.00", status: "SHIPPED_TO_MODEL" },
  { id: 3, order_no: "JP003", title: "待提交订单", commission_amount: "99.00", status: "IN_PROGRESS" },
  { id: 4, order_no: "JP004", title: "待验收订单", commission_amount: "100.00", status: "RETURNED" },
  { id: 5, order_no: "JP005", title: "已完成订单", commission_amount: "120.00", status: "COMPLETED" },
];

function renderPage() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter><ModelOrdersPage /></MemoryRouter>
    </QueryClientProvider>,
  );
}

function renderDetailPage() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter><OrderDetailPage role="model" orderId={3} /></MemoryRouter>
    </QueryClientProvider>,
  );
}

beforeEach(() => {
  mocks.getMyOrders.mockResolvedValue({ items: orders, total: orders.length });
  mocks.getMessages.mockResolvedValue({ items: [], total: 0 });
  mocks.getOrder.mockResolvedValue({
    ...orders[2],
    merchant_id: 1,
    model_id: 2,
    description: "完成商品平拍素材。",
    product_categories: ["服饰穿搭"],
    deposit_amount: "0.00",
    sample_images: [],
    order_type: "product_photo",
    quantity: 1,
    required_media_count: 6,
    delivery_days: 3,
    deposit_required: false,
    return_required: false,
    shoot_requirements: "提交清晰商品图。",
    ship_to_model_tracking_no: null,
    ship_to_model_company: null,
    return_tracking_no: null,
    return_company: null,
    submitted_media: [],
    reject_reason: null,
    created_at: null,
    logs: [],
    merchant: { id: 1, nickname: "测试商家", phone: "13000000001" },
  });
});

describe("ModelOrdersPage", () => {
  it("shows the next action for every active talent order status", async () => {
    renderPage();

    expect((await screen.findAllByText("等待商家寄样")).length).toBeGreaterThanOrEqual(2);
    expect(screen.getAllByText("确认收货").length).toBeGreaterThanOrEqual(2);
    expect(screen.getAllByText("提交推广内容").length).toBeGreaterThanOrEqual(2);
    expect(screen.getAllByText("等待商家验收").length).toBeGreaterThanOrEqual(2);
    expect(screen.getAllByText("查看结算明细").length).toBeGreaterThanOrEqual(2);
  });

  it("shows the same next action in a talent order detail", async () => {
    renderDetailPage();

    expect(await screen.findByText("下一步")).toBeVisible();
    expect(screen.getByText("提交推广内容")).toBeVisible();
  });

  it("distinguishes an interface error from an empty list and offers reload", async () => {
    mocks.getMyOrders.mockRejectedValueOnce(new Error("网络异常"));
    renderPage();

    expect(await screen.findByText("订单加载失败，请稍后重试")).toBeVisible();
    expect(screen.queryByText("暂无符合当前状态的订单")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "重新加载" })).toBeVisible();
  });

  it("shows the empty message for the current status filter", async () => {
    mocks.getMyOrders.mockResolvedValueOnce({ items: [], total: 0 });
    renderPage();

    expect(await screen.findByText("暂无符合当前状态的订单")).toBeVisible();
  });
});
