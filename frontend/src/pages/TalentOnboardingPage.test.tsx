import { render, screen } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { TalentOnboardingPage } from "./TalentOnboardingPage";

const mocks = vi.hoisted(() => ({
  getCurrentUser: vi.fn(),
  saveCurrentUser: vi.fn(),
  saveModelProfile: vi.fn(),
  submitVerification: vi.fn(),
}));

vi.mock("../api/users", () => mocks);

function renderPage() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={["/model/onboarding"]}><TalentOnboardingPage /></MemoryRouter>
    </QueryClientProvider>,
  );
}

beforeEach(() => {
  mocks.getCurrentUser.mockResolvedValue({
    id: 2,
    phone: "13800138001",
    role: "model",
    nickname: "小雨",
    verify_status: "unverified",
    model_profile: { receive_address: "", receiver_name: "", receiver_phone: "", receive_address_detail: "", portfolio_urls: [] },
  });
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("TalentOnboardingPage", () => {
  it("presents the two onboarding steps with a clear preparation context", async () => {
    renderPage();

    expect(await screen.findByRole("heading", { name: "达人入驻" })).toBeVisible();
    expect(screen.getByText("入驻准备")).toBeVisible();
    expect(screen.getByText("完善资料")).toBeVisible();
    expect(screen.getByText("实名认证")).toBeVisible();
    expect(screen.getByText("接单资料")).toBeVisible();
    expect(screen.getByRole("button", { name: "下一步：实名认证" })).toBeVisible();
  });

  it("does not create unconnected form instances before the verification step", async () => {
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => undefined);
    renderPage();

    await screen.findByRole("heading", { name: "达人入驻" });

    expect(consoleError.mock.calls.flat().join(" ")).not.toContain("useForm");
  });

  it("does not create form instances after verification is complete", async () => {
    mocks.getCurrentUser.mockResolvedValueOnce({
      id: 2,
      phone: "13800138001",
      role: "model",
      nickname: "小雨",
      verify_status: "verified",
      model_profile: { receive_address: "上海市/浦东新区", receiver_name: "小雨", receiver_phone: "13800138001", receive_address_detail: "测试路 88 号", portfolio_urls: Array.from({ length: 6 }, () => "https://example.com/portfolio.png") },
    });
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => undefined);
    renderPage();

    await screen.findByText("达人认证已通过");

    expect(consoleError.mock.calls.flat().join(" ")).not.toContain("useForm");
  });
});
