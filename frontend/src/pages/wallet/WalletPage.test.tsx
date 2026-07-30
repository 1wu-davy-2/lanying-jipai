import { render, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

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

describe("WalletPage", () => {
  it("separates withdrawable funds, processing withdrawals, and account records", async () => {
    renderPage();

    expect(await screen.findByRole("heading", { name: "资金账户" })).toBeVisible();
    expect(screen.getByText("可提现")).toBeVisible();
    expect(screen.getByText("处理中提现")).toBeVisible();
    expect(screen.getByText("账单记录")).toBeVisible();
    const availableBalanceCard = screen.getByText("可提现").closest(".wallet-summary-card") as HTMLElement;
    const transactionCountCard = screen.getByText("账单记录").closest(".wallet-summary-card") as HTMLElement;

    await waitFor(() => expect(availableBalanceCard).toHaveTextContent("¥66.00"));
    expect(transactionCountCard).toHaveTextContent("12 笔");
    expect(screen.getByRole("button", { name: "申请提现" })).toBeVisible();
  });
});
