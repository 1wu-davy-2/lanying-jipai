import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { OfficialHomePage } from "./OfficialHomePage";

const mocks = vi.hoisted(() => ({
  getLatestAndroidRelease: vi.fn(),
  navigateCurrentWindow: vi.fn(),
}));

vi.mock("../api/appReleases", () => mocks);
vi.mock("../utils/navigation", () => ({ navigateCurrentWindow: mocks.navigateCurrentWindow }));

describe("OfficialHomePage", () => {
  beforeEach(() => {
    mocks.getLatestAndroidRelease.mockReset();
    mocks.navigateCurrentWindow.mockReset();
  });

  it("presents the brand as the first heading with both primary paths", () => {
    render(<MemoryRouter><OfficialHomePage /></MemoryRouter>);

    expect(screen.getByRole("heading", { name: "蓝鹰寄拍" })).toBeVisible();
    expect(screen.getByRole("link", { name: "我是达人" })).toHaveAttribute("href", "/talent/register");
    expect(screen.getByRole("link", { name: "发布寄拍" })).toHaveAttribute("href", "/login");
  });

  it("serves every visual from local brand assets without runtime remote URLs", () => {
    render(<MemoryRouter><OfficialHomePage /></MemoryRouter>);

    const sources = [...document.querySelectorAll("img")].map((img) => img.getAttribute("src") ?? "");
    expect(sources.length).toBeGreaterThanOrEqual(4);
    for (const source of sources) {
      expect(source).toMatch(/^\/images\/brand\//);
      expect(source).not.toContain("unsplash.com");
    }
    expect(document.querySelector(".official-page")?.innerHTML).not.toContain("transparenttextures.com");
  });

  it("opens the mobile navigation and switches FAQ answers", () => {
    render(<MemoryRouter><OfficialHomePage /></MemoryRouter>);

    fireEvent.click(screen.getByRole("button", { name: "打开导航" }));
    expect(screen.getByRole("navigation", { name: "移动端导航" })).toBeVisible();

    const question = screen.getByRole("button", { name: "没有摄影经验，可以接单吗？" });
    fireEvent.click(question);
    expect(screen.getByText(/不要求专业摄影棚/)).toBeVisible();
  });

  it("explains when the Android App has not been released and keeps the mini-program notice", async () => {
    mocks.getLatestAndroidRelease.mockResolvedValue(null);
    render(<MemoryRouter><OfficialHomePage /></MemoryRouter>);

    fireEvent.click(screen.getByRole("button", { name: "下载 Android App" }));
    await waitFor(() => expect(screen.getByRole("status")).toHaveTextContent("Android App 暂未发布，请稍后再试。"));
    expect(mocks.getLatestAndroidRelease).toHaveBeenCalledTimes(1);

    fireEvent.click(screen.getByRole("button", { name: "打开微信小程序" }));
    expect(screen.getByRole("status")).toHaveTextContent(/微信小程序.*正在开发中/);
  });

  it("explains when the Android release service is unavailable", async () => {
    mocks.getLatestAndroidRelease.mockRejectedValue(new Error("network unavailable"));
    render(<MemoryRouter><OfficialHomePage /></MemoryRouter>);

    fireEvent.click(screen.getByRole("button", { name: "下载 Android App" }));

    await waitFor(() => expect(screen.getByRole("status")).toHaveTextContent("Android App 下载服务暂不可用，请稍后再试。"));
  });

  it("navigates to the APK URL from the latest Android release", async () => {
    mocks.getLatestAndroidRelease.mockResolvedValue({
      platform: "android",
      version_code: 2,
      version_name: "1.0.1",
      force_update: true,
      release_notes: "修复已知问题",
      apk_url: "https://downloads.example.com/lanying-jipai-1.0.1.apk",
      apk_sha256: "a".repeat(64),
    });
    render(<MemoryRouter><OfficialHomePage /></MemoryRouter>);

    fireEvent.click(screen.getByRole("button", { name: "下载 Android App" }));

    await waitFor(() => expect(mocks.navigateCurrentWindow).toHaveBeenCalledWith("https://downloads.example.com/lanying-jipai-1.0.1.apk"));
  });
});
