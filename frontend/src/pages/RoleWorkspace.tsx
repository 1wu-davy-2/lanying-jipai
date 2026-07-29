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
import { WalletPage } from "./wallet/WalletPage";
import { WithdrawalApplyPage } from "./wallet/WithdrawalApplyPage";
import { AdminDashboardPage } from "./admin/AdminDashboardPage";
import { AdminDisputesPage } from "./admin/AdminDisputesPage";
import { AdminOperationsPage } from "./admin/AdminOperationsPage";
import { AdminOrdersPage } from "./admin/AdminOrdersPage";
import { AdminUsersPage } from "./admin/AdminUsersPage";
import { AdminWithdrawalsPage } from "./admin/AdminWithdrawalsPage";

const labels: Record<UserRole, string> = { merchant: "商家工作台", model: "达人工作台", admin: "管理工作台" };
const navigation: Record<UserRole, { key: string; label: string }[]> = {
  merchant: [{ key: "orders", label: "我的订单" }, { key: "profile", label: "店铺资料" }],
  model: [{ key: "hall", label: "抢单大厅" }, { key: "orders", label: "我的订单" }, { key: "wallet", label: "我的钱包" }, { key: "profile", label: "个人资料" }],
  admin: [{ key: "operations", label: "运营发单" }, { key: "dashboard", label: "数据看板" }, { key: "users", label: "用户管理" }, { key: "orders", label: "订单监控" }, { key: "disputes", label: "争议处理" }, { key: "withdrawals", label: "提现审核" }],
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
  const modelWalletRoute = role === "model" && currentPage === "wallet";
  const modelWithdrawRoute = role === "model" && location.pathname === "/model/wallet/withdraw";
  const adminDashboardRoute = role === "admin" && currentPage === "dashboard";
  const adminOperationsRoute = role === "admin" && currentPage === "operations";
  const adminUsersRoute = role === "admin" && currentPage === "users";
  const adminOrdersRoute = role === "admin" && currentPage === "orders";
  const adminDisputesRoute = role === "admin" && currentPage === "disputes";
  const adminWithdrawalsRoute = role === "admin" && currentPage === "withdrawals";
  return (
    <Layout className="workspace-shell">
      <Layout.Sider width={224} className="workspace-sider">
        <div className="workspace-brand">蓝鹰寄拍</div>
        <Menu theme="dark" mode="inline" selectedKeys={orderId ? [role === "admin" ? "operations" : "orders"] : modelWithdrawRoute ? ["wallet"] : currentPage ? [currentPage] : []} items={navigation[role]} onClick={({ key }) => navigate(`/${role}/${key}`)} />
      </Layout.Sider>
      <Layout>
        <Layout.Header className="workspace-header">
          <span>{session?.user.nickname}</span>
          <Button type="text" icon={<LogoutOutlined />} onClick={() => { clearSession(); navigate("/login"); }}>退出</Button>
        </Layout.Header>
        <Layout.Content className="workspace-content">{orderId ? <OrderDetailPage role={role} orderId={orderId} /> : modelWithdrawRoute ? <WithdrawalApplyPage /> : profileRoute ? <ProfilePage role={role} /> : merchantOrdersRoute ? <MerchantOrdersPage /> : modelHallRoute ? <ModelHallPage /> : modelOrdersRoute ? <ModelOrdersPage /> : modelWalletRoute ? <WalletPage /> : adminOperationsRoute ? <AdminOperationsPage /> : adminDashboardRoute ? <AdminDashboardPage /> : adminUsersRoute ? <AdminUsersPage /> : adminOrdersRoute ? <AdminOrdersPage /> : adminDisputesRoute ? <AdminDisputesPage /> : adminWithdrawalsRoute ? <AdminWithdrawalsPage /> : <Typography.Title level={2}>{labels[role]}</Typography.Title>}</Layout.Content>
      </Layout>
    </Layout>
  );
}
