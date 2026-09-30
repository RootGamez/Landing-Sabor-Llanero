# @sabor/mailer — emails transaccionales vía AWS Lambda + SMTP

La API (Worker de Cloudflare) no habla SMTP. Cuando necesita mandar un email le pide el
envío a esta Lambda con un POST firmado, y la Lambda lo entrega por SMTP con `nodemailer`.

```
Worker (apps/api) ──POST firmado (HMAC)──► Lambda Function URL ──► SMTP
   lib/mailer.ts                              apps/mailer
```

- **Contrato compartido:** `packages/shared/src/email.ts` (plantillas permitidas, datos de
  cada una y la firma HMAC). Lo usan las dos puntas.
- **Credenciales SMTP:** viven solo como variables de entorno de la Lambda. El Worker solo
  guarda `MAIL_LAMBDA_URL` y `MAIL_LAMBDA_SECRET`.
- **Seguridad:** firma HMAC-SHA256 con ventana de 60 s (anti-replay); la Lambda no acepta
  asunto/HTML arbitrarios (arma el mensaje desde una plantilla) y solo acepta links a
  `ALLOWED_LINK_ORIGINS`; no loguea destinatarios, links ni credenciales.

## Crear la Lambda en AWS (paso a paso)

1. **Empaquetar:** desde la raíz del repo, `make build-mailer` → genera
   `apps/mailer/dist/mailer.zip`.
2. **Generar el secreto de firma** (guárdalo, lo vas a pegar en dos lugares):
   `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`
3. **Consola de AWS → región `us-east-1`** (arriba a la derecha) **→ Lambda → Create function**:
   - *Author from scratch*
   - Function name: `sabor-llanero-mailer`
   - Runtime: **Node.js 22.x** (o el más nuevo que ofrezca la consola)
   - Architecture: **arm64**
   - Permissions: dejar *Create a new role with basic Lambda permissions* (solo logs)
   - **No** la pongas dentro de una VPC (necesitaría un NAT Gateway, ~32 USD/mes).
4. **Code → Upload from → .zip file** → subir `mailer.zip` → Save.
   En *Runtime settings → Edit* verifica que el **Handler** sea `index.handler`.
5. **Configuration → General configuration → Edit:** Timeout **15 sec**, Memory **256 MB**.
6. **Configuration → Environment variables → Edit**, agregar:

   | Variable | Valor |
   |---|---|
   | `SMTP_HOST` | host de tu servidor SMTP |
   | `SMTP_PORT` | `465` (SSL) o `587` (STARTTLS). El puerto 25 lo limita AWS |
   | `SMTP_SECURE` | `true` si el puerto es 465; `false` si es 587 |
   | `SMTP_USER` / `SMTP_PASS` | credenciales de la casilla SMTP |
   | `MAIL_FROM` | la dirección remitente (debe ser una que tu SMTP pueda enviar) |
   | `MAIL_FROM_NAME` | `Sabor Llanero` |
   | `SIGNING_SECRET` | el secreto del paso 2 (mínimo 32 caracteres; la Lambda no arranca con uno más corto) |
   | `ALLOWED_LINK_ORIGINS` | `https://saborllanero.online,https://cms.saborllanero.online` |

   Pega las credenciales **directo en la consola de AWS** (no las compartas por chat ni las
   subas al repositorio).
7. **Configuration → Concurrency → Edit → Reserve concurrency = 3.** Muy recomendado: la Function URL
   es pública (la protege solo la firma), así que esto limita el costo y el daño de un flood.
   Si AWS no te deja (cuentas nuevas con cuota baja), pídele a soporte subir la cuota o al menos
   no te saltes el paso 10 (alerta de gasto). Endurecimiento futuro: Auth type `AWS_IAM` + SigV4 en el Worker.
