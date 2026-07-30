import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Button, Form, Input, Modal, Space, Table, Tabs, Tag, Typography, message } from "antd";

import { approveWithdrawal, completeWithdrawal, getAdminWithdrawals, rejectWithdrawal } from "../../api/admin";
import type { Withdrawal } from "../../api/wallets";

const tabs = [{ key: "pending", label: "待审核" }, { key: "approved", label: "待转账" }, { key: "completed", label: "已完成" }, { key: "rejected", label: "已驳回" }];
const labels: Record<string, { label: string; color: string }> = { pending: { label: "待审核", color: "gold" }, approved: { label: "待转账", color: "blue" }, completed: { label: "已完成", color: "green" }, rejected: { label: "已驳回", color: "red" } };
type Action = "reject" | "complete";

export function AdminWithdrawalsPage() {
  const queryClient = useQueryClient();
  const [status, setStatus] = useState("pending");
  const [target, setTarget] = useState<Withdrawal | null>(null);
  const [action, setAction] = useState<Action | null>(null);
  const [form] = Form.useForm();
  const { data, isLoading } = useQuery({ queryKey: ["admin-withdrawals", status], queryFn: () => getAdminWithdrawals(status) });
  const refresh = () => Promise.all([queryClient.invalidateQueries({ queryKey: ["admin-withdrawals"] }), queryClient.invalidateQueries({ queryKey: ["admin-dashboard"] })]);
  const approve = (item: Withdrawal) => Modal.confirm({ title: "通过提现审核", content: `确认通过 ${item.withdrawal_no} 吗？`, onOk: async () => { try { await approveWithdrawal(item.id); await refresh(); message.success("提现申请已通过"); } catch (error) { message.error(error instanceof Error ? error.message : "操作失败"); } } });
  const submitAction = async (values: { reason?: string; transfer_no?: string }) => {
    if (!target || !action) return;
    try { if (action === "reject") await rejectWithdrawal(target.id, values.reason ?? ""); else await completeWithdrawal(target.id, values.transfer_no ?? ""); setAction(null); setTarget(null); form.resetFields(); await refresh(); message.success("操作成功"); } catch (error) { message.error(error instanceof Error ? error.message : "操作失败"); }
  };
  return <div><div className="page-heading"><Typography.Title level={2}>提现审核</Typography.Title></div><Tabs activeKey={status} onChange={setStatus} items={tabs} />
    <Table rowKey="id" loading={isLoading} dataSource={data?.items ?? []} pagination={false} columns={[
      { title: "提现单号", dataIndex: "withdrawal_no" }, { title: "金额", dataIndex: "amount", render: (value) => `¥${value}` },
      { title: "收款账号", dataIndex: "alipay_account", render: (value) => value || "-" }, { title: "状态", dataIndex: "status", render: (value) => <Tag color={labels[value]?.color}>{labels[value]?.label ?? value}</Tag> },
      { title: "操作", render: (_, item: Withdrawal) => <Space>{item.status === "pending" && <><Button size="small" type="primary" onClick={() => approve(item)}>通过</Button><Button size="small" danger onClick={() => { setTarget(item); setAction("reject"); }}>驳回</Button></>}{item.status === "approved" && <Button size="small" type="primary" onClick={() => { setTarget(item); setAction("complete"); }}>登记转账</Button>}</Space> },
    ]} />
    <Modal title={action === "reject" ? "驳回提现" : "登记转账"} open={action !== null} onCancel={() => { setAction(null); setTarget(null); form.resetFields(); }} footer={null} destroyOnHidden><Form form={form} layout="vertical" onFinish={submitAction}>{action === "reject" ? <Form.Item name="reason" label="驳回原因" rules={[{ required: true, message: "请输入驳回原因" }]}><Input.TextArea rows={3} /></Form.Item> : <Form.Item name="transfer_no" label="支付宝转账流水号" rules={[{ required: true, message: "请输入转账流水号" }]}><Input /></Form.Item>}<Button type="primary" htmlType="submit">确认</Button></Form></Modal>
  </div>;
}
