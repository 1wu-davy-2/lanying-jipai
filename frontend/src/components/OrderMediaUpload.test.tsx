import { fireEvent, render, waitFor } from "@testing-library/react";
import { useState } from "react";
import { describe, expect, it, vi } from "vitest";

import { OrderMediaUpload } from "./OrderMediaUpload";

vi.mock("../api/orders", () => ({
  uploadFile: vi.fn(async (file: File) => ({ url: `/uploads/${file.name}` })),
}));

function UploadHarness({ onChange }: { onChange: (urls: string[]) => void }) {
  const [urls, setUrls] = useState<string[]>([]);
  return <OrderMediaUpload value={urls} accept="media" onChange={(next) => { setUrls(next); onChange(next); }} />;
}

describe("OrderMediaUpload", () => {
  it("keeps every result from one multi-file selection", async () => {
    const onChange = vi.fn();
    const { container } = render(<UploadHarness onChange={onChange} />);
    const files = [
      new File(["image"], "delivery-1.png", { type: "image/png" }),
      new File(["image"], "delivery-2.png", { type: "image/png" }),
      new File(["video"], "delivery.mp4", { type: "video/mp4" }),
    ];
    const input = container.querySelector('input[type="file"]');

    expect(input).not.toBeNull();
    fireEvent.change(input as HTMLInputElement, { target: { files } });

    await waitFor(() => {
      expect(onChange).toHaveBeenCalledWith(files.map((file) => `/uploads/${file.name}`));
    });
    expect(container.querySelectorAll(".ant-upload-list-item-done")).toHaveLength(3);
  });
});
