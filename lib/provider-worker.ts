import { logEvent, readConfig, dispatchPaidOrders, syncStatuses, refreshBalance } from './provider';

/**
 * Trabajador en segundo plano: envía los pedidos pagados pendientes y refresca
 * los estados desde PEAKERR. Sólo se activa cuando la API está configurada.
 * Un fallo del proveedor nunca detiene la tienda: se registra y se reintenta.
 */

declare global {
  // eslint-disable-next-line no-var
  var __novaProviderLoop: boolean | undefined;
}

const DISPATCH_INTERVAL = 90_000;

export function startProviderLoop(): void {
  if (global.__novaProviderLoop) return;
  global.__novaProviderLoop = true;

  let busy = false;

  const tick = async () => {
    if (busy) return;
    let config;
    try {
      config = readConfig();
    } catch {
      return;
    }
    if (!config.connected || !config.hasKey) return;

    busy = true;
    try {
      const sent = await dispatchPaidOrders();
      if (sent > 0) logEvent('info', 'worker', `Pedidos enviados automáticamente: ${sent}.`);
      const result = await syncStatuses();
      if (result.updated > 0) logEvent('info', 'worker', `Estados actualizados: ${result.updated}.`);
      await refreshBalance();
    } catch (error) {
      logEvent('warn', 'worker', error instanceof Error ? error.message : 'Error en el ciclo automático.');
    } finally {
      busy = false;
    }
  };

  // Primer ciclo diferido para no retrasar el arranque del servidor.
  setTimeout(() => {
    void tick();
  }, 15_000);

  const interval = setInterval(() => {
    void tick();
  }, DISPATCH_INTERVAL);
  // No mantener vivo el proceso por este temporizador.
  if (typeof interval.unref === 'function') interval.unref();
}
