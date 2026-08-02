import { useState } from "react";
import { Button, Form, Input, Typography, message } from "antd";
import { Link, useLocation, useNavigate } from "react-router-dom";

import { login } from "../../api/auth";
import { useAuthStore } from "../../stores/authStore";
import type { UserRole } from "../../types";
import { AuthFrame } from "./AuthFrame";

type PortalRole = Extract<UserRole, "admin" | "model">;

function roleHome(role: UserRole) {
  return role === "merchant" ? "/merchant/orders" : role === "model" ? "/model/hall" : "/admin/operations";
}

export function LoginPage({ portal }: { portal?: PortalRole }) {
  const navigate = useNavigate();
  const location = useLocation();
  const setSession = useAuthStore((state) => state.setSession);
  const [submitting, setSubmitting] = useState(false);

  const submit = async ({ phone, password }: { phone: string; password: string }) => {
    setSubmitting(true);
    try {
      const session = await login(phone, password);
      if (portal && session.user.role !== portal) {
        message.error(portal === "admin" ? "请使用管理员账号登录运营管理端" : "请使用达人账号登录达人端");
        return;
      }
      setSession(session);
      const state = location.state as { from?: { pathname?: string } } | null;
      navigate(state?.from?.pathname ?? roleHome(session.user.role), { replace: true });
    } catch (error) {
      message.error(error instanceof Error ? error.message : "登录失败，请稍后重试");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <AuthFrame>
      <div className="auth-form-wrap">
        <Typography.Title level={1}>{portal === "admin" ? "运营管理端登录" : portal === "model" ? "达人端登录" : "登录"}</Typography.Title>
        <Typography.Paragraph className="auth-subtitle">{portal === "admin" ? "进入运营发单与审核工作台" : portal === "model" ? "进入抢单、交付与收入工作台" : "进入寄拍订单工作台"}</Typography.Paragraph>
        <Form layout="vertical" onFinish={submit} requiredMark={false}>
          <Form.Item name="phone" label="手机号" rules={[{ required: true, message: "请输入手机号" }]}>
            <Input size="large" inputMode="tel" autoComplete="tel" />
          </Form.Item>
          <Form.Item name="password" label="密码" rules={[{ required: true, message: "请输入密码" }]}>
            <Input.Password size="large" autoComplete="current-password" />
          </Form.Item>
          <Button type="primary" htmlType="submit" size="large" block loading={submitting}>登录</Button>
        </Form>
        <p className="auth-switch">{portal === "model" ? <>还没有达人账号？<Link to="/talent/register">达人注册</Link></> : portal === "admin" ? <Link to="/entry">切换入口</Link> : <>还没有账号？<Link to="/talent/register">达人注册</Link></>}</p>
      </div>
    </AuthFrame>
  );
}
