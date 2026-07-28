import axios from "axios";

import type { ApiEnvelope } from "../types";

export const client = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL ?? "/api",
  timeout: 15_000,
});

client.interceptors.request.use((config) => {
  const raw = localStorage.getItem("lanying-jipai-auth");
  if (raw) {
    try {
      const { access_token } = JSON.parse(raw) as { access_token: string };
      config.headers.Authorization = `Bearer ${access_token}`;
    } catch {
      localStorage.removeItem("lanying-jipai-auth");
    }
  }
  return config;
});

client.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) localStorage.removeItem("lanying-jipai-auth");
    return Promise.reject(error);
  },
);

export async function request<T>(promise: Promise<{ data: ApiEnvelope<T> }>): Promise<T> {
  try {
    const response = await promise;
    if (response.data.code !== 0) throw new Error(response.data.message);
    return response.data.data;
  } catch (error) {
    if (axios.isAxiosError(error)) {
      const message = error.response?.data?.message;
      throw new Error(typeof message === "string" ? message : "网络请求失败，请稍后重试");
    }
    throw error;
  }
}
