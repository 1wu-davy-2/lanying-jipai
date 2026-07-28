import { useState } from "react";
import { Button, Form, Input, Radio, Typography, message } from "antd";
import { Link, useNavigate } from "react-router-dom";

import { register } from "../../api/auth";
import { useAuthStore } from "../../stores/authStore";
import type { UserRole } from "../../types";
import { AuthFrame } from "./AuthFrame";

export function RegisterPage() {
  const navigate = useNavigate();
  const setSession = useAuthStore((state) => state.setSession);
  const [submitting, setSubmitting] = useState(false);

  const submit = async ({ phone, password, role }: { phone: string; password: string; role: Exclude<UserRole, "admin"> }) => {
    setSubmitting(true);
    try {
      const session = await register(phone, password, role);
      setSession(session);
      navigate(role === "merchant" ? "/merchant/orders" : "/model/hall", { replace: true });
    } catch (error) {
      message.error(error instanceof Error ? error.message : "注册失败，请稍后重试");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <AuthFrame>
      <div className="auth-form-wrap">
        <Typography.Title level={1}>注册</Typography.Title>
        <Typography.Paragraph className="auth-subtitle">创建你的寄拍协作账号</Typography.Paragraph>
        <Form layout="vertical" initialValues={{ role: "merchant" }} onFinish={submit} requiredMark={false}>
          <Form.Item name="role" label="账号角色"><Radio.Group optionType="button" buttonStyle="solid"><Radio.Button value="merchant">商家</Radio.Button><Radio.Button value="model">达人</Radio.Button></Radio.Group></Form.Item>
          <Form.Item name="phone" label="手机号" rules={[{ required: true, message: "请输入手机号" }]}><Input size="large" inputMode="tel" autoComplete="tel" /></Form.Item>
          <Form.Item name="password" label="密码" rules={[{ required: true, min: 8, message: "密码至少 8 位" }]}><Input.Password size="large" autoComplete="new-password" /></Form.Item>
          <Button type="primary" htmlType="submit" size="large" block loading={submitting}>创建账号</Button>
        </Form>
        <p className="auth-switch">已有账号？<Link to="/login">返回登录</Link></p>
      </div>
    </AuthFrame>
  );
}
