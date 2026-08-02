import { useState } from "react";
import { Button, Form, Input, Select, Typography, message } from "antd";
import { Link, useNavigate } from "react-router-dom";

import { register } from "../../api/auth";
import { useAuthStore } from "../../stores/authStore";
import { AuthFrame } from "./AuthFrame";

type RegisterValues = {
  phone: string;
  nickname: string;
  registration_channel?: string;
  password: string;
};

export function RegisterPage() {
  const navigate = useNavigate();
  const setSession = useAuthStore((state) => state.setSession);
  const [submitting, setSubmitting] = useState(false);

  const submit = async ({ phone, password, nickname, registration_channel }: RegisterValues) => {
    setSubmitting(true);
    try {
      const session = await register(phone, password, "model", nickname, registration_channel);
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
          <Form.Item name="phone" label="手机号" rules={[{ required: true, message: "请输入手机号" }]}>
            <Input size="large" inputMode="tel" autoComplete="tel" />
          </Form.Item>
          <Form.Item name="nickname" label="达人名称" rules={[{ required: true, min: 2, max: 50, message: "请输入 2-50 个字符的达人名称" }]}>
            <Input size="large" maxLength={50} autoComplete="nickname" />
          </Form.Item>
          <Form.Item name="registration_channel" label="了解我们的渠道">
            <Select
              size="large"
              allowClear
              placeholder="请选择来源（选填）"
              options={[
                { value: "douyin", label: "抖音" },
                { value: "xiaohongshu", label: "小红书" },
                { value: "wechat", label: "微信 / 社群" },
                { value: "friend", label: "朋友推荐" },
                { value: "search", label: "搜索引擎" },
                { value: "other", label: "其他" },
              ]}
            />
          </Form.Item>
          <Form.Item name="password" label="密码" rules={[{ required: true, min: 8, message: "密码至少 8 位" }]}>
            <Input.Password size="large" autoComplete="new-password" />
          </Form.Item>
          <Button type="primary" htmlType="submit" size="large" block loading={submitting}>创建账号</Button>
        </Form>
        <p className="auth-switch">已有账号？<Link to="/talent/login">返回达人登录</Link></p>
      </div>
    </AuthFrame>
  );
}
