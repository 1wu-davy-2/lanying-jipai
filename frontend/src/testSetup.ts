import "@testing-library/jest-dom/vitest";
import { cleanup } from "@testing-library/react";
import { AxiosError } from "axios";
import { afterEach } from "vitest";
import { vi } from "vitest";

import { client } from "./api/client";

afterEach(cleanup);

const nativeGetComputedStyle = window.getComputedStyle.bind(window);
Object.defineProperty(window, "getComputedStyle", {
  configurable: true,
  writable: true,
  value: (element: Element) => nativeGetComputedStyle(element),
});

client.defaults.adapter = () => Promise.reject(new AxiosError("HTTP requests are disabled in component tests"));

Object.defineProperty(window, "matchMedia", {
  writable: true,
  value: vi.fn().mockImplementation((query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: vi.fn(),
    removeListener: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  })),
});
