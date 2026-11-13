/**
 * Prepara una base temporal para revisar la pantalla de recargas Sip en local.
 * No toca la base real de la tienda.
 *
 * Uso: DATA_DIR=/tmp/nova-saldo-ui npx tsx tmp/seed-saldo-check.ts
 */
import fs from 'node:fs';

const DATA_DIR = process.env.DATA_DIR || '/tmp/nova-saldo-ui';
process.env.DATA_DIR = DATA_DIR;
fs.rmSync(DATA_DIR, { recursive: true, force: true });

async function main() {
  const store = await import('../lib/store');
  const sip = await import('../lib/sip');

  const user = store.createUser({ email: 'cliente@novastore.test', name: 'Cliente Nova', password: 'clave-segura-123' });
  if (!user.ok) throw new Error(user.error);

  store.updateSettings({ maintenance: '0', store_name: 'NovaStore' });
  sip.saveSipSettings({
    holder: 'NovaStore SAC',
    number: '999 111 222',
    alias: 'novastore.sip',
    note: 'Usa tu código NOVA como referencia.',
    auto: true,
  });

  console.log(`Listo: usuario ${user.user.email}, mantenimiento desactivado en ${DATA_DIR}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
