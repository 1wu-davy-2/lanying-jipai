import { client, request } from "./client";
import type { UserRole } from "../types";

export type OrderStatus = "DRAFT" | "PUBLISHED" | "CLAIMED" | "OWNED_PRODUCT_REVIEW" | "SHIPPED_TO_MODEL" | "IN_PROGRESS" | "SUBMITTED" | "REVISION_REQUIRED" | "WAITING_RETURN" | "RETURNED" | "COMPLETED" | "DISPUTED" | "CANCELLED";
export type OrderType = "product_photo" | "try_on" | "short_video" | "live_show";
export type ApplicationStatus = "PENDING" | "APPROVED" | "REJECTED" | "WAITLISTED" | "CLOSED";
export type ProductSource = "merchant_ship" | "talent_purchase" | "talent_owned";
export type FulfillmentStatus = "WAITING_SHIPMENT" | "SHIPPED_TO_MODEL" | "OWNED_PRODUCT_REVIEW" | "IN_PROGRESS" | "SUBMITTED" | "REVISION_REQUIRED" | "WAITING_RETURN" | "RETURNED" | "COMPLETED" | "DISPUTED" | "CANCELLED" | "CLAIMED";
export type SubmissionStatus = "PENDING_REVIEW" | "APPROVED" | "REVISION_REQUIRED" | "DISPUTED";

export const productSourceLabels: Record<ProductSource, string> = {
  merchant_ship: "商家寄样",
  talent_purchase: "达人自行购买",
  talent_owned: "达人已有同款",
};

export interface OrderItem {
  id: number;
  order_no: string;
  merchant_id: number;
  model_id: number | null;
  title: string;
  description: string;
  product_categories: string[];
  commission_amount: string;
  deposit_amount: string;
  sample_images: string[];
  order_type: OrderType;
  quantity: number;
  required_media_count: number;
  delivery_days: number;
  deposit_required: boolean;
  return_required: boolean;
  product_source: ProductSource;
  product_subsidy_amount: string;
  self_keep_after_shoot: boolean;
  shoot_requirements: string | null;
  status: OrderStatus;
  ship_to_model_tracking_no: string | null;
  ship_to_model_company: string | null;
  return_tracking_no: string | null;
  return_company: string | null;
  submitted_media: string[];
  reject_reason: string | null;
  created_at: string | null;
  application_status?: ApplicationStatus | null;
  approved_quantity?: number;
  active_quantity?: number;
  submitted_quantity?: number;
  completed_quantity?: number;
  available_quantity?: number;
  recruitment_status?: "OPEN" | "FULL" | "CLOSED" | string;
  pending_application_count?: number;
  waiting_submission_count?: number;
  waiting_acceptance_count?: number;
  fulfillment_id?: number;
  slot_no?: number | null;
  fulfillment_status?: FulfillmentStatus;
  fulfillment_submission_versions?: number;
}

export interface OrderLog {
  id: number;
  operator_id: number;
  from_status: OrderStatus | null;
  to_status: OrderStatus;
  remark: string | null;
  created_at: string | null;
  operator: { id: number; nickname: string; role: UserRole } | null;
}

export interface OrderDetail extends OrderItem {
  logs: OrderLog[];
  merchant: { id: number; nickname: string; phone?: string; avatar_url?: string | null; shop_name?: string; shop_platform?: string | null } | null;
  application_reason?: string | null;
  owned_product_images?: string[];
}

export interface TalentSnapshot {
  id: number;
  nickname: string;
  avatar_url?: string | null;
  level?: string | null;
  verify_status?: string | null;
  completed_orders?: number;
  portfolio_images?: string[];
  phone?: string | null;
}

export interface FulfillmentSubmission {
  id: number;
  fulfillment_id: number;
  version: number;
  status: SubmissionStatus;
  media_urls: string[];
  remark?: string | null;
  review_reason?: string | null;
  reviewer_id?: number | null;
  submitted_at?: string | null;
  reviewed_at?: string | null;
}

