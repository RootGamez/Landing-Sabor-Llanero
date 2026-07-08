import { Routes, Route } from 'react-router-dom';
import { LoginPage } from './pages/LoginPage';
import { MenuItemsPage } from './pages/MenuItemsPage';
import { MenuItemFormPage } from './pages/MenuItemFormPage';
import { CategoriesPage } from './pages/CategoriesPage';
import { MerchandisingPage } from './pages/MerchandisingPage';
import { WhatsappConfigPage } from './pages/WhatsappConfigPage';
import { UsersPage } from './pages/UsersPage';
import { ProfilePage } from './pages/ProfilePage';
import { ReportsPage } from './pages/ReportsPage';
import { NotFoundPage } from './pages/NotFoundPage';
import { RequireAuth } from './components/auth/RequireAuth';
import { RequireRole } from './components/auth/RequireRole';
import { AppShell } from './components/layout/AppShell';
import { ToastContainer } from './components/ui/ToastContainer';

function Protected({ children }: { children: React.ReactNode }) {
  return (
    <RequireAuth>
      <AppShell>{children}</AppShell>
    </RequireAuth>
  );
}

export default function App() {
  return (
    <>
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route
          path="/"
          element={
            <Protected>
              <MenuItemsPage />
            </Protected>
          }
        />
        <Route
          path="/menu/:id"
          element={
            <Protected>
              <MenuItemFormPage />
            </Protected>
          }
        />
        <Route
          path="/categorias"
          element={
            <Protected>
              <CategoriesPage />
            </Protected>
          }
        />
        <Route
          path="/merchandising"
          element={
            <Protected>
              <MerchandisingPage />
            </Protected>
          }
        />
        <Route
          path="/whatsapp"
          element={
            <Protected>
              <WhatsappConfigPage />
            </Protected>
          }
        />
        <Route
          path="/reportes"
          element={
            <Protected>
              <ReportsPage />
            </Protected>
          }
        />
        <Route
          path="/perfil"
          element={
            <Protected>
              <ProfilePage />
            </Protected>
          }
        />
        <Route
          path="/usuarios"
          element={
            <Protected>
              {/* eslint-disable-next-line jsx-a11y/aria-role -- `role` es una prop propia de
                  RequireRole (control de acceso), no un atributo ARIA de un elemento DOM. */}
              <RequireRole role="owner">
                <UsersPage />
              </RequireRole>
            </Protected>
          }
        />
        <Route path="*" element={<NotFoundPage />} />
      </Routes>
      {/* Toast global también visible en /login (fuera del AppShell) */}
      <ToastContainer />
    </>
  );
}
