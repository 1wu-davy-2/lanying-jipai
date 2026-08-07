import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { WalletPage } from "./WalletPage";

const mocks = vi.hoisted(() => ({
  getMyWithdrawals: vi.fn(),
  getWallet: vi.fn(),
  getWalletTransactions: vi.fn(),
}));

vi.mock("../../api/wallets", () => mocks);

function renderPage() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter><WalletPage /></MemoryRouter>
    </QueryClientProvider>,
  );
}

beforeEach(() => {
  mocks.getWallet.mockResolvedValue({ available_balance: "66.00", frozen_balance: "18.00" });
  mocks.getWalletTransactions.mockResolvedValue({ items: [], total: 12, page: 1, page_size: 20 });
  mocks.getMyWithdrawals.mockResolvedValue({ items: [], total: 0, page: 1, page_size: 20 });
});

afterEach(() => {
  vi.clearAllMocks();
});

describe("WalletPage", () => {
  it("keeps withdrawable balance as the primary figure and processing items as secondary", async () => {
    renderPage();

    expect(await screen.findByRole("heading", { name: "资金账户" })).toBeVisible();
    const primary = screen.getAllByText("可提现余额").map((el) => el.closest(".wallet-summary-primary")).find((el): el is HTMLElement => Boolean(el)) as HTMLElement;
    const secondary = screen.getByText("处理中提现").closest(".wallet-summary-secondary") as HTMLElement;

    await waitFor(() => expect(primary).toHaveTextContent("¥66.00"));
    expect(secondary).toHaveTextContent("¥18.00");
    expect(secondary).toHaveTextContent("12 笔");
    expect(screen.getByRole("button", { name: "申请提现" })).toBeVisible();
  });

  it("renders mobile bill lists with signed amounts and neutral fallback for unknown withdrawal statuses", async () => {
    mocks.getWalletTransactions.mockResolvedValue({
      items: [
        { id: 1, type: "order_settlement", amount: "66.00", balance_after: "66.00", created_at: "2026-08-01T10:00:00Z" },
        { id: 2, type: "withdrawal_freeze", amount: "-18.00", balance_after: "48.00", created_at: "2026-08-02T10:00:00Z" },
      ], total: 2, page: 1, page_size: 20,
    });
    mocks.getMyWithdrawals.mockResolvedValue({
      items: [
        { id: 3, withdrawal_no: "TX202608020001", amount: "18.00", status: "rejected", reject_reason: "账号实名不一致", created_at: "2026-08-02T10:00:00Z" },
        { id: 4, withdrawal_no: "TX202608020002", amount: "5.00", status: "SOME_NEW_STATUS", reject_reason: null, created_at: null },
      ], total: 2, page: 1, page_size: 20,
    });
    renderPage();

    expect((await screen.findAllByText("订单佣金结算")).length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText("+¥66.00").length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText("¥-18.00").length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText("变动后余额 ¥48.00", { exact: false })).toBeInTheDocument();
    expect(screen.getAllByText("TX202608020001").length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText("已驳回").length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText("驳回原因：账号实名不一致")).toBeInTheDocument();
    expect(screen.getAllByText("状态未知").length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText("-").length).toBeGreaterThanOrEqual(1);
  });

  it("offers reload when wallet data fails instead of showing zeros", async () => {
    mocks.getWallet.mockRejectedValueOnce(new Error("网络异常"));
    renderPage();

    expect(await screen.findByText("资金数据加载失败")).toBeVisible();
    fireEvent.click(screen.getByRole("button", { name: "重新加载" }));
    await waitFor(() => expect(mocks.getWallet).toHaveBeenCalledTimes(2));
  });
});
