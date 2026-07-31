import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { ArrowRightOutlined, PictureOutlined } from "@ant-design/icons";
import { Alert, Button, Empty, Image, Segmented, Skeleton, Space, Tag, Typography } from "antd";
import { useNavigate } from "react-router-dom";

import { getOrderHall, productSourceLabels } from "../../api/orders";
import { getTalentStatus } from "../../api/users";
import { PRODUCT_CATEGORIES, productCategoryColor } from "../../constants/productCategories";

const ALL_CATEGORIES = "all";

export function ModelHallPage() {
  const navigate = useNavigate();
  const [category, setCategory] = useState(ALL_CATEGORIES);
  const { data, isLoading } = useQuery({
    queryKey: ["order-hall", category],
    queryFn: () => getOrderHall(category === ALL_CATEGORIES ? undefined : category),
    refetchInterval: 15_000,
  });
  const { data: talentStatus } = useQuery({ queryKey: ["talent-status"], queryFn: getTalentStatus });
  const categoryOptions = [
    { label: "全部", value: ALL_CATEGORIES },
    ...PRODUCT_CATEGORIES.map((item) => ({ label: item.value, value: item.value })),
  ];

  return <section className="talent-hall">
    <header className="talent-hall-heading">
      <div>
        <Typography.Text className="talent-page-kicker">精选合作</Typography.Text>
        <Typography.Title level={2}>订单大厅</Typography.Title>
        <Typography.Text type="secondary">先看收益和要求，再选择适合自己的合作。</Typography.Text>
      </div>
      <div className="talent-hall-count" aria-label={`可申请订单 ${data?.total ?? 0} 单`}><strong>{data?.total ?? 0}</strong><span>可申请订单</span></div>
    </header>
    {talentStatus && <Alert className="talent-claim-status" type={talentStatus.can_claim ? "success" : "warning"} showIcon message={`${talentStatus.level.name}：同时最多 ${talentStatus.level.max_active_orders} 单，单笔不超过 ¥${talentStatus.level.max_commission_amount}`} description={talentStatus.can_claim ? `已完成 ${talentStatus.completed_orders} 单，当前进行中 ${talentStatus.active_orders} 单。` : talentStatus.profile_complete ? "实名认证审核通过后可正式接单。" : "请先在“我的”完成头像、用户名、收货地区和至少 6 张作品照片。"} />}
    <div className="hall-category-filter" aria-label="商品分类筛选">
      <Segmented value={category} options={categoryOptions} onChange={(value) => setCategory(String(value))} />
    </div>
    {isLoading ? <div className="talent-order-grid">{Array.from({ length: 6 }, (_, index) => <div className="talent-order-skeleton" key={index}><Skeleton active paragraph={{ rows: 4 }} /></div>)}</div> :
      (data?.items.length ?? 0) > 0 ? <div className="talent-order-grid">{data?.items.map((order) => {
        const image = order.sample_images[0];
        return <article className="talent-order-item" key={order.id}>
          <div className="talent-order-media">
            {image ? <Image preview={false} src={image} alt={order.title} /> : <div className="talent-order-placeholder"><PictureOutlined /><span>{order.product_categories[0] ?? "商品"}</span></div>}
          </div>
          <div className="talent-order-body">
            <div className="talent-order-meta"><Space size={[4, 4]} wrap>{order.product_categories.map((item) => <Tag key={item} color={productCategoryColor(item)}>{item}</Tag>)}{order.merchant?.quality_merchant && <Tag color="green">优质商家</Tag>}{order.merchant?.guarantee_deposit_paid && <Tag color="gold">已缴保证金</Tag>}</Space><div className="talent-order-commission"><span>佣金</span><strong>¥{order.commission_amount}</strong></div></div>
            <Typography.Title level={4} ellipsis={{ rows: 2 }}>{order.title}</Typography.Title>
            <Typography.Paragraph ellipsis={{ rows: 2 }} className="talent-order-description">{order.description}</Typography.Paragraph>
            <div className="talent-order-facts"><span>{productSourceLabels[order.product_source]}</span><span>{order.return_required ? "需要返货" : "拍完自留"}</span><span>{order.required_media_count} 张图片 + 1 视频</span><span>{order.delivery_days} 天交付</span></div>
            {order.product_source === "talent_purchase" && <div className="talent-order-subsidy">商品补贴 ¥{order.product_subsidy_amount}，验收后与佣金一并结算</div>}
            <div className="talent-order-requirement"><span>交付要求</span><Typography.Text ellipsis>{order.shoot_requirements || "按订单要求交付素材"}</Typography.Text></div>
            <Button type="primary" block icon={<ArrowRightOutlined aria-hidden="true" />} onClick={() => navigate(`/model/hall/${order.id}`)}>{order.application_status === "PENDING" ? "查看申请" : "查看详情并申请"}</Button>
          </div>
        </article>;
      })}</div> : <Empty description="该分类暂无可接订单" />}
  </section>;
}
