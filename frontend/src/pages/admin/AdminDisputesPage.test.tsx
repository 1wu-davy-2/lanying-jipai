import { render, screen } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { AdminDisputesPage } from "./AdminDisputesPage";

const mocks = vi.hoisted(() => ({
  getDisputedOrders: vi.fn(),
  getFulfillmentDisputes: vi.fn(),
  arbitrateOrder: vi.fn(),
  arbitrateFulfillment: vi.fn(),
}));

vi.mock("../../api/admin", () => ({
  getDisputedOrders: mocks.getDisputedOrders,
  getFulfillmentDisputes: mocks.getFulfillmentDisputes,
  arbitrateOrder: mocks.arbitrateOrder,
  arbitrateFulfillment: mocks.arbitrateFulfillment,
}));

function renderPage() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(<QueryClientProvider client={queryClient}><MemoryRouter><AdminDisputesPage /></MemoryRouter></QueryClientProvider>);
}

beforeEach(() => {
  mocks.getDisputedOrders.mockResolvedValue({ items: [{ id: 1, title: "旧订单争议", order_no: "ORDER-1", reject_reason: "旧原因", commission_amount: "50.00" }], total: 1, page: 1, page_size: 20 });
  mocks.getFulfillmentDisputes.mockResolvedValue({ items: [{
    id: 8,
    order_id: 2,
    slot_no: 2,
    status: "DISPUTED",
    reject_reason: "返图争议",
    commission_amount: "80.00",
    model: { id: 9, nickname: "达人乙" },
    talent: null,
    order: { id: 2, order_no: "ORDER-2", title: "多人履约订单" },
  }], total: 1, page: 1, page_size: 20 });
});

describe("AdminDisputesPage", () => {
  it("shows legacy order disputes and fulfillment disputes together", async () => {
    renderPage();

    expect(await screen.findByText("旧订单争议")).toBeVisible();
    expect(await screen.findByText("多人履约订单")).toBeVisible();
    expect(screen.getByText("新履约")).toBeVisible();
    expect(mocks.getFulfillmentDisputes).toHaveBeenCalledWith({ page: 1, page_size: 20 });
  });
});
