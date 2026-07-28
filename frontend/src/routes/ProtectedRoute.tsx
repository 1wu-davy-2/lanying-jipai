import { Navigate, Outlet, useLocation } from "react-router-dom";

import { useAuthStore } from "../stores/authStore";
import type { UserRole } from "../types";

function roleHome(role: UserRole) {
  return role === "merchant" ? "/merchant/orders" : role === "model" ? "/model/hall" : "/admin/dashboard";
}

export function ProtectedRoute({ roles }: { roles: UserRole[] }) {
  const session = useAuthStore((state) => state.session);
  const location = useLocation();
  if (!session) return <Navigate to="/login" replace state={{ from: location }} />;
  if (!roles.includes(session.user.role)) return <Navigate to={roleHome(session.user.role)} replace />;
  return <Outlet />;
}
