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

  it("leads with the current stage, next action and stage facts", async () => {
    renderPage();

    expect(await screen.findByText("当前阶段")).toBeInTheDocument();
    expect(screen.getAllByText("待审核返图").length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText("下一步：等待商家审核返图")).toBeInTheDocument();
    expect(screen.getByText("佣金")).toBeInTheDocument();
    expect(screen.getByText("¥88.00")).toBeInTheDocument();
    expect(screen.getByText("仅显示你自己的物流、返图和审核记录")).toBeInTheDocument();
  });

  it("keeps older submission versions reviewable next to the latest one", async () => {
    mocks.getFulfillment.mockResolvedValue({
      ...fulfillment,
      submissions: [
        { id: 21, fulfillment_id: 12, version: 2, status: "PENDING_REVIEW", media_urls: ["https://cdn.example.com/v2.mp4", "https://cdn.example.com/v2.jpg"], submitted_at: "2026-08-01T10:00:00Z" },
        { id: 20, fulfillment_id: 12, version: 1, status: "REVISION_REQUIRED", media_urls: ["https://cdn.example.com/v1.jpg"], review_reason: "光线不足，请重新拍摄", submitted_at: "2026-07-30T10:00:00Z" },
      ],
    });
    renderPage();

    expect(await screen.findByText(/最近提交 · 第 2 版/)).toBeInTheDocument();
    expect(screen.getByText(/历史版本 · 第 1 版/)).toBeInTheDocument();
    expect(screen.getByText("审核反馈：光线不足，请重新拍摄")).toBeInTheDocument();
    expect(screen.getByText("视频")).toBeInTheDocument();
    expect(screen.getAllByText("图片").length).toBeGreaterThanOrEqual(2);
  });

  it("shows the revision feedback next to the upload box", async () => {
    mocks.getFulfillment.mockResolvedValue({
      ...fulfillment,
      status: "REVISION_REQUIRED",
      submissions: [{ id: 20, fulfillment_id: 12, version: 1, status: "REVISION_REQUIRED", media_urls: ["https://cdn.example.com/v1.jpg"], review_reason: "背景杂乱，请简化场景", submitted_at: null }],
    });
    renderPage();

    expect(await screen.findByText("修改要求")).toBeInTheDocument();
    expect(screen.getByText("背景杂乱，请简化场景")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "提交当前版本" })).toBeInTheDocument();
  });

  it("does not render action forms for waiting review states", async () => {
    renderPage();

    expect(await screen.findByText("当前阶段")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "确认收货" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "提交当前版本" })).not.toBeInTheDocument();
  });
});
