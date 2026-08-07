import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Button, Empty, Input, Select, Skeleton, Space, Switch, Table, Typography } from "antd";
import { useNavigate } from "react-router-dom";

import { getAdminOrders } from "../../api/admin";
import { OrderStatusTag, orderStatusLabel } from "../../components/OrderStatusTag";

export function AdminOrdersPage() {
  const navigate = useNavigate();
  const [status, setStatus] = useState<string | undefined>();
  const [keyword, setKeyword] = useState("");
  const [overdue, setOverdue] = useState(false);
  const params = useMemo(() => ({ status_filter: status, keyword: keyword || undefined, overdue: overdue || undefined }), [keyword, overdue, status]);
  const { data, isLoading, error, refetch } = useQuery({ queryKey: ["admin-orders", params], queryFn: () => getAdminOrders(params) });
  return <div><div className="page-heading"><div><Typography.Title level={2}>订单监控</Typography.Title><Typography.Text type="secondary">全平台订单状态与超时风险集中查看。</Typography.Text></div></div><Space wrap className="filter-bar"><Select allowClear placeholder="订单状态" onChange={setStatus} options={["PUBLISHED", "CLAIMED", "SHIPPED_TO_MODEL", "IN_PROGRESS", "RETURNED", "COMPLETED", "DISPUTED", "CANCELLED"].map((value) => ({ value, label: orderStatusLabel(value) }))} /><Input.Search allowClear placeholder="订单号或标题" onSearch={setKeyword} /><span>仅超时</span><Switch checked={overdue} onChange={setOverdue} /></Space>
    {isLoading ? <Skeleton active paragraph={{ rows: 6 }} /> :
      error ? <Empty description="订单加载失败，请稍后重试"><Button onClick={() => refetch()}>重新加载</Button></Empty> :
        <div className="admin-orders-panels">
          <div className="admin-mobile-orders">
            {(data?.items ?? []).map((order) => <button type="button" className="admin-mobile-order" key={order.id} onClick={() => navigate(`/admin/orders/${order.id}`)}>
              <span className="admin-mobile-order-heading"><strong>{order.title}</strong><OrderStatusTag status={order.status} /></span>
              <span className="admin-mobile-order-number">{order.order_no}</span>
              <span className="admin-mobile-order-footer"><span>交付时限 {order.delivery_days} 天</span><b>¥{order.commission_amount}</b></span>
            </button>)}
          </div>
          <Table rowKey="id" loading={isLoading} dataSource={data?.items ?? []} pagination={false} onRow={(record) => ({ onClick: () => navigate(`/admin/orders/${record.id}`), className: "table-row-link" })} columns={[{ title: "订单", render: (_, order) => <div><strong>{order.title}</strong><div className="muted-text">{order.order_no}</div></div> }, { title: "佣金", dataIndex: "commission_amount", render: (value) => `¥${value}` }, { title: "状态", dataIndex: "status", render: (value) => <OrderStatusTag status={value} /> }, { title: "交付时限", dataIndex: "delivery_days", render: (value) => `${value} 天` }, { title: "创建时间", dataIndex: "created_at", render: (value) => value ? new Date(value).toLocaleString() : "-" }]} />
        </div>}
  </div>;
}
