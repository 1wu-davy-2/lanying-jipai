import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeftOutlined } from "@ant-design/icons";
import { Button, Card, Descriptions, Divider, Empty, Form, Image, Input, Space, Timeline, Typography, message } from "antd";
import { useNavigate } from "react-router-dom";

import { getFulfillment, getOrder, receiveFulfillment, returnFulfillment, submitFulfillment } from "../../api/orders";
import { OrderMediaUpload } from "../../components/OrderMediaUpload";
import { OrderStatusTag } from "../../components/OrderStatusTag";
import { talentOrderNextAction } from "./talentOrderProgress";

function isVideo(url: string) { return /\.(mp4|mov|webm)(\?|$)/i.test(url); }

export function ModelFulfillmentDetailPage({ fulfillmentId }: { fulfillmentId: number }) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [media, setMedia] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  const [returnForm] = Form.useForm<{ company: string; tracking_no: string }>();
  const { data: fulfillment, isLoading } = useQuery({ queryKey: ["fulfillment", fulfillmentId], queryFn: () => getFulfillment(fulfillmentId) });
  const { data: parentOrder } = useQuery({ queryKey: ["order", fulfillment?.order_id], queryFn: () => getOrder(fulfillment!.order_id), enabled: Boolean(fulfillment?.order_id) });
  const refresh = () => queryClient.invalidateQueries({ queryKey: ["fulfillment", fulfillmentId] });
  const submit = async () => {
    if (!media.length) { message.warning("请至少上传一张图片和一个大于 5 秒的视频"); return; }
    setSaving(true);
    try { await submitFulfillment(fulfillmentId, { submitted_media: media }); setMedia([]); await refresh(); message.success("返图版本已提交"); } catch (error) { message.error(error instanceof Error ? error.message : "提交失败"); } finally { setSaving(false); }
  };
  const submitReturn = async (values: { company: string; tracking_no: string }) => {
    setSaving(true);
    try {
      await returnFulfillment(fulfillmentId, values);
      returnForm.resetFields();
      await refresh();
      message.success("返货物流已提交，等待商家验收");
    } catch (error) {
      message.error(error instanceof Error ? error.message : "返货物流提交失败");
    } finally {
      setSaving(false);
    }
  };
  if (isLoading) return <Card loading />;
  if (!fulfillment) return <Empty description="履约实例不存在或无权查看" />;
  const latest = fulfillment.submissions?.[0];
  const status = fulfillment.status;
  const mediaUrls = latest?.media_urls || [];
  return <div className="order-detail model-fulfillment-detail"><div className="page-heading"><Button type="text" icon={<ArrowLeftOutlined />} aria-label="返回订单列表" onClick={() => navigate("/model/orders")} /><div><Typography.Title level={2}>名额 {fulfillment.slot_no ?? "已释放"} · {fulfillment.order?.title || parentOrder?.title || "履约详情"}</Typography.Title><Typography.Text type="secondary">仅显示你自己的物流、返图和审核记录</Typography.Text></div><OrderStatusTag status={status} /></div>
    <div className="order-detail-grid"><Card className="content-card" title="当前履约"><Descriptions column={{ xs: 1, sm: 2 }} size="small" items={[{ key: "status", label: "状态", children: <OrderStatusTag status={status} /> }, { key: "next", label: "下一步", children: talentOrderNextAction(status) }, { key: "commission", label: "佣金", children: `¥${fulfillment.commission_amount}` }, { key: "subsidy", label: "商品补贴", children: `¥${fulfillment.product_subsidy_amount}` }, { key: "ship", label: "寄样物流", children: fulfillment.ship_to_model_tracking_no ? `${fulfillment.ship_to_model_company || ""} ${fulfillment.ship_to_model_tracking_no}` : "暂无" }, { key: "return", label: "返货物流", children: fulfillment.return_required ? fulfillment.return_tracking_no ? `${fulfillment.return_company || ""} ${fulfillment.return_tracking_no}` : "待填写" : "拍后自留" }]} />
      {mediaUrls.length > 0 && <><Divider /><Typography.Text strong>最近提交版本 {latest?.version}</Typography.Text><Space wrap style={{ marginTop: 10 }}>{mediaUrls.map((url) => isVideo(url) ? <video key={url} src={url} controls preload="metadata" style={{ width: 120, height: 90, background: "#172026" }} /> : <Image key={url} width={120} height={90} style={{ objectFit: "cover" }} src={url} />)}</Space></>}
      {latest?.review_reason && <Typography.Paragraph type="warning" style={{ marginTop: 14 }}>审核反馈：{latest.review_reason}</Typography.Paragraph>}
      {status === "SHIPPED_TO_MODEL" && <Button type="primary" onClick={async () => { try { await receiveFulfillment(fulfillmentId); await refresh(); message.success("已确认收货"); } catch (error) { message.error(error instanceof Error ? error.message : "确认收货失败"); } }}>确认收货</Button>}
      {(status === "IN_PROGRESS" || status === "REVISION_REQUIRED") && <div className="fulfillment-submit-box"><Typography.Text strong>{status === "REVISION_REQUIRED" ? "请根据审核意见修改后重新提交" : "提交返图版本"}</Typography.Text><Typography.Paragraph type="secondary">至少包含 {parentOrder?.required_media_count || fulfillment.order?.required_media_count || 1} 张图片和 1 个大于 5 秒的 MP4 视频。</Typography.Paragraph><OrderMediaUpload value={media} onChange={setMedia} accept="media" maxCount={Math.max(9, (parentOrder?.required_media_count || fulfillment.order?.required_media_count || 1) + 3)} /><Button type="primary" loading={saving} onClick={submit}>提交当前版本</Button></div>}
      {status === "WAITING_RETURN" && <div className="fulfillment-submit-box"><Typography.Text strong>填写返货物流</Typography.Text><Typography.Paragraph type="secondary">返图审核已通过，请寄回商品后填写物流信息，商家验收后结算。</Typography.Paragraph><Form form={returnForm} layout="vertical" onFinish={submitReturn}><Form.Item name="company" label="物流公司" rules={[{ required: true, message: "请输入物流公司" }]}><Input maxLength={50} /></Form.Item><Form.Item name="tracking_no" label="物流单号" rules={[{ required: true, message: "请输入物流单号" }]}><Input maxLength={50} /></Form.Item><Button type="primary" htmlType="submit" loading={saving}>提交返货物流</Button></Form></div>}
    </Card><Card className="content-card" title="履约时间线"><Timeline items={[{ children: `名额分配 ${fulfillment.claimed_at ? new Date(fulfillment.claimed_at).toLocaleString() : "-"}` }, { children: `寄样 ${fulfillment.shipped_at ? new Date(fulfillment.shipped_at).toLocaleString() : "-"}` }, { children: `返图提交 ${fulfillment.submitted_at ? new Date(fulfillment.submitted_at).toLocaleString() : "-"}` }, { children: `完成 ${fulfillment.completed_at ? new Date(fulfillment.completed_at).toLocaleString() : "-"}` }]} /></Card></div>
  </div>;
}
