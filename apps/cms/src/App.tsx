import { Routes, Route } from 'react-router-dom';
import type { Role } from '@sabor/shared';
import { LoginPage } from './pages/LoginPage';
import { ForgotPasswordPage } from './pages/ForgotPasswordPage';
import { ResetPasswordPage } from './pages/ResetPasswordPage';
import { DashboardPage } from './pages/DashboardPage';
import { MenuItemsPage } from './pages/MenuItemsPage';
import { PedidosPage } from './pages/PedidosPage';
import { PremiosPage } from './pages/PremiosPage';
import { SorteoPage } from './pages/SorteoPage';
import { LoyaltyConfigPage } from './pages/LoyaltyConfigPage';
import { MenuItemFormPage } from './pages/MenuItemFormPage';
import { CategoriesPage } from './pages/CategoriesPage';
import { MerchandisingPage } from './pages/MerchandisingPage';
import { WhatsappConfigPage } from './pages/WhatsappConfigPage';
import { UsersPage } from './pages/UsersPage';
import { ProfilePage } from './pages/ProfilePage';
import { ReportsPage } from './pages/ReportsPage';
import { PosPage } from './pages/PosPage';
import { CashClosuresPage } from './pages/CashClosuresPage';
import { SalesHistoryPage } from './pages/SalesHistoryPage';
import { TablePlanPage } from './pages/TablePlanPage';
import { ExpensesPage } from './pages/ExpensesPage';
import { ExpenseImportPage } from './pages/ExpenseImportPage';
import { ExpenseCategoriesPage } from './pages/ExpenseCategoriesPage';
import { NotFoundPage } from './pages/NotFoundPage';
import { PosLayout, RoleLayout, ShellLayout } from './components/layout/RouteLayouts';
import {
  LEGACY_REDIRECTS,
  LegacyMenuItemRedirect,
  LegacyRedirect,
} from './components/routing/LegacyRedirect';
import { ToastContainer } from './components/ui/ToastContainer';

const BACKOFFICE_ROLES: readonly Role[] = ['owner', 'admin'];
const OWNER_ONLY: readonly Role[] = ['owner'];
const ALL_STAFF_ROLES: readonly Role[] = ['owner', 'admin', 'cashier'];

export default function App() {
  return (
    <>
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route path="/forgot-password" element={<ForgotPasswordPage />} />
        <Route path="/reset-password" element={<ResetPasswordPage />} />

        {/* POS a pantalla completa (D14): sin sidebar. */}
        <Route element={<PosLayout />}>
          <Route path="/ventas/pos" element={<PosPage />} />
        </Route>

        <Route element={<ShellLayout />}>
          {/* Perfil: abierto al cajero (D9), junto con el POS y los cierres. */}
          <Route path="/ajustes/perfil" element={<ProfilePage />} />

          {/* El cajero cierra su caja y comparte el resumen; el historial lo oculta la propia página. */}
          <Route element={<RoleLayout roles={ALL_STAFF_ROLES} />}>
            <Route path="/ventas/cierres" element={<CashClosuresPage />} />
          </Route>

          <Route element={<RoleLayout roles={OWNER_ONLY} />}>
            <Route path="/ajustes/usuarios" element={<UsersPage />} />
          </Route>

          <Route element={<RoleLayout roles={BACKOFFICE_ROLES} />}>
            <Route path="/" element={<DashboardPage />} />
            <Route path="/reportes" element={<ReportsPage />} />
            <Route path="/ventas/historial" element={<SalesHistoryPage />} />
            <Route path="/ventas/mesas" element={<TablePlanPage />} />
            <Route path="/gastos" element={<ExpensesPage />} />
            <Route path="/gastos/importar" element={<ExpenseImportPage />} />
            <Route path="/gastos/categorias" element={<ExpenseCategoriesPage />} />

            <Route path="/tienda/pedidos" element={<PedidosPage />} />
            <Route path="/tienda/menu" element={<MenuItemsPage />} />
            <Route path="/tienda/menu/:id" element={<MenuItemFormPage />} />
            <Route path="/tienda/categorias" element={<CategoriesPage />} />
            <Route path="/tienda/destacados" element={<MerchandisingPage />} />
            <Route path="/tienda/premios" element={<PremiosPage />} />
            <Route path="/tienda/sorteo" element={<SorteoPage />} />
            <Route path="/tienda/puntos" element={<LoyaltyConfigPage />} />
            <Route path="/tienda/whatsapp" element={<WhatsappConfigPage />} />
          </Route>
        </Route>

        {/* Rutas antiguas -> módulos nuevos. */}
        {LEGACY_REDIRECTS.map(([from, to]) => (
          <Route key={from} path={from} element={<LegacyRedirect to={to} />} />
        ))}
        <Route path="/menu/:id" element={<LegacyMenuItemRedirect />} />

        <Route path="*" element={<NotFoundPage />} />
      </Routes>
      {/* Toast global también visible en /login (fuera del AppShell) */}
      <ToastContainer />
    </>
  );
}
