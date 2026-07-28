import { client, request } from "./client";
import type { OrderItem } from "./orders";
import type { Withdrawal } from "./wallets";

export interface Page<T> { items: T[]; total: number; page: number; page_size: number; }

export interface AdminUser {
  id: number;
  phone: string;
  role: "merchant" | "model" | "admin";
  nickname: string;
  status: "active" | "disabled";
  real_name: string | null;
  id_card_no: string | null;
  verify_status: "unverified" | "pending" | "verified" | "rejected";
  verify_reject_reason: string | null;
}

export interface DashboardSummary {
  today_orders: number;
  month_orders: number;
  month_completed_amount: string;
  pending_withdrawals: number;
  disputed_orders: number;
}

export function getDashboard() { return request<DashboardSummary>(client.get("/admin/dashboard/summary")); }
export function getAdminUsers(params: Record<string, string | undefined> = {}) { return request<Page<AdminUser>>(client.get("/admin/users", { params })); }
export function updateAdminUserStatus(userId: number, status: "active" | "disabled") { return request<AdminUser>(client.put(`/admin/users/${userId}/status`, { status })); }
export function reviewVerification(userId: number, approved: boolean, reason?: string) { return request<AdminUser>(client.put(`/admin/users/${userId}/verify`, { approved, reason })); }
export function getAdminOrders(params: Record<string, string | boolean | undefined> = {}) { return request<Page<OrderItem>>(client.get("/admin/orders", { params })); }
export function getDisputedOrders() { return request<Page<OrderItem>>(client.get("/admin/orders/disputed")); }
export function arbitrateOrder(orderId: number, values: { winner: "model" | "merchant"; remark: string }) { return request<OrderItem>(client.put(`/admin/orders/${orderId}/arbitrate`, values)); }
export function getAdminWithdrawals(status_filter?: string) { return request<Page<Withdrawal>>(client.get("/admin/withdrawals", { params: status_filter ? { status_filter } : undefined })); }
export function approveWithdrawal(withdrawalId: number) { return request<Withdrawal>(client.put(`/admin/withdrawals/${withdrawalId}/approve`)); }
export function rejectWithdrawal(withdrawalId: number, reason: string) { return request<Withdrawal>(client.put(`/admin/withdrawals/${withdrawalId}/reject`, { reason })); }
export function completeWithdrawal(withdrawalId: number, transfer_no: string) { return request<Withdrawal>(client.put(`/admin/withdrawals/${withdrawalId}/complete`, { transfer_no })); }
