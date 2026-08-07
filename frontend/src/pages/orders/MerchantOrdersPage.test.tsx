import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { MerchantOrdersPage } from "./MerchantOrdersPage";

const mocks = vi.hoisted(() => ({
  createOrder: vi.fn(),
  getMyOrders: vi.fn(),
}));

vi.mock("../../api/orders", () => ({
  createOrder: mocks.createOrder,
  getMyOrders: mocks.getMyOrders,
}));

vi.mock("../../components/OrderMediaUpload", () => ({ OrderMediaUpload: () => <div data-testid="media-upload" /> }));

const orders = [
  { id: 1, order_no: "JP001", title: "夏季防晒衣", commission_amount: "66.00", status: "PUBLISHED", quantity: 2, approved_quantity: 1, completed_quantity: 0, pending_application_count: 3, waiting_acceptance_count: 0, created_at: "2026-08-01T10:00:00Z" },
  { id: 2, order_no: "JP002", title: "秋冬大衣", commission_amount: "88.00", status: "COMPLETED", quantity: 1, completed_quantity: 1, created_at: "2026-07-20T10:00:00Z" },
];

function renderPage() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter><MerchantOrdersPage /></MemoryRouter>
    </QueryClientProvider>,
  );
}

beforeEach(() => {
  mocks.getMyOrders.mockResolvedValue({ items: orders, total: orders.length, page: 1, page_size: 20 });
  mocks.createOrder.mockResolvedValue({ id: 99 });
});

afterEach(() => {
  vi.clearAllMocks();
});

describe("MerchantOrdersPage", () => {
  it("shows recruitment and fulfillment progress alongside order status on desktop", async () => {
    renderPage();

    expect((await screen.findAllByText("夏季防晒衣")).length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText("1/2").length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText("待审 3").length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText("0/2").length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText("已完成").length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText(/2026/).length).toBeGreaterThanOrEqual(1);
  });

  it("renders mobile summary cards with status, progress and amount", async () => {
    renderPage();

    const card = (await screen.findAllByText("夏季防晒衣")).map((el) => el.closest(".merchant-mobile-order")).find((el): el is HTMLElement => Boolean(el)) as HTMLElement;
    expect(card).toBeInTheDocument();
    expect(card).toHaveTextContent("JP001");
    expect(card).toHaveTextContent("名额 1/2");
    expect(card).toHaveTextContent("完成 0/2");
    expect(card).toHaveTextContent("佣金 ¥66.00");
  });

  it("groups the publish form without changing field defaults or payload", async () => {
    renderPage();

    fireEvent.click(await screen.findByRole("button", { name: "发布订单" }));
    expect(screen.getByRole("heading", { name: "商品与合作" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "样品处理" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "数量与费用" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "交付要求" })).toBeInTheDocument();
    expect(screen.getByTestId("media-upload")).toBeInTheDocument();
    expect(screen.getByLabelText("寄拍数量")).toHaveValue("1");
    expect(screen.getByLabelText("交付素材")).toHaveValue("6");
    expect(screen.getByLabelText("收货后交付")).toHaveValue("5");
  });

  it("submits the publish form with the same payload contract", async () => {
    // 下拉、弹层与表单交互在低配环境较慢，放宽该用例超时（不弱化断言）
    renderPage();

    fireEvent.click(await screen.findByRole("button", { name: "发布订单" }));
    fireEvent.change(screen.getByLabelText("订单标题"), { target: { value: "新季度连衣裙平拍" } });
    fireEvent.change(screen.getByLabelText("拍摄说明"), { target: { value: "突出面料与版型" } });
    fireEvent.change(screen.getByLabelText("佣金"), { target: { value: "88" } });
    fireEvent.blur(screen.getByLabelText("佣金"));
    fireEvent.mouseDown(screen.getByLabelText("商品分类"));
    fireEvent.click(await screen.findByTitle("服饰穿搭"));

    fireEvent.click(screen.getByRole("button", { name: /确认发布/ }));

    await waitFor(() => expect(mocks.createOrder).toHaveBeenCalled());
    const payload = mocks.createOrder.mock.calls[0][0] as Record<string, unknown>;
    expect(payload.title).toBe("新季度连衣裙平拍");
    expect(payload.description).toBe("突出面料与版型");
    expect(payload.commission_amount).toBe("88.00");
    expect(payload.product_categories).toEqual(["服饰穿搭"]);
    expect(payload.quantity).toBe(1);
    expect(payload.required_media_count).toBe(6);
    expect(payload.delivery_days).toBe(5);
    expect(payload.deposit_required).toBe(false);
    expect(payload.deposit_amount).toBe("0.00");
    expect(payload.product_source).toBe("merchant_ship");
    expect(payload.return_required).toBe(true);
    expect(payload.self_keep_after_shoot).toBe(false);
    expect(payload.product_subsidy_amount).toBe("0.00");
    expect(payload.sample_images).toEqual([]);
  }, 15000);

  it("offers reload when the order list fails to load", async () => {
    mocks.getMyOrders.mockRejectedValueOnce(new Error("网络异常"));
    renderPage();

    expect(await screen.findByText("订单加载失败，请稍后重试")).toBeVisible();
    expect(screen.getByRole("button", { name: "重新加载" })).toBeVisible();
  });
});
