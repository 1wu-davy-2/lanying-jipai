import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { AdminOperationsPage } from "./AdminOperationsPage";

const mocks = vi.hoisted(() => ({
  createAdminMerchant: vi.fn(),
  createAdminOrder: vi.fn(),
  getAdminOrders: vi.fn(),
  getAdminUsers: vi.fn(),
}));

vi.mock("../../api/admin", () => ({
  createAdminMerchant: mocks.createAdminMerchant,
  createAdminOrder: mocks.createAdminOrder,
  getAdminOrders: mocks.getAdminOrders,
  getAdminUsers: mocks.getAdminUsers,
}));

vi.mock("../../components/OrderMediaUpload", () => ({ OrderMediaUpload: () => <div data-testid="media-upload" /> }));

const merchant = { id: 5, nickname: "夏日服饰", phone: "13000000005", merchant_profile: { shop_name: "夏日旗舰店" } };

function renderPage() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter><AdminOperationsPage /></MemoryRouter>
    </QueryClientProvider>,
  );
}

beforeEach(() => {
  mocks.getAdminUsers.mockResolvedValue({ items: [merchant], total: 1 });
  mocks.getAdminOrders.mockResolvedValue({ items: [{ id: 9, order_no: "JP009", title: "代发订单", commission_amount: "66.00", status: "PUBLISHED", delivery_days: 5, created_at: null }], total: 1 });
  mocks.createAdminOrder.mockResolvedValue({ id: 99 });
  mocks.createAdminMerchant.mockResolvedValue(merchant);
});

afterEach(() => {
  vi.clearAllMocks();
});

describe("AdminOperationsPage", () => {
  it("publishes an order for the selected merchant with the same payload contract", async () => {
    // 下拉、弹层与表单交互在低配环境较慢，放宽该用例超时（不弱化断言）
    renderPage();

    fireEvent.mouseDown(await screen.findByRole("combobox"));
    fireEvent.click(await screen.findByTitle("夏日旗舰店 · 13000000005"));
    fireEvent.click(await screen.findByRole("button", { name: "发布订单" }));

    expect(screen.getByRole("heading", { name: "商品与合作" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "数量与费用" })).toBeInTheDocument();
    expect(screen.getByTestId("media-upload")).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText("订单标题"), { target: { value: "代发连衣裙" } });
    fireEvent.change(screen.getByLabelText("拍摄说明"), { target: { value: "平拍展示" } });
    fireEvent.change(screen.getByLabelText("佣金"), { target: { value: "66" } });
    fireEvent.blur(screen.getByLabelText("佣金"));
    fireEvent.mouseDown(screen.getByLabelText("商品分类"));
    fireEvent.click(await screen.findByTitle("服饰穿搭"));
    fireEvent.click(screen.getByRole("button", { name: /确认发布/ }));

    await waitFor(() => expect(mocks.createAdminOrder).toHaveBeenCalled());
    const payload = mocks.createAdminOrder.mock.calls[0][0] as Record<string, unknown>;
    expect(payload.merchant_id).toBe(5);
    expect(payload.title).toBe("代发连衣裙");
    expect(payload.commission_amount).toBe("66.00");
    expect(payload.quantity).toBe(1);
    expect(payload.required_media_count).toBe(6);
    expect(payload.delivery_days).toBe(5);
    expect(payload.product_source).toBe("merchant_ship");
    expect(payload.return_required).toBe(true);
    expect(payload.sample_images).toEqual([]);
  }, 15000);

  it("shows mobile order cards once a merchant is selected", async () => {
    renderPage();

    fireEvent.mouseDown(await screen.findByRole("combobox"));
    fireEvent.click(await screen.findByTitle("夏日旗舰店 · 13000000005"));

    const card = (await screen.findAllByText("代发订单")).map((el) => el.closest(".admin-mobile-order")).find((el): el is HTMLElement => Boolean(el)) as HTMLElement;
    expect(card).toHaveTextContent("JP009");
    expect(card).toHaveTextContent("¥66.00");
  });

  it("shows an empty prompt before any merchant is selected", async () => {
    renderPage();

    expect(await screen.findByText("选择商家后查看或发布订单")).toBeVisible();
  });
});
