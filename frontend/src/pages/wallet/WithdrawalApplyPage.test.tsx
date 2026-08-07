import { useEffect } from "react";
import type { ReactNode } from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter, Route, Routes, useLocation } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { WithdrawalApplyPage } from "./WithdrawalApplyPage";

const mocks = vi.hoisted(() => ({
  applyWithdrawal: vi.fn(),
  getCurrentUser: vi.fn(),
  getWallet: vi.fn(),
}));

vi.mock("../../api/wallets", () => ({
  applyWithdrawal: mocks.applyWithdrawal,
  getWallet: mocks.getWallet,
}));

vi.mock("../../api/users", () => ({
  getCurrentUser: mocks.getCurrentUser,
}));

function LocationProbe({ onPath }: { onPath: (path: string) => void }) {
  const location = useLocation();
  useEffect(() => { onPath(location.pathname); }, [location.pathname, onPath]);
  return null;
}

function renderPage(onPath?: (path: string) => void) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={["/"]}>
        <Routes>
          <Route path="/" element={<WithdrawalApplyPage />} />
          <Route path="/model/wallet" element={<div>资金账户</div>} />
        </Routes>
        {onPath && <LocationProbe onPath={onPath} />}
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

function fillForm(values: Record<string, string>) {
  for (const [label, value] of Object.entries(values)) {
    const input = screen.getByLabelText(label);
    fireEvent.change(input, { target: { value } });
    fireEvent.blur(input);
  }
}

beforeEach(() => {
  mocks.getWallet.mockResolvedValue({ available_balance: "66.00", frozen_balance: "0.00" });
  mocks.getCurrentUser.mockResolvedValue({ id: 2, phone: "13800138001", role: "model", nickname: "小雨", alipay_account: "alipay@example.com", alipay_real_name: "小雨" });
  mocks.applyWithdrawal.mockResolvedValue(undefined);
});

afterEach(() => {
  vi.clearAllMocks();
});

describe("WithdrawalApplyPage", () => {
  it("shows the available balance, amount limit hint and the alipay snapshot note", async () => {
    renderPage();

    expect(await screen.findByRole("heading", { name: "申请提现" })).toBeVisible();
    expect(screen.getByText("¥66.00")).toBeVisible();
    expect(screen.getByText("不能超过可提现余额 ¥66.00")).toBeVisible();
    expect(document.querySelector(".withdrawal-balance")).toBeInTheDocument();
    expect(screen.getByText("支付宝账号为本次提现的收款账户快照，提交后不会修改你的个人资料。")).toBeVisible();
    expect(screen.getByRole("button", { name: "返回钱包" })).toBeVisible();
  });

  it("submits the withdrawal with the snapshot account and returns to the wallet", async () => {
    const paths: string[] = [];
    renderPage((path) => paths.push(path));

    await screen.findByRole("heading", { name: "申请提现" });
    fillForm({ "提现金额": "50", "收款支付宝账号": "alipay@example.com", "支付宝实名": "小雨" });
    fireEvent.click(screen.getByRole("button", { name: /提交申请/ }));

    expect(await screen.findByText("资金账户")).toBeInTheDocument();
    expect(mocks.applyWithdrawal).toHaveBeenCalledWith({ amount: "50.00", alipay_account: "alipay@example.com", alipay_real_name: "小雨" });
    expect(paths).toContain("/model/wallet");
  });

  it("disables the submit button and explains when there is no available balance", async () => {
    mocks.getWallet.mockResolvedValue({ available_balance: "0.00", frozen_balance: "0.00" });
    renderPage();

    expect(await screen.findByText("当前无可提现余额")).toBeVisible();
    expect(screen.getByRole("button", { name: /提交申请/ })).toBeDisabled();
  });

  it("keeps the entered amount and account when the request fails", async () => {
    mocks.applyWithdrawal.mockRejectedValueOnce(new Error("余额不足"));
    renderPage();

    await screen.findByRole("heading", { name: "申请提现" });
    fillForm({ "提现金额": "50", "收款支付宝账号": "alipay@example.com", "支付宝实名": "小雨" });
    fireEvent.click(screen.getByRole("button", { name: /提交申请/ }));

    expect(await screen.findByText("余额不足")).toBeInTheDocument();
    expect(screen.getByLabelText("提现金额")).toHaveValue("50.00");
    expect(screen.getByLabelText("收款支付宝账号")).toHaveValue("alipay@example.com");
  });
});
