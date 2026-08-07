import { fireEvent, render, screen, within } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { ReactNode } from "react";

import { MarketplaceOrderDetailPage } from "./MarketplaceOrderDetailPage";
import { ModelHallPage } from "./ModelHallPage";

const mocks = vi.hoisted(() => ({
  applyForOrder: vi.fn(),
  getHallOrder: vi.fn(),
  getOrderHall: vi.fn(),
  getTalentStatus: vi.fn(),
}));

vi.mock("../../api/orders", () => ({
  applyForOrder: mocks.applyForOrder,
  getHallOrder: mocks.getHallOrder,
  getOrderHall: mocks.getOrderHall,
  productSourceLabels: { merchant_ship: "商家寄样", talent_purchase: "达人自行购买", talent_owned: "达人已有同款" },
}));

vi.mock("../../api/users", () => ({
  getTalentStatus: mocks.getTalentStatus,
}));

const sampleOrder = {
  id: 8,
  order_no: "JP202607300008",
  merchant_id: 3,
  model_id: null,
  title: "夏季防晒衣平拍",
  description: "拍摄适合商品详情页展示的平拍素材，突出面料与版型。",
  product_categories: ["服饰穿搭"],
  commission_amount: "66.00",
  deposit_amount: "0.00",
  sample_images: [],
  order_type: "product_photo" as const,
  quantity: 1,
  required_media_count: 6,
  delivery_days: 3,
  deposit_required: false,
  return_required: false,
  product_source: "talent_purchase" as const,
  product_subsidy_amount: "12.00",
  self_keep_after_shoot: true,
  shoot_requirements: "提交 6 张以上清晰图片，包含正面、侧面和细节图。",
  status: "PUBLISHED" as const,
  ship_to_model_tracking_no: null,
  ship_to_model_company: null,
  return_tracking_no: null,
  return_company: null,
  submitted_media: [],
  reject_reason: null,
  created_at: null,
  application_status: null as string | null,
  application_reason: null as string | null,
  merchant: { id: 3, nickname: "夏日服饰", shop_name: "夏日服饰旗舰店", shop_platform: "抖音", quality_merchant: true, guarantee_deposit_paid: true, guarantee_deposit_amount: "500.00" },
};

const claimableStatus = {
  profile_complete: true,
  verified: true,
  can_claim: true,
  completed_orders: 4,
  active_orders: 1,
  level: { code: "L1", name: "新手达人", max_active_orders: 2, max_commission_amount: "100.00", next_level_completed_orders: 10 },
};

function renderPage(node: ReactNode) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter>{node}</MemoryRouter>
    </QueryClientProvider>,
  );
}

beforeEach(() => {
  mocks.getOrderHall.mockResolvedValue({ items: [sampleOrder], total: 1 });
  mocks.getHallOrder.mockResolvedValue(sampleOrder);
  mocks.getTalentStatus.mockResolvedValue(claimableStatus);
  mocks.applyForOrder.mockResolvedValue(undefined);
});

afterEach(() => {
  vi.clearAllMocks();
});

