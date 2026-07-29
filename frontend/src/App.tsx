import { Navigate, Route, Routes } from "react-router-dom";

import { ProtectedRoute } from "./routes/ProtectedRoute";
import { LoginPage } from "./pages/auth/LoginPage";
import { RegisterPage } from "./pages/auth/RegisterPage";
import { RoleWorkspace } from "./pages/RoleWorkspace";

export function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route path="/register" element={<RegisterPage />} />
      <Route element={<ProtectedRoute roles={["merchant"]} />}>
        <Route path="/merchant/*" element={<RoleWorkspace role="merchant" />} />
      </Route>
      <Route element={<ProtectedRoute roles={["model"]} />}>
        <Route path="/model/*" element={<RoleWorkspace role="model" />} />
      </Route>
      <Route element={<ProtectedRoute roles={["admin"]} />}>
        <Route path="/admin/*" element={<RoleWorkspace role="admin" />} />
      </Route>
      <Route path="/" element={<Navigate to="/login" replace />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
