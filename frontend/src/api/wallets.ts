import { client, request } from "./client";

export interface WalletBalance {
  available_balance: string;
  frozen_balance: string;
}

export interface WalletTransaction {
  id: number;
  type: string;
  amount: string;
  balance_after: string;
  frozen_balance_after: string;
  order_id: number | null;
  withdrawal_id: number | null;
  remark: string | null;
  created_at: string | null;
}

export interface Withdrawal {
  id: number;
  withdrawal_no: string;
  amount: string;
  alipay_account: string | null;
  alipay_real_name: string | null;
  status: "pending" | "approved" | "rejected" | "completed";
  reject_reason: string | null;
  transfer_no: string | null;
  created_at: string | null;
}

interface Page<T> { items: T[]; total: number; page: number; page_size: number; }

export function getWallet() { return request<WalletBalance>(client.get("/wallets/me")); }
export function getWalletTransactions() { return request<Page<WalletTransaction>>(client.get("/wallets/me/transactions")); }
export function getMyWithdrawals() { return request<Page<Withdrawal>>(client.get("/withdrawals/me")); }
export function applyWithdrawal(values: { amount: string; alipay_account: string; alipay_real_name: string }) {
  return request<Withdrawal>(client.post("/withdrawals", values));
}
