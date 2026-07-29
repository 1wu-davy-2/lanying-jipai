import { AppstoreOutlined, FileTextOutlined, LogoutOutlined, TrophyOutlined, UserOutlined, WalletOutlined } from "@ant-design/icons";
import { Button, Layout, Menu, Typography } from "antd";
import { useLocation, useNavigate } from "react-router-dom";

import { useAuthStore } from "../stores/authStore";
import type { UserRole } from "../types";
import { ProfilePage } from "./ProfilePage";
import { TalentOnboardingPage } from "./TalentOnboardingPage";
import { TalentRankingPage } from "./TalentRankingPage";
import { MerchantOrdersPage } from "./orders/MerchantOrdersPage";
import { ModelHallPage } from "./orders/ModelHallPage";
import { MarketplaceOrderDetailPage } from "./orders/MarketplaceOrderDetailPage";
import { ModelOrdersPage } from "./orders/ModelOrdersPage";
import { OrderDetailPage } from "./orders/OrderDetailPage";
import { WalletPage } from "./wallet/WalletPage";
import { WithdrawalApplyPage } from "./wallet/WithdrawalApplyPage";
import { AdminDashboardPage } from "./admin/AdminDashboardPage";
import { AdminApplicationsPage } from "./admin/AdminApplicationsPage";
import { AdminDisputesPage } from "./admin/AdminDisputesPage";
import { AdminOperationsPage } from "./admin/AdminOperationsPage";
import { AdminOrdersPage } from "./admin/AdminOrdersPage";
import { AdminUsersPage } from "./admin/AdminUsersPage";
import { AdminWithdrawalsPage } from "./admin/AdminWithdrawalsPage";

const labels: Record<UserRole, string> = { merchant: "商家工作台", model: "达人工作台", admin: "管理工作台" };
const navigation: Record<UserRole, { key: string; label: string }[]> = {
  merchant: [{ key: "orders", label: "我的订单" }, { key: "profile", label: "店铺资料" }],
  model: [{ key: "hall", label: "抢单大厅" }, { key: "ranking", label: "达人榜单" }, { key: "orders", label: "我的订单" }, { key: "wallet", label: "我的钱包" }, { key: "profile", label: "个人资料" }],
  admin: [{ key: "operations", label: "运营发单" }, { key: "applications", label: "接单申请" }, { key: "dashboard", label: "数据看板" }, { key: "users", label: "用户管理" }, { key: "orders", label: "订单监控" }, { key: "disputes", label: "争议处理" }, { key: "withdrawals", label: "提现审核" }],
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
  const hallDetailMatch = role === "model" ? location.pathname.match(/^\/model\/hall\/(\d+)$/) : null;
  const hallOrderId = hallDetailMatch ? Number(hallDetailMatch[1]) : null;
  const profileRoute = currentPage === "profile" && (role === "merchant" || role === "model");
  const merchantOrdersRoute = role === "merchant" && currentPage === "orders";
  const modelHallRoute = role === "model" && currentPage === "hall";
  const modelOrdersRoute = role === "model" && currentPage === "orders";
  const modelWalletRoute = role === "model" && currentPage === "wallet";
  const modelWithdrawRoute = role === "model" && location.pathname === "/model/wallet/withdraw";
  const modelOnboardingRoute = role === "model" && location.pathname.startsWith("/model/onboarding");
  const modelRankingRoute = role === "model" && currentPage === "ranking";
  const adminDashboardRoute = role === "admin" && currentPage === "dashboard";
  const adminApplicationsRoute = role === "admin" && currentPage === "applications";
  const adminOperationsRoute = role === "admin" && currentPage === "operations";
  const adminUsersRoute = role === "admin" && currentPage === "users";
  const adminOrdersRoute = role === "admin" && currentPage === "orders";
  const adminDisputesRoute = role === "admin" && currentPage === "disputes";
  const adminWithdrawalsRoute = role === "admin" && currentPage === "withdrawals";
  const talentMobileNavigation = [
    { key: "hall", label: "抢单", icon: <AppstoreOutlined /> },
    { key: "ranking", label: "榜单", icon: <TrophyOutlined /> },
    { key: "orders", label: "订单", icon: <FileTextOutlined /> },
    { key: "wallet", label: "钱包", icon: <WalletOutlined /> },
    { key: "profile", label: "我的", icon: <UserOutlined /> },
  ];
  const logout = () => {
    clearSession();
    navigate(role === "model" ? "/talent/login" : "/login");
  };
  return (
    <Layout className={`workspace-shell ${role === "model" ? "talent-workspace-shell" : ""}`}>
      <Layout.Sider width={224} className="workspace-sider">
        <div className="workspace-brand">蓝鹰寄拍</div>
        <Menu theme="dark" mode="inline" selectedKeys={orderId ? [role === "admin" ? "operations" : "orders"] : hallOrderId ? ["hall"] : modelWithdrawRoute ? ["wallet"] : currentPage ? [currentPage] : []} items={navigation[role]} onClick={({ key }) => navigate(`/${role}/${key}`)} />
      </Layout.Sider>
      <Layout>
        <Layout.Header className="workspace-header">
          <span>{session?.user.nickname}</span>
          <Button type="text" icon={<LogoutOutlined />} onClick={logout}>退出</Button>
        </Layout.Header>
        {role === "model" && <div className="talent-mobile-header"><strong>蓝影寄拍</strong><span>{session?.user.nickname}</span><Button type="text" icon={<LogoutOutlined />} aria-label="退出登录" onClick={logout} /></div>}
        <Layout.Content className="workspace-content">{modelOnboardingRoute ? <TalentOnboardingPage /> : hallOrderId ? <MarketplaceOrderDetailPage orderId={hallOrderId} /> : orderId ? <OrderDetailPage role={role} orderId={orderId} /> : modelWithdrawRoute ? <WithdrawalApplyPage /> : profileRoute ? <ProfilePage role={role} /> : merchantOrdersRoute ? <MerchantOrdersPage /> : modelHallRoute ? <ModelHallPage /> : modelRankingRoute ? <TalentRankingPage /> : modelOrdersRoute ? <ModelOrdersPage /> : modelWalletRoute ? <WalletPage /> : adminOperationsRoute ? <AdminOperationsPage /> : adminApplicationsRoute ? <AdminApplicationsPage /> : adminDashboardRoute ? <AdminDashboardPage /> : adminUsersRoute ? <AdminUsersPage /> : adminOrdersRoute ? <AdminOrdersPage /> : adminDisputesRoute ? <AdminDisputesPage /> : adminWithdrawalsRoute ? <AdminWithdrawalsPage /> : <Typography.Title level={2}>{labels[role]}</Typography.Title>}</Layout.Content>
      </Layout>
      {role === "model" && <nav className="talent-mobile-nav" aria-label="达人导航">{talentMobileNavigation.map((item) => <button type="button" aria-label={item.label} className={currentPage === item.key || (orderId && item.key === "orders") || (hallOrderId && item.key === "hall") || (modelWithdrawRoute && item.key === "wallet") ? "active" : ""} key={item.key} onClick={() => navigate(`/model/${item.key}`)}>{item.icon}<span>{item.label}</span></button>)}</nav>}
    </Layout>
  );
}
