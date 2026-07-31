import { fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it } from "vitest";

import { OfficialHomePage } from "./OfficialHomePage";

describe("OfficialHomePage", () => {
  it("presents the platform proposition and both primary paths", () => {
    render(<MemoryRouter><OfficialHomePage /></MemoryRouter>);

    expect(screen.getByRole("heading", { name: /把每一次寄拍，交给清晰的流程/ })).toBeVisible();
    expect(screen.getByRole("link", { name: "我是达人" })).toHaveAttribute("href", "/talent/register");
    expect(screen.getByRole("link", { name: "发布寄拍" })).toHaveAttribute("href", "/login");
  });

  it("opens the mobile navigation and switches FAQ answers", () => {
    render(<MemoryRouter><OfficialHomePage /></MemoryRouter>);

    fireEvent.click(screen.getByRole("button", { name: "打开导航" }));
    expect(screen.getByRole("navigation", { name: "移动端导航" })).toBeVisible();

    const question = screen.getByRole("button", { name: "没有摄影经验，可以接单吗？" });
    fireEvent.click(question);
    expect(screen.getByText(/不要求专业摄影棚/)).toBeVisible();
  });

  it("shows an in-development notice for each download channel", () => {
    render(<MemoryRouter><OfficialHomePage /></MemoryRouter>);

    fireEvent.click(screen.getByRole("button", { name: "下载 Android App" }));
    expect(screen.getByRole("status")).toHaveTextContent(/Android App.*正在开发中/);

    fireEvent.click(screen.getByRole("button", { name: "打开微信小程序" }));
    expect(screen.getByRole("status")).toHaveTextContent(/微信小程序.*正在开发中/);
  });
});
