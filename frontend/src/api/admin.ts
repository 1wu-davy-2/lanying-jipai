import { client, request } from "./client";
import type { ApplicationStatus, OrderItem } from "./orders";
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
  merchant_profile?: {
    shop_name: string;
    shop_platform: string | null;
    contact_phone: string;
    default_ship_address: string;
  } | null;
}

export interface DashboardSummary {
  today_orders: number;
  month_orders: number;
  month_completed_amount: string;
  pending_withdrawals: number;
  disputed_orders: number;
}

export interface ScriptCategory {
  id: number;
  code: string;
  name: string;
  description: string;
  is_restricted: boolean;
}

export interface ScriptDocumentSummary {
  id: number;
  title: string;
  source_key: string;
  source_filename: string;
  section_count: number;
  copy_block_count: number;
  category: ScriptCategory;
}

export interface ScriptDocument extends ScriptDocumentSummary {
  markdown_body: string;
}

export interface AdminOrderApplication {
  id: number;
  status: ApplicationStatus;
  message: string | null;
  review_reason: string | null;
  created_at: string | null;
  reviewed_at: string | null;
  applicant: { id: number; nickname: string; avatar_url: string | null; verify_status: string; level: string } | null;
  order: OrderItem | null;
}

export function getDashboard() { return request<DashboardSummary>(client.get("/admin/dashboard/summary")); }
export function getAdminScriptCategories() { return request<ScriptCategory[]>(client.get("/admin/scripts/categories")); }
export function getAdminScripts(params: { category?: string; keyword?: string; page?: number; page_size?: number } = {}) { return request<Page<ScriptDocumentSummary>>(client.get("/admin/scripts", { params })); }
export function getAdminScript(documentId: number) { return request<ScriptDocument>(client.get(`/admin/scripts/${documentId}`)); }
export function getAdminUsers(params: Record<string, string | undefined> = {}) { return request<Page<AdminUser>>(client.get("/admin/users", { params })); }
export function createAdminMerchant(values: { phone: string; password: string; nickname?: string; shop_name: string; shop_platform?: string; contact_phone: string; default_ship_address: string }) { return request<AdminUser>(client.post("/admin/users/merchants", values)); }
export function updateAdminUserStatus(userId: number, status: "active" | "disabled") { return request<AdminUser>(client.put(`/admin/users/${userId}/status`, { status })); }
export function reviewVerification(userId: number, approved: boolean, reason?: string) { return request<AdminUser>(client.put(`/admin/users/${userId}/verify`, { approved, reason })); }
export function getAdminOrders(params: Record<string, string | number | boolean | undefined> = {}) { return request<Page<OrderItem>>(client.get("/admin/orders", { params })); }
export function createAdminOrder(values: Record<string, unknown>) { return request<OrderItem>(client.post("/admin/orders", values)); }
export function getAdminOrderApplications(status?: ApplicationStatus) { return request<Page<AdminOrderApplication>>(client.get("/admin/order-applications", { params: status ? { status } : undefined })); }
export function reviewOrderApplication(applicationId: number, values: { approved: boolean; reason?: string }) { return request<AdminOrderApplication>(client.put(`/admin/order-applications/${applicationId}/review`, values)); }
export function shipAdminOrder(orderId: number, values: { tracking_no: string; company: string }) { return request<OrderItem>(client.put(`/admin/orders/${orderId}/ship`, values)); }
export function acceptAdminOrder(orderId: number) { return request<OrderItem>(client.put(`/admin/orders/${orderId}/accept`)); }
export function rejectAdminOrder(orderId: number, reason: string) { return request<OrderItem>(client.put(`/admin/orders/${orderId}/reject`, { reason })); }
export function cancelAdminOrder(orderId: number) { return request<OrderItem>(client.put(`/admin/orders/${orderId}/cancel`)); }
export function getDisputedOrders() { return request<Page<OrderItem>>(client.get("/admin/orders/disputed")); }
export function arbitrateOrder(orderId: number, values: { winner: "model" | "merchant"; remark: string }) { return request<OrderItem>(client.put(`/admin/orders/${orderId}/arbitrate`, values)); }
export function getAdminWithdrawals(status_filter?: string) { return request<Page<Withdrawal>>(client.get("/admin/withdrawals", { params: status_filter ? { status_filter } : undefined })); }
export function approveWithdrawal(withdrawalId: number) { return request<Withdrawal>(client.put(`/admin/withdrawals/${withdrawalId}/approve`)); }
export function rejectWithdrawal(withdrawalId: number, reason: string) { return request<Withdrawal>(client.put(`/admin/withdrawals/${withdrawalId}/reject`, { reason })); }
export function completeWithdrawal(withdrawalId: number, transfer_no: string) { return request<Withdrawal>(client.put(`/admin/withdrawals/${withdrawalId}/complete`, { transfer_no })); }
