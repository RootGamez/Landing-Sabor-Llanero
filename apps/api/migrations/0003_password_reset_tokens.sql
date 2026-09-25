-- Tokens de recuperación de contraseña para `users` (staff). De un solo uso y
-- vida corta: nunca se guarda el token crudo, solo su hash SHA-256, para que
-- una fuga de la base no permita reconstruir un link de reset válido.
CREATE TABLE password_reset_tokens (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token_hash TEXT NOT NULL UNIQUE,
  expires_at TEXT NOT NULL,
  used_at    TEXT,                   -- NULL = todavía válido; se setea al canjearlo (un solo uso)
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX idx_reset_tokens_user ON password_reset_tokens(user_id);
