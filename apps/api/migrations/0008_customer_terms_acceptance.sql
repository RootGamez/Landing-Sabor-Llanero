-- Prueba de aceptación de Términos y Política de Privacidad al crear la cuenta.
-- `terms_version` es LEGAL_VERSION (packages/shared/src/legal.ts) vigente al registrarse.
-- Nullable: las cuentas creadas antes de esta migración nunca aceptaron nada y quedan en NULL
-- (no se inventa un consentimiento retroactivo).
ALTER TABLE customers ADD COLUMN terms_version TEXT;
ALTER TABLE customers ADD COLUMN terms_accepted_at TEXT;
