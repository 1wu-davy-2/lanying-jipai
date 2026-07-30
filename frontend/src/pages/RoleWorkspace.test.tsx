import { render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { MemoryRouter } from "react-router-dom";

import { useAuthStore } from "../stores/authStore";
import { RoleWorkspace } from "./RoleWorkspace";

vi.mock("./orders/ModelHallPage", () => ({
  ModelHallPage: () => <h1>订单大厅内容</h1>,
}));

afterEach(() => {
  useAuthStore.setState({ session: null });
});

describe("RoleWorkspace", () => {
  it("uses order hall wording in the desktop and mobile talent navigation", () => {
    useAuthStore.setState({
      session: {
        access_token: "test-access-token",
        refresh_token: "test-refresh-token",
        token_type: "bearer",
        user: { id: 1, phone: "13000000001", nickname: "测试达人", role: "model" },
      },
    });

    render(
      <MemoryRouter initialEntries={["/model/hall"]}>
        <RoleWorkspace role="model" />
      </MemoryRouter>,
    );

    expect(screen.getByRole("menuitem", { name: "订单大厅" })).toBeVisible();
    const mobileNavigation = screen.getByRole("navigation", { name: "达人导航" });
    expect(within(mobileNavigation).getByRole("button", { name: "订单大厅" })).toBeVisible();
    expect(screen.getByRole("heading", { name: "订单大厅内容" })).toBeVisible();
  });
});
