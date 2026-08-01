import { describe, expect, it, vi } from "vitest";

import { client, shouldRedirectForUnauthorizedRequest } from "./client";
import { getMyFulfillments } from "./orders";

describe("shouldRedirectForUnauthorizedRequest", () => {
  it("keeps the current page for failed login and registration requests", () => {
    expect(shouldRedirectForUnauthorizedRequest("/auth/login")).toBe(false);
    expect(shouldRedirectForUnauthorizedRequest("/auth/register")).toBe(false);
  });

  it("redirects when an authenticated business request receives 401", () => {
    expect(shouldRedirectForUnauthorizedRequest("/orders")).toBe(true);
  });

  it("requests my fulfillments through the orders router", async () => {
    const get = vi.spyOn(client, "get").mockResolvedValue({
      data: { code: 0, message: "ok", data: { items: [], total: 0, page: 1, page_size: 20 } },
    } as never);

    await getMyFulfillments();

    expect(get).toHaveBeenCalledWith("/orders/fulfillments/my", {
      params: { status: undefined, page: 1, page_size: 20 },
    });
    get.mockRestore();
  });
});
