import { AppstoreOutlined, AuditOutlined, DashboardOutlined, EyeOutlined, FileTextOutlined, FormOutlined, LogoutOutlined, MenuOutlined, ReadOutlined, ShopOutlined, TeamOutlined, TrophyOutlined, UserOutlined, WalletOutlined, WarningOutlined } from "@ant-design/icons";
import { Button, Drawer, Layout, Menu, Typography } from "antd";
import type { MenuProps } from "antd";
import { useState } from "react";
import type { ReactNode } from "react";
import { useLocation, useNavigate } from "react-router-dom";

import { AppLogo } from "../components/AppLogo";
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
import { MerchantOrderWorkspacePage } from "./orders/MerchantOrderWorkspacePage";
import { ModelFulfillmentDetailPage } from "./orders/ModelFulfillmentDetailPage";
import { WalletPage } from "./wallet/WalletPage";
import { WithdrawalApplyPage } from "./wallet/WithdrawalApplyPage";
import { AdminDashboardPage } from "./admin/AdminDashboardPage";
import { AdminApplicationsPage } from "./admin/AdminApplicationsPage";
import { AdminDisputesPage } from "./admin/AdminDisputesPage";
import { AdminOperationsPage } from "./admin/AdminOperationsPage";
import { AdminOrdersPage } from "./admin/AdminOrdersPage";
import { AdminScriptsPage } from "./admin/AdminScriptsPage";
import { AdminUsersPage } from "./admin/AdminUsersPage";
import { AdminWithdrawalsPage } from "./admin/AdminWithdrawalsPage";

const labels: Record<UserRole, string> = { merchant: "商家工作台", model: "达人工作台", admin: "管理工作台" };
// 导航 key、顺序与路由不变；图标映射见 docs/ui-redesign/01-prd.md 4.5 与 T03。
const navigation: Record<UserRole, { key: string; label: string; icon: ReactNode }[]> = {
  merchant: [
    { key: "orders", label: "我的订单", icon: <FileTextOutlined /> },
    { key: "profile", label: "店铺资料", icon: <ShopOutlined /> },
  ],
  model: [
    { key: "hall", label: "订单大厅", icon: <AppstoreOutlined /> },
    { key: "ranking", label: "达人榜单", icon: <TrophyOutlined /> },
    { key: "orders", label: "我的订单", icon: <FileTextOutlined /> },
    { key: "wallet", label: "我的钱包", icon: <WalletOutlined /> },
    { key: "profile", label: "个人资料", icon: <UserOutlined /> },
  ],
  admin: [
    { key: "operations", label: "运营发单", icon: <FormOutlined /> },
    { key: "applications", label: "接单申请", icon: <AuditOutlined /> },
    { key: "scripts", label: "话术库", icon: <ReadOutlined /> },
    { key: "dashboard", label: "数据看板", icon: <DashboardOutlined /> },
    { key: "users", label: "用户管理", icon: <TeamOutlined /> },
    { key: "orders", label: "订单监控", icon: <EyeOutlined /> },
    { key: "disputes", label: "争议处理", icon: <WarningOutlined /> },
    { key: "withdrawals", label: "提现审核", icon: <WalletOutlined /> },
  ],
};

// 管理端不可点击小标题分组：仅视觉分组，保持导航项顺序与可访问顺序不变。
const adminGroups: { title: string; keys: string[] }[] = [
  { title: "订单运营", keys: ["operations", "applications"] },
  { title: "内容与数据", keys: ["scripts", "dashboard"] },
  { title: "用户与订单", keys: ["users", "orders"] },
  { title: "争议与提现", keys: ["disputes", "withdrawals"] },
];

function menuItemsFor(role: UserRole): MenuProps["items"] {
  if (role !== "admin") {
    return navigation[role].map((item) => ({ key: item.key, label: item.label, icon: item.icon }));
  }
  return adminGroups.map((group) => ({
    type: "group",
    label: group.title,
    children: group.keys.map((key) => {
      const item = navigation[role].find((entry) => entry.key === key)!;
      return { key: item.key, label: item.label, icon: item.icon };
    }),
  }));
}

