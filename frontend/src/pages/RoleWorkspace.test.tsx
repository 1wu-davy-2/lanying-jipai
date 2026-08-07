import { fireEvent, render, screen, within } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter } from "react-router-dom";
import { afterEach, describe, expect, it, vi } from "vitest";

import { useAuthStore } from "../stores/authStore";
import type { UserRole } from "../types";
import { RoleWorkspace } from "./RoleWorkspace";

vi.mock("./orders/ModelHallPage", () => ({
  ModelHallPage: () => <h1>订单大厅内容</h1>,
}));

vi.mock("./admin/AdminScriptsPage", () => ({
  AdminScriptsPage: () => <h1>话术库内容</h1>,
}));

vi.mock("./orders/MarketplaceOrderDetailPage", () => ({
  MarketplaceOrderDetailPage: () => <h1>大厅详情</h1>,
}));

vi.mock("./orders/ModelFulfillmentDetailPage", () => ({
  ModelFulfillmentDetailPage: () => <h1>履约详情</h1>,
}));

vi.mock("./orders/MerchantOrderWorkspacePage", () => ({
  MerchantOrderWorkspacePage: () => <h1>多人履约工作台</h1>,
}));

function sessionFor(role: UserRole) {
  return {
    access_token: "test-access-token",
    refresh_token: "test-refresh-token",
    token_type: "bearer",
    user: { id: role === "admin" ? 3 : role === "merchant" ? 1 : 2, phone: "13000000001", nickname: role === "admin" ? "超级管理员" : role === "merchant" ? "商家" : "测试达人", role },
  } as const;
}

function renderWorkspace(role: UserRole, path: string) {
  useAuthStore.setState({ session: sessionFor(role) });
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={[path]}>
        <RoleWorkspace role={role} />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

afterEach(() => {
  useAuthStore.setState({ session: null });
});

describe("RoleWorkspace", () => {
  it("uses order hall wording in the desktop and mobile talent navigation", () => {
    renderWorkspace("model", "/model/hall");

    expect(screen.getByRole("menuitem", { name: /订单大厅/ })).toBeVisible();
    const mobileNavigation = screen.getByRole("navigation", { name: "达人导航" });
    expect(within(mobileNavigation).getByRole("button", { name: "订单大厅" })).toBeVisible();
    expect(screen.getByRole("heading", { name: "订单大厅内容" })).toBeVisible();
  });

  it("registers the administrator script library menu and route", () => {
    renderWorkspace("admin", "/admin/scripts");

    expect(screen.getByRole("menuitem", { name: /话术库/ })).toBeVisible();
    expect(screen.getByRole("heading", { name: "话术库内容" })).toBeVisible();
  });

  it("renders the merchant navigation with icons and highlights the orders parent", () => {
    renderWorkspace("merchant", "/merchant/orders/7");

    expect(screen.getByRole("menuitem", { name: /我的订单/ })).toHaveClass("ant-menu-item-selected");
    expect(screen.getByLabelText("file-text")).toBeInTheDocument();
    expect(screen.getByLabelText("shop")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "多人履约工作台" })).toBeInTheDocument();
  });

  it("highlights the hall parent on the marketplace detail route", () => {
    renderWorkspace("model", "/model/hall/12");

    expect(screen.getByRole("menuitem", { name: /订单大厅/ })).toHaveClass("ant-menu-item-selected");
    expect(screen.getByRole("heading", { name: "大厅详情" })).toBeInTheDocument();
  });

  it("highlights the orders parent on the fulfillment detail route", () => {
    renderWorkspace("model", "/model/fulfillments/9");

    expect(screen.getByRole("menuitem", { name: /我的订单/ })).toHaveClass("ant-menu-item-selected");
    const mobileNavigation = screen.getByRole("navigation", { name: "达人导航" });
    expect(within(mobileNavigation).getByRole("button", { name: "订单" })).toHaveClass("active");
  });

  it("highlights the wallet parent on the withdrawal route", () => {
    renderWorkspace("model", "/model/wallet/withdraw");

    expect(screen.getByRole("menuitem", { name: /我的钱包/ })).toHaveClass("ant-menu-item-selected");
  });

  it("renders admin group titles and icons without changing item order", () => {
    renderWorkspace("admin", "/admin/orders/3");

    expect(screen.getByText("订单运营")).toBeInTheDocument();
    expect(screen.getByText("内容与数据")).toBeInTheDocument();
    expect(screen.getByText("用户与订单")).toBeInTheDocument();
    expect(screen.getByText("争议与提现")).toBeInTheDocument();
    expect(screen.getByRole("menuitem", { name: /运营发单/ })).toHaveClass("ant-menu-item-selected");
    for (const icon of ["form", "audit", "read", "dashboard", "team", "eye", "warning", "wallet"]) {
      expect(screen.getByLabelText(icon)).toBeInTheDocument();
    }
  });

  it("navigates from the mobile bottom navigation", async () => {
    renderWorkspace("model", "/model/hall");

    fireEvent.click(screen.getByRole("button", { name: "钱包" }));
    expect(await screen.findByRole("heading", { name: "资金账户" })).toBeInTheDocument();
  });

  it("opens the merchant drawer navigation and navigates on click", async () => {
    renderWorkspace("merchant", "/merchant/orders");

    fireEvent.click(screen.getByRole("button", { name: "打开导航菜单" }));
    const dialog = screen.getByRole("dialog");
    fireEvent.click(within(dialog).getByText("店铺资料"));

    expect(await screen.findByRole("heading", { name: "店铺资料" })).toBeInTheDocument();
  });
});