describe("talent marketplace", () => {
  it("shows a scannable order hall card with total reward, composition, delivery time, and detail action", async () => {
    renderPage(<ModelHallPage />);

    expect(await screen.findByRole("heading", { name: "订单大厅" })).toBeVisible();
    expect(await screen.findByText("夏季防晒衣平拍")).toBeVisible();
    const orderCard = screen.getByRole("article");
    expect(orderCard.querySelector(".ant-tag")).toHaveTextContent("服饰穿搭");
    expect(within(orderCard).getByText("¥78.00")).toBeVisible();
    expect(within(orderCard).getByText(/佣金 ¥66.00 \+ 补贴 ¥12.00/)).toBeVisible();
    expect(within(orderCard).getByText("达人自行购买")).toBeVisible();
    expect(within(orderCard).getByText("拍完自留")).toBeVisible();
    expect(within(orderCard).getByText("优质商家")).toBeVisible();
    expect(within(orderCard).getByText("已缴保证金")).toBeVisible();
    expect(within(orderCard).getByText("3 天交付")).toBeVisible();
    expect(within(orderCard).getByRole("button", { name: "查看详情并申请" })).toBeVisible();
  });

  it("hides the subsidy line when the order has no subsidy", async () => {
    mocks.getOrderHall.mockResolvedValueOnce({ items: [{ ...sampleOrder, product_subsidy_amount: "0.00" }], total: 1 });
    renderPage(<ModelHallPage />);

    const orderCard = await screen.findByRole("article");
    expect(within(orderCard).getByText("¥66.00")).toBeVisible();
    expect(within(orderCard).getByText("佣金 ¥66.00")).toBeVisible();
    expect(within(orderCard).queryByText(/商品补贴/)).not.toBeInTheDocument();
  });

  it("requests the selected hall page and exposes pagination for more than one page", async () => {
    mocks.getOrderHall.mockResolvedValueOnce({ items: [sampleOrder], total: 21, page: 1, page_size: 20 });
    renderPage(<ModelHallPage />);

    expect(await screen.findByRole("list")).toBeVisible();
    expect(mocks.getOrderHall).toHaveBeenCalledWith(undefined, 1, 20);
    expect(screen.getByTitle("Next Page")).toBeVisible();
  });

  it("resets to page one when switching the category filter", async () => {
    renderPage(<ModelHallPage />);

    fireEvent.click(await screen.findByText("服饰穿搭"));
    expect(mocks.getOrderHall).toHaveBeenLastCalledWith("服饰穿搭", 1, 20);
  });

  it("distinguishes an interface error from an empty hall and offers reload", async () => {
    mocks.getOrderHall.mockRejectedValueOnce(new Error("网络异常"));
    renderPage(<ModelHallPage />);

    expect(await screen.findByText("订单加载失败，请稍后重试")).toBeVisible();
    expect(screen.queryByText("该分类暂无可接订单")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "重新加载" })).toBeVisible();
  });

  it("shows an empty hall message for an empty category", async () => {
    mocks.getOrderHall.mockResolvedValueOnce({ items: [], total: 0 });
    renderPage(<ModelHallPage />);

    expect(await screen.findByText("该分类暂无可接订单")).toBeVisible();
  });

  it("marks the claim strip ok with a trust background when claimable", async () => {
    renderPage(<ModelHallPage />);

    const strip = await screen.findByRole("status");
    expect(strip).toHaveClass("talent-claim-strip--ok");
    expect(strip).toHaveTextContent("新手达人");
    expect(screen.queryByRole("button", { name: "去完善资料" })).not.toBeInTheDocument();
  });

  it("marks the claim strip warn and keeps the profile entry when not claimable", async () => {
    mocks.getTalentStatus.mockResolvedValue({ ...claimableStatus, can_claim: false, profile_complete: false });
    renderPage(<ModelHallPage />);

    const strip = await screen.findByRole("status");
    expect(strip).toHaveClass("talent-claim-strip--warn");
    expect(strip).toHaveTextContent("请先在“我的”完成头像、用户名、收货地区和至少 6 张作品照片");
    expect(screen.getByRole("button", { name: "去完善资料" })).toBeVisible();
  });

  it("groups an order detail into reward, work, completion, and platform rules", async () => {
    renderPage(<MarketplaceOrderDetailPage orderId={8} />);

    expect(await screen.findByRole("heading", { name: "可获得收益" })).toBeVisible();
    expect(screen.getByRole("heading", { name: "你需要完成" })).toBeVisible();
    expect(screen.getByRole("heading", { name: "如何完成" })).toBeVisible();
    expect(screen.getByRole("heading", { name: "订单保障与规则" })).toBeVisible();
    expect(screen.getByRole("button", { name: "提交接单申请" })).toBeVisible();
    expect(screen.getByText("佣金 ¥66.00 · 补贴 ¥12.00")).toBeVisible();
    expect(screen.getByText("¥78.00")).toBeVisible();
  });

  it("shows only the pending block and no primary action after applying", async () => {
    mocks.getHallOrder.mockResolvedValue({ ...sampleOrder, application_status: "PENDING" });
    renderPage(<MarketplaceOrderDetailPage orderId={8} />);

    expect(await screen.findByText("申请已提交")).toBeVisible();
    expect(screen.queryByRole("button", { name: "提交接单申请" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /补充同款图/ })).not.toBeInTheDocument();
  });

  it("shows the rejection block with a re-apply action", async () => {
    mocks.getHallOrder.mockResolvedValue({ ...sampleOrder, application_status: "REJECTED", application_reason: "当前档期冲突" });
    renderPage(<MarketplaceOrderDetailPage orderId={8} />);

    expect(await screen.findByText("本次申请未通过")).toBeVisible();
    expect(screen.getByText("当前档期冲突")).toBeVisible();
    expect(screen.getByRole("button", { name: "提交接单申请" })).toBeVisible();
  });

  it("shows a dedicated re-apply action for owned-product orders", async () => {
    mocks.getHallOrder.mockResolvedValue({ ...sampleOrder, product_source: "talent_owned", application_status: "REJECTED" });
    renderPage(<MarketplaceOrderDetailPage orderId={8} />);

    expect(await screen.findByRole("button", { name: "补充同款图后重新申请" })).toBeVisible();
  });

  it("shows the approved block with an order entry and no primary action", async () => {
    mocks.getHallOrder.mockResolvedValue({ ...sampleOrder, application_status: "APPROVED" });
    renderPage(<MarketplaceOrderDetailPage orderId={8} />);

    expect(await screen.findByText("申请已通过")).toBeVisible();
    expect(screen.getByRole("link", { name: "我的订单" })).toBeVisible();
    expect(screen.queryByRole("button", { name: "提交接单申请" })).not.toBeInTheDocument();
  });

  it("disables the primary action with the reason when not qualified", async () => {
    mocks.getTalentStatus.mockResolvedValue({ ...claimableStatus, can_claim: false });
    renderPage(<MarketplaceOrderDetailPage orderId={8} />);

    const button = await screen.findByRole("button", { name: "暂不具备申请资格" });
    expect(button).toBeDisabled();
    expect(screen.getByText("请先完成资料与实名认证，并满足当前等级的接单限制。")).toBeVisible();
  });

  it("shows a reload action when the detail fails to load", async () => {
    mocks.getHallOrder.mockRejectedValueOnce(new Error("网络异常"));
    renderPage(<MarketplaceOrderDetailPage orderId={8} />);

    expect(await screen.findByText("订单加载失败，请稍后重试")).toBeVisible();
    expect(screen.getByRole("button", { name: "重新加载" })).toBeVisible();
  });

  it("submits the application with message and clears the modal after success", async () => {
    renderPage(<MarketplaceOrderDetailPage orderId={8} />);

    fireEvent.click(await screen.findByRole("button", { name: "提交接单申请" }));
    fireEvent.change(screen.getByPlaceholderText("简要说明你的拍摄方向、档期或相近作品经验（选填）"), { target: { value: "周末有空，有平拍经验" } });
    fireEvent.click(screen.getByRole("button", { name: "确认申请" }));

    expect(await screen.findByText("申请已提交，等待运营审核")).toBeVisible();
    expect(mocks.applyForOrder).toHaveBeenCalledWith(8, "周末有空，有平拍经验", []);
  });

  it("blocks owned-product submissions without a same-product image", async () => {
    mocks.getHallOrder.mockResolvedValue({ ...sampleOrder, product_source: "talent_owned" });
    renderPage(<MarketplaceOrderDetailPage orderId={8} />);

    fireEvent.click(await screen.findByRole("button", { name: "提交接单申请" }));
    fireEvent.click(screen.getByRole("button", { name: "确认申请" }));

    expect(await screen.findByText("已有同款订单必须先上传至少一张同款实拍图")).toBeVisible();
    expect(mocks.applyForOrder).not.toHaveBeenCalled();
  });
});
