/**
 * Arranque del servidor: activa el trabajador de PEAKERR (envío de pedidos
 * pagados y seguimiento de estados). Si la API no está configurada no hace nada.
 * Un fallo aquí nunca debe impedir que la tienda arranque.
 */
export async function register() {
  if (process.env.NEXT_RUNTIME !== 'nodejs') return;
  try {
    const { startProviderWorker } = await import('./lib/provider-worker');
    startProviderWorker();
  } catch (error) {
    console.error('[peakerr] no se pudo iniciar el trabajador', error);
  }
}
