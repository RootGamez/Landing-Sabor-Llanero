-- El 👋 de la plantilla default (0001_init.sql) llega como "?" en algunos
-- teléfonos/versiones de WhatsApp al abrir el deep link wa.me (glifo fuera
-- del plano básico multilingüe, mal decodificado por ciertos clientes) —
-- confirmado por el dueño en producción. Se limpia el carácter de la fila ya
-- guardada en D1 en vez de solo cambiar el default de la columna (que no
-- afecta filas existentes).
--
-- REPLACE() en vez de pisar la columna entera con un valor fijo: conserva
-- cualquier otro cambio que el dueño ya haya hecho a la plantilla desde el
-- CMS. Primero cubre el saludo default exacto ("Hola 👋"/"Hi 👋" → "¡Hola!"/
-- "Hi!", conserva la gramática) y después, como red de seguridad, quita
-- cualquier 👋 que haya quedado en otra parte de una plantilla ya
-- personalizada (con o sin espacio), colapsando el doble espacio que deje el
-- hueco.
UPDATE whatsapp_config
SET
  message_template_es = TRIM(REPLACE(REPLACE(REPLACE(
    REPLACE(message_template_es, 'Hola 👋', '¡Hola!'),
    '👋 ', ''), '👋', ''), '  ', ' ')),
  message_template_en = TRIM(REPLACE(REPLACE(REPLACE(
    REPLACE(message_template_en, 'Hi 👋', 'Hi!'),
    '👋 ', ''), '👋', ''), '  ', ' '));
