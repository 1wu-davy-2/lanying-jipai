import { fireEvent, render, screen, within } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { AdminScriptsPage } from "./AdminScriptsPage";

const mocks = vi.hoisted(() => ({
  getAdminScript: vi.fn(),
  getAdminScriptCategories: vi.fn(),
  getAdminScripts: vi.fn(),
}));

vi.mock("../../api/admin", () => mocks);

const chapterBody = Array.from({ length: 12 }, (_, chapterIndex) => {
  const blocks = Array.from({ length: chapterIndex < 10 ? 4 : 3 }, (_, blockIndex) => (
    `\`\`\`text\nChapter ${chapterIndex + 1} copy ${blockIndex + 1}\n\`\`\``
  )).join("\n\n");
  return `## Chapter ${chapterIndex + 1}\n\n${blocks}`;
}).join("\n\n");

function renderPage() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={queryClient}>
      <AdminScriptsPage />
    </QueryClientProvider>,
  );
}

beforeEach(() => {
  const category = { id: 1, code: "douyin_ops", name: "抖音运营话术", description: "运营沟通资料", is_restricted: false };
  const document = {
    id: 1,
    title: "抖音运营话术库",
    source_key: "douyin-ops-scripts",
    source_filename: "douyin-ops-scripts.md",
    section_count: 12,
    copy_block_count: 46,
    category,
  };
  mocks.getAdminScriptCategories.mockResolvedValue([category]);
  mocks.getAdminScripts.mockResolvedValue({ items: [document], total: 1, page: 1, page_size: 20 });
  mocks.getAdminScript.mockResolvedValue({ ...document, markdown_body: chapterBody });
});

describe("AdminScriptsPage", () => {
  it("browses twelve chapters and paginates forty-six copy blocks", async () => {
    renderPage();

    expect(await screen.findByText(/12 个章节.*46 条可复制话术/)).toBeVisible();
    fireEvent.click(screen.getByRole("button", { name: "查看章节" }));

    const chapters = await screen.findByText("Chapter 12");
    expect(chapters).toBeVisible();
    expect(screen.getByText("12 个章节")).toBeVisible();
    const copySearch = screen.getByRole("searchbox", { name: "话术检索" });
    fireEvent.change(copySearch, { target: { value: "Chapter" } });
    expect(await screen.findByText("#1")).toBeVisible();
    expect(screen.queryByText("#7")).not.toBeInTheDocument();

    fireEvent.click(screen.getByText("2", { selector: "a" }));
    expect(await screen.findByText("#7")).toBeVisible();
  }, 15000);

  it("filters chapters and copy blocks independently", async () => {
    renderPage();
    await screen.findByText(/12 个章节.*46 条可复制话术/);
    fireEvent.click(screen.getByRole("button", { name: "查看章节" }));

    const chapterSearch = await screen.findByRole("textbox", { name: "章节检索" });
    fireEvent.change(chapterSearch, { target: { value: "Chapter 12" } });
    const chapterList = chapterSearch.closest("aside");
    expect(chapterList).not.toBeNull();
    expect(within(chapterList!).getByText("Chapter 12")).toBeVisible();
    expect(within(chapterList!).queryByText("Chapter 11")).not.toBeInTheDocument();

    const copySearch = screen.getByRole("searchbox", { name: "话术检索" });
    fireEvent.change(copySearch, { target: { value: "Chapter 8 copy 4" } });
    expect(await screen.findByText("Chapter 8")).toBeVisible();
    expect(screen.getByText("Chapter 8 copy 4")).toBeVisible();
    expect(screen.queryByText("Chapter 8 copy 3")).not.toBeInTheDocument();
  });
});
