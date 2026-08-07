import { render, screen } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { ProfilePage } from "./ProfilePage";

const mocks = vi.hoisted(() => ({
  getCurrentUser: vi.fn(),
  getTalentStatus: vi.fn(),
  saveCurrentUser: vi.fn(),
  saveMerchantProfile: vi.fn(),
  saveModelProfile: vi.fn(),
  submitVerification: vi.fn(),
}));

vi.mock("../api/users", () => mocks);

function renderPage() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter><ProfilePage role="model" /></MemoryRouter>
    </QueryClientProvider>,
  );
}

beforeEach(() => {
  mocks.getCurrentUser.mockResolvedValue({
    id: 2,
    phone: "13800138001",
    role: "model",
    nickname: "小雨",
    avatar_url: "https://example.com/avatar.png",
    verify_status: "verified",
    model_profile: {
      height_cm: 162,
      weight_kg: 49,
      skill_tags: "服饰,平拍",
      receive_address: "上海市/浦东新区",
      receiver_name: "小雨",
      receiver_phone: "13800138001",
      receive_address_detail: "测试路 88 号",
      portfolio_urls: Array.from({ length: 6 }, (_, index) => `https://example.com/${index}.png`),
    },
  });
  mocks.getTalentStatus.mockResolvedValue({
    profile_complete: true,
    verified: true,
    can_claim: true,
    completed_orders: 8,
    active_orders: 1,
    level: { code: "L2", name: "成长达人", max_active_orders: 3, max_commission_amount: "300.00", next_level_completed_orders: 20 },
  });
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("ProfilePage", () => {
  it("presents a private talent profile around verification, ability, and portfolio", async () => {
    renderPage();

    expect(await screen.findByRole("heading", { name: "身份与认证" })).toBeVisible();
    expect(screen.getByRole("heading", { name: "接单能力" })).toBeVisible();
    expect(screen.getByRole("heading", { name: "收件信息" })).toBeVisible();
    expect(screen.getByRole("heading", { name: "作品集" })).toBeVisible();
    expect(screen.getByRole("button", { name: "维护接单资料" })).toBeVisible();
    expect(screen.queryByText("13800138001")).not.toBeInTheDocument();
    expect(screen.queryByText("测试路 88 号")).not.toBeInTheDocument();
  });

  it("renders the read-only profile without Ant Design deprecation warnings", async () => {
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => undefined);
    renderPage();

    await screen.findByRole("heading", { name: "身份与认证" });
    const diagnostics = consoleError.mock.calls.flat().join(" ");

    expect(diagnostics).not.toContain("labelStyle");
    expect(diagnostics).not.toContain("useForm");
  });

  it("explains the purpose of each verification field", async () => {
    mocks.getCurrentUser.mockResolvedValue({ ...(await mocks.getCurrentUser()), verify_status: "unverified" });
    renderPage();

    expect(await screen.findByText("仅用于实名认证与结算核对")).toBeVisible();
    expect(screen.getByText("仅用于实名认证，审核后按权限脱敏显示")).toBeVisible();
    expect(screen.getByText("仅用于提现结算")).toBeVisible();
  });

  it("shows the pending verification state with a single review entry", async () => {
    mocks.getCurrentUser.mockResolvedValue({ ...(await mocks.getCurrentUser()), verify_status: "pending" });
    renderPage();

    expect(await screen.findByText("实名认证审核中")).toBeVisible();
    expect(screen.getByText("审核通过后即可正式接单。")).toBeVisible();
  });

  it("shows the rejected verification state with the full reason and a resubmit form", async () => {
    mocks.getCurrentUser.mockResolvedValue({ ...(await mocks.getCurrentUser()), verify_status: "rejected", verify_reject_reason: "身份证照片不清晰，请重新提交清晰版本" });
    renderPage();

    expect(await screen.findByText("认证被驳回")).toBeVisible();
    expect(screen.getByText("身份证照片不清晰，请重新提交清晰版本")).toBeVisible();
    expect(screen.getByRole("button", { name: "提交认证" })).toBeVisible();
  });

  it("renders the merchant profile branch with the same verification fields", async () => {
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    mocks.getCurrentUser.mockResolvedValue({ id: 1, phone: "13000000001", role: "merchant", nickname: "夏日服饰", verify_status: "unverified" });
    render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter><ProfilePage role="merchant" /></MemoryRouter>
      </QueryClientProvider>,
    );

    expect(await screen.findByRole("heading", { name: "店铺资料" })).toBeVisible();
    expect(await screen.findByLabelText("店铺名称")).toBeVisible();
    expect(screen.getByText("仅用于提现结算")).toBeVisible();
    expect(screen.queryByText("接单能力")).not.toBeInTheDocument();
  });
});
