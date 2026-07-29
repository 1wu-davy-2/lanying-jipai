import { client, request } from "./client";
import type { UserRole } from "../types";

export interface UserProfile {
  id: number;
  phone: string;
  role: UserRole;
  nickname: string;
  avatar_url?: string | null;
  verify_status: string;
  verify_reject_reason?: string | null;
  alipay_account?: string | null;
  alipay_real_name?: string | null;
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
    receiver_name: string;
    receiver_phone: string;
    receive_address_detail: string;
    portfolio_urls: string[];
  } | null;
}

export function getCurrentUser() {
  return request<UserProfile>(client.get("/users/me"));
}

export interface TalentStatus {
  profile_complete: boolean;
  verified: boolean;
  can_claim: boolean;
  completed_orders: number;
  active_orders: number;
  level: { code: string; name: string; max_active_orders: number; max_commission_amount: string; next_level_completed_orders: number | null };
}

export interface RankingEntry {
  rank: number;
  nickname: string;
  avatar_url?: string | null;
  level: string;
  completed_orders: number;
  earnings: string;
  is_simulated: boolean;
}

export function getTalentStatus() {
  return request<TalentStatus>(client.get("/users/me/talent-status"));
}

export function getModelRanking() {
  return request<{ simulated: RankingEntry[]; real: RankingEntry[] }>(client.get("/users/model-ranking"));
}

export function saveCurrentUser(values: { nickname?: string; avatar_url?: string }) {
  return request<UserProfile>(client.put("/users/me", values));
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
