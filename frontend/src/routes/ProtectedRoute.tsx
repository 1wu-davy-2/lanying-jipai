import { Navigate, Outlet, useLocation } from "react-router-dom";

import { useAuthStore } from "../stores/authStore";
import type { UserRole } from "../types";

function roleHome(role: UserRole) {
  return role === "merchant" ? "/merchant/orders" : role === "model" ? "/model/hall" : "/admin/operations";
}

function loginHome(roles: UserRole[]) {
  if (roles.length === 1 && roles[0] === "model") return "/talent/login";
  if (roles.length === 1 && roles[0] === "admin") return "/admin/login";
  return "/login";
}

export function ProtectedRoute({ roles }: { roles: UserRole[] }) {
  const session = useAuthStore((state) => state.session);
  const location = useLocation();
  if (!session) return <Navigate to={loginHome(roles)} replace state={{ from: location }} />;
  if (!roles.includes(session.user.role)) return <Navigate to={roleHome(session.user.role)} replace />;
  return <Outlet />;
}
