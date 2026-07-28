import { LogoutOutlined } from "@ant-design/icons";
import { Button, Layout, Menu, Typography } from "antd";
import { useLocation, useNavigate } from "react-router-dom";

import { useAuthStore } from "../stores/authStore";
import type { UserRole } from "../types";
import { ProfilePage } from "./ProfilePage";
import { MerchantOrdersPage } from "./orders/MerchantOrdersPage";
import { ModelHallPage } from "./orders/ModelHallPage";
import { ModelOrdersPage } from "./orders/ModelOrdersPage";
import { OrderDetailPage } from "./orders/OrderDetailPage";

const labels: Record<UserRole, string> = { merchant: "商家工作台", model: "达人工作台", admin: "管理工作台" };
const navigation: Record<UserRole, { key: string; label: string }[]> = {
  merchant: [{ key: "orders", label: "我的订单" }, { key: "profile", label: "店铺资料" }],
  model: [{ key: "hall", label: "抢单大厅" }, { key: "orders", label: "我的订单" }, { key: "profile", label: "个人资料" }],
  admin: [{ key: "dashboard", label: "数据看板" }, { key: "users", label: "用户管理" }],
};

export function RoleWorkspace({ role }: { role: UserRole }) {
  const navigate = useNavigate();
  const location = useLocation();
  const session = useAuthStore((state) => state.session);
  const clearSession = useAuthStore((state) => state.clearSession);
  const pathSegments = location.pathname.split("/");
  const currentPage = pathSegments[pathSegments.length - 1];
  const detailMatch = location.pathname.match(new RegExp(`^/${role}/orders/(\\d+)$`));
  const orderId = detailMatch ? Number(detailMatch[1]) : null;
  const profileRoute = currentPage === "profile" && (role === "merchant" || role === "model");
  const merchantOrdersRoute = role === "merchant" && currentPage === "orders";
  const modelHallRoute = role === "model" && currentPage === "hall";
  const modelOrdersRoute = role === "model" && currentPage === "orders";
  return (
    <Layout className="workspace-shell">
      <Layout.Sider width={224} className="workspace-sider">
        <div className="workspace-brand">蓝鹰寄拍</div>
        <Menu theme="dark" mode="inline" selectedKeys={orderId ? ["orders"] : currentPage ? [currentPage] : []} items={navigation[role]} onClick={({ key }) => navigate(`/${role}/${key}`)} />
      </Layout.Sider>
      <Layout>
        <Layout.Header className="workspace-header">
          <span>{session?.user.nickname}</span>
          <Button type="text" icon={<LogoutOutlined />} onClick={() => { clearSession(); navigate("/login"); }}>退出</Button>
        </Layout.Header>
        <Layout.Content className="workspace-content">{orderId ? <OrderDetailPage role={role} orderId={orderId} /> : profileRoute ? <ProfilePage role={role} /> : merchantOrdersRoute ? <MerchantOrdersPage /> : modelHallRoute ? <ModelHallPage /> : modelOrdersRoute ? <ModelOrdersPage /> : <Typography.Title level={2}>{labels[role]}</Typography.Title>}</Layout.Content>
      </Layout>
    </Layout>
  );
}
