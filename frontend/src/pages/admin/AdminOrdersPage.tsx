import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Input, Select, Space, Switch, Table, Typography } from "antd";
import { useNavigate } from "react-router-dom";

import { getAdminOrders } from "../../api/admin";
import { OrderStatusTag } from "../../components/OrderStatusTag";

export function AdminOrdersPage() {
  const navigate = useNavigate();
  const [status, setStatus] = useState<string | undefined>();
  const [keyword, setKeyword] = useState("");
  const [overdue, setOverdue] = useState(false);
  const params = useMemo(() => ({ status_filter: status, keyword: keyword || undefined, overdue: overdue || undefined }), [keyword, overdue, status]);
  const { data, isLoading } = useQuery({ queryKey: ["admin-orders", params], queryFn: () => getAdminOrders(params) });
  return <div><div className="page-heading"><Typography.Title level={2}>订单监控</Typography.Title></div><Space wrap className="filter-bar"><Select allowClear placeholder="订单状态" onChange={setStatus} options={["PUBLISHED", "CLAIMED", "SHIPPED_TO_MODEL", "IN_PROGRESS", "RETURNED", "COMPLETED", "DISPUTED", "CANCELLED"].map((value) => ({ value, label: value }))} /><Input.Search allowClear placeholder="订单号或标题" onSearch={setKeyword} /><span>仅超时</span><Switch checked={overdue} onChange={setOverdue} /></Space>
    <Table rowKey="id" loading={isLoading} dataSource={data?.items ?? []} pagination={false} onRow={(record) => ({ onClick: () => navigate(`/admin/orders/${record.id}`), className: "table-row-link" })} columns={[{ title: "订单", render: (_, order) => <div><strong>{order.title}</strong><div className="muted-text">{order.order_no}</div></div> }, { title: "佣金", dataIndex: "commission_amount", render: (value) => `¥${value}` }, { title: "状态", dataIndex: "status", render: (value) => <OrderStatusTag status={value} /> }, { title: "创建时间", dataIndex: "created_at", render: (value) => value ? new Date(value).toLocaleString() : "-" }]} />
  </div>;
}
