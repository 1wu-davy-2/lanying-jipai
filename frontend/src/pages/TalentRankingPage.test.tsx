import { fireEvent, render, screen, within } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { TalentRankingPage } from "./TalentRankingPage";

const mocks = vi.hoisted(() => ({ getModelRanking: vi.fn() }));

vi.mock("../api/users", () => ({ getModelRanking: mocks.getModelRanking }));

const ranking = {
  real: [
    { rank: 1, nickname: "阿棠", avatar_url: null, level: "L3", completed_orders: 42, earnings: "8600.00" },
    { rank: 2, nickname: "小鱼", avatar_url: null, level: "L2", completed_orders: 28, earnings: "5100.00" },
  ],
  simulated: [
    { rank: 1, nickname: "演示达人", avatar_url: null, level: "L3", completed_orders: 66, earnings: "9999.00" },
  ],
};

function renderPage() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter><TalentRankingPage /></MemoryRouter>
    </QueryClientProvider>,
  );
}

beforeEach(() => {
  mocks.getModelRanking.mockResolvedValue(ranking);
});

afterEach(() => {
  vi.clearAllMocks();
});

describe("TalentRankingPage", () => {
  it("highlights the real list and shows restrained medals for the top three", async () => {
    renderPage();

    expect(await screen.findByRole("heading", { name: "达人排行榜" })).toBeVisible();
    expect(await screen.findByText("阿棠")).toBeVisible();
    expect(screen.getByText("42 单完成")).toBeVisible();
    expect(screen.getByText("¥8600.00")).toBeVisible();
    const firstPlace = screen.getByText("阿棠").closest(".ranking-row") as HTMLElement;
    expect(firstPlace.querySelector(".ranking-place")).toHaveClass("ranking-place-1");
    expect(within(firstPlace).getByLabelText("前三名")).toBeInTheDocument();
    expect(screen.queryByText("平台演示")).not.toBeInTheDocument();
  });

  it("switches to the simulated list which keeps the demo tag visible", async () => {
    renderPage();

    fireEvent.click(await screen.findByText("平台演示榜"));
    expect(screen.getByText("演示达人")).toBeVisible();
    expect(screen.getByText("平台演示")).toBeVisible();
    expect(screen.queryByText("阿棠")).not.toBeInTheDocument();
  });

  it("shows the level rules as a compact strip without marketing cards", async () => {
    renderPage();

    const strip = (await screen.findByLabelText("等级接单规则")) as HTMLElement;
    expect(strip).toHaveTextContent("新星达人");
    expect(strip).toHaveTextContent("1 单并行 · 单笔不超过 ¥300");
    expect(strip).toHaveTextContent("稳定达人");
    expect(strip).toHaveTextContent("进阶及以上");
    expect(strip).toHaveTextContent("最高 ¥8,000/单");
    expect(document.querySelector(".ranking-rule-strip .ant-card")).toBeNull();
  });

  it("shows an empty state without completed orders", async () => {
    mocks.getModelRanking.mockResolvedValue({ real: [], simulated: [] });
    renderPage();

    expect(await screen.findByText("暂无已认证达人的成交数据")).toBeVisible();
  });
});
