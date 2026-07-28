import { client, request } from "./client";
import type { UserRole } from "../types";

export interface UserProfile {
  id: number;
  phone: string;
  role: UserRole;
  nickname: string;
  verify_status: string;
  merchant_profile?: {
    shop_name: string;
    shop_platform?: string | null;
    contact_phone: string;
    default_ship_address: string;
  } | null;
  model_profile?: {
    height_cm?: number | null;
    weight_kg?: number | null;
    shoe_size?: string | null;
    skill_tags?: string | null;
    receive_address: string;
    portfolio_urls?: string | null;
  } | null;
}

export function getCurrentUser() {
  return request<UserProfile>(client.get("/users/me"));
}

export function saveMerchantProfile(values: Record<string, unknown>) {
  return request<UserProfile>(client.put("/users/me/merchant-profile", values));
}

export function saveModelProfile(values: Record<string, unknown>) {
  return request<UserProfile>(client.put("/users/me/model-profile", values));
}

export function submitVerification(values: Record<string, unknown>) {
  return request<UserProfile>(client.post("/users/me/verify", values));
}
