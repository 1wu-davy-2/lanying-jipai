import { client, request } from "./client";

export type OrderStatus = "DRAFT" | "PUBLISHED" | "CLAIMED" | "SHIPPED_TO_MODEL" | "IN_PROGRESS" | "RETURNED" | "COMPLETED" | "DISPUTED" | "CANCELLED";

export interface OrderItem {
  id: number;
  order_no: string;
  merchant_id: number;
  model_id: number | null;
  title: string;
  description: string;
  commission_amount: string;
  deposit_amount: string;
  sample_images: string[];
  shoot_requirements: string | null;
  status: OrderStatus;
  ship_to_model_tracking_no: string | null;
  ship_to_model_company: string | null;
  return_tracking_no: string | null;
  return_company: string | null;
  submitted_media: string[];
  reject_reason: string | null;
  created_at: string | null;
}

export interface OrderLog {
  id: number;
  operator_id: number;
  from_status: OrderStatus | null;
  to_status: OrderStatus;
  remark: string | null;
  created_at: string | null;
}

export interface OrderDetail extends OrderItem { logs: OrderLog[]; }

interface OrderList { items: OrderItem[]; total: number; page?: number; page_size?: number; }

export function getMyOrders(status?: OrderStatus) {
  return request<OrderList>(client.get("/orders", { params: status ? { status_filter: status } : undefined }));
}
export function getOrderHall() { return request<OrderList>(client.get("/orders/hall")); }
export function getOrder(orderId: number) { return request<OrderDetail>(client.get(`/orders/${orderId}`)); }
export function claimOrder(orderId: number) { return request<OrderItem>(client.post(`/orders/${orderId}/claim`)); }
export function createOrder(values: Record<string, unknown>) { return request<OrderItem>(client.post("/orders", values)); }
export function shipOrder(orderId: number, values: { tracking_no: string; company: string }) { return request<OrderItem>(client.put(`/orders/${orderId}/ship`, values)); }
export function receiveOrder(orderId: number) { return request<OrderItem>(client.put(`/orders/${orderId}/receive`)); }
export function submitOrder(orderId: number, values: { tracking_no: string; company: string; submitted_media: string[] }) { return request<OrderItem>(client.put(`/orders/${orderId}/submit`, values)); }
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
