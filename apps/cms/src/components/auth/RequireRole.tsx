import type { ReactNode } from 'react';
import { Navigate } from 'react-router-dom';
import type { Role } from '@sabor/shared';
import { useSessionStore } from '../../store/sessionStore';

/** Guard solo-owner: usado para /usuarios (BLUEPRINT §1.6). */
export function RequireRole({ role, children }: { role: Role; children: ReactNode }) {
  const user = useSessionStore((s) => s.user);

  if (!user || user.role !== role) {
    return <Navigate to="/" replace />;
  }
  return <>{children}</>;
}
