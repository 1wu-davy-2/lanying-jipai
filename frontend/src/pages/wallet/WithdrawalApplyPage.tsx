import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeftOutlined } from "@ant-design/icons";
import { Button, Card, Form, Input, InputNumber, Skeleton, Typography, message } from "antd";
import { useNavigate } from "react-router-dom";

import { getCurrentUser } from "../../api/users";
import { applyWithdrawal, getWallet } from "../../api/wallets";

export function WithdrawalApplyPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [saving, setSaving] = useState(false);
  const [form] = Form.useForm();
  const wallet = useQuery({ queryKey: ["wallet"], queryFn: getWallet });
  const user = useQuery({ queryKey: ["current-user"], queryFn: getCurrentUser });
  useEffect(() => {
    if (user.data) form.setFieldsValue({ alipay_account: user.data.alipay_account, alipay_real_name: user.data.alipay_real_name });
  }, [form, user.data]);
  const submit = async (values: { amount: number; alipay_account: string; alipay_real_name: string }) => {
    setSaving(true);
    try {
      await applyWithdrawal({ ...values, amount: values.amount.toFixed(2) });
      await Promise.all([queryClient.invalidateQueries({ queryKey: ["wallet"] }), queryClient.invalidateQueries({ queryKey: ["wallet-transactions"] }), queryClient.invalidateQueries({ queryKey: ["my-withdrawals"] })]);
      message.success("提现申请已提交"); navigate("/model/wallet");
    } catch (error) { message.error(error instanceof Error ? error.message : "申请失败"); } finally { setSaving(false); }
  };
  if (wallet.isLoading || user.isLoading) return <Skeleton active />;
  const available = Number(wallet.data?.available_balance ?? 0);
  return <div className="narrow-page">
    <div className="page-heading"><Button type="text" icon={<ArrowLeftOutlined />} aria-label="返回钱包" onClick={() => navigate("/model/wallet")} /><Typography.Title level={2}>申请提现</Typography.Title></div>
    <Card className="content-card"><div className="withdrawal-balance">可提现余额 <strong>¥{available.toFixed(2)}</strong></div>
      <Form form={form} layout="vertical" onFinish={submit} requiredMark={false}>
        <Form.Item name="amount" label="提现金额" rules={[{ required: true, message: "请输入提现金额" }]}><InputNumber min={0.01} max={available} precision={2} prefix="¥" className="field-full" /></Form.Item>
        <Form.Item name="alipay_account" label="支付宝账号" rules={[{ required: true, message: "请输入收款支付宝账号" }]}><Input /></Form.Item>
        <Form.Item name="alipay_real_name" label="支付宝实名" rules={[{ required: true, message: "请输入支付宝实名" }]}><Input /></Form.Item>
        <Button type="primary" htmlType="submit" loading={saving} disabled={available <= 0}>提交申请</Button>
      </Form>
    </Card>
  </div>;
}
