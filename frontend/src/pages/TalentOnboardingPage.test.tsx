import { render, screen } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

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
});
