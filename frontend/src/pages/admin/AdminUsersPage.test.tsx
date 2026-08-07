import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { AdminUsersPage } from "./AdminUsersPage";

const mocks = vi.hoisted(() => ({
  getAdminUsers: vi.fn(),
  reviewVerification: vi.fn(),
  updateAdminUserStatus: vi.fn(),
  updateMerchantAssurance: vi.fn(),
}));

vi.mock("../../api/admin", () => ({
  getAdminUsers: mocks.getAdminUsers,
  reviewVerification: mocks.reviewVerification,
  updateAdminUserStatus: mocks.updateAdminUserStatus,
  updateMerchantAssurance: mocks.updateMerchantAssurance,
}));

const users = [
  { id: 1, nickname: "测试达人", phone: "13800138001", role: "model", status: "active", verify_status: "pending", registration_channel: "douyin", id_card_no: "110101199001011234" },
  { id: 2, nickname: "夏日旗舰店", phone: "13900139002", role: "merchant", status: "active", verify_status: "verified", registration_channel: null, merchant_profile: { quality_merchant: false, guarantee_deposit_paid: false, guarantee_deposit_amount: "0.00" } },
];

function renderPage() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter><AdminUsersPage /></MemoryRouter>
    </QueryClientProvider>,
  );
}

beforeEach(() => {
  mocks.getAdminUsers.mockResolvedValue({ items: users, total: users.length });
  mocks.reviewVerification.mockResolvedValue(undefined);
  mocks.updateAdminUserStatus.mockResolvedValue(undefined);
  mocks.updateMerchantAssurance.mockResolvedValue(undefined);
});

afterEach(() => {
  vi.clearAllMocks();
});

describe("AdminUsersPage", () => {
  it("renders mobile summaries with masked phone and role status", async () => {
    renderPage();

    const card = (await screen.findAllByText("测试达人")).map((el) => el.closest(".admin-users-mobile-card")).find((el): el is HTMLElement => Boolean(el)) as HTMLElement;
    expect(card).toHaveTextContent("138****8001");
    expect(card).toHaveTextContent("达人");
    expect(card).toHaveTextContent("待审核");
    expect(card).toHaveTextContent("正常");
  });

  it("opens the verification review modal with the masked identity hint", async () => {
    renderPage();

    fireEvent.click((await screen.findAllByRole("button", { name: "审核认证" }))[0]);
    expect(screen.getByText("认证审核")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "确认审核" }));

    await waitFor(() => expect(mocks.reviewVerification).toHaveBeenCalledWith(1, true, undefined));
  });

  it("saves merchant assurance through its dedicated modal", async () => {
    renderPage();

    fireEvent.click((await screen.findAllByRole("button", { name: "设置保障" }))[0]);
    fireEvent.click(screen.getByRole("button", { name: "保存设置" }));

    await waitFor(() => expect(mocks.updateMerchantAssurance).toHaveBeenCalledWith(2, { quality_merchant: false, guarantee_deposit_paid: false, guarantee_deposit_amount: "0.00" }));
  });
});