export function RoleWorkspace({ role }: { role: UserRole }) {
  const navigate = useNavigate();
  const location = useLocation();
  const session = useAuthStore((state) => state.session);
  const clearSession = useAuthStore((state) => state.clearSession);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const pathSegments = location.pathname.split("/");
  const currentPage = pathSegments[pathSegments.length - 1];
  const detailMatch = location.pathname.match(new RegExp(`^/${role}/orders/(\\d+)$`));
  const orderId = detailMatch ? Number(detailMatch[1]) : null;
  const hallDetailMatch = role === "model" ? location.pathname.match(/^\/model\/hall\/(\d+)$/) : null;
  const hallOrderId = hallDetailMatch ? Number(hallDetailMatch[1]) : null;
  const fulfillmentDetailMatch = role === "model" ? location.pathname.match(/^\/model\/fulfillments\/(\d+)$/) : null;
  const fulfillmentId = fulfillmentDetailMatch ? Number(fulfillmentDetailMatch[1]) : null;
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
  const adminScriptsRoute = role === "admin" && currentPage === "scripts";
  const adminUsersRoute = role === "admin" && currentPage === "users";
  const adminOrdersRoute = role === "admin" && currentPage === "orders";
  const adminDisputesRoute = role === "admin" && currentPage === "disputes";
  const adminWithdrawalsRoute = role === "admin" && currentPage === "withdrawals";
  const selectedKeys = orderId ? [role === "admin" ? "operations" : "orders"] : hallOrderId ? ["hall"] : fulfillmentId ? ["orders"] : modelWithdrawRoute ? ["wallet"] : currentPage ? [currentPage] : [];
  const talentMobileNavigation = [
    { key: "hall", label: "订单大厅", icon: <AppstoreOutlined /> },
    { key: "ranking", label: "榜单", icon: <TrophyOutlined /> },
    { key: "orders", label: "订单", icon: <FileTextOutlined /> },
    { key: "wallet", label: "钱包", icon: <WalletOutlined /> },
    { key: "profile", label: "我的", icon: <UserOutlined /> },
  ];
  const logout = () => {
    clearSession();
    navigate(role === "model" ? "/talent/login" : "/login");
  };
  const go = (key: string) => {
    setDrawerOpen(false);
    navigate(`/${role}/${key}`);
  };
  return (
    <Layout className={`workspace-shell ${role === "model" ? "talent-workspace-shell" : ""}`}>
      <Layout.Sider width={232} className="workspace-sider">
        <div className="workspace-brand"><AppLogo variant="full" /></div>
        <Menu theme="dark" mode="inline" selectedKeys={selectedKeys} items={menuItemsFor(role)} onClick={({ key }) => navigate(`/${role}/${key}`)} />
      </Layout.Sider>
      <Layout>
        <Layout.Header className="workspace-header">
          <span className="workspace-user">{session?.user.nickname}</span>
          <Button type="text" icon={<LogoutOutlined />} onClick={logout}>退出</Button>
        </Layout.Header>
        <div className="workspace-mobile-header">
          {role !== "model" && <Button type="text" icon={<MenuOutlined />} aria-label="打开导航菜单" onClick={() => setDrawerOpen(true)} />}
          <AppLogo variant="full" size={22} className="workspace-mobile-logo" />
          <span className="workspace-user">{session?.user.nickname}</span>
          <Button type="text" icon={<LogoutOutlined />} aria-label="退出登录" onClick={logout} />
        </div>
        {role !== "model" && (
          <Drawer placement="left" width={232} open={drawerOpen} onClose={() => setDrawerOpen(false)} title={<AppLogo />} className="workspace-drawer">
            <Menu mode="inline" selectedKeys={selectedKeys} items={menuItemsFor(role)} onClick={({ key }) => go(key)} />
          </Drawer>
        )}
        <Layout.Content className="workspace-content">{modelOnboardingRoute ? <TalentOnboardingPage /> : hallOrderId ? <MarketplaceOrderDetailPage orderId={hallOrderId} /> : fulfillmentId ? <ModelFulfillmentDetailPage fulfillmentId={fulfillmentId} /> : orderId ? (role === "merchant" || role === "admin" ? <MerchantOrderWorkspacePage orderId={orderId} viewerRole={role} /> : <OrderDetailPage role={role} orderId={orderId} />) : modelWithdrawRoute ? <WithdrawalApplyPage /> : profileRoute ? <ProfilePage role={role} /> : merchantOrdersRoute ? <MerchantOrdersPage /> : modelHallRoute ? <ModelHallPage /> : modelRankingRoute ? <TalentRankingPage /> : modelOrdersRoute ? <ModelOrdersPage /> : modelWalletRoute ? <WalletPage /> : adminOperationsRoute ? <AdminOperationsPage /> : adminApplicationsRoute ? <AdminApplicationsPage /> : adminScriptsRoute ? <AdminScriptsPage /> : adminDashboardRoute ? <AdminDashboardPage /> : adminUsersRoute ? <AdminUsersPage /> : adminOrdersRoute ? <AdminOrdersPage /> : adminDisputesRoute ? <AdminDisputesPage /> : adminWithdrawalsRoute ? <AdminWithdrawalsPage /> : <Typography.Title level={2}>{labels[role]}</Typography.Title>}</Layout.Content>
      </Layout>
      {role === "model" && <nav className="talent-mobile-nav" aria-label="达人导航">{talentMobileNavigation.map((item) => <button type="button" aria-label={item.label} className={currentPage === item.key || (orderId && item.key === "orders") || (fulfillmentId && item.key === "orders") || (hallOrderId && item.key === "hall") || (modelWithdrawRoute && item.key === "wallet") ? "active" : ""} key={item.key} onClick={() => navigate(`/model/${item.key}`)}>{item.icon}<span>{item.label}</span></button>)}</nav>}
    </Layout>
  );
}
