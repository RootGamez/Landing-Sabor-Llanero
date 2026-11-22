import { Navigate, useLocation, useParams } from 'react-router-dom';

/**
 * Rutas anteriores a la reorganización por módulos (F1) -> ruta nueva.
 * Se conservan para no romper favoritos ni enlaces enviados por WhatsApp.
 */
export const LEGACY_REDIRECTS: ReadonlyArray<readonly [from: string, to: string]> = [
  ['/menu', '/tienda/menu'],
  ['/pedidos', '/tienda/pedidos'],
  ['/premios', '/tienda/premios'],
  ['/sorteo', '/tienda/sorteo'],
  ['/config-puntos', '/tienda/puntos'],
  ['/categorias', '/tienda/categorias'],
  ['/merchandising', '/tienda/destacados'],
  ['/whatsapp', '/tienda/whatsapp'],
  ['/usuarios', '/ajustes/usuarios'],
  ['/perfil', '/ajustes/perfil'],
];

/** Redirige a `to` conservando query string y hash. */
export function LegacyRedirect({ to }: { to: string }) {
  const { search, hash } = useLocation();
  return <Navigate to={{ pathname: to, search, hash }} replace />;
}

/** `/menu/:id` -> `/tienda/menu/:id`, preservando el id (o `nuevo`). */
export function LegacyMenuItemRedirect() {
  const { id = '' } = useParams<{ id: string }>();
  return <LegacyRedirect to={`/tienda/menu/${encodeURIComponent(id)}`} />;
}
