import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Button, Empty, Pagination, Skeleton, Table, Tabs, Typography } from "antd";
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
  const { data, isLoading, error, refetch } = useQuery({ queryKey: ["model-orders", status, page], queryFn: () => getMyOrders(status === "all" ? undefined : status, page) });
  const orders = data?.items ?? [];
  const selectStatus = (value: string) => {
    setStatus(value as OrderStatus | "all");
    setPage(1);
  };

  return <div className="model-orders-page">
    <div className="page-heading model-orders-heading"><div><Typography.Title level={2}>我的订单</Typography.Title><Typography.Text type="secondary">查看订单状态和下一步安排。</Typography.Text></div></div>
    <Tabs activeKey={status} onChange={selectStatus} items={tabs} />
    {isLoading ? <Skeleton active paragraph={{ rows: 5 }} /> :
      error ? <Empty description="订单加载失败，请稍后重试"><Button onClick={() => refetch()}>重新加载</Button></Empty> :
        orders.length > 0 ? <><div className="model-mobile-order-list">
          {orders.map((order) => { const fulfillmentStatus = order.fulfillment_status || order.status; return <button type="button" className="model-mobile-order" key={order.fulfillment_id || order.id} onClick={() => navigate(order.fulfillment_id ? `/model/fulfillments/${order.fulfillment_id}` : `/model/orders/${order.id}`)}>
            <span className="model-mobile-order-heading"><strong>{order.title}</strong><OrderStatusTag status={fulfillmentStatus} /></span>
            <span className="model-mobile-order-number">{order.order_no}</span>
            <span className="model-mobile-order-progress"><span>{order.slot_no ? `名额 ${order.slot_no}` : "下一步"}</span><strong>{talentOrderNextAction(fulfillmentStatus)}</strong></span>
            <span className="model-mobile-order-footer"><span>本单收益</span><b>¥{order.commission_amount}</b></span>
          </button>; })}
          {(data?.total ?? 0) > 20 && <Pagination simple current={page} pageSize={20} total={data?.total ?? 0} onChange={setPage} showSizeChanger={false} />}
        </div>
        <div className="model-orders-table"><Table rowKey={(record) => record.fulfillment_id || record.id} loading={isLoading} dataSource={orders} pagination={{ current: page, pageSize: 20, total: data?.total ?? 0, onChange: setPage, showSizeChanger: false }} onRow={(record) => ({ onClick: () => navigate(record.fulfillment_id ? `/model/fulfillments/${record.fulfillment_id}` : `/model/orders/${record.id}`), className: "table-row-link" })} columns={[
          { title: "订单", render: (_, order) => <div><strong>{order.title}</strong>{order.slot_no ? <div className="muted-text">名额 {order.slot_no} · {order.order_no}</div> : <div className="muted-text">{order.order_no}</div>}</div> },
          { title: "收益", dataIndex: "commission_amount", render: (value) => `¥${value}` },
          { title: "状态", render: (_, order) => <OrderStatusTag status={order.fulfillment_status || order.status} /> },
          { title: "下一步", render: (_, order) => talentOrderNextAction(order.fulfillment_status || order.status) },
        ]} /></div></> : <Empty description="暂无符合当前状态的订单" />}
  </div>;
}
