import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Table, Tabs, Typography } from "antd";
import { useNavigate } from "react-router-dom";

import { getMyOrders, type OrderStatus } from "../../api/orders";
import { OrderStatusTag } from "../../components/OrderStatusTag";

const tabs: { key: OrderStatus | "all"; label: string }[] = [
  { key: "all", label: "全部" }, { key: "CLAIMED", label: "待收货" }, { key: "SHIPPED_TO_MODEL", label: "待收货" },
  { key: "IN_PROGRESS", label: "拍摄中" }, { key: "RETURNED", label: "待验收" }, { key: "COMPLETED", label: "已完成" },
];

export function ModelOrdersPage() {
  const navigate = useNavigate();
  const [status, setStatus] = useState<OrderStatus | "all">("all");
  const { data, isLoading } = useQuery({ queryKey: ["model-orders", status], queryFn: () => getMyOrders(status === "all" ? undefined : status) });
  return <div>
    <div className="page-heading"><Typography.Title level={2}>我的订单</Typography.Title></div>
    <Tabs activeKey={status} onChange={(key) => setStatus(key as OrderStatus | "all")} items={tabs} />
    <Table rowKey="id" loading={isLoading} dataSource={data?.items ?? []} pagination={false} onRow={(record) => ({ onClick: () => navigate(`/model/orders/${record.id}`), className: "table-row-link" })} columns={[
      { title: "订单", dataIndex: "title" },
      { title: "商家佣金", dataIndex: "commission_amount", render: (value) => `¥${value}` },
      { title: "状态", dataIndex: "status", render: (value) => <OrderStatusTag status={value} /> },
    ]} />
  </div>;
}
