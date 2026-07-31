import { render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter } from "react-router-dom";

import { App } from "./App";
import { useAuthStore } from "./stores/authStore";

afterEach(() => {
  useAuthStore.setState({ session: null });
  localStorage.clear();
});

function renderWithProviders(path: string) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={[path]}><App /></MemoryRouter>
    </QueryClientProvider>,
  );
}

describe("App", () => {
  it("shows the public platform homepage at the root route", () => {
    renderWithProviders("/");

    expect(screen.getByRole("heading", { name: /把每一次寄拍，交给清晰的流程/ })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "我是达人" })).toHaveAttribute("href", "/talent/register");
  });

  it("redirects an anonymous protected-route visitor to login", () => {
    renderWithProviders("/merchant/orders");

    expect(screen.getByRole("heading", { name: "登录" })).toBeInTheDocument();
  });

  it("shows the merchant profile at the role-specific profile route", () => {
    useAuthStore.setState({
      session: {
        access_token: "token",
        refresh_token: "refresh",
        token_type: "bearer",
        user: { id: 1, phone: "13800138000", role: "merchant", nickname: "商家" },
      },
    });
    renderWithProviders("/merchant/profile");

    expect(screen.getByRole("heading", { name: "店铺资料" })).toBeInTheDocument();
  });

  it("shows an order publishing action on the merchant order route", () => {
    useAuthStore.setState({
      session: {
        access_token: "token", refresh_token: "refresh", token_type: "bearer",
        user: { id: 1, phone: "13800138000", role: "merchant", nickname: "商家" },
      },
    });
    renderWithProviders("/merchant/orders");

    expect(screen.getByRole("button", { name: "发布订单" })).toBeInTheDocument();
  });

  it("shows the model order workspace at the role-specific order route", () => {
    useAuthStore.setState({
      session: {
        access_token: "token", refresh_token: "refresh", token_type: "bearer",
        user: { id: 2, phone: "13800138001", role: "model", nickname: "达人" },
      },
    });
    renderWithProviders("/model/orders");

    expect(screen.getByRole("heading", { name: "我的订单" })).toBeInTheDocument();
  });

  it("renders the talent bottom navigation for the mobile workspace", () => {
    useAuthStore.setState({
      session: {
        access_token: "token", refresh_token: "refresh", token_type: "bearer",
        user: { id: 2, phone: "13800138001", role: "model", nickname: "达人" },
      },
    });
    renderWithProviders("/model/orders");

    const navigation = screen.getByRole("navigation", { name: "达人导航" });
    expect(navigation).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "订单大厅" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "订单" })).toBeInTheDocument();
  });

  it("sends an anonymous talent visitor to the talent login page", () => {
    renderWithProviders("/model/hall");

    expect(screen.getByRole("heading", { name: "达人端登录" })).toBeInTheDocument();
  });

  it("shows the wallet workspace for a model", () => {
    useAuthStore.setState({
      session: {
        access_token: "token", refresh_token: "refresh", token_type: "bearer",
        user: { id: 2, phone: "13800138001", role: "model", nickname: "达人" },
      },
    });
    renderWithProviders("/model/wallet");

    expect(screen.getByRole("heading", { name: "资金账户" })).toBeInTheDocument();
  });

  it("shows the administrator dashboard", () => {
    useAuthStore.setState({
      session: {
        access_token: "token", refresh_token: "refresh", token_type: "bearer",
        user: { id: 3, phone: "13800138002", role: "admin", nickname: "管理员" },
      },
    });
    renderWithProviders("/admin/dashboard");

    expect(screen.getByRole("heading", { name: "运营看板" })).toBeInTheDocument();
  });

  it("shows the operations order workspace for an administrator", () => {
    useAuthStore.setState({
      session: {
        access_token: "token", refresh_token: "refresh", token_type: "bearer",
        user: { id: 3, phone: "13800138002", role: "admin", nickname: "管理员" },
      },
    });
    renderWithProviders("/admin/operations");

    expect(screen.getByRole("heading", { name: "运营发单" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "新建商家" })).toBeInTheDocument();
  });
});
