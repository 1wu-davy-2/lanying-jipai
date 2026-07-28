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
  return <div>
    <div className="page-heading"><Typography.Title level={2}>我的钱包</Typography.Title><Button type="primary" onClick={() => navigate("/model/wallet/withdraw")}>申请提现</Button></div>
    <Row gutter={[16, 16]} className="balance-grid">
      <Col xs={24} sm={12}><Card className="balance-card"><span>可提现余额</span><strong>¥{wallet.data?.available_balance ?? "0.00"}</strong></Card></Col>
      <Col xs={24} sm={12}><Card className="balance-card"><span>冻结中金额</span><strong>¥{wallet.data?.frozen_balance ?? "0.00"}</strong></Card></Col>
    </Row>
    <Card title="余额流水" className="content-card section-card">
      <Table rowKey="id" loading={transactions.isLoading} dataSource={transactions.data?.items ?? []} pagination={false} columns={[
        { title: "类型", dataIndex: "type", render: (value) => transactionLabels[value] ?? value },
        { title: "变动", dataIndex: "amount", render: (value) => <span className={Number(value) < 0 ? "amount-negative" : "amount-positive"}>{Number(value) > 0 ? "+" : ""}¥{value}</span> },
        { title: "可提现余额", dataIndex: "balance_after", render: (value) => `¥${value}` },
        { title: "时间", dataIndex: "created_at", render: (value) => value ? new Date(value).toLocaleString() : "-" },
      ]} />
    </Card>
    <Card title="提现记录" className="content-card section-card">
      <Table rowKey="id" loading={withdrawals.isLoading} dataSource={withdrawals.data?.items ?? []} pagination={false} columns={[
        { title: "提现单号", dataIndex: "withdrawal_no" }, { title: "金额", dataIndex: "amount", render: (value) => `¥${value}` },
        { title: "状态", dataIndex: "status", render: (value) => <Tag color={withdrawalLabels[value]?.color}>{withdrawalLabels[value]?.label ?? value}</Tag> },
        { title: "驳回原因", dataIndex: "reject_reason", render: (value) => value || "-" },
        { title: "申请时间", dataIndex: "created_at", render: (value) => value ? new Date(value).toLocaleString() : "-" },
      ]} />
    </Card>
  </div>;
}
