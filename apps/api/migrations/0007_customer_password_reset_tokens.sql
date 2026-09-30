-- Tokens de recuperación de contraseña para `customers` (clientes finales).
-- Tabla separada de `password_reset_tokens` (staff) a propósito — misma regla
-- que separa `users` de `customers`: los dos mundos de auth nunca comparten
-- tablas. Mismo diseño que 0003: de un solo uso, vida corta, y nunca se guarda
-- el token crudo, solo su hash SHA-256.
CREATE TABLE customer_password_reset_tokens (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  customer_id INTEGER NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  token_hash  TEXT NOT NULL UNIQUE,
  expires_at  TEXT NOT NULL,
  used_at     TEXT,                   -- NULL = todavía válido; se setea al canjearlo (un solo uso)
  created_at  TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX idx_customer_reset_tokens_customer ON customer_password_reset_tokens(customer_id);
