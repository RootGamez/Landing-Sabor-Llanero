import { Link } from 'react-router-dom';

export function NotFoundPage() {
  return (
    <div className="flex flex-col items-center gap-4 py-24 text-center">
      <h1 className="text-3xl font-bold text-text">404</h1>
      <p className="text-text-muted">No encontramos esta página.</p>
      <Link to="/" className="text-sm font-medium text-primary hover:underline">
        Volver al inicio
      </Link>
    </div>
  );
}
