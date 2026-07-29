import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { AppstoreOutlined, ArrowRightOutlined, PictureOutlined } from "@ant-design/icons";
import { Alert, Button, Empty, Image, Segmented, Skeleton, Space, Tag, Typography } from "antd";
import { useNavigate } from "react-router-dom";

import { getOrderHall } from "../../api/orders";
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
        <Typography.Title level={2}>接单大厅</Typography.Title>
        <Typography.Text type="secondary">可申请订单 {data?.total ?? 0}</Typography.Text>
      </div>
      <AppstoreOutlined className="talent-hall-icon" aria-hidden="true" />
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
            <div className="talent-order-meta"><Space size={[4, 4]} wrap>{order.product_categories.map((item) => <Tag key={item} color={productCategoryColor(item)}>{item}</Tag>)}</Space><strong>¥{order.commission_amount}</strong></div>
            <Typography.Title level={4} ellipsis={{ rows: 2 }}>{order.title}</Typography.Title>
            <Typography.Paragraph ellipsis={{ rows: 2 }} className="talent-order-description">{order.description}</Typography.Paragraph>
            <div className="talent-order-facts"><span>{order.quantity} 件样品</span><span>{order.required_media_count} 份素材</span><span>{order.delivery_days} 天交付</span></div>
            <Typography.Text className="talent-order-requirement" ellipsis>{order.shoot_requirements || "按订单要求交付素材"}</Typography.Text>
            <Button type="primary" block icon={<ArrowRightOutlined />} onClick={() => navigate(`/model/hall/${order.id}`)}>{order.application_status === "PENDING" ? "查看申请" : "查看详情并申请"}</Button>
          </div>
        </article>;
      })}</div> : <Empty description="该分类暂无可接订单" />}
  </section>;
}
