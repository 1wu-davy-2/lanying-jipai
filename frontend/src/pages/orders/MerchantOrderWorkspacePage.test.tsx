import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { App as AntdApp } from "antd";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { MerchantOrderWorkspacePage } from "./MerchantOrderWorkspacePage";

const mocks = vi.hoisted(() => ({
  acceptFulfillment: vi.fn(),
  getFulfillmentMessages: vi.fn(),
  getOrderWorkspace: vi.fn(),
  postFulfillmentMessage: vi.fn(),
  reviewFulfillmentOwnedProduct: vi.fn(),
  reviewFulfillmentSubmission: vi.fn(),
  shipFulfillment: vi.fn(),
  productSourceLabels: {
    merchant_ship: "Merchant ships",
    talent_purchase: "Talent purchases",
    talent_owned: "Talent-owned product",
  },
}));

vi.mock("../../api/orders", () => mocks);

const workspace = {
  order: {
    id: 7,
    order_no: "ORDER-7",
    title: "Disputed fulfillment",
    quantity: 1,
    commission_amount: "10.00",
    product_source: "talent_owned",
    return_required: false,
  },
  summary: {
    quantity: 1,
    approved_quantity: 1,
    active_quantity: 1,
    submitted_quantity: 0,
    completed_quantity: 0,
    available_quantity: 0,
    recruitment_status: "FULL",
  },
  applications: [],
  fulfillments: [{
    id: 3,
    order_id: 7,
    application_id: 4,
    model_id: 11,
    slot_no: 1,
    status: "DISPUTED",
    product_source: "talent_owned",
    return_required: false,
    self_keep_after_shoot: true,
    commission_amount: "10.00",
    product_subsidy_amount: "0.00",
    talent: { id: 11, nickname: "Talent" },
    submissions: [{
      id: 3,
      fulfillment_id: 3,
      version: 1,
      status: "PENDING_REVIEW",
      media_urls: [],
    }],
  }],
};

function renderPage() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={queryClient}>
      <AntdApp><MemoryRouter><MerchantOrderWorkspacePage orderId={7} /></MemoryRouter></AntdApp>
    </QueryClientProvider>,
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.getOrderWorkspace.mockResolvedValue(workspace);
  mocks.getFulfillmentMessages.mockResolvedValue({ items: [], total: 0 });
});

describe("MerchantOrderWorkspacePage", () => {
  it("keeps dispute guidance read-only while arbitration is pending", async () => {
    renderPage();

    fireEvent.click(await screen.findByText("查看达人履约详情"));

    expect(await screen.findByText("返图版本")).toBeInTheDocument();
    expect(await screen.findByText("该履约已进入争议处理")).toBeInTheDocument();
    expect(screen.queryByText("通过返图")).not.toBeInTheDocument();
    expect(screen.queryByText("驳回并要求修改")).not.toBeInTheDocument();
    expect(mocks.reviewFulfillmentSubmission).not.toHaveBeenCalled();
  });

  it("does not expose merchant-only actions to an administrator", async () => {
    const adminWorkspace = { ...workspace, fulfillments: [{ ...workspace.fulfillments[0], status: "CLAIMED" }] };
    mocks.getOrderWorkspace.mockResolvedValue(adminWorkspace);

    render(
      <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
        <AntdApp><MemoryRouter><MerchantOrderWorkspacePage orderId={7} viewerRole="admin" /></MemoryRouter></AntdApp>
      </QueryClientProvider>,
    );

    fireEvent.click(await screen.findByText("查看达人履约详情"));
    expect(await screen.findByText("履约时间线")).toBeInTheDocument();
    expect(screen.queryByText("填写寄样物流")).not.toBeInTheDocument();
    expect(screen.queryByText("通过同款审核")).not.toBeInTheDocument();
  });

  it("lets a merchant reject an owned-product review with a reason", async () => {
    mocks.getOrderWorkspace.mockResolvedValue({ ...workspace, fulfillments: [{ ...workspace.fulfillments[0], status: "OWNED_PRODUCT_REVIEW", submissions: [] }] });
    renderPage();

    fireEvent.click(await screen.findByText("查看达人履约详情"));
    fireEvent.click(await screen.findByText("驳回同款"));
    fireEvent.change(screen.getByPlaceholderText("请填写驳回原因"), { target: { value: "图片与订单要求不一致" } });
    fireEvent.click(screen.getByRole("button", { name: "确认驳回" }));

    await waitFor(() => expect(mocks.reviewFulfillmentOwnedProduct).toHaveBeenCalledWith(3, { approved: false, reason: "图片与订单要求不一致" }));
  });

  it("does not submit an owned-product rejection without a reason", async () => {
    mocks.getOrderWorkspace.mockResolvedValue({ ...workspace, fulfillments: [{ ...workspace.fulfillments[0], status: "OWNED_PRODUCT_REVIEW", submissions: [] }] });
    renderPage();

    fireEvent.click(await screen.findByText("查看达人履约详情"));
    fireEvent.click(await screen.findByText("驳回同款"));
    fireEvent.click(screen.getByRole("button", { name: "确认驳回" }));

    expect(mocks.reviewFulfillmentOwnedProduct).not.toHaveBeenCalled();
  });

  it("prevents a second owned-product review while the first request is pending", async () => {
    let resolveReview: (() => void) | undefined;
    mocks.reviewFulfillmentOwnedProduct.mockImplementation(() => new Promise<void>((resolve) => { resolveReview = resolve; }));
    mocks.getOrderWorkspace.mockResolvedValue({ ...workspace, fulfillments: [{ ...workspace.fulfillments[0], status: "OWNED_PRODUCT_REVIEW", submissions: [] }] });
    renderPage();

    fireEvent.click(await screen.findByText("查看达人履约详情"));
    fireEvent.click(screen.getByText("驳回同款"));
    fireEvent.change(screen.getByPlaceholderText("请填写驳回原因"), { target: { value: "图片与订单要求不一致" } });
    const confirm = screen.getByRole("button", { name: "确认驳回" });
    fireEvent.click(confirm);
    fireEvent.click(confirm);

    await waitFor(() => expect(mocks.reviewFulfillmentOwnedProduct).toHaveBeenCalledTimes(1));
    resolveReview?.();
  });
});
