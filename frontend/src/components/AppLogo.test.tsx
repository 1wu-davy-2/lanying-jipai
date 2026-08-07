import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { AppLogo } from "./AppLogo";

describe("AppLogo", () => {
  it("renders the full variant with the brand name and an accessible mark", () => {
    render(<AppLogo variant="full" />);

    expect(screen.getByText("蓝鹰寄拍")).toBeInTheDocument();
    expect(screen.getByRole("img", { name: "蓝鹰寄拍" })).toBeInTheDocument();
  });

  it("renders the mark-only variant without text but with aria-label", () => {
    render(<AppLogo variant="mark" size={32} />);

    expect(screen.queryByText("蓝鹰寄拍")).not.toBeInTheDocument();
    const mark = screen.getByRole("img", { name: "蓝鹰寄拍" });
    expect(mark).toBeInTheDocument();
    expect(mark).toHaveAttribute("aria-label", "蓝鹰寄拍");
  });
});
