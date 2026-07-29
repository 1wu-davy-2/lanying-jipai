import { useState } from "react";
import { Button, Form, Input, Typography, message } from "antd";
import { Link, useNavigate } from "react-router-dom";

import { register } from "../../api/auth";
import { useAuthStore } from "../../stores/authStore";
import { AuthFrame } from "./AuthFrame";

export function RegisterPage() {
  const navigate = useNavigate();
  const setSession = useAuthStore((state) => state.setSession);
  const [submitting, setSubmitting] = useState(false);

  const submit = async ({ phone, password }: { phone: string; password: string }) => {
    setSubmitting(true);
    try {
      const session = await register(phone, password, "model");
      setSession(session);
      navigate("/model/onboarding", { replace: true });
    } catch (error) {
      message.error(error instanceof Error ? error.message : "注册失败，请稍后重试");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <AuthFrame>
      <div className="auth-form-wrap">
        <Typography.Title level={1}>达人注册</Typography.Title>
        <Typography.Paragraph className="auth-subtitle">创建你的接单账号</Typography.Paragraph>
        <Form layout="vertical" onFinish={submit} requiredMark={false}>
          <Form.Item name="phone" label="手机号" rules={[{ required: true, message: "请输入手机号" }]}><Input size="large" inputMode="tel" autoComplete="tel" /></Form.Item>
          <Form.Item name="password" label="密码" rules={[{ required: true, min: 8, message: "密码至少 8 位" }]}><Input.Password size="large" autoComplete="new-password" /></Form.Item>
          <Button type="primary" htmlType="submit" size="large" block loading={submitting}>创建账号</Button>
        </Form>
        <p className="auth-switch">已有账号？<Link to="/talent/login">返回达人登录</Link></p>
      </div>
    </AuthFrame>
  );
}
