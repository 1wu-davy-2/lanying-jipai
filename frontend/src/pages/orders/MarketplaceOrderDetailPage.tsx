import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeftOutlined, CheckCircleOutlined, ClockCircleOutlined, FileImageOutlined, SafetyCertificateOutlined, ShopOutlined } from "@ant-design/icons";
import { Alert, Button, Empty, Image, Input, Modal, Skeleton, Space, Tag, Typography, message } from "antd";
import { useNavigate } from "react-router-dom";

import { applyForOrder, getHallOrder, productSourceLabels } from "../../api/orders";
import { OrderMediaUpload } from "../../components/OrderMediaUpload";
import { getTalentStatus } from "../../api/users";
import { productCategoryColor } from "../../constants/productCategories";

const orderTypeLabels = {
  product_photo: "商品平拍",
  try_on: "试穿展示",
  short_video: "短视频素材",
  live_show: "直播展示",
};

export function MarketplaceOrderDetailPage({ orderId }: { orderId: number }) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [applicationMessage, setApplicationMessage] = useState("");
  const [ownedProductImages, setOwnedProductImages] = useState<string[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const { data: order, isLoading, error } = useQuery({ queryKey: ["hall-order", orderId], queryFn: () => getHallOrder(orderId) });
  const { data: talentStatus } = useQuery({ queryKey: ["talent-status"], queryFn: getTalentStatus });

  const submit = async () => {
    if (submitting) return;
    if (order?.product_source === "talent_owned" && ownedProductImages.length === 0) {
      message.warning("已有同款订单必须先上传至少一张同款实拍图");
      return;
    }
    setSubmitting(true);
    try {
      await applyForOrder(orderId, applicationMessage, ownedProductImages);
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["hall-order", orderId] }),
        queryClient.invalidateQueries({ queryKey: ["order-hall"] }),
      ]);
      setOpen(false);
      setOwnedProductImages([]);
      message.success("申请已提交，等待运营审核");
    } catch (requestError) {
      message.error(requestError instanceof Error ? requestError.message : "申请提交失败");
    } finally {
      setSubmitting(false);
    }
  };

  if (isLoading) return <Skeleton active paragraph={{ rows: 12 }} />;
  if (!order) return <Empty description={error instanceof Error ? error.message : "订单不存在或已结束招募"} />;
  const pending = order.application_status === "PENDING";
  const rejected = order.application_status === "REJECTED";
  const approved = order.application_status === "APPROVED";
  const blocked = !talentStatus?.can_claim;

  return <section className="marketplace-detail">
    <Button className="marketplace-back" type="text" icon={<ArrowLeftOutlined />} onClick={() => navigate("/model/hall")}>返回大厅</Button>
    <div className="marketplace-detail-layout">
      <div className="marketplace-gallery">
        {order.sample_images.length ? <Image.PreviewGroup items={order.sample_images}>
          <Image className="marketplace-cover" src={order.sample_images[0]} alt={order.title} />
          {order.sample_images.slice(1, 5).map((url) => <Image key={url} className="marketplace-thumb" src={url} alt={`${order.title} 样图`} />)}
        </Image.PreviewGroup> : <div className="marketplace-empty-media"><FileImageOutlined /><span>商家暂未上传样图</span></div>}
      </div>
      <div className="marketplace-summary">
        <Typography.Text className="talent-page-kicker">订单概览</Typography.Text>
        <Space size={[4, 6]} wrap>{order.product_categories.map((item) => <Tag key={item} color={productCategoryColor(item)}>{item}</Tag>)}<Tag>{orderTypeLabels[order.order_type]}</Tag></Space>
        <Typography.Title level={2}>{order.title}</Typography.Title>
        <div className="marketplace-reward"><Typography.Title level={4}>可获得收益</Typography.Title><strong>¥{(Number(order.commission_amount) + Number(order.product_subsidy_amount)).toFixed(2)}</strong>{order.product_subsidy_amount !== "0.00" && <Typography.Text type="secondary">含商品补贴 ¥{order.product_subsidy_amount}</Typography.Text>}</div>
        <div className="marketplace-spec-grid">
          <div><span>商品来源</span><strong>{productSourceLabels[order.product_source]}</strong></div>
          <div><span>商品处理</span><strong>{order.return_required ? "拍后需返货" : "拍完自留"}</strong></div>
          <div><span>交付素材</span><strong>{order.required_media_count} 张图片 + 1 视频</strong></div>
          <div><span>交付时限</span><strong>{order.delivery_days} 天内</strong></div>
        </div>
        {pending && <Alert type="info" showIcon icon={<ClockCircleOutlined />} message="申请已提交" description="运营将结合达人等级、作品和档期审核，审核通过后订单进入待寄样。" />}
        {rejected && <Alert type="warning" showIcon message="本次申请未通过" description={order.application_reason || "可继续浏览其他匹配订单。"} />}
        {approved && <Alert type="success" showIcon message="申请已通过" description="订单已分配，请到“我的订单”处理寄样与拍摄流程。" />}
        {(!order.application_status || rejected) && <Button className="marketplace-primary-action" type="primary" size="large" block disabled={blocked} onClick={() => setOpen(true)}>{blocked ? "暂不具备申请资格" : rejected && order.product_source === "talent_owned" ? "补充同款图后重新申请" : "提交接单申请"}</Button>}
        {blocked && <Typography.Text type="secondary">请先完成资料与实名认证，并满足当前等级的接单限制。</Typography.Text>}
      </div>
    </div>
    <div className="marketplace-information">
      <div className="marketplace-information-main">
        <section className="marketplace-information-section">
          <Typography.Title level={4}>你需要完成</Typography.Title>
          <Typography.Paragraph>{order.description}</Typography.Paragraph>
        </section>
        <section className="marketplace-information-section">
          <Typography.Title level={4}>如何完成</Typography.Title>
          <Typography.Paragraph className="marketplace-requirements">{order.shoot_requirements || "请按商家沟通确认的拍摄规范交付素材。"}<br />返图必须至少包含 {order.required_media_count} 张图片和 1 个时长大于 5 秒的 MP4 视频。</Typography.Paragraph>
        </section>
      </div>
      <aside className="marketplace-information-aside">
        <section className="marketplace-rules">
          <Typography.Title level={4}>订单保障与规则</Typography.Title>
          <div className="marketplace-commitments">
            <span><SafetyCertificateOutlined /> {order.deposit_required ? `需缴押金 ¥${order.deposit_amount}` : "无需缴纳押金"}</span>
            <span><CheckCircleOutlined /> {order.product_source === "merchant_ship" ? "运营审核通过后，商家才会寄出样品" : order.product_source === "talent_purchase" ? `达人自行购买，验收后补贴 ¥${order.product_subsidy_amount}` : "达人上传同款实拍图，商家审核通过后再拍摄"}</span>
            <span><ClockCircleOutlined /> 请在 {order.product_source === "merchant_ship" ? "收货后" : "审核通过后"} {order.delivery_days} 天内完成素材交付</span>
          </div>
        </section>
        <div className="marketplace-merchant">
          <ShopOutlined />
          <div><Typography.Text type="secondary">合作商家</Typography.Text><Typography.Title level={5}>{order.merchant?.shop_name || order.merchant?.nickname || "商家"}</Typography.Title><Space size={[4, 4]} wrap>{order.merchant?.quality_merchant && <Tag color="green">优质商家</Tag>}{order.merchant?.guarantee_deposit_paid && <Tag color="gold">已缴保证金 ¥{order.merchant.guarantee_deposit_amount}</Tag>}<Typography.Text type="secondary">{order.merchant?.shop_platform || "平台商家"}</Typography.Text></Space></div>
        </div>
      </aside>
    </div>
    <Modal title="提交接单申请" open={open} onCancel={() => { setOpen(false); setOwnedProductImages([]); }} onOk={submit} okText="确认申请" confirmLoading={submitting} destroyOnHidden>
      <Typography.Paragraph type="secondary">运营会根据作品、等级和当前档期审核。{order.product_source === "merchant_ship" ? "申请通过后，商家才会寄出样品。" : order.product_source === "talent_purchase" ? "申请通过后请自行购买商品，验收后补贴与佣金一并结算。" : "申请通过后还需由商家审核同款实拍图。"}</Typography.Paragraph>
      <Input.TextArea value={applicationMessage} onChange={(event) => setApplicationMessage(event.target.value)} rows={4} maxLength={300} showCount placeholder="简要说明你的拍摄方向、档期或相近作品经验（选填）" />
      {order.product_source === "talent_owned" && <div className="owned-product-upload"><Typography.Text strong>同款实拍图</Typography.Text><Typography.Paragraph type="secondary">请上传至少一张本人已有同款商品的清晰实拍图，商家会在分配后审核。</Typography.Paragraph><OrderMediaUpload value={ownedProductImages} onChange={setOwnedProductImages} accept="image" maxCount={6} /></div>}
    </Modal>
  </section>;
}
