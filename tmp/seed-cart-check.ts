/**
 * Crea una base temporal de pruebas (DATA_DIR aparte) con un cliente para
 * comprobar rutas que exigen sesión. No toca la base real de la tienda.
 */
import path from 'node:path';

const dir = '/tmp/nova-cart-check';
process.env.DATA_DIR = dir;

async function main() {
  const { db } = await import('/workspace/MiProyectoNova/lib/db');
  const store = await import('/workspace/MiProyectoNova/lib/store');
  db();
  const result = store.createUser({
    email: 'cliente@nova.local',
    name: 'Cliente Prueba',
    password: 'Prueba1234',
  });
  console.log('DATA_DIR=' + path.resolve(dir));
  console.log(JSON.stringify(result));
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
