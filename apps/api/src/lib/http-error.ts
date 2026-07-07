export class HttpError extends Error {
  constructor(
    public status: 400 | 401 | 403 | 404 | 409 | 422 | 429,
    message: string,
  ) {
    super(message);
    this.name = 'HttpError';
  }
}

export const notFound = (msg = 'No encontrado') => new HttpError(404, msg);
export const unauthorized = (msg = 'No autenticado') => new HttpError(401, msg);
export const forbidden = (msg = 'No autorizado') => new HttpError(403, msg);
export const badRequest = (msg = 'Solicitud inválida') => new HttpError(400, msg);
export const conflict = (msg = 'Conflicto') => new HttpError(409, msg);
export const tooManyRequests = (msg = 'Demasiadas solicitudes, intentá de nuevo en un momento') =>
  new HttpError(429, msg);
