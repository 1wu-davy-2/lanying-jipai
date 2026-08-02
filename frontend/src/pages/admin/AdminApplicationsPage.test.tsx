import { render, screen } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { AdminApplicationsPage } from "./AdminApplicationsPage";

const mocks = vi.hoisted(() => ({
  getAdminOrderApplications: vi.fn(),
  reviewOrderApplication: vi.fn(),
}));

vi.mock("../../api/admin", () => ({
  getAdminOrderApplications: mocks.getAdminOrderApplications,
  reviewOrderApplication: mocks.reviewOrderApplication,
}));

function renderPage() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(<QueryClientProvider client={queryClient}><MemoryRouter><AdminApplicationsPage /></MemoryRouter></QueryClientProvider>);
}

beforeEach(() => {
  mocks.getAdminOrderApplications.mockResolvedValue({
    items: [{
      id: 10,
      status: "PENDING",
      message: "申请说明",
      owned_product_images: [],
      review_reason: null,
      created_at: null,
      reviewed_at: null,
      applicant: { id: 7, nickname: "达人甲", avatar_url: null, verify_status: "verified", level: "L2" },
      order: {
        id: 3,
        order_no: "ORDER-3",
        title: "满额订单",
        quantity: 1,
        approved_quantity: 1,
        available_quantity: 0,
        recruitment_status: "FULL",
      },
    }],
    total: 21,
    page: 1,
    page_size: 20,
  });
});

describe("AdminApplicationsPage", () => {
  it("loads all statuses with server pagination and disables review for a full order", async () => {
    renderPage();

    expect(await screen.findByText("满额订单")).toBeVisible();
    expect(mocks.getAdminOrderApplications).toHaveBeenCalledWith(undefined, { page: 1, page_size: 20 });
    expect(screen.getByRole("button", { name: "审 核" })).toBeDisabled();
    expect(screen.getByText("订单名额已满，不能再分配达人")).toBeVisible();
    expect(screen.getByText("第 1-20 条，共 21 条")).toBeVisible();
  });
});
