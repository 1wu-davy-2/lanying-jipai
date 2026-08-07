import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeftOutlined } from "@ant-design/icons";
import { Alert, Button, Card, Descriptions, Divider, Empty, Form, Image, Input, Modal, Space, Timeline, Typography, message } from "antd";
import { useNavigate } from "react-router-dom";

import { disputeFulfillment, getFulfillment, getOrder, receiveFulfillment, returnFulfillment, submitFulfillment } from "../../api/orders";
import { FulfillmentMessageBoard } from "../../components/FulfillmentMessageBoard";
import { OrderMediaUpload } from "../../components/OrderMediaUpload";
import { OrderStatusTag, orderStatusLabel } from "../../components/OrderStatusTag";
import { talentOrderNextAction } from "./talentOrderProgress";

function isVideo(url: string) { return /\.mp4(?:[?#]|$)/i.test(url); }

/** 交付素材缩略图：固定 4:3，图片与视频都标注类型；视频保留原生 controls。 */
function FulfillmentMediaThumbs({ urls }: { urls: string[] }) {
  return <div className="fulfillment-media-grid">{urls.map((url) => (
    <div className="fulfillment-media-thumb" key={url}>
      {isVideo(url) ? <video src={url} controls preload="metadata" aria-label="交付视频" /> : <Image src={url} alt="交付图片" />}
      <span className="fulfillment-media-type">{isVideo(url) ? "视频" : "图片"}</span>
    </div>
  ))}</div>;
}

export function ModelFulfillmentDetailPage({ fulfillmentId }: { fulfillmentId: number }) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [media, setMedia] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  const [disputeOpen, setDisputeOpen] = useState(false);
  const [disputeReason, setDisputeReason] = useState("");
  const [disputeSaving, setDisputeSaving] = useState(false);
  const [returnForm] = Form.useForm<{ company: string; tracking_no: string }>();
  const { data: fulfillment, isLoading } = useQuery({ queryKey: ["fulfillment", fulfillmentId], queryFn: () => getFulfillment(fulfillmentId) });
  const { data: parentOrder } = useQuery({ queryKey: ["order", fulfillment?.order_id], queryFn: () => getOrder(fulfillment!.order_id), enabled: Boolean(fulfillment?.order_id) });
  const refresh = () => queryClient.invalidateQueries({ queryKey: ["fulfillment", fulfillmentId] });
  const submit = async () => {
    if (!media.length) { message.warning("请至少上传一张图片和一个大于 5 秒的视频"); return; }
    const requiredImages = parentOrder?.required_media_count || fulfillment?.order?.required_media_count || 1;
    const imageCount = media.filter((url) => !isVideo(url)).length;
    const hasVideo = media.some(isVideo);
    if (imageCount < requiredImages || !hasVideo) {
      message.warning(`请上传至少 ${requiredImages} 张图片和 1 个 MP4 视频（超过 5 秒）`);
      return;
    }
    if (saving) return;
    setSaving(true);
    try { await submitFulfillment(fulfillmentId, { submitted_media: media }); setMedia([]); await refresh(); message.success("返图版本已提交"); } catch (error) { message.error(error instanceof Error ? error.message : "提交失败"); } finally { setSaving(false); }
  };
  const submitReturn = async (values: { company: string; tracking_no: string }) => {
    if (saving) return;
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
  const submitDispute = async () => {
    const reason = disputeReason.trim();
    if (!reason) {
      message.warning("请说明申诉原因");
      return;
    }
    setDisputeSaving(true);
    try {
      await disputeFulfillment(fulfillmentId, reason);
      setDisputeOpen(false);
      setDisputeReason("");
      await refresh();
      message.success("申诉已提交，等待管理员处理");
    } catch (error) {
      message.error(error instanceof Error ? error.message : "申诉提交失败");
    } finally {
      setDisputeSaving(false);
    }
  };
  const receive = async () => {
    if (saving) return;
    setSaving(true);
    try {
      await receiveFulfillment(fulfillmentId);
      await refresh();
      message.success("已确认收货");
    } catch (error) {
      message.error(error instanceof Error ? error.message : "确认收货失败");
    } finally {
      setSaving(false);
    }
  };
  if (isLoading) return <Card loading />;
  if (!fulfillment) return <Empty description="履约实例不存在或无权查看" />;
  const latest = fulfillment.submissions?.[0];
  const status = fulfillment.status;
  const submissions = fulfillment.submissions ?? [];
  const canDispute = ["SUBMITTED", "REVISION_REQUIRED", "WAITING_RETURN", "RETURNED"].includes(status);
  const deliveryDays = parentOrder?.delivery_days ?? fulfillment.order?.delivery_days;
  return <div className="order-detail model-fulfillment-detail"><div className="page-heading"><Button type="text" icon={<ArrowLeftOutlined />} aria-label="返回订单列表" onClick={() => navigate("/model/orders")} /><div><Typography.Title level={2}>名额 {fulfillment.slot_no ?? "已释放"} · {fulfillment.order?.title || parentOrder?.title || "履约详情"}</Typography.Title><Typography.Text type="secondary">仅显示你自己的物流、返图和审核记录</Typography.Text></div><OrderStatusTag status={status} /></div>
    <Card className="content-card fulfillment-stage-card" title="当前阶段">
      <div className="fulfillment-stage-heading">
        <div className="fulfillment-stage-copy">
          <strong className="fulfillment-stage-status">{orderStatusLabel(status)}</strong>
          <span className="fulfillment-stage-next">下一步：{talentOrderNextAction(status)}</span>
          <span className="fulfillment-stage-condition">需在 {deliveryDays ?? "-"} 天内完成素材交付；{fulfillment.return_required ? "返货验收通过后结算。" : "验收通过后结算。"}</span>
        </div>
        <div className="fulfillment-stage-facts">
          <span>佣金 <b>¥{fulfillment.commission_amount}</b></span>
          <span>商品补贴 <b>¥{fulfillment.product_subsidy_amount}</b></span>
        </div>
      </div>
      {status === "DISPUTED" && <Alert type="warning" showIcon message="申诉处理中" description="该履约已提交管理员处理，处理完成前不能继续提交返图或物流。" />}
      {status === "SHIPPED_TO_MODEL" && <Button type="primary" loading={saving} onClick={receive}>确认收货</Button>}
      {(status === "IN_PROGRESS" || status === "REVISION_REQUIRED") && <div className="fulfillment-submit-box">
        {status === "REVISION_REQUIRED" && latest?.review_reason && <Alert type="warning" showIcon message="修改要求" description={latest.review_reason} />}
        <Typography.Text strong>{status === "REVISION_REQUIRED" ? "请根据审核意见修改后重新提交" : "提交返图版本"}</Typography.Text>
        <Typography.Paragraph type="secondary">至少包含 {parentOrder?.required_media_count || fulfillment.order?.required_media_count || 1} 张图片和 1 个大于 5 秒的 MP4 视频。</Typography.Paragraph>
        <OrderMediaUpload value={media} onChange={setMedia} accept="media" maxCount={Math.max(9, (parentOrder?.required_media_count || fulfillment.order?.required_media_count || 1) + 3)} />
        <Button type="primary" loading={saving} onClick={submit}>提交当前版本</Button>
      </div>}
      {status === "WAITING_RETURN" && <div className="fulfillment-submit-box"><Typography.Text strong>填写返货物流</Typography.Text><Typography.Paragraph type="secondary">返图审核已通过，请寄回商品后填写物流信息，商家验收后结算。</Typography.Paragraph><Form form={returnForm} layout="vertical" onFinish={submitReturn}><Form.Item name="company" label="物流公司" rules={[{ required: true, message: "请输入物流公司" }]}><Input maxLength={50} /></Form.Item><Form.Item name="tracking_no" label="物流单号" rules={[{ required: true, message: "请输入物流单号" }]}><Input maxLength={50} /></Form.Item><Button type="primary" htmlType="submit" loading={saving}>提交返货物流</Button></Form></div>}
    </Card>
    <div className="order-detail-grid">
      <Card className="content-card" title="物流与交付"><Descriptions column={{ xs: 1, sm: 2 }} size="small" items={[{ key: "ship", label: "寄样物流", children: fulfillment.ship_to_model_tracking_no ? `${fulfillment.ship_to_model_company || ""} ${fulfillment.ship_to_model_tracking_no}` : "暂无" }, { key: "return", label: "返货物流", children: fulfillment.return_required ? fulfillment.return_tracking_no ? `${fulfillment.return_company || ""} ${fulfillment.return_tracking_no}` : "待填写" : "拍后自留" }]} />
        {submissions.length > 0 && <><Divider /><div className="fulfillment-version-list">{submissions.map((submission, index) => (
          <div className={`fulfillment-version${index === 0 ? " fulfillment-version--latest" : ""}`} key={submission.id}>
            <div className="fulfillment-version-heading"><strong>{index === 0 ? "最近提交" : "历史版本"} · 第 {submission.version} 版</strong><span className="muted-text">{submission.submitted_at ? new Date(submission.submitted_at).toLocaleString() : ""}</span></div>
            <FulfillmentMediaThumbs urls={submission.media_urls} />
            {submission.review_reason && <Typography.Paragraph type="warning" className="fulfillment-version-feedback">审核反馈：{submission.review_reason}</Typography.Paragraph>}
          </div>
        ))}</div></>}
        {submissions.length === 0 && <Typography.Text type="secondary">尚未提交交付素材</Typography.Text>}
      </Card>
      <Card className="content-card" title="履约时间线"><Timeline items={[{ children: `名额分配 ${fulfillment.claimed_at ? new Date(fulfillment.claimed_at).toLocaleString() : "-"}` }, { children: `寄样 ${fulfillment.shipped_at ? new Date(fulfillment.shipped_at).toLocaleString() : "-"}` }, { children: `返图提交 ${fulfillment.submitted_at ? new Date(fulfillment.submitted_at).toLocaleString() : "-"}` }, { children: `完成 ${fulfillment.completed_at ? new Date(fulfillment.completed_at).toLocaleString() : "-"}` }]} /></Card>
    </div>
    <FulfillmentMessageBoard fulfillmentId={fulfillment.id} />
    <Space wrap className="fulfillment-detail-actions">{canDispute && <Button danger onClick={() => setDisputeOpen(true)}>发起申诉</Button>}</Space>
    <Modal title="发起履约申诉" open={disputeOpen} onCancel={() => setDisputeOpen(false)} okText="提交申诉" cancelText="取消" confirmLoading={disputeSaving} onOk={submitDispute} destroyOnHidden>
      <Typography.Paragraph type="secondary">请描述你认为需要平台介入的事实、证据和诉求。提交后该履约会暂时停止后续操作。</Typography.Paragraph>
      <Input.TextArea value={disputeReason} onChange={(event) => setDisputeReason(event.target.value)} rows={5} maxLength={1000} showCount placeholder="填写申诉原因" />
    </Modal>
  </div>;
}
