import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { AdminWithdrawalsPage } from "./AdminWithdrawalsPage";

const mocks = vi.hoisted(() => ({
  approveWithdrawal: vi.fn(),
  completeWithdrawal: vi.fn(),
  getAdminWithdrawals: vi.fn(),
  rejectWithdrawal: vi.fn(),
}));

vi.mock("../../api/admin", () => ({
  approveWithdrawal: mocks.approveWithdrawal,
  completeWithdrawal: mocks.completeWithdrawal,
  getAdminWithdrawals: mocks.getAdminWithdrawals,
  rejectWithdrawal: mocks.rejectWithdrawal,
}));

const withdrawals = [
  { id: 1, withdrawal_no: "TX001", amount: "66.00", alipay_account: "a@example.com", alipay_real_name: "小雨", status: "rejected", reject_reason: "账号实名不一致", transfer_no: null, created_at: "2026-08-01T10:00:00Z" },
  { id: 2, withdrawal_no: "TX002", amount: "18.00", alipay_account: "b@example.com", alipay_real_name: "阿棠", status: "approved", reject_reason: null, transfer_no: null, created_at: null },
  { id: 3, withdrawal_no: "TX003", amount: "9.00", alipay_account: "c@example.com", alipay_real_name: "小鱼", status: "SOME_NEW_STATUS", reject_reason: null, transfer_no: "Z20260801001", created_at: null },
  { id: 4, withdrawal_no: "TX004", amount: "30.00", alipay_account: "d@example.com", alipay_real_name: "阿花", status: "pending", reject_reason: null, transfer_no: null, created_at: "2026-08-02T10:00:00Z" },
];

function renderPage() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter><AdminWithdrawalsPage /></MemoryRouter>
    </QueryClientProvider>,
  );
}

beforeEach(() => {
  mocks.getAdminWithdrawals.mockResolvedValue({ items: withdrawals, total: withdrawals.length });
  mocks.approveWithdrawal.mockResolvedValue(undefined);
  mocks.completeWithdrawal.mockResolvedValue(undefined);
  mocks.rejectWithdrawal.mockResolvedValue(undefined);
});

afterEach(() => {
  vi.clearAllMocks();
});

describe("AdminWithdrawalsPage", () => {
  it("shows reject reasons and transfer numbers in the mobile summaries", async () => {
    renderPage();

    expect((await screen.findAllByText("TX001")).length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText("驳回原因：账号实名不一致").length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText("转账流水：Z20260801001").length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText("状态未知").length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText("¥66.00")).toBeVisible();
  });

  it("shows the reject flow with a required reason", async () => {
    renderPage();

    fireEvent.click((await screen.findAllByRole("button", { name: /驳\s*回/ }))[0]);
    fireEvent.click(screen.getByRole("button", { name: /确\s*认/ }));

    expect(mocks.rejectWithdrawal).not.toHaveBeenCalled();

    fireEvent.change(screen.getByLabelText("驳回原因"), { target: { value: "账号实名不一致" } });
    fireEvent.click(screen.getByRole("button", { name: /确\s*认/ }));

    await waitFor(() => expect(mocks.rejectWithdrawal).toHaveBeenCalledWith(4, "账号实名不一致"));
  });

  it("registers the transfer number for an approved withdrawal", async () => {
    renderPage();

    fireEvent.click((await screen.findAllByRole("button", { name: /登记转账/ }))[0]);
    fireEvent.change(screen.getByLabelText("支付宝转账流水号"), { target: { value: "Z20260801002" } });
    fireEvent.click(screen.getByRole("button", { name: /确\s*认/ }));

    await waitFor(() => expect(mocks.completeWithdrawal).toHaveBeenCalledWith(2, "Z20260801002"));
  });
});
