/**
 * Verificación funcional de las recargas Sip de NovaStore.
 *
 * Usa una base temporal (DATA_DIR) para no tocar los datos reales de la tienda
 * y comprueba: código único NOVA####, operación única, acreditación automática
 * solo con pago confirmado, monto coincidente, sin doble acreditación y
 * persistencia de los registros.
 *
 * Uso: DATA_DIR=/tmp/nova-sip-check npx tsx scripts/verify-sip.ts
 */
import fs from 'node:fs';

const DATA_DIR = process.env.DATA_DIR || '/tmp/nova-sip-check';
process.env.DATA_DIR = DATA_DIR;
fs.rmSync(DATA_DIR, { recursive: true, force: true });

const results: Array<{ name: string; ok: boolean; detail?: string }> = [];
function check(name: string, ok: boolean, detail = '') {
  results.push({ name, ok, detail });
  if (!ok) throw new Error(`FALLÓ: ${name}${detail ? ` — ${detail}` : ''}`);
}

async function main() {
  const store = await import('../lib/store');
  const sip = await import('../lib/sip');
  const { db, closeDb } = await import('../lib/db');

  /* ---------------------------------------------------------------- */
  /* 1. Configuración de la cuenta Sip                                 */
  /* ---------------------------------------------------------------- */
  const apiKeyPlain = 'sip-test-key-abc123';
  const saved = sip.saveSipSettings({
    holder: 'NovaStore SAC',
    number: '999 111 222',
    alias: 'novastore.sip',
    cci: '00212345678901234567',
    note: 'Usa tu código NOVA como referencia.',
    auto: true,
    apiUrl: 'https://api.sip.test/v1',
    apiKey: apiKeyPlain,
    generateWebhookSecret: true,
  });
  check('guarda la configuración Sip', saved.ok, saved.error);
  check('genera el secreto del webhook', Boolean(saved.webhookSecret));

  const account = sip.getSipAccount();
  check('expone titular y número al cliente', account.holder === 'NovaStore SAC' && account.number === '999 111 222');

  const status = sip.getSipStatus();
  check('la cuenta queda configurada', status.configured === true);
  check('la clave API queda guardada', status.hasApiKey === true);

  const settingValues = (db().prepare('SELECT key, value FROM settings').all() as Array<{ key: string; value: string }>)
    .map((row) => row.value)
    .join('|');
  check('la clave API no se guarda en texto plano', !settingValues.includes(apiKeyPlain));

  const secret = sip.webhookSecret();
  check('el secreto del webhook es recuperable', secret.length > 10);
  check('el webhook acepta el secreto correcto', sip.verifyWebhookSecret(secret) === true);
  check('el webhook rechaza un secreto incorrecto', sip.verifyWebhookSecret('secreto-falso') === false);

  /* ---------------------------------------------------------------- */
  /* 2. Código único de operación                                      */
  /* ---------------------------------------------------------------- */
  const sample = sip.generateSipCode();
  check('el código tiene formato NOVA####', /^NOVA\d{4,6}$/.test(sample), sample);
  check('el código se extrae de un texto de referencia', sip.extractCode(`Pago ref ${sample} ok`) === sample);
  check('extractCode devuelve vacío sin código', sip.extractCode('transferencia sin referencia') === '');

  /* ---------------------------------------------------------------- */
  /* 3. Cliente y recarga                                              */
  /* ---------------------------------------------------------------- */
  const created = store.createUser({ email: 'sip-check@novastore.test', name: 'Cliente Sip', password: 'clave-segura-123' });
  check('crea el usuario de prueba', created.ok === true, created.ok ? '' : created.error);
  if (!created.ok) return;
  const user = created.user;
  const admin = store.createUser({ email: 'sip-admin@novastore.test', name: 'Admin Sip', password: 'clave-segura-123' });
  check('crea el administrador de prueba', admin.ok === true);

  const codes = new Set<string>();
  for (let i = 0; i < 120; i += 1) codes.add(sip.generateSipCode());
  check('los códigos generados no se repiten', codes.size === 120, `${codes.size}/120`);

  const first = sip.createSipTopup(user.id, { amountCents: 2000, method: 'YAPE' });
  check('crea la recarga Sip', first.ok === true, first.ok ? '' : first.error);
  if (!first.ok) return;

  const firstTopup = sip.getSipTopup(first.id);
  check('la recarga guarda su código único', firstTopup?.sipCode === first.code, String(firstTopup?.sipCode));
  check('la recarga queda pendiente', firstTopup?.status === 'PENDING');
  check('la recarga registra el medio de origen', firstTopup?.sipMethod === 'YAPE');
  check('la recarga usa la referencia del código', firstTopup?.reference === first.code);

  check('rechaza montos por debajo del mínimo', sip.createSipTopup(user.id, { amountCents: 10, method: 'SIP' }).ok === false);

  const adminNotes = db().prepare('SELECT COUNT(*) AS c FROM notifications').get() as { c: number };
  check('avisa al administrador de la recarga', adminNotes.c > 0);

  /* ---------------------------------------------------------------- */
  /* 4. Acreditación automática con pago confirmado                    */
  /* ---------------------------------------------------------------- */
  const balanceBefore = store.getUserById(user.id)!.balanceCents;
  check('el saldo inicia en cero', balanceBefore === 0);

  const applied = sip.registerSipTransaction({
    operationNumber: 'OP-0001',
    amountCents: 2000,
    referenceCode: first.code,
    senderName: 'Cliente Sip',
    senderPhone: '999888777',
    source: 'WEBHOOK',
  });
  check('registra la operación recibida', applied.ok === true, applied.error);
  check('acredita automáticamente la recarga', applied.status === 'APPLIED', String(applied.status));

  const afterAuto = store.getUserById(user.id)!;
  check('el saldo sube exactamente el monto', afterAuto.balanceCents === balanceBefore + 2000, String(afterAuto.balanceCents));

  const approvedTopup = sip.getSipTopup(first.id);
  check('la recarga queda aprobada', approvedTopup?.status === 'APPROVED');
  check('la recarga guarda la operación', approvedTopup?.sipOperation === 'OP-0001');
  check('la recarga marca la fecha de acreditación', Boolean(approvedTopup?.creditedAt));

  const walletRows = store.listWallet(user.id).filter((tx) => tx.type === 'TOPUP');
  check('registra un solo movimiento de saldo', walletRows.length === 1, String(walletRows.length));

  /* ---------------------------------------------------------------- */
  /* 5. Sin duplicados ni doble cobro                                  */
  /* ---------------------------------------------------------------- */
  const duplicate = sip.registerSipTransaction({
    operationNumber: 'OP-0001',
    amountCents: 2000,
    referenceCode: first.code,
  });
  check('detecta la operación repetida', duplicate.duplicate === true);
  check('no vuelve a acreditar la misma operación', store.getUserById(user.id)!.balanceCents === balanceBefore + 2000);
  check('no duplica el movimiento', store.listWallet(user.id).filter((tx) => tx.type === 'TOPUP').length === 1);

  const reuse = sip.createSipTopup(user.id, { amountCents: 2000, method: 'PLIN' });
  check('crea una segunda recarga', reuse.ok === true);
  if (reuse.ok) {
    const reused = sip.registerSipTransaction({
      operationNumber: 'OP-0002',
      amountCents: 2000,
      referenceCode: first.code,
    });
    check('no reutiliza un código ya acreditado', reused.status !== 'APPLIED', String(reused.status));
    check('el saldo no cambia con el código repetido', store.getUserById(user.id)!.balanceCents === balanceBefore + 2000);
  }

  const mismatch = sip.createSipTopup(user.id, { amountCents: 5000, method: 'SIP' });
  check('crea la recarga con monto a comparar', mismatch.ok === true);
  if (mismatch.ok) {
    const wrongAmount = sip.registerSipTransaction({
      operationNumber: 'OP-0003',
      amountCents: 3000,
      referenceCode: mismatch.code,
    });
    check('detecta el monto distinto', wrongAmount.status === 'AMOUNT_MISMATCH', String(wrongAmount.status));
    check('no acredita con monto distinto', store.getUserById(user.id)!.balanceCents === balanceBefore + 2000);
    check('la recarga sigue pendiente', sip.getSipTopup(mismatch.id)?.status === 'PENDING');
  }

  const orphan = sip.registerSipTransaction({ operationNumber: 'OP-0004', amountCents: 1500, referenceCode: 'NOVA000000' });
  check('marca sin conciliar un código desconocido', orphan.status === 'UNMATCHED', String(orphan.status));
  check('no acredita operaciones sin conciliar', store.getUserById(user.id)!.balanceCents === balanceBefore + 2000);

  const unmatchedCount = sip.sipSummary().unmatched;
  check('el panel cuenta las operaciones sin conciliar', unmatchedCount >= 2, String(unmatchedCount));

  /* ---------------------------------------------------------------- */
  /* 6. Verificación y aprobación manual                               */
  /* ---------------------------------------------------------------- */
  const manual = sip.createSipTopup(user.id, { amountCents: 1000, method: 'OTRO' });
  check('crea una recarga para verificación manual', manual.ok === true);
  if (manual.ok) {
    const nothing = sip.verifySipTopup(manual.id);
    check('no acredita sin operación registrada', nothing.ok === false && store.getUserById(user.id)!.balanceCents === balanceBefore + 2000);

    sip.registerSipTransaction({ operationNumber: 'OP-0005', amountCents: 1000, referenceCode: manual.code, source: 'ADMIN' });
    check('acredita la operación registrada por el administrador', store.getUserById(user.id)!.balanceCents === balanceBefore + 3000);
    check('la recarga verificada queda aprobada', sip.getSipTopup(manual.id)?.status === 'APPROVED');
    const verified = sip.verifySipTopup(manual.id);
    check('no duplica el saldo al verificar de nuevo', verified.ok === true && verified.credited === false);
  }

  const pendingTopup = sip.createSipTopup(user.id, { amountCents: 800, method: 'SIP' });
  check('crea una recarga pendiente', pendingTopup.ok === true);
  if (pendingTopup.ok) {
    const adminId = admin.ok ? admin.user.id : user.id;
    const before = store.getUserById(user.id)!.balanceCents;
    const approve = store.reviewTopup(pendingTopup.id, 'APPROVED', 'Pago confirmado', adminId);
    check('aprueba manualmente la recarga', approve.ok === true, approve.error);
    check('acredita una sola vez al aprobar', store.getUserById(user.id)!.balanceCents === before + 800);

    const again = store.reviewTopup(pendingTopup.id, 'APPROVED', 'Repetido', adminId);
    check('no permite aprobar dos veces', again.ok === false);
    check('el saldo no se duplica al reaprobar', store.getUserById(user.id)!.balanceCents === before + 800);
  }

  /* ---------------------------------------------------------------- */
  /* 7. Persistencia                                                   */
  /* ---------------------------------------------------------------- */
  const summary = sip.sipSummary();
  check('el resumen cuenta las recargas acreditadas', summary.appliedToday >= 2, String(summary.appliedToday));
  check('el total recibido solo suma pagos acreditados', summary.receivedCents >= 3800, String(summary.receivedCents));

  closeDb();
  const topupsAfter = store.listTopups(user.id);
  const transactionsAfter = sip.listSipTransactions();
  check('las recargas siguen guardadas tras cerrar la base', topupsAfter.length >= 4, String(topupsAfter.length));
  check('las operaciones Sip siguen guardadas', transactionsAfter.length === 5, String(transactionsAfter.length));
  check('los códigos siguen disponibles', topupsAfter.every((topup) => Boolean(topup.sipCode)));
  check('la configuración Sip persiste', sip.getSipStatus().holder === 'NovaStore SAC');
  check('el saldo persiste', store.getUserById(user.id)!.balanceCents === 3800, String(store.getUserById(user.id)!.balanceCents));

  console.log(`\n${results.length} comprobaciones Sip OK`);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    for (const result of results.filter((item) => !item.ok)) console.error(`- ${result.name} ${result.detail}`);
    process.exit(1);
  });
