import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { AdminDashboardPage } from "./AdminDashboardPage";

const mocks = vi.hoisted(() => ({ getDashboard: vi.fn() }));

vi.mock("../../api/admin", () => ({ getDashboard: mocks.getDashboard }));

function renderPage() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter><AdminDashboardPage /></MemoryRouter>
    </QueryClientProvider>,
  );
}

beforeEach(() => {
  mocks.getDashboard.mockResolvedValue({ today_orders: 5, month_orders: 88, month_completed_amount: "12345.60", pending_withdrawals: 3, disputed_orders: 1 });
});

afterEach(() => {
  vi.clearAllMocks();
});

describe("AdminDashboardPage", () => {
  it("shows the core metrics in a compact strip with clear labels", async () => {
    renderPage();

    expect(await screen.findByText("今日新增订单")).toBeVisible();
    expect(screen.getByText("5")).toBeVisible();
    expect(screen.getByText("88")).toBeVisible();
    expect(screen.getByText("¥12345.60")).toBeVisible();
    expect(screen.getByText("待审核提现")).toBeVisible();
    expect(screen.getByText("待处理争议")).toBeVisible();
  });

  it("offers reload instead of showing zeros when the dashboard fails", async () => {
    mocks.getDashboard.mockRejectedValueOnce(new Error("网络异常"));
    renderPage();

    expect(await screen.findByText("看板数据加载失败，请稍后重试")).toBeVisible();
    fireEvent.click(screen.getByRole("button", { name: "重新加载" }));
    await waitFor(() => expect(mocks.getDashboard).toHaveBeenCalledTimes(2));
  });
});
