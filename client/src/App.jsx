import { BrowserRouter, Navigate, Outlet, Route, Routes } from "react-router-dom";

import { routePaths } from "./constants.js";
import { AuthProvider, useAuth } from "./context/AuthContext.jsx";
import { SidebarProvider } from "./context/SidebarContext.jsx";
import { ThemeProvider } from "./context/ThemeContext.jsx";
import { ToastProvider } from "./context/ToastContext.jsx";
import AdminLayout from "./layout/AdminLayout.jsx";
import LicensesPage from "./pages/LicensesPage.jsx";
import MailSettingsPage from "./pages/MailSettingsPage.jsx";
import PeoplePage from "./pages/PeoplePage.jsx";
import ProvidersPage from "./pages/ProvidersPage.jsx";
import SignInPage from "./pages/SignInPage.jsx";
import StreamersPage from "./pages/StreamersPage.jsx";

function AuthGuard() {
  const { isAuthenticated, isHydrating } = useAuth();
  if (isHydrating) return <div className="p-8 text-center text-gray-500 dark:text-gray-400">Loading...</div>;
  if (!isAuthenticated) return <Navigate replace to={routePaths.login} />;
  return (
    <SidebarProvider>
      <AdminLayout>
        <Outlet />
      </AdminLayout>
    </SidebarProvider>
  );
}

export default function App() {
  return (
    <ThemeProvider>
      <ToastProvider>
        <AuthProvider>
          <BrowserRouter>
            <Routes>
              <Route path={routePaths.login} element={<SignInPage />} />
              <Route element={<AuthGuard />}>
                <Route path={routePaths.providers} element={<ProvidersPage />} />
                <Route path={routePaths.people} element={<PeoplePage />} />
                <Route path={routePaths.licenses} element={<LicensesPage />} />
                <Route path={routePaths.streamers} element={<StreamersPage />} />
                <Route path={routePaths.mailSettings} element={<MailSettingsPage />} />
              </Route>
              <Route path="*" element={<Navigate replace to={routePaths.providers} />} />
            </Routes>
          </BrowserRouter>
        </AuthProvider>
      </ToastProvider>
    </ThemeProvider>
  );
}
