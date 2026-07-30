import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Empty, Pagination, Skeleton, Table, Tabs, Typography } from "antd";
import { useNavigate } from "react-router-dom";

import { getMyOrders, type OrderStatus } from "../../api/orders";
import { OrderStatusTag } from "../../components/OrderStatusTag";
import { talentOrderNextAction } from "./talentOrderProgress";

const tabs: { key: OrderStatus | "all"; label: string }[] = [
  { key: "all", label: "全部" }, { key: "CLAIMED", label: "待寄出" }, { key: "SHIPPED_TO_MODEL", label: "待收货" },
  { key: "IN_PROGRESS", label: "拍摄中" }, { key: "RETURNED", label: "待验收" }, { key: "COMPLETED", label: "已完成" },
];

export function ModelOrdersPage() {
  const navigate = useNavigate();
  const [status, setStatus] = useState<OrderStatus | "all">("all");
  const [page, setPage] = useState(1);
  const { data, isLoading } = useQuery({ queryKey: ["model-orders", status, page], queryFn: () => getMyOrders(status === "all" ? undefined : status, page) });
  const orders = data?.items ?? [];
  const selectStatus = (value: string) => {
    setStatus(value as OrderStatus | "all");
    setPage(1);
  };

  return <div className="model-orders-page">
    <div className="page-heading model-orders-heading"><div><Typography.Title level={2}>我的订单</Typography.Title><Typography.Text type="secondary">查看订单状态和下一步安排。</Typography.Text></div></div>
    <Tabs activeKey={status} onChange={selectStatus} items={tabs} />
    <div className="model-mobile-order-list">
      {isLoading ? <Skeleton active paragraph={{ rows: 5 }} /> : orders.length > 0 ? <>{orders.map((order) => <button type="button" className="model-mobile-order" key={order.id} onClick={() => navigate(`/model/orders/${order.id}`)}>
        <span className="model-mobile-order-heading"><strong>{order.title}</strong><OrderStatusTag status={order.status} /></span>
        <span className="model-mobile-order-number">{order.order_no}</span>
        <span className="model-mobile-order-progress"><span>下一步</span><strong>{talentOrderNextAction(order.status)}</strong></span>
        <span className="model-mobile-order-footer"><span>本单收益</span><b>¥{order.commission_amount}</b></span>
      </button>)}</> : <Empty description="暂无订单" />}
      {(data?.total ?? 0) > 20 && <Pagination simple current={page} pageSize={20} total={data?.total ?? 0} onChange={setPage} showSizeChanger={false} />}
    </div>
    <div className="model-orders-table"><Table rowKey="id" loading={isLoading} dataSource={orders} pagination={{ current: page, pageSize: 20, total: data?.total ?? 0, onChange: setPage, showSizeChanger: false }} onRow={(record) => ({ onClick: () => navigate(`/model/orders/${record.id}`), className: "table-row-link" })} columns={[
      { title: "订单", dataIndex: "title" },
      { title: "收益", dataIndex: "commission_amount", render: (value) => `¥${value}` },
      { title: "状态", dataIndex: "status", render: (value) => <OrderStatusTag status={value} /> },
      { title: "下一步", dataIndex: "status", render: (value) => talentOrderNextAction(value) },
    ]} /></div>
  </div>;
}