export interface OrderFulfillment {
  id: number;
  order_id: number;
  application_id: number;
  model_id: number;
  slot_no: number | null;
  status: FulfillmentStatus;
  product_source: ProductSource;
  return_required: boolean;
  self_keep_after_shoot: boolean;
  commission_amount: string;
  product_subsidy_amount: string;
  ship_to_model_tracking_no?: string | null;
  ship_to_model_company?: string | null;
  return_tracking_no?: string | null;
  return_company?: string | null;
  submitted_at?: string | null;
  reviewed_at?: string | null;
  claimed_at?: string | null;
  shipped_at?: string | null;
  in_progress_at?: string | null;
  returned_at?: string | null;
  completed_at?: string | null;
  reject_reason?: string | null;
  talent?: TalentSnapshot | null;
  model?: TalentSnapshot | null;
  submissions?: FulfillmentSubmission[];
  application?: OrderApplication | null;
}

export interface OrderWorkspaceSummary {
  quantity: number;
  approved_quantity: number;
  active_quantity: number;
  submitted_quantity: number;
  completed_quantity: number;
  available_quantity: number;
  recruitment_status: "OPEN" | "FULL" | "CLOSED" | string;
  pending_application_count?: number;
  waiting_submission_count?: number;
  waiting_acceptance_count?: number;
}

export interface OrderWorkspace {
  order: OrderItem;
  summary: OrderWorkspaceSummary;
  applications: OrderApplication[];
  fulfillments: OrderFulfillment[];
  recent_logs?: OrderLog[];
}

export interface MarketplaceOrder extends OrderItem {
  merchant: { id: number; nickname: string; avatar_url?: string | null; shop_name?: string; shop_platform?: string | null; quality_merchant?: boolean; guarantee_deposit_paid?: boolean; guarantee_deposit_amount?: string } | null;
  application_reason?: string | null;
}

export interface OrderApplication {
  id: number;
  order_id?: number;
  status: ApplicationStatus;
  message: string | null;
  owned_product_images?: string[];
  review_reason?: string | null;
  created_at: string | null;
  reviewed_at?: string | null;
  applicant?: TalentSnapshot | null;
  fulfillment_id?: number | null;
  fulfillment?: OrderFulfillment | null;
  order?: OrderItem;
}

interface OrderList<T = OrderItem> { items: T[]; total: number; page?: number; page_size?: number; }

