import { fireEvent, render, screen, within } from "@testing-library/react";
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
    expect((await screen.findAllByText("多人履约订单")).length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText("新履约").length).toBeGreaterThanOrEqual(1);
    expect(mocks.getFulfillmentDisputes).toHaveBeenCalledWith({ page: 1, page_size: 20 });
  });

  it("distinguishes the arbitration scope for fulfillment disputes", async () => {
    renderPage();

    await screen.findByText("返图争议");
    const mobileItem = screen.getAllByText("多人履约订单").map((el) => el.closest(".admin-mobile-dispute")).find((el): el is HTMLElement => Boolean(el)) as HTMLElement;
    fireEvent.click(within(mobileItem).getByRole("button", { name: /仲\s*裁/ }));
    expect(await screen.findByText("本操作只影响名额 2 的单个履约实例。")).toBeInTheDocument();
    expect(screen.getByText("履约仲裁")).toBeInTheDocument();
  });

  it("shows the dispute status in Chinese on both desktop and mobile summaries", async () => {
    renderPage();

    expect((await screen.findAllByText("争议中")).length).toBeGreaterThanOrEqual(1);
    const mobileItem = screen.getAllByText("多人履约订单").map((el) => el.closest(".admin-mobile-dispute")).find((el): el is HTMLElement => Boolean(el)) as HTMLElement;
    expect(mobileItem).toHaveTextContent("第 2 个名额");
    expect(mobileItem).toHaveTextContent("返图争议");
    expect(mobileItem).toHaveTextContent("¥80.00");
  });
});
