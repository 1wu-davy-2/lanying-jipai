import { useQuery } from "@tanstack/react-query";
import { Card, Col, Row, Skeleton, Statistic, Typography } from "antd";

import { getDashboard } from "../../api/admin";

export function AdminDashboardPage() {
  const { data, isLoading } = useQuery({ queryKey: ["admin-dashboard"], queryFn: getDashboard, refetchInterval: 30_000 });
  return <div><div className="page-heading"><Typography.Title level={2}>运营看板</Typography.Title></div>
    {isLoading ? <Skeleton active /> : <Row gutter={[16, 16]} className="dashboard-grid">
      <Col xs={24} sm={12} xl={8}><Card><Statistic title="今日新增订单" value={data?.today_orders ?? 0} /></Card></Col>
      <Col xs={24} sm={12} xl={8}><Card><Statistic title="本月订单数" value={data?.month_orders ?? 0} /></Card></Col>
      <Col xs={24} sm={12} xl={8}><Card><Statistic title="本月成交金额" prefix="¥" value={data?.month_completed_amount ?? "0.00"} precision={2} /></Card></Col>
      <Col xs={24} sm={12} xl={8}><Card><Statistic title="待审核提现" value={data?.pending_withdrawals ?? 0} /></Card></Col>
      <Col xs={24} sm={12} xl={8}><Card><Statistic title="待处理争议" value={data?.disputed_orders ?? 0} /></Card></Col>
    </Row>}
  </div>;
}
