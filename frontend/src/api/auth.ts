import { client, request } from "./client";
import type { AuthSession, UserRole } from "../types";

export function login(phone: string, password: string) {
  return request<AuthSession>(client.post("/auth/login", { phone, password }));
}

export function register(phone: string, password: string, role: Exclude<UserRole, "admin">) {
  return request<AuthSession>(client.post("/auth/register", { phone, password, role }));
}
