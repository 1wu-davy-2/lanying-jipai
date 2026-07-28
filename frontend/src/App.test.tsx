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

  it("shows the wallet workspace for a model", () => {
    useAuthStore.setState({
      session: {
        access_token: "token", refresh_token: "refresh", token_type: "bearer",
        user: { id: 2, phone: "13800138001", role: "model", nickname: "达人" },
      },
    });
    renderWithProviders("/model/wallet");

    expect(screen.getByRole("heading", { name: "我的钱包" })).toBeInTheDocument();
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
});
