import { useEffect } from "react";
import type { ReactNode } from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter, Route, Routes, useLocation } from "react-router-dom";
import { afterEach, describe, expect, it, vi } from "vitest";

import { EntryPage } from "./EntryPage";
import { LoginPage } from "./LoginPage";
import { RegisterPage } from "./RegisterPage";

const mocks = vi.hoisted(() => ({
  login: vi.fn(),
  register: vi.fn(),
}));

vi.mock("../../api/auth", () => mocks);

function LocationProbe({ onPath }: { onPath: (path: string) => void }) {
  const location = useLocation();
  useEffect(() => { onPath(location.pathname); }, [location.pathname, onPath]);
  return null;
}

function renderWithRoutes(ui: ReactNode, onPath: (path: string) => void) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={["/"]}>
        <Routes>
          <Route path="/" element={ui} />
          <Route path="/admin/login" element={<LoginPage portal="admin" />} />
          <Route path="/talent/login" element={<LoginPage portal="model" />} />
          <Route path="/model/onboarding" element={<div>入驻引导</div>} />
        </Routes>
        <LocationProbe onPath={onPath} />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

function fillForm(labels: Record<string, string>) {
  for (const [label, value] of Object.entries(labels)) {
    fireEvent.change(screen.getByLabelText(label), { target: { value } });
  }
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe("EntryPage 入口选项", () => {
  it("标题为进入蓝鹰寄拍，两个入口按现有顺序跳转", () => {
    const paths: string[] = [];
    renderWithRoutes(<EntryPage />, (path) => paths.push(path));

    expect(screen.getByRole("heading", { name: "进入蓝鹰寄拍" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /运营管理端/ })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /达人端/ })).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /达人端/ }));
    expect(paths).toContain("/talent/login");
    expect(screen.getByRole("heading", { name: "达人端登录" })).toBeInTheDocument();
  });
});

describe("LoginPage portal 身份", () => {
  it("管理员入口标题为运营管理端登录", () => {
    renderWithRoutes(<LoginPage portal="admin" />, () => undefined);
    expect(screen.getByRole("heading", { name: "运营管理端登录" })).toBeInTheDocument();
  });

  it("登录角色与入口不符时提示换用正确账号，不误报账号丢失", async () => {
    mocks.login.mockResolvedValue({
      access_token: "token",
      refresh_token: "refresh",
      token_type: "bearer",
      user: { id: 2, phone: "13800138001", role: "model", nickname: "小雨" },
    });
    renderWithRoutes(<LoginPage portal="admin" />, () => undefined);

    fillForm({ 手机号: "13800138001", 密码: "password123" });
    fireEvent.click(screen.getByRole("button", { name: /登\s*录/ }));

    expect(await screen.findByText("请使用管理员账号登录运营管理端")).toBeInTheDocument();
    expect(screen.getByLabelText("手机号")).toHaveValue("13800138001");
  });
});

describe("RegisterPage 注册提交", () => {
  it("以 model 角色提交注册并进入入驻引导", async () => {
    const paths: string[] = [];
    mocks.register.mockResolvedValue({
      access_token: "token",
      refresh_token: "refresh",
      token_type: "bearer",
      user: { id: 2, phone: "13800138001", role: "model", nickname: "小雨" },
    });
    renderWithRoutes(<RegisterPage />, (path) => paths.push(path));

    expect(screen.getByRole("heading", { name: "达人注册" })).toBeInTheDocument();
    expect(screen.getByText("创建你的接单账号")).toBeInTheDocument();

    fillForm({ 手机号: "13800138001", 达人名称: "小雨", 密码: "password123" });
    fireEvent.click(screen.getByRole("button", { name: "创建账号" }));

    expect(await screen.findByText("入驻引导")).toBeInTheDocument();
    expect(mocks.register).toHaveBeenCalledWith("13800138001", "password123", "model", "小雨", undefined);
    expect(paths).toContain("/model/onboarding");
  });
});
