import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Alert, Avatar, Button, Card, Col, Descriptions, Form, Image, Input, Row, Skeleton, Space, Tag, Typography, message } from "antd";
import { EditOutlined } from "@ant-design/icons";

import { addressFromPath, addressToPath } from "../constants/shippingAddresses";
import { getCurrentUser, saveCurrentUser, saveMerchantProfile, saveModelProfile, submitVerification } from "../api/users";
import { getTalentStatus } from "../api/users";
import type { UserRole } from "../types";
import { TalentProfileFields } from "../components/TalentProfileFields";

export function ProfilePage({ role }: { role: Extract<UserRole, "merchant" | "model"> }) {
  const queryClient = useQueryClient();
  const { data, isLoading } = useQuery({ queryKey: ["current-user"], queryFn: getCurrentUser });
  const { data: talentStatus } = useQuery({ queryKey: ["talent-status"], queryFn: getTalentStatus, enabled: role === "model" });
  const [saving, setSaving] = useState(false);
  const [editing, setEditing] = useState(false);

  useEffect(() => {
    if (!data || role !== "model") return;
    const profile = data.model_profile;
    setEditing(!Boolean(data.nickname && data.avatar_url && profile?.receive_address && profile?.receiver_name && profile?.receiver_phone && profile?.receive_address_detail && (profile.portfolio_urls?.length ?? 0) >= 6));
  }, [data, role]);

  const saveProfile = async (values: Record<string, unknown>) => {
    setSaving(true);
    try {
      if (role === "merchant") {
        await saveMerchantProfile(values);
      } else {
        await saveCurrentUser({ nickname: values.nickname as string, avatar_url: values.avatar_url as string });
        await saveModelProfile({
          height_cm: values.height_cm,
          weight_kg: values.weight_kg,
          skill_tags: values.skill_tags,
          receive_address: addressFromPath(values.receive_address as string[]),
          receiver_name: values.receiver_name,
          receiver_phone: values.receiver_phone,
          receive_address_detail: values.receive_address_detail,
          portfolio_urls: values.portfolio_urls,
        });
      }
      await queryClient.invalidateQueries({ queryKey: ["current-user"] });
      message.success("资料已保存");
    } catch (error) {
      message.error(error instanceof Error ? error.message : "保存失败");
    } finally {
      setSaving(false);
    }
  };

  const verify = async (values: Record<string, unknown>) => {
    setSaving(true);
    try {
      await submitVerification(values);
      await queryClient.invalidateQueries({ queryKey: ["current-user"] });
      message.success("认证资料已提交，审核通过后即可正式接单");
    } catch (error) {
      message.error(error instanceof Error ? error.message : "提交失败");
    } finally {
      setSaving(false);
    }
  };

  const title = role === "merchant" ? "店铺资料" : "个人资料";
  const verified = data?.verify_status === "verified";
  const profileInitialValues = role === "merchant" ? data?.merchant_profile ?? undefined : data ? {
    nickname: data.nickname,
    avatar_url: data.avatar_url ?? undefined,
    ...data.model_profile,
    receive_address: addressToPath(data.model_profile?.receive_address),
    portfolio_urls: data.model_profile?.portfolio_urls ?? [],
  } : undefined;
  const verificationPanel = <Card title="实名认证" className="content-card">
    {data?.verify_status === "pending" ? <Alert type="info" showIcon message="实名认证审核中" description="审核通过后即可正式接单。" /> : <>
      {data?.verify_status === "rejected" && <Alert type="error" showIcon message="认证被驳回" description={data.verify_reject_reason || "请核对资料后重新提交"} />}
      {data?.verify_status !== "verified" && <Form layout="vertical" onFinish={verify} requiredMark={false}>
        <Form.Item name="real_name" label="真实姓名" rules={[{ required: true, message: "请输入真实姓名" }]}><Input /></Form.Item>
        <Form.Item name="id_card_no" label="身份证号" rules={[{ required: true, message: "请输入身份证号" }]}><Input /></Form.Item>
        <Form.Item name="alipay_account" label="支付宝账号" rules={[{ required: true, message: "请输入支付宝账号" }]}><Input /></Form.Item>
        <Form.Item name="alipay_real_name" label="支付宝实名" rules={[{ required: true, message: "请输入支付宝实名" }]}><Input /></Form.Item>
        <Button htmlType="submit" loading={saving}>提交认证</Button>
      </Form>}
      {data?.verify_status === "verified" && <Alert type="success" showIcon message="已完成实名认证" description="你的资料已满足接单认证要求。" />}
    </>}
  </Card>;
  return <div className="profile-page">
    {role === "model" && data && <Typography.Text className="talent-registration-channel">注册来源：{data.registration_channel || "未填写"}</Typography.Text>}
    <div className="page-heading profile-heading"><div><Typography.Text className="talent-page-kicker">{role === "model" ? "个人账户" : "店铺账户"}</Typography.Text><Typography.Title level={2}>{title}</Typography.Title>{role === "model" && <Typography.Text type="secondary">认证、接单资料和作品集集中维护。</Typography.Text>}</div><Space wrap><Tag color={verified ? "success" : "gold"}>{verified ? "已认证" : "待认证"}</Tag>{role === "model" && !editing && <Button icon={<EditOutlined aria-hidden="true" />} onClick={() => setEditing(true)}>维护接单资料</Button>}</Space></div>
    {isLoading ? <Skeleton active /> : role === "model" && !editing && data ? <Row gutter={[20, 20]}>
      <Col xs={24} lg={15}>
        <section className="talent-profile-overview">
          <div className="talent-profile-hero">
            <Avatar size={88} src={data.avatar_url}>{data.nickname.slice(0, 1)}</Avatar>
            <div><Typography.Title level={4}>身份与认证</Typography.Title><Typography.Title level={3}>{data.nickname}</Typography.Title><Space wrap><Tag color={verified ? "success" : "gold"}>{verified ? "已认证" : "待认证"}</Tag><Tag color="cyan">{talentStatus?.level.code || "L1"} {talentStatus?.level.name || "新星达人"}</Tag></Space><Typography.Text className="talent-profile-verification-copy">{verified ? "实名认证已完成，可按当前等级申请订单。" : "完成认证后即可正式接单。"}</Typography.Text></div>
          </div>
          <section className="talent-profile-section"><Typography.Title level={4}>接单能力</Typography.Title><div className="talent-profile-stats"><div><strong>{talentStatus?.completed_orders ?? 0}</strong><span>已完成订单</span></div><div><strong>{talentStatus?.active_orders ?? 0}</strong><span>进行中订单</span></div><div><strong>¥{talentStatus?.level.max_commission_amount ?? "300"}</strong><span>单笔接单上限</span></div></div><Descriptions column={{ xs: 1, sm: 2 }} size="small" styles={{ label: { color: "#718083" } }}><Descriptions.Item label="身高 / 体重">{data.model_profile?.height_cm || "-"} cm / {data.model_profile?.weight_kg || "-"} kg</Descriptions.Item><Descriptions.Item label="擅长标签">{data.model_profile?.skill_tags || "未填写"}</Descriptions.Item></Descriptions></section>
          <section className="talent-profile-section talent-profile-contact"><Typography.Title level={4}>收件信息</Typography.Title><Typography.Text type="secondary">已配置收货信息，接单后将用于商家寄送样品。</Typography.Text><Button type="link" onClick={() => setEditing(true)}>维护收件信息</Button></section>
          <section className="talent-profile-portfolio"><Typography.Title level={4}>作品集</Typography.Title><Image.PreviewGroup>{(data.model_profile?.portfolio_urls ?? []).map((url) => <Image key={url} src={url} alt="达人作品" />)}</Image.PreviewGroup></section>
        </section>
      </Col>
      <Col xs={24} lg={9}>{verificationPanel}</Col>
    </Row> : <Row gutter={[20, 20]}>
      <Col xs={24} lg={14}>
        <Card title={role === "merchant" ? "店铺信息" : "接单资料"} className="content-card">
          <Form key={`${role}-${data?.id ?? "profile"}`} initialValues={profileInitialValues} layout="vertical" onFinish={saveProfile} requiredMark={false}>
            {role === "merchant" ? <>
              <Form.Item name="shop_name" label="店铺名称" rules={[{ required: true, message: "请输入店铺名称" }]}><Input /></Form.Item>
              <Form.Item name="shop_platform" label="电商平台"><Input /></Form.Item>
              <Form.Item name="contact_phone" label="联系电话" rules={[{ required: true, message: "请输入联系电话" }]}><Input /></Form.Item>
              <Form.Item name="default_ship_address" label="默认寄件地址" rules={[{ required: true, message: "请输入默认寄件地址" }]}><Input.TextArea rows={3} /></Form.Item>
            </> : <TalentProfileFields />}
            <Space><Button type="primary" htmlType="submit" loading={saving}>保存资料</Button>{role === "model" && <Button onClick={() => setEditing(false)}>取消</Button>}</Space>
          </Form>
        </Card>
      </Col>
      <Col xs={24} lg={10}>{verificationPanel}</Col>
    </Row>}
  </div>;
}
