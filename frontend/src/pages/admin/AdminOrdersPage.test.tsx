import { fireEvent, render, screen } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { AdminOrdersPage } from "./AdminOrdersPage";

const mocks = vi.hoisted(() => ({ getAdminOrders: vi.fn() }));

vi.mock("../../api/admin", () => ({ getAdminOrders: mocks.getAdminOrders }));

const items = [
  { id: 1, order_no: "JP001", title: "监控订单一", commission_amount: "66.00", status: "IN_PROGRESS", delivery_days: 5, created_at: "2026-08-01T10:00:00Z" },
  { id: 2, order_no: "JP002", title: "监控订单二", commission_amount: "88.00", status: "SOME_NEW_STATUS", delivery_days: 7, created_at: null },
];

function renderPage() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter><AdminOrdersPage /></MemoryRouter>
    </QueryClientProvider>,
  );
}

beforeEach(() => {
  mocks.getAdminOrders.mockResolvedValue({ items, total: items.length });
});

afterEach(() => {
  vi.clearAllMocks();
});

describe("AdminOrdersPage", () => {
  it("shows Chinese status labels and a delivery deadline column", async () => {
    renderPage();

    expect((await screen.findAllByText("拍摄中")).length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText("状态未知").length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText("5 天").length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText(/2026/).length).toBeGreaterThanOrEqual(1);
  });

  it("renders mobile summary cards for each monitored order", async () => {
    renderPage();

    const card = (await screen.findAllByText("监控订单一")).map((el) => el.closest(".admin-mobile-order")).find((el): el is HTMLElement => Boolean(el)) as HTMLElement;
    expect(card).toHaveTextContent("JP001");
    expect(card).toHaveTextContent("交付时限 5 天");
    expect(card).toHaveTextContent("¥66.00");
  });

  it("filters the overdue list through the existing switch", async () => {
    renderPage();

    fireEvent.click(await screen.findByRole("switch"));
    expect(mocks.getAdminOrders).toHaveBeenLastCalledWith({ overdue: true });
  });

  it("offers reload when the monitoring list fails", async () => {
    mocks.getAdminOrders.mockRejectedValueOnce(new Error("网络异常"));
    renderPage();

    expect(await screen.findByText("订单加载失败，请稍后重试")).toBeVisible();
    expect(screen.getByRole("button", { name: "重新加载" })).toBeVisible();
  });
});
