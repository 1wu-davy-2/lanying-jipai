import { client, request } from "./client";
import type { AuthSession, UserRole } from "../types";

export function login(phone: string, password: string) {
  return request<AuthSession>(client.post("/auth/login", { phone, password }));
}

export function register(phone: string, password: string, role: Exclude<UserRole, "admin">, nickname?: string, channel?: string) {
  return request<AuthSession>(client.post("/auth/register", {
    phone,
    password,
    role,
    ...(nickname?.trim() ? { nickname: nickname.trim() } : {}),
    ...(channel?.trim() ? { registration_channel: channel.trim() } : {}),
  }));
}
