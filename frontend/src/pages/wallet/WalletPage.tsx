import { useQuery } from "@tanstack/react-query";
import { Alert, Button, Card, Skeleton, Table, Tag, Typography } from "antd";
import { useNavigate } from "react-router-dom";

import { getMyWithdrawals, getWallet, getWalletTransactions } from "../../api/wallets";

const transactionLabels: Record<string, string> = {
  order_settlement: "订单佣金结算",
  withdrawal_freeze: "提现冻结",
  withdrawal_complete: "提现完成",
  withdrawal_reject_refund: "提现驳回退款",
};
const withdrawalStatusMap: Record<string, { label: string; color: string }> = {
  pending: { label: "待审核", color: "gold" }, approved: { label: "待转账", color: "blue" }, rejected: { label: "已驳回", color: "error" }, completed: { label: "已完成", color: "green" },
};
const withdrawalStatusFallback = { label: "状态未知", color: "default" };

function formatAmount(value: string | number) {
  const amount = Number(value);
  return `${amount > 0 ? "+" : ""}¥${amount.toFixed(2)}`;
}

export function WalletPage() {
  const navigate = useNavigate();
  const wallet = useQuery({ queryKey: ["wallet"], queryFn: getWallet });
  const transactions = useQuery({ queryKey: ["wallet-transactions"], queryFn: getWalletTransactions });
  const withdrawals = useQuery({ queryKey: ["my-withdrawals"], queryFn: getMyWithdrawals });
  const hasError = Boolean(wallet.error || transactions.error || withdrawals.error);
  const reload = () => { wallet.refetch(); transactions.refetch(); withdrawals.refetch(); };
  return <div className="wallet-page">
    <div className="page-heading wallet-heading"><div><Typography.Title level={2}>资金账户</Typography.Title><Typography.Text type="secondary">提现申请和审核状态会同步显示在这里。</Typography.Text></div><Button type="primary" onClick={() => navigate("/model/wallet/withdraw")}>申请提现</Button></div>
    {hasError && <Alert type="error" showIcon message="资金数据加载失败" description="请稍后重试。" action={<Button size="small" onClick={reload}>重新加载</Button>} />}
    <div className="wallet-summary">
      <div className="wallet-summary-primary"><span>可提现余额</span><strong>¥{Number(wallet.data?.available_balance ?? 0).toFixed(2)}</strong><Typography.Text type="secondary">可提交提现申请</Typography.Text></div>
      <div className="wallet-summary-secondary">
        <div><span>处理中提现</span><strong>¥{Number(wallet.data?.frozen_balance ?? 0).toFixed(2)}</strong><small>审核或转账中的金额</small></div>
        <div><span>账单记录</span><strong>{transactions.data?.total ?? 0}<em> 笔</em></strong><small>可核对每笔资金变动</small></div>
      </div>
    </div>
    <div className="wallet-tables">
      <Card title="资金明细" className="content-card section-card wallet-record-card">
        <Table rowKey="id" loading={transactions.isLoading} dataSource={transactions.data?.items ?? []} pagination={false} columns={[
          { title: "类型", dataIndex: "type", render: (value) => transactionLabels[value] ?? "其他变动" },
          { title: "金额变化", dataIndex: "amount", render: (value) => <span className={Number(value) < 0 ? "amount-negative" : "amount-positive"}>{formatAmount(value)}</span> },
          { title: "可提现余额", dataIndex: "balance_after", render: (value) => `¥${Number(value).toFixed(2)}` },
          { title: "时间", dataIndex: "created_at", render: (value) => value ? new Date(value).toLocaleString() : "-" },
        ]} />
      </Card>
      <Card title="提现进度" className="content-card section-card wallet-record-card">
        <Table rowKey="id" loading={withdrawals.isLoading} dataSource={withdrawals.data?.items ?? []} pagination={false} columns={[
          { title: "提现单号", dataIndex: "withdrawal_no" }, { title: "金额", dataIndex: "amount", render: (value) => `¥${Number(value).toFixed(2)}` },
          { title: "状态", dataIndex: "status", render: (value) => { const config = withdrawalStatusMap[value] ?? withdrawalStatusFallback; return <Tag color={config.color}>{config.label}</Tag>; } },
          { title: "驳回原因", dataIndex: "reject_reason", render: (value) => value || "-" },
          { title: "申请时间", dataIndex: "created_at", render: (value) => value ? new Date(value).toLocaleString() : "-" },
        ]} />
      </Card>
    </div>
    <div className="wallet-mobile-lists">
      <section className="wallet-mobile-group">
        <h4 className="wallet-mobile-group-heading">资金明细</h4>
        {transactions.isLoading ? <Skeleton active paragraph={{ rows: 3 }} /> : (transactions.data?.items.length ?? 0) > 0 ? transactions.data?.items.map((item) => (
          <div className="wallet-mobile-item" key={item.id}>
            <div className="wallet-mobile-item-heading"><strong>{transactionLabels[item.type] ?? "其他变动"}</strong><b className={Number(item.amount) < 0 ? "amount-negative" : "amount-positive"}>{formatAmount(item.amount)}</b></div>
            <span className="wallet-mobile-item-meta">变动后余额 ¥{Number(item.balance_after).toFixed(2)} · {item.created_at ? new Date(item.created_at).toLocaleString() : "-"}</span>
          </div>
        )) : <div className="wallet-mobile-item"><span className="muted-text">暂无资金变动</span></div>}
      </section>
      <section className="wallet-mobile-group">
        <h4 className="wallet-mobile-group-heading">提现进度</h4>
        {withdrawals.isLoading ? <Skeleton active paragraph={{ rows: 3 }} /> : (withdrawals.data?.items.length ?? 0) > 0 ? withdrawals.data?.items.map((item) => {
          const config = withdrawalStatusMap[item.status] ?? withdrawalStatusFallback;
          return <div className="wallet-mobile-item" key={item.id}>
            <div className="wallet-mobile-item-heading"><strong>{item.withdrawal_no}</strong><Tag color={config.color}>{config.label}</Tag></div>
            <span className="wallet-mobile-item-meta">金额 ¥{Number(item.amount).toFixed(2)} · {item.created_at ? new Date(item.created_at).toLocaleString() : "-"}</span>
            {item.reject_reason && <span className="wallet-mobile-item-reason">驳回原因：{item.reject_reason}</span>}
          </div>;
        }) : <div className="wallet-mobile-item"><span className="muted-text">暂无提现记录</span></div>}
      </section>
    </div>
  </div>;
}
