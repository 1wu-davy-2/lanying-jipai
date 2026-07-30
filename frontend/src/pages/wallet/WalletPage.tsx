import { useQuery } from "@tanstack/react-query";
import { Button, Card, Col, Row, Table, Tag, Typography } from "antd";
import { useNavigate } from "react-router-dom";

import { getMyWithdrawals, getWallet, getWalletTransactions } from "../../api/wallets";

const transactionLabels: Record<string, string> = {
  order_settlement: "订单佣金结算",
  withdrawal_freeze: "提现冻结",
  withdrawal_complete: "提现完成",
  withdrawal_reject_refund: "提现驳回退款",
};
const withdrawalLabels: Record<string, { label: string; color: string }> = {
  pending: { label: "待审核", color: "gold" }, approved: { label: "待转账", color: "blue" }, rejected: { label: "已驳回", color: "red" }, completed: { label: "已完成", color: "green" },
};

export function WalletPage() {
  const navigate = useNavigate();
  const wallet = useQuery({ queryKey: ["wallet"], queryFn: getWallet });
  const transactions = useQuery({ queryKey: ["wallet-transactions"], queryFn: getWalletTransactions });
  const withdrawals = useQuery({ queryKey: ["my-withdrawals"], queryFn: getMyWithdrawals });
  return <div className="wallet-page">
    <div className="page-heading wallet-heading"><div><Typography.Text className="talent-page-kicker">资金管理</Typography.Text><Typography.Title level={2}>资金账户</Typography.Title><Typography.Text type="secondary">提现申请和审核状态会同步显示在这里。</Typography.Text></div><Button type="primary" onClick={() => navigate("/model/wallet/withdraw")}>申请提现</Button></div>
    <Row gutter={[12, 12]} className="wallet-summary-grid">
      <Col xs={24} sm={8}><Card className="wallet-summary-card wallet-summary-card--available"><span>可提现</span><strong>¥{wallet.data?.available_balance ?? "0.00"}</strong><Typography.Text type="secondary">可提交提现申请</Typography.Text></Card></Col>
      <Col xs={24} sm={8}><Card className="wallet-summary-card"><span>处理中提现</span><strong>¥{wallet.data?.frozen_balance ?? "0.00"}</strong><Typography.Text type="secondary">审核或转账中的金额</Typography.Text></Card></Col>
      <Col xs={24} sm={8}><Card className="wallet-summary-card"><span>账单记录</span><strong>{transactions.data?.total ?? 0}<em> 笔</em></strong><Typography.Text type="secondary">可核对每笔资金变动</Typography.Text></Card></Col>
    </Row>
    <Card title="资金明细" className="content-card section-card wallet-record-card">
      <Table rowKey="id" loading={transactions.isLoading} dataSource={transactions.data?.items ?? []} pagination={false} columns={[
        { title: "类型", dataIndex: "type", render: (value) => transactionLabels[value] ?? value },
        { title: "金额变化", dataIndex: "amount", render: (value) => <span className={Number(value) < 0 ? "amount-negative" : "amount-positive"}>{Number(value) > 0 ? "+" : ""}¥{value}</span> },
        { title: "可提现余额", dataIndex: "balance_after", render: (value) => `¥${value}` },
        { title: "时间", dataIndex: "created_at", render: (value) => value ? new Date(value).toLocaleString() : "-" },
      ]} />
    </Card>
    <Card title="提现进度" className="content-card section-card wallet-record-card">
      <Table rowKey="id" loading={withdrawals.isLoading} dataSource={withdrawals.data?.items ?? []} pagination={false} columns={[
        { title: "提现单号", dataIndex: "withdrawal_no" }, { title: "金额", dataIndex: "amount", render: (value) => `¥${value}` },
        { title: "状态", dataIndex: "status", render: (value) => <Tag color={withdrawalLabels[value]?.color}>{withdrawalLabels[value]?.label ?? value}</Tag> },
        { title: "驳回原因", dataIndex: "reject_reason", render: (value) => value || "-" },
        { title: "申请时间", dataIndex: "created_at", render: (value) => value ? new Date(value).toLocaleString() : "-" },
      ]} />
    </Card>
  </div>;
}
