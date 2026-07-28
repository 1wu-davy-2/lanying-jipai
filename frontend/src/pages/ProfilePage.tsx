import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Button, Card, Col, Form, Input, InputNumber, Row, Skeleton, Tag, Typography, message } from "antd";

import { getCurrentUser, saveMerchantProfile, saveModelProfile, submitVerification } from "../api/users";
import type { UserRole } from "../types";

export function ProfilePage({ role }: { role: Extract<UserRole, "merchant" | "model"> }) {
  const queryClient = useQueryClient();
  const { data, isLoading } = useQuery({ queryKey: ["current-user"], queryFn: getCurrentUser });
  const [saving, setSaving] = useState(false);
  const [profileForm] = Form.useForm();
  const [verifyForm] = Form.useForm();

  useEffect(() => {
    if (!data) return;
    profileForm.setFieldsValue(role === "merchant" ? data.merchant_profile : data.model_profile);
  }, [data, profileForm, role]);

  const saveProfile = async (values: Record<string, unknown>) => {
    setSaving(true);
    try {
      await (role === "merchant" ? saveMerchantProfile(values) : saveModelProfile(values));
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
      verifyForm.resetFields();
      message.success("认证资料已提交");
    } catch (error) {
      message.error(error instanceof Error ? error.message : "提交失败");
    } finally {
      setSaving(false);
    }
  };

  const title = role === "merchant" ? "店铺资料" : "个人资料";
  return (
    <div className="profile-page">
      <div className="page-heading"><Typography.Title level={2}>{title}</Typography.Title><Tag color={data?.verify_status === "verified" ? "success" : "gold"}>{data?.verify_status === "verified" ? "已认证" : "待认证"}</Tag></div>
      {isLoading ? <Skeleton active /> : <Row gutter={[20, 20]}>
        <Col xs={24} lg={14}>
          <Card title={role === "merchant" ? "店铺信息" : "接单信息"} className="content-card">
            <Form form={profileForm} layout="vertical" onFinish={saveProfile} requiredMark={false}>
              {role === "merchant" ? <><Form.Item name="shop_name" label="店铺名称" rules={[{ required: true, message: "请输入店铺名称" }]}><Input /></Form.Item><Form.Item name="shop_platform" label="电商平台"><Input /></Form.Item><Form.Item name="contact_phone" label="联系电话" rules={[{ required: true, message: "请输入联系电话" }]}><Input /></Form.Item><Form.Item name="default_ship_address" label="默认寄件地址" rules={[{ required: true, message: "请输入默认寄件地址" }]}><Input.TextArea rows={3} /></Form.Item></> : <><Row gutter={12}><Col span={12}><Form.Item name="height_cm" label="身高（cm）"><InputNumber min={1} max={300} className="field-full" /></Form.Item></Col><Col span={12}><Form.Item name="weight_kg" label="体重（kg）"><InputNumber min={1} max={500} className="field-full" /></Form.Item></Col></Row><Form.Item name="skill_tags" label="技能标签"><Input placeholder="例如：模特, 摄影, 美甲" /></Form.Item><Form.Item name="receive_address" label="收货地址" rules={[{ required: true, message: "请输入收货地址" }]}><Input.TextArea rows={3} /></Form.Item><Form.Item name="portfolio_urls" label="作品集链接"><Input.TextArea rows={2} /></Form.Item></>}
              <Button type="primary" htmlType="submit" loading={saving}>保存资料</Button>
            </Form>
          </Card>
        </Col>
        <Col xs={24} lg={10}>
          <Card title="实名认证" className="content-card">
            <Form form={verifyForm} layout="vertical" onFinish={verify} requiredMark={false}>
              <Form.Item name="real_name" label="真实姓名" rules={[{ required: true, message: "请输入真实姓名" }]}><Input /></Form.Item>
              <Form.Item name="id_card_no" label="身份证号" rules={[{ required: true, message: "请输入身份证号" }]}><Input /></Form.Item>
              <Form.Item name="alipay_account" label="支付宝账号" rules={[{ required: true, message: "请输入支付宝账号" }]}><Input /></Form.Item>
              <Form.Item name="alipay_real_name" label="支付宝实名" rules={[{ required: true, message: "请输入支付宝实名" }]}><Input /></Form.Item>
              <Button htmlType="submit" loading={saving}>提交认证</Button>
            </Form>
          </Card>
        </Col>
      </Row>}
    </div>
  );
}
