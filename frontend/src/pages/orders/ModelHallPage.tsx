import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { AppstoreOutlined, PictureOutlined, ThunderboltOutlined } from "@ant-design/icons";
import { Button, Empty, Image, Modal, Segmented, Skeleton, Space, Tag, Typography, message } from "antd";

import { claimOrder, getOrderHall } from "../../api/orders";
import { PRODUCT_CATEGORIES, productCategoryColor } from "../../constants/productCategories";

const ALL_CATEGORIES = "all";

export function ModelHallPage() {
  const queryClient = useQueryClient();
  const [category, setCategory] = useState(ALL_CATEGORIES);
  const { data, isLoading } = useQuery({
    queryKey: ["order-hall", category],
    queryFn: () => getOrderHall(category === ALL_CATEGORIES ? undefined : category),
    refetchInterval: 15_000,
  });
  const claim = async (id: number) => {
    try {
      await claimOrder(id);
      await queryClient.invalidateQueries({ queryKey: ["order-hall"] });
      message.success("抢单成功");
    } catch (error) {
      message.error(error instanceof Error ? error.message : "该订单已被其他达人抢走");
      await queryClient.invalidateQueries({ queryKey: ["order-hall"] });
    }
  };
  const confirmClaim = (id: number, title: string) => Modal.confirm({
    title: "确认抢单",
    content: `确认接受「${title}」吗？`,
    okText: "确认抢单",
    cancelText: "取消",
    onOk: () => claim(id),
  });
  const categoryOptions = [
    { label: "全部", value: ALL_CATEGORIES },
    ...PRODUCT_CATEGORIES.map((item) => ({ label: item.value, value: item.value })),
  ];

  return <section className="talent-hall">
    <header className="talent-hall-heading">
      <div>
        <Typography.Title level={2}>抢单大厅</Typography.Title>
        <Typography.Text type="secondary">可接订单 {data?.total ?? 0}</Typography.Text>
      </div>
      <AppstoreOutlined className="talent-hall-icon" aria-hidden="true" />
    </header>
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
            <Typography.Text className="talent-order-requirement" ellipsis>{order.shoot_requirements || "按订单要求交付素材"}</Typography.Text>
            <Button type="primary" block icon={<ThunderboltOutlined />} onClick={() => confirmClaim(order.id, order.title)}>抢单</Button>
          </div>
        </article>;
      })}</div> : <Empty description="该分类暂无可接订单" />}
  </section>;
}
