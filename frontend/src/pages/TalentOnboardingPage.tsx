import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Alert, Button, Card, Form, Input, Result, Skeleton, Steps, Typography, message } from "antd";
import { useLocation, useNavigate } from "react-router-dom";

import { addressFromPath, addressToPath } from "../constants/shippingAddresses";
import { getCurrentUser, saveCurrentUser, saveModelProfile, submitVerification } from "../api/users";
import { TalentProfileFields } from "../components/TalentProfileFields";

type TalentProfileValues = {
  nickname: string;
  avatar_url: string;
  height_cm?: number | null;
  weight_kg?: number | null;
  skill_tags?: string | null;
  receive_address: string[];
  receiver_name: string;
  receiver_phone: string;
  receive_address_detail: string;
  portfolio_urls: string[];
};

export function TalentOnboardingPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const queryClient = useQueryClient();
  const verificationStep = location.pathname.endsWith("/verify");
  const { data, isLoading } = useQuery({ queryKey: ["current-user"], queryFn: getCurrentUser });
  const [saving, setSaving] = useState(false);
  const [profileForm] = Form.useForm<TalentProfileValues>();
  const [verifyForm] = Form.useForm();

  useEffect(() => {
    if (!data) return;
    profileForm.setFieldsValue({
      nickname: data.nickname,
      avatar_url: data.avatar_url ?? undefined,
      ...data.model_profile,
      receive_address: addressToPath(data.model_profile?.receive_address),
      portfolio_urls: data.model_profile?.portfolio_urls ?? [],
    });
  }, [data, profileForm]);

  const saveProfile = async (values: TalentProfileValues) => {
    setSaving(true);
    try {
      await saveCurrentUser({ nickname: values.nickname, avatar_url: values.avatar_url });
      await saveModelProfile({
        height_cm: values.height_cm,
        weight_kg: values.weight_kg,
        skill_tags: values.skill_tags,
        receive_address: addressFromPath(values.receive_address),
        receiver_name: values.receiver_name,
        receiver_phone: values.receiver_phone,
        receive_address_detail: values.receive_address_detail,
        portfolio_urls: values.portfolio_urls,
      });
      await queryClient.invalidateQueries({ queryKey: ["current-user"] });
      navigate("/model/onboarding/verify");
    } catch (error) {
      message.error(error instanceof Error ? error.message : "资料保存失败");
    } finally {
      setSaving(false);
    }
  };

  const submitVerify = async (values: Record<string, unknown>) => {
    setSaving(true);
    try {
      await submitVerification(values);
      await queryClient.invalidateQueries({ queryKey: ["current-user"] });
      message.success("实名认证资料已提交，审核通过后即可正式接单");
      navigate("/model/hall");
    } catch (error) {
      message.error(error instanceof Error ? error.message : "认证提交失败");
    } finally {
      setSaving(false);
    }
  };

  if (isLoading) return <Skeleton active />;
  if (data?.verify_status === "verified") {
    return <Result status="success" title="达人认证已通过" subTitle="你的账号已可以正式接单。" extra={<Button type="primary" onClick={() => navigate("/model/hall")}>进入抢单大厅</Button>} />;
  }

  return <section className="talent-onboarding">
    <div className="page-heading"><div><Typography.Title level={2}>达人入驻</Typography.Title><Typography.Text type="secondary">完成资料和实名认证后，才能正式接单。</Typography.Text></div></div>
    <Steps current={verificationStep ? 1 : 0} items={[{ title: "完善资料", description: "头像、地区、作品" }, { title: "实名认证", description: "审核通过后接单" }]} />
    <Card className="content-card talent-onboarding-panel" title={verificationStep ? "实名认证" : "接单资料"}>
      {verificationStep ? <>
        {data?.verify_status === "rejected" && <Alert type="error" showIcon message="认证被驳回" description={data.verify_reject_reason || "请核对资料后重新提交"} />}
        {data?.verify_status === "pending" ? <Result status="info" title="实名认证审核中" subTitle="管理员审核通过后，账号将自动获得正式接单资格。" extra={<Button onClick={() => navigate("/model/hall")}>返回大厅</Button>} /> : <Form form={verifyForm} layout="vertical" onFinish={submitVerify} requiredMark={false}>
          <Form.Item name="real_name" label="真实姓名" rules={[{ required: true, message: "请输入真实姓名" }]}><Input /></Form.Item>
          <Form.Item name="id_card_no" label="身份证号" rules={[{ required: true, message: "请输入身份证号" }]}><Input /></Form.Item>
          <Form.Item name="alipay_account" label="支付宝账号" rules={[{ required: true, message: "请输入支付宝账号" }]}><Input /></Form.Item>
          <Form.Item name="alipay_real_name" label="支付宝实名" rules={[{ required: true, message: "请输入支付宝实名" }]}><Input /></Form.Item>
          <Button type="primary" htmlType="submit" loading={saving}>提交实名认证</Button>
        </Form>}
      </> : <Form form={profileForm} layout="vertical" onFinish={saveProfile} requiredMark={false}>
        <TalentProfileFields />
        <Button type="primary" htmlType="submit" loading={saving}>下一步：实名认证</Button>
      </Form>}
    </Card>
  </section>;
}
