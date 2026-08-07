import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Button, Card, Descriptions, Divider, Empty, Form, Image, Input, List, Modal, Space, Timeline, Typography, message } from "antd";
import { ArrowLeftOutlined } from "@ant-design/icons";
import { useNavigate } from "react-router-dom";

import {
  acceptOrder, cancelOrder, getMessages, getOrder, postMessage, receiveOrder, rejectOrder, reviewOwnedProduct, shipOrder, submitOrder,
  type OrderStatus,
} from "../../api/orders";
import { acceptAdminOrder, cancelAdminOrder, rejectAdminOrder, shipAdminOrder } from "../../api/admin";
import { OrderMediaUpload } from "../../components/OrderMediaUpload";
import { OrderStatusTag, orderStatusLabel } from "../../components/OrderStatusTag";
import type { UserRole } from "../../types";
import { talentOrderNextAction } from "./talentOrderProgress";

type ActionKind = "ship" | "submit" | "reject" | "owned-review" | "owned-reject";

function isVideo(url: string) {
  return /\.mp4(?:[?#]|$)/i.test(url);
}

function SubmittedMedia({ urls }: { urls: string[] }) {
  const imageUrls = urls.filter((url) => !isVideo(url));
  return <Image.PreviewGroup items={imageUrls}>
    <Space wrap>
      {urls.map((url) => isVideo(url)
        ? <video key={url} src={url} controls preload="metadata" className="order-media-thumb" />
        : <Image key={url} className="order-media-thumb" src={url} />)}
    </Space>
  </Image.PreviewGroup>;
}

export function OrderDetailPage({ role, orderId }: { role: UserRole; orderId: number }) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [action, setAction] = useState<ActionKind | null>(null);
  const [saving, setSaving] = useState(false);
  const [media, setMedia] = useState<string[]>([]);
  const [messageText, setMessageText] = useState("");
  const [form] = Form.useForm();
  const { data: order, isLoading } = useQuery({ queryKey: ["order", orderId], queryFn: () => getOrder(orderId) });
  const { data: messages } = useQuery({ queryKey: ["order-messages", orderId], queryFn: () => getMessages(orderId), refetchInterval: 10_000 });
  const refresh = async () => {
    await queryClient.invalidateQueries({ queryKey: ["order", orderId] });
    await queryClient.invalidateQueries({ queryKey: ["merchant-orders"] });
    await queryClient.invalidateQueries({ queryKey: ["model-orders"] });
    await queryClient.invalidateQueries({ queryKey: ["order-hall"] });
    await queryClient.invalidateQueries({ queryKey: ["admin-orders"] });
    await queryClient.invalidateQueries({ queryKey: ["operation-orders"] });
  };
  const runConfirm = (title: string, operation: () => Promise<unknown>) => {
    Modal.confirm({ title, content: "该操作不可撤销，确认继续吗？", okText: "确认", cancelText: "取消", onOk: async () => {
      try { await operation(); await refresh(); message.success("操作成功"); } catch (error) { message.error(error instanceof Error ? error.message : "操作失败"); }
    } });
  };
  const submitAction = async (values: { tracking_no?: string; company?: string; reason?: string }) => {
    if (!order || !action) return;
    setSaving(true);
    try {
      if (action === "ship") await (role === "admin" ? shipAdminOrder(order.id, { tracking_no: values.tracking_no ?? "", company: values.company ?? "" }) : shipOrder(order.id, { tracking_no: values.tracking_no ?? "", company: values.company ?? "" }));
      if (action === "submit") {
        if (media.length === 0) { message.error("请至少上传一份素材"); return; }
        await submitOrder(order.id, { tracking_no: values.tracking_no ?? "", company: values.company ?? "", submitted_media: media });
      }
      if (action === "owned-review") await reviewOwnedProduct(order.id, { approved: true });
      if (action === "owned-reject") await reviewOwnedProduct(order.id, { approved: false, reason: values.reason });
      if (action === "reject") await (role === "admin" ? rejectAdminOrder(order.id, values.reason ?? "") : rejectOrder(order.id, values.reason ?? ""));
      await refresh(); form.resetFields(); setMedia([]); setAction(null); message.success("操作成功");
    } catch (error) { message.error(error instanceof Error ? error.message : "操作失败"); } finally { setSaving(false); }
  };
  const sendMessage = async () => {
    if (!messageText.trim()) return;
    try { await postMessage(orderId, messageText.trim()); setMessageText(""); await queryClient.invalidateQueries({ queryKey: ["order-messages", orderId] }); }
    catch (error) { message.error(error instanceof Error ? error.message : "发送失败"); }
  };
  if (isLoading) return <Card loading />;
  if (!order) return <Empty description="订单不存在" />;
  const actsForMerchant = role === "merchant" || role === "admin";
  const canShip = actsForMerchant && order.status === "CLAIMED";
  const canReceive = role === "model" && order.status === "SHIPPED_TO_MODEL";
  const canSubmit = role === "model" && order.status === "IN_PROGRESS";
  const canAccept = actsForMerchant && order.status === "RETURNED";
  const canReviewOwnedProduct = role === "merchant" && order.status === "OWNED_PRODUCT_REVIEW";
  const canCancel = actsForMerchant && order.status === "PUBLISHED";
  const modelNextAction = role === "model" ? talentOrderNextAction(order.status) : null;
  const mediaUrls = [...order.sample_images, ...order.submitted_media];
  return <div className="order-detail">
    <div className="page-heading"><Button type="text" icon={<ArrowLeftOutlined />} aria-label="返回订单列表" onClick={() => navigate(role === "admin" ? "/admin/operations" : `/${role}/orders`)} /><Typography.Title level={2}>订单详情</Typography.Title><OrderStatusTag status={order.status} /></div>
    <div className="order-detail-grid">
      <Card className="content-card" title={order.title} extra={<strong>¥{order.commission_amount}</strong>}>
        <Descriptions column={{ xs: 1, sm: 2 }} size="small" items={[
          { key: "number", label: "订单号", children: order.order_no },
          { key: "status", label: "当前状态", children: <OrderStatusTag status={order.status} /> },
          { key: "created", label: "创建时间", children: order.created_at ? new Date(order.created_at).toLocaleString() : "-" },
          { key: "merchant", label: "商家归属", children: order.merchant ? `${order.merchant.nickname} · ${order.merchant.phone}` : `商家 #${order.merchant_id}` },
          { key: "product", label: "商品处理", children: `${order.product_source === "merchant_ship" ? "商家寄样" : order.product_source === "talent_purchase" ? "达人自行购买" : "达人已有同款"} · ${order.return_required ? "拍后需返货" : "拍完自留"}` },
          { key: "delivery", label: "交付标准", children: `${order.required_media_count} 张图片 + 至少 1 个大于 5 秒的视频` },
          { key: "requirements", label: "交付要求", children: order.shoot_requirements || "未填写", span: 2 },
          { key: "description", label: "拍摄说明", children: order.description, span: 2 },
        ]} />
        {modelNextAction && <div className="model-order-detail-next-action"><span>下一步</span><strong>{modelNextAction}</strong></div>}
        {(order.ship_to_model_tracking_no || order.return_tracking_no) && <><Divider /><Descriptions column={{ xs: 1, sm: 2 }} size="small" items={[
          { key: "ship", label: "寄样物流", children: order.ship_to_model_tracking_no ? `${order.ship_to_model_company} ${order.ship_to_model_tracking_no}` : "-" },
          { key: "return", label: "回寄物流", children: order.return_tracking_no ? `${order.return_company} ${order.return_tracking_no}` : "-" },
        ]} /></>}
        {order.owned_product_images?.length ? <><Divider /><Typography.Text strong>达人提交的同款实拍图</Typography.Text><Image.PreviewGroup items={order.owned_product_images}><Space wrap>{order.owned_product_images.map((url) => <Image key={url} className="order-media-thumb" src={url} />)}</Space></Image.PreviewGroup></> : null}
        {mediaUrls.length > 0 && <><Divider /><SubmittedMedia urls={mediaUrls} /></>}
        <Divider />
        <Space wrap>
          {canCancel && <Button danger onClick={() => runConfirm("撤回订单", () => role === "admin" ? cancelAdminOrder(order.id) : cancelOrder(order.id))}>撤回订单</Button>}
          {canShip && <Button type="primary" onClick={() => setAction("ship")}>填写寄样物流</Button>}
          {canReceive && <Button type="primary" onClick={() => runConfirm("确认收货", () => receiveOrder(order.id))}>确认收货</Button>}
          {canReviewOwnedProduct && <Button type="primary" onClick={() => setAction("owned-review")}>审核同款商品</Button>}
          {canReviewOwnedProduct && <Button danger onClick={() => setAction("owned-reject")}>驳回同款</Button>}
          {canSubmit && <Button type="primary" onClick={() => setAction("submit")}>{order.return_required ? "提交素材并回寄" : "提交素材"}</Button>}
          {canAccept && <Button type="primary" onClick={() => runConfirm("验收通过", () => role === "admin" ? acceptAdminOrder(order.id) : acceptOrder(order.id))}>验收通过</Button>}
          {canAccept && <Button danger onClick={() => setAction("reject")}>发起争议</Button>}
        </Space>
      </Card>
      <Card className="content-card" title="状态流转"><Timeline items={order.logs.map((log) => ({ color: log.to_status === "COMPLETED" ? "green" : undefined, children: <div><strong>{orderStatusLabel(log.to_status)}</strong><div className="muted-text">{log.remark || "状态更新"} {log.operator ? ` · ${log.operator.role === "admin" ? "运营" : log.operator.role === "merchant" ? "商家" : "达人"}：${log.operator.nickname}` : ""} {log.created_at ? ` · ${new Date(log.created_at).toLocaleString()}` : ""}</div></div> }))} /></Card>
    </div>
    <Card className="content-card message-board" title="订单留言">
      <List dataSource={messages?.items ?? []} locale={{ emptyText: "暂无留言" }} renderItem={(item) => <List.Item><List.Item.Meta title={item.sender_id === order.merchant_id ? "商家" : "达人"} description={item.created_at ? new Date(item.created_at).toLocaleString() : ""} /><span>{item.content}</span></List.Item>} />
      <Space.Compact className="message-composer"><Input value={messageText} onChange={(event) => setMessageText(event.target.value)} onPressEnter={sendMessage} placeholder="输入留言" maxLength={5000} /><Button type="primary" onClick={sendMessage}>发送</Button></Space.Compact>
    </Card>
    <Modal title={action === "ship" ? "填写寄样物流" : action === "submit" ? order.return_required ? "提交素材并回寄" : "提交素材" : action === "owned-review" ? "审核达人同款商品" : action === "owned-reject" ? "驳回达人同款商品" : "发起争议"} open={action !== null} onCancel={() => { setAction(null); form.resetFields(); setMedia([]); }} footer={null} destroyOnHidden>
      <Form form={form} layout="vertical" onFinish={submitAction}>
        {action === "submit" && <><Typography.Paragraph type="secondary">请上传至少 {order.required_media_count} 张图片及 1 个时长大于 5 秒的 MP4 视频。</Typography.Paragraph><Form.Item label="交付素材" required><OrderMediaUpload value={media} onChange={setMedia} accept="media" maxCount={Math.max(9, order.required_media_count + 3)} /></Form.Item></>}
        {(action === "ship" || (action === "submit" && order.return_required)) && <><Form.Item name="company" label="物流公司" rules={[{ required: true, message: "请输入物流公司" }]}><Input /></Form.Item><Form.Item name="tracking_no" label="物流单号" rules={[{ required: true, message: "请输入物流单号" }]}><Input /></Form.Item></>}
        {action === "owned-review" && <Typography.Paragraph>确认实拍图与订单商品为同款后，将允许达人直接开始拍摄。若不匹配请关闭此弹窗后通过订单留言沟通，并在后台重新开放申请。</Typography.Paragraph>}
        {action === "owned-reject" && <Form.Item name="reason" label="驳回原因" rules={[{ required: true, message: "请说明同款不匹配的原因" }]}><Input.TextArea rows={4} maxLength={255} /></Form.Item>}
        {action === "reject" && <Form.Item name="reason" label="争议原因" rules={[{ required: true, message: "请输入争议原因" }]}><Input.TextArea rows={4} /></Form.Item>}
        <Button type="primary" htmlType="submit" loading={saving}>确认提交</Button>
      </Form>
    </Modal>
  </div>;
}
