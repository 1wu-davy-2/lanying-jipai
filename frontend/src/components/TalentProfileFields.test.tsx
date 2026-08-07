import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { Button, Form } from "antd";
import { describe, expect, it, vi } from "vitest";

import { PortfolioField, TalentProfileFields } from "./TalentProfileFields";

vi.mock("../api/orders", () => ({
  uploadFile: vi.fn(async (file: File) => ({ url: `/uploads/${file.name}` })),
}));

function PortfolioForm({ onSubmit }: { onSubmit: (values: { portfolio_urls: string[] }) => void }) {
  return <Form onFinish={onSubmit}>
    <PortfolioField />
    <Button htmlType="submit">提交</Button>
  </Form>;
}

function TalentProfileForm() {
  return <Form layout="vertical"><TalentProfileFields /></Form>;
}

describe("PortfolioField", () => {
  it("groups onboarding fields and states the portfolio upload limits", () => {
    render(<TalentProfileForm />);

    expect(screen.getByRole("heading", { name: "基本资料" })).toBeVisible();
    expect(screen.getByRole("heading", { name: "接单能力" })).toBeVisible();
    expect(screen.getByRole("heading", { name: "收货信息" })).toBeVisible();
    expect(screen.getByRole("heading", { name: "作品集" })).toBeVisible();
    expect(screen.getByText("已上传 0 张。仅支持 JPG、PNG、WEBP，至少 6 张，最多 12 张。")).toBeVisible();
  });

  it("submits every uploaded portfolio URL with the form", async () => {
    const onSubmit = vi.fn();
    const { container } = render(<PortfolioForm onSubmit={onSubmit} />);

    const files = Array.from({ length: 6 }, (_, index) => new File(["image"], `portfolio-${index}.png`, { type: "image/png" }));
    const input = container.querySelector('input[type="file"]');
    expect(input).not.toBeNull();
    fireEvent.change(input as HTMLInputElement, { target: { files } });
    await waitFor(() => expect(container.querySelectorAll(".ant-upload-list-item-done")).toHaveLength(6));
    fireEvent.click(screen.getByRole("button", { name: /提\s*交/ }));

    await waitFor(() => expect(onSubmit).toHaveBeenCalledWith({
      portfolio_urls: files.map((file) => `/uploads/${file.name}`),
    }));
  });
});
