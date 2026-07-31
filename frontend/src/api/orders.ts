import { client, request } from "./client";
import type { UserRole } from "../types";

export type OrderStatus = "DRAFT" | "PUBLISHED" | "CLAIMED" | "OWNED_PRODUCT_REVIEW" | "SHIPPED_TO_MODEL" | "IN_PROGRESS" | "RETURNED" | "COMPLETED" | "DISPUTED" | "CANCELLED";
export type OrderType = "product_photo" | "try_on" | "short_video" | "live_show";
export type ApplicationStatus = "PENDING" | "APPROVED" | "REJECTED";
export type ProductSource = "merchant_ship" | "talent_purchase" | "talent_owned";

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

export interface MarketplaceOrder extends OrderItem {
  merchant: { id: number; nickname: string; avatar_url?: string | null; shop_name?: string; shop_platform?: string | null; quality_merchant?: boolean; guarantee_deposit_paid?: boolean; guarantee_deposit_amount?: string } | null;
  application_reason?: string | null;
}

export interface OrderApplication {
  id: number;
  order_id?: number;
  status: ApplicationStatus;
  message: string | null;
  review_reason?: string | null;
  created_at: string | null;
  order?: OrderItem;
}

interface OrderList<T = OrderItem> { items: T[]; total: number; page?: number; page_size?: number; }

export function getMyOrders(status?: OrderStatus, page = 1, pageSize = 20) {
  return request<OrderList>(client.get("/orders", { params: { status_filter: status, page, page_size: pageSize } }));
}
export function getOrderHall(category?: string) { return request<OrderList<MarketplaceOrder>>(client.get("/orders/hall", { params: category ? { category } : undefined })); }
export function getHallOrder(orderId: number) { return request<MarketplaceOrder>(client.get(`/orders/hall/${orderId}`)); }
export function getOrder(orderId: number) { return request<OrderDetail>(client.get(`/orders/${orderId}`)); }
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

export interface OrderMessage { id: number; sender_id: number; content: string; created_at: string | null; }
export function getMessages(orderId: number) { return request<{ items: OrderMessage[]; total: number }>(client.get(`/orders/${orderId}/messages`)); }
export function postMessage(orderId: number, content: string) { return request<OrderMessage>(client.post(`/orders/${orderId}/messages`, { content })); }

export function uploadFile(file: File) {
  const form = new FormData();
  form.append("file", file);
  return request<{ url: string }>(client.post("/uploads", form));
}
