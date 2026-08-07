import { useQuery } from "@tanstack/react-query";
import { Button, Empty, Skeleton, Typography } from "antd";

import { getDashboard } from "../../api/admin";

export function AdminDashboardPage() {
  const { data, isLoading, error, refetch } = useQuery({ queryKey: ["admin-dashboard"], queryFn: getDashboard, refetchInterval: 30_000 });
  return <div><div className="page-heading"><div><Typography.Title level={2}>运营看板</Typography.Title><Typography.Text type="secondary">今日与本月核心运营指标。</Typography.Text></div></div>
    {isLoading ? <Skeleton active paragraph={{ rows: 4 }} /> :
      error ? <Empty description="看板数据加载失败，请稍后重试"><Button onClick={() => refetch()}>重新加载</Button></Empty> :
        <div className="dashboard-metrics">
          <div><span>今日新增订单</span><strong>{data?.today_orders ?? 0}</strong></div>
          <div><span>本月订单数</span><strong>{data?.month_orders ?? 0}</strong></div>
          <div><span>本月成交金额</span><strong className="dashboard-metrics-money">¥{Number(data?.month_completed_amount ?? 0).toFixed(2)}</strong></div>
          <div><span>待审核提现</span><strong>{data?.pending_withdrawals ?? 0}</strong></div>
          <div><span>待处理争议</span><strong>{data?.disputed_orders ?? 0}</strong></div>
        </div>}
  </div>;
}
