import { Navigate, Route, Routes } from "react-router-dom";

import { ProtectedRoute } from "./routes/ProtectedRoute";
import { LoginPage } from "./pages/auth/LoginPage";
import { RegisterPage } from "./pages/auth/RegisterPage";
import { EntryPage } from "./pages/auth/EntryPage";
import { OfficialHomePage } from "./pages/OfficialHomePage";
import { RoleWorkspace } from "./pages/RoleWorkspace";

export function App() {
  const talentOnly = import.meta.env.VITE_APP_MODE === "talent";
  return (
    <Routes>
      <Route path="/" element={talentOnly ? <Navigate to="/model/hall" replace /> : <OfficialHomePage />} />
      <Route path="/entry" element={<EntryPage />} />
      <Route path="/login" element={<LoginPage />} />
      <Route path="/admin/login" element={<LoginPage portal="admin" />} />
      <Route path="/talent/login" element={<LoginPage portal="model" />} />
      <Route path="/talent/register" element={<RegisterPage />} />
      <Route path="/register" element={<Navigate to="/talent/register" replace />} />
      <Route element={<ProtectedRoute roles={["merchant"]} />}>
        <Route path="/merchant/*" element={<RoleWorkspace role="merchant" />} />
      </Route>
      <Route element={<ProtectedRoute roles={["model"]} />}>
        <Route path="/model/*" element={<RoleWorkspace role="model" />} />
      </Route>
      <Route element={<ProtectedRoute roles={["admin"]} />}>
        <Route path="/admin/*" element={<RoleWorkspace role="admin" />} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
