/**
 * Genera el INSERT SQL para crear el usuario owner inicial.
 * Corre en Node (no en el Worker), usa el mismo hash PBKDF2 que src/lib/password.ts
 * para que el hash sea compatible con el login real.
 *
 * Uso:
 *   pnpm --filter @sabor/api exec tsx scripts/create-owner.ts <email> <password> <nombre>
 *
 * Copiar el INSERT resultante y correrlo con:
 *   pnpm wrangler d1 execute sabor-llanero-db --local --command "<INSERT ...>"
 */
import { hashPassword } from '../src/lib/password';

async function main() {
  const [email, password, name] = process.argv.slice(2);
  if (!email || !password || !name) {
    console.error('Uso: create-owner.ts <email> <password> <nombre>');
    process.exit(1);
  }

  const hash = await hashPassword(password);
  const escapedHash = hash.replace(/'/g, "''");
  const escapedEmail = email.toLowerCase().replace(/'/g, "''");
  const escapedName = name.replace(/'/g, "''");

  console.log(
    `INSERT INTO users (email, password_hash, name, role) VALUES ('${escapedEmail}', '${escapedHash}', '${escapedName}', 'owner');`,
  );
}

main();