export function getMyOrders(status?: OrderStatus, page = 1, pageSize = 20) {
  return request<OrderList>(client.get("/orders", { params: { status_filter: status, page, page_size: pageSize } }));
}
export function getOrderHall(category?: string, page = 1, pageSize = 20) {
  return request<OrderList<MarketplaceOrder>>(client.get("/orders/hall", {
    params: {
      ...(category ? { category } : {}),
      page,
      page_size: pageSize,
    },
  }));
}
export function getHallOrder(orderId: number) { return request<MarketplaceOrder>(client.get(`/orders/hall/${orderId}`)); }
export function getOrder(orderId: number) { return request<OrderDetail>(client.get(`/orders/${orderId}`)); }
export function getOrderWorkspace(orderId: number) { return request<OrderWorkspace>(client.get(`/orders/${orderId}/workspace`)); }
export function getOrderApplications(orderId: number, params: { status?: ApplicationStatus; keyword?: string; page?: number; page_size?: number } = {}) { return request<OrderList<OrderApplication>>(client.get(`/orders/${orderId}/applications`, { params })); }
export function getOrderFulfillments(orderId: number, status?: FulfillmentStatus) { return request<OrderList<OrderFulfillment>>(client.get(`/orders/${orderId}/fulfillments`, { params: status ? { status } : undefined })); }
export function getFulfillment(fulfillmentId: number) { return request<OrderFulfillment & { order?: OrderItem; logs?: OrderLog[] }>(client.get(`/orders/fulfillments/${fulfillmentId}`)); }
export function getMyFulfillments(status?: FulfillmentStatus, page = 1, pageSize = 20) { return request<OrderList<OrderFulfillment>>(client.get("/orders/fulfillments/my", { params: { status, page, page_size: pageSize } })); }
export function applyForOrder(orderId: number, message?: string, ownedProductImages: string[] = []) { return request<OrderApplication>(client.post(`/orders/${orderId}/applications`, { message, owned_product_images: ownedProductImages })); }
export function getMyApplications() { return request<{ items: OrderApplication[]; total: number }>(client.get("/orders/my-applications")); }
export function createOrder(values: Record<string, unknown>) { return request<OrderItem>(client.post("/orders", values)); }
export function shipOrder(orderId: number, values: { tracking_no: string; company: string }) { return request<OrderItem>(client.put(`/orders/${orderId}/ship`, values)); }
export function receiveOrder(orderId: number) { return request<OrderItem>(client.put(`/orders/${orderId}/receive`)); }
export function submitOrder(orderId: number, values: { tracking_no?: string; company?: string; submitted_media: string[] }) { return request<OrderItem>(client.put(`/orders/${orderId}/submit`, values)); }
export function reviewOwnedProduct(orderId: number, values: { approved: boolean; reason?: string }) { return request<OrderItem>(client.put(`/orders/${orderId}/owned-product-review`, values)); }
export function acceptOrder(orderId: number) { return request<OrderItem>(client.put(`/orders/${orderId}/accept`)); }
export function rejectOrder(orderId: number, reason: string) { return request<OrderItem>(client.put(`/orders/${orderId}/reject`, { reason })); }
export function cancelOrder(orderId: number) { return request<OrderItem>(client.put(`/orders/${orderId}/cancel`)); }
export function shipFulfillment(fulfillmentId: number, values: { tracking_no: string; company: string }) { return request<OrderFulfillment>(client.put(`/orders/fulfillments/${fulfillmentId}/ship`, values)); }
export function receiveFulfillment(fulfillmentId: number) { return request<OrderFulfillment>(client.put(`/orders/fulfillments/${fulfillmentId}/receive`)); }
export function reviewFulfillmentOwnedProduct(fulfillmentId: number, values: { approved: boolean; reason?: string }) { return request<OrderFulfillment>(client.put(`/orders/fulfillments/${fulfillmentId}/owned-product-review`, values)); }
export function submitFulfillment(fulfillmentId: number, values: { submitted_media: string[]; remark?: string; tracking_no?: string; company?: string }) { return request<FulfillmentSubmission>(client.post(`/orders/fulfillments/${fulfillmentId}/submissions`, values)); }
export function reviewFulfillmentSubmission(fulfillmentId: number, submissionId: number, values: { approved: boolean; reason?: string }) { return request<OrderFulfillment>(client.put(`/orders/fulfillments/${fulfillmentId}/submissions/${submissionId}/review`, values)); }
export function returnFulfillment(fulfillmentId: number, values: { tracking_no: string; company: string }) { return request<OrderFulfillment>(client.put(`/orders/fulfillments/${fulfillmentId}/return`, values)); }
export function acceptFulfillment(fulfillmentId: number) { return request<OrderFulfillment>(client.put(`/orders/fulfillments/${fulfillmentId}/accept`)); }
export function disputeFulfillment(fulfillmentId: number, reason: string) { return request<OrderFulfillment>(client.put(`/orders/fulfillments/${fulfillmentId}/dispute`, { reason })); }

export interface OrderMessage { id: number; sender_id: number; content: string; created_at: string | null; }
export function getMessages(orderId: number) { return request<{ items: OrderMessage[]; total: number }>(client.get(`/orders/${orderId}/messages`)); }
export function postMessage(orderId: number, content: string) { return request<OrderMessage>(client.post(`/orders/${orderId}/messages`, { content })); }

export interface FulfillmentMessage extends OrderMessage {
  fulfillment_id?: number;
}
export function getFulfillmentMessages(fulfillmentId: number) {
  return request<{ items: FulfillmentMessage[]; total: number }>(client.get(`/orders/fulfillments/${fulfillmentId}/messages`));
}
export function postFulfillmentMessage(fulfillmentId: number, content: string) {
  return request<FulfillmentMessage>(client.post(`/orders/fulfillments/${fulfillmentId}/messages`, { content }));
}

export function uploadFile(file: File) {
  const form = new FormData();
  form.append("file", file);
  return request<{ url: string }>(client.post("/uploads", form, { timeout: 120_000 }));
}
