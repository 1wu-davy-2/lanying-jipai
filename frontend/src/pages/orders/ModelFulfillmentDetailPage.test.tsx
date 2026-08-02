import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { App as AntdApp } from "antd";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { ModelFulfillmentDetailPage } from "./ModelFulfillmentDetailPage";

const mocks = vi.hoisted(() => ({
  disputeFulfillment: vi.fn(),
  getFulfillment: vi.fn(),
  getFulfillmentMessages: vi.fn(),
  getOrder: vi.fn(),
  postFulfillmentMessage: vi.fn(),
  receiveFulfillment: vi.fn(),
  returnFulfillment: vi.fn(),
  submitFulfillment: vi.fn(),
}));

vi.mock("../../api/orders", () => mocks);
vi.mock("../../components/OrderMediaUpload", () => ({ OrderMediaUpload: () => <div data-testid="media-upload" /> }));

const fulfillment = {
  id: 12,
  order_id: 7,
  application_id: 4,
  model_id: 11,
  slot_no: 2,
  status: "SUBMITTED",
  product_source: "merchant_ship",
  return_required: true,
  self_keep_after_shoot: false,
  commission_amount: "88.00",
  product_subsidy_amount: "0.00",
  submissions: [],
  order: { title: "夏季短视频", required_media_count: 6 },
};

function renderPage() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={queryClient}>
      <AntdApp><MemoryRouter><ModelFulfillmentDetailPage fulfillmentId={12} /></MemoryRouter></AntdApp>
    </QueryClientProvider>,
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.getFulfillment.mockResolvedValue(fulfillment);
  mocks.getOrder.mockResolvedValue({ ...fulfillment.order, id: 7 });
  mocks.getFulfillmentMessages.mockResolvedValue({ items: [], total: 0 });
  mocks.disputeFulfillment.mockResolvedValue({ ...fulfillment, status: "DISPUTED" });
});

describe("ModelFulfillmentDetailPage", () => {
  it("submits a fulfillment dispute and scopes messages to the fulfillment", async () => {
    renderPage();

    expect(await screen.findByText("发起申诉")).toBeInTheDocument();
    expect(mocks.getFulfillmentMessages).toHaveBeenCalledWith(12);

    fireEvent.click(screen.getByText("发起申诉"));
    fireEvent.change(screen.getByPlaceholderText("填写申诉原因"), { target: { value: "返图审核与订单要求不一致" } });
    fireEvent.click(screen.getByRole("button", { name: "提交申诉" }));

    await waitFor(() => expect(mocks.disputeFulfillment).toHaveBeenCalledWith(12, "返图审核与订单要求不一致"));
  });
});