8. **Configuration → Function URL → Create function URL:**
   - Auth type: **NONE** (la autenticación es la firma HMAC)
   - Invoke mode: BUFFERED, **CORS desactivado**
   - Copia la URL (`https://xxxx.lambda-url.us-east-1.on.aws/`).
   - Si responde 403, revisa *Configuration → Permissions → Resource-based policy*: deben
     existir `lambda:InvokeFunctionUrl` y `lambda:InvokeFunction` para la Function URL
     (la consola suele agregarlos sola).
9. **CloudWatch → Log groups → `/aws/lambda/sabor-llanero-mailer` → Actions → Edit retention
   setting → 14 days** (evita acumular logs indefinidamente).
10. **Alerta de gasto:** *Billing → Budgets → Create budget* de 1 USD/mes con aviso por email.

## Probar la Lambda sola

```bash
MAILER_URL=https://xxxx.lambda-url.us-east-1.on.aws/ \
MAILER_SECRET=<el SIGNING_SECRET> \
TO=tu@email.com \
pnpm --filter @sabor/mailer send-test
```

Debe responder `202 {"messageId":...}` y llegarte un email. Errores comunes:

| Respuesta | Causa |
|---|---|
| `401` | `MAILER_SECRET` distinto de `SIGNING_SECRET`, o reloj desfasado > 60 s |
| `400` | `LINK_ORIGIN` no está en `ALLOWED_LINK_ORIGINS`, o payload fuera del contrato |
| `502` | falló el SMTP: mira el `code` en CloudWatch Logs (`EAUTH` = credenciales, `ETIMEDOUT`/`ECONNECTION` = host/puerto) |
| `403` de AWS | falta el permiso de la Function URL (paso 8) |

## Conectar el Worker

Desde la raíz del repo (te pide el valor de cada uno):

```bash
cd apps/api
pnpm wrangler secret put MAIL_LAMBDA_URL --env production      # la Function URL
pnpm wrangler secret put MAIL_LAMBDA_SECRET --env production   # el mismo SIGNING_SECRET
```

⚠️ **Hazlo antes de `make deploy-api`**: en producción la API devuelve 500 en todas las
rutas si faltan estos dos secrets (guard de configuración en `apps/api/src/index.ts`).

Para probar el envío real en local, agrega los dos secrets a `apps/api/.dev.vars` (ver
`.dev.vars.example`). Con una Lambda real, agrega además
`http://localhost:3000,http://localhost:5174` a `ALLOWED_LINK_ORIGINS`; si no, la Lambda rechaza los
links de desarrollo con 400. Los tests de la API ya fuerzan esos secrets vacíos, así que nunca envían
emails reales.

## Comportamiento de los links de recuperación

- Vencen a los 30 min y son de un solo uso. Canjear uno inutiliza los demás de la cuenta.
- Mínimo 60 s entre dos emails para la misma cuenta, y máximo 5 links vigentes por cuenta.
  Un pedido nuevo no invalida los links anteriores (así nadie puede anular el link que estás por usar).

## Actualizar la Lambda

`make build-mailer` → consola AWS → *Code → Upload from → .zip file*. Las variables de
entorno no cambian al subir código.

## Agregar un email nuevo

1. `packages/shared/src/email.ts`: sumar una variante a `emailRequestSchema` (plantilla + datos).
2. `apps/mailer/src/templates/<nombre>.ts`: `render(data)` → `{ subject, html, text }`, y
   declarar en `linkFields` qué campos de `data` son links. Registrarla en
   `templates/index.ts` (TypeScript no compila si falta).
3. En la API: `sendEmailSafely(env, '<nombre>', to, data)` dentro de `waitUntil`.
4. Tests en `apps/mailer/src/templates/templates.test.ts`. Re-empaquetar y subir la Lambda.

No sirve para envíos masivos/marketing: para eso conviene SES con una cola.

## Desarrollo

```bash
pnpm --filter @sabor/mailer test        # vitest
pnpm --filter @sabor/mailer typecheck
pnpm --filter @sabor/mailer build       # dist/mailer.zip
```
