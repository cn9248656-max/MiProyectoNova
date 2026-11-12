import { db } from '../../../lib/db';
import { formatDate, formatMoney } from '../../../lib/money';
import { PROVIDER_STATUS_LABEL, listLinkedProducts, listLogs, listProviderOrders, listServices, providerStats, readConfig } from '../../../lib/provider';
import {
  createProductFromServiceAction,
  disconnectPeakerrAction,
  linkProductServiceAction,
  refreshProviderStatusAction,
  retryProviderOrderAction,
  savePeakerrConfigAction,
  saveProviderPricingAction,
  syncPeakerrServicesAction,
  testPeakerrAction,
  toggleProviderServiceAction,
  unlinkProductServiceAction,
} from '../../peakerr-actions';

export const dynamic = 'force-dynamic';

const cell: React.CSSProperties = { padding: '8px 10px', borderBottom: '1px solid rgba(255,255,255,0.08)', textAlign: 'left', verticalAlign: 'top' };
const head: React.CSSProperties = { ...cell, fontSize: 12, textTransform: 'uppercase', letterSpacing: '0.06em', color: '#a89bd6' };
const tableStyle: React.CSSProperties = { width: '100%', borderCollapse: 'collapse', fontSize: 14 };
const scroll: React.CSSProperties = { overflowX: 'auto', marginTop: 10 };

export default async function PeakerrPage({
  searchParams,
}: {
  searchParams: Promise<{ ok?: string; error?: string }>;
}) {
  const { ok, error } = await searchParams;
  const config = readConfig();
  const stats = providerStats();
  const services = listServices(300);
  const linked = listLinkedProducts();
  const orders = listProviderOrders(60);
  const logs = listLogs(30);
  const products = db().prepare('SELECT id, name FROM products ORDER BY name ASC LIMIT 500').all() as Array<{ id: string; name: string }>;
  const categories = db().prepare('SELECT id, name FROM categories ORDER BY name ASC').all() as Array<{ id: string; name: string }>;
  const money = (cents: number) => formatMoney(cents, config.currency);

  return (
    <div className="stack" style={{ gap: 22 }}>
      <div>
        <h1 style={{ margin: 0 }}>PEAKERR API</h1>
        <p className="muted" style={{ marginTop: 6 }}>
          Proveedor de servicios SMM conectado a tu tienda. Todas las solicitudes se ejecutan en el servidor: tu clave API
          nunca se envía al navegador.
        </p>
      </div>

      {ok ? <div className="alert alert--success">{ok}</div> : null}
      {error ? <div className="alert alert--error">{error}</div> : null}
      {!config.hasKey ? (
        <div className="alert alert--error">
          Aún no hay una clave API guardada. Pega la clave de tu cuenta PEAKERR (Panel → API) y pulsa «Guardar y probar».
        </div>
      ) : null}

      {/* Estado ------------------------------------------------------- */}
      <section className="card">
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 18, justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <span className="tiny muted">Estado</span>
            <div style={{ fontWeight: 700, fontSize: 18 }}>
              {config.connected ? '🟢 Conectado' : '🔴 Desconectado'}
            </div>
          </div>
          <div>
            <span className="tiny muted">Saldo PEAKERR</span>
            <div style={{ fontWeight: 700, fontSize: 18 }}>{money(config.balanceCents)}</div>
          </div>
          <div>
            <span className="tiny muted">Ganancia acumulada</span>
            <div style={{ fontWeight: 700, fontSize: 18 }}>{money(stats.profitCents)}</div>
          </div>
          <div>
            <span className="tiny muted">Servicios importados</span>
            <div style={{ fontWeight: 700, fontSize: 18 }}>{config.services}</div>
          </div>
          <div>
            <span className="tiny muted">Última comprobación</span>
            <div>{config.lastCheck ? formatDate(config.lastCheck) : '—'}</div>
          </div>
          <div>
            <span className="tiny muted">Última sincronización</span>
            <div>{config.lastSync ? formatDate(config.lastSync) : '—'}</div>
          </div>
        </div>
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginTop: 16 }}>
          <form action={testPeakerrAction}>
            <button className="btn" type="submit">
              Probar conexión
            </button>
          </form>
          <form action={refreshProviderStatusAction}>
            <button className="btn btn--ghost" type="submit">
              Actualizar pedidos ahora
            </button>
          </form>
          <form action={disconnectPeakerrAction}>
            <button className="btn btn--ghost" type="submit">
              Desconectar API
            </button>
          </form>
        </div>
      </section>

      {/* Conexión ----------------------------------------------------- */}
      <section className="card">
        <h2 style={{ marginTop: 0, fontSize: 18 }}>Conexión</h2>
        <form action={savePeakerrConfigAction} className="stack" style={{ gap: 12 }}>
          <div className="field">
            <label className="label" htmlFor="url">
              URL de la API
            </label>
            <input className="input" id="url" name="url" defaultValue={config.url} placeholder="https://peakerr.com/api/v2" />
            <p className="hint" style={{ marginBottom: 0 }}>
              Usa exactamente el endpoint que indica tu panel de PEAKERR (normalmente https://peakerr.com/api/v2).
            </p>
          </div>
          <div className="field">
            <label className="label" htmlFor="apiKey">
              Clave API {config.hasKey ? <span className="muted tiny">(ya guardada · deja vacío para conservarla)</span> : null}
            </label>
            <input
              className="input"
              id="apiKey"
              name="apiKey"
              type="password"
              autoComplete="off"
              placeholder={config.hasKey ? '••••••••••••••••' : 'Pega aquí tu clave API'}
            />
            <p className="hint" style={{ marginBottom: 0 }}>
              Se guarda cifrada (AES-256-GCM) en el servidor y se sincroniza con tu base de datos. Nunca aparece en el
              código del navegador.
            </p>
          </div>
          <button className="btn" type="submit">
            Guardar y probar
          </button>
        </form>
      </section>

      {/* Servicios ---------------------------------------------------- */}
      <section className="card">
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap', alignItems: 'center' }}>
          <h2 style={{ margin: 0, fontSize: 18 }}>Servicios importados</h2>
          <form action={syncPeakerrServicesAction}>
            <button className="btn" type="submit">
              Sincronizar servicios
            </button>
          </form>
        </div>
        <p className="hint" style={{ marginBottom: 0 }}>
          La sincronización actualiza nombre, tipo, categoría y costo del proveedor. <strong>Nunca</strong> cambia tus
          precios de venta, ofertas ni el estado activo de tus productos.
        </p>

        {services.length === 0 ? (
          <p className="muted" style={{ marginBottom: 0 }}>
            Todavía no hay servicios. Conecta la API y pulsa «Sincronizar servicios».
          </p>
        ) : (
          <div style={scroll}>
            <table style={tableStyle}>
              <thead>
                <tr>
                  <th style={head}>ID</th>
                  <th style={head}>Servicio</th>
                  <th style={head}>Categoría</th>
                  <th style={head}>Costo /1000</th>
                  <th style={head}>Mín / Máx</th>
                  <th style={head}>Estado</th>
                  <th style={head}>Acción</th>
                </tr>
              </thead>
              <tbody>
                {services.slice(0, 80).map((service) => (
                  <tr key={service.id}>
                    <td style={cell}>{service.serviceId}</td>
                    <td style={cell}>
                      {service.name}
                      <div className="tiny muted">{service.type}</div>
                    </td>
                    <td style={cell}>{service.category}</td>
                    <td style={cell}>{money(service.rateCents)}</td>
                    <td style={cell}>
                      {service.min} / {service.max}
                    </td>
                    <td style={cell}>{service.active ? 'Activo' : 'Oculto'}</td>
                    <td style={cell}>
                      <form action={toggleProviderServiceAction} style={{ display: 'flex', gap: 6 }}>
                        <input type="hidden" name="serviceId" value={service.serviceId} />
                        <input type="hidden" name="active" value={service.active ? '0' : '1'} />
                        <button className="btn btn--ghost" type="submit">
                          {service.active ? 'Ocultar' : 'Activar'}
                        </button>
                      </form>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {services.length > 80 ? (
              <p className="tiny muted">Mostrando 80 de {services.length} servicios. Usa el buscador del catálogo para el resto.</p>
            ) : null}
          </div>
        )}
      </section>

      {/* Crear producto desde servicio -------------------------------- */}
      <section className="card">
        <h2 style={{ marginTop: 0, fontSize: 18 }}>Crear producto desde un servicio</h2>
        <form action={createProductFromServiceAction} className="stack" style={{ gap: 12 }}>
          <div className="field">
            <label className="label" htmlFor="newService">
              Servicio de PEAKERR
            </label>
            <select className="input" id="newService" name="serviceId" required>
              <option value="">Selecciona un servicio…</option>
              {services.map((service) => (
                <option key={service.id} value={service.serviceId}>
                  [{service.serviceId}] {service.name} · costo {money(service.rateCents)}/1000
                </option>
              ))}
            </select>
          </div>
          <div className="field">
            <label className="label" htmlFor="newCategory">
              Categoría de tu tienda
            </label>
            <select className="input" id="newCategory" name="categoryId" required>
              <option value="">Selecciona una categoría…</option>
              {categories.map((category) => (
                <option key={category.id} value={category.id}>
                  {category.name}
                </option>
              ))}
            </select>
          </div>
          <div className="field">
            <label className="label" htmlFor="newPrice">
              Tu precio de venta por 1000 unidades
            </label>
            <input className="input" id="newPrice" name="salePrice" inputMode="decimal" placeholder="Ej. 3.50" required />
          </div>
          <button className="btn" type="submit">
            Crear y publicar producto
          </button>
        </form>
      </section>

      {/* Vincular producto existente ---------------------------------- */}
      <section className="card">
        <h2 style={{ marginTop: 0, fontSize: 18 }}>Vincular un producto existente</h2>
        <form action={linkProductServiceAction} className="stack" style={{ gap: 12 }}>
          <div className="field">
            <label className="label" htmlFor="linkProduct">
              Producto de NovaStore
            </label>
            <select className="input" id="linkProduct" name="productId" required>
              <option value="">Selecciona un producto…</option>
              {products.map((product) => (
                <option key={product.id} value={product.id}>
                  {product.name}
                </option>
              ))}
            </select>
          </div>
          <div className="field">
            <label className="label" htmlFor="linkService">
              ID del servicio en PEAKERR
            </label>
            <select className="input" id="linkService" name="serviceId" required>
              <option value="">Selecciona un servicio…</option>
              {services.map((service) => (
                <option key={service.id} value={service.serviceId}>
                  [{service.serviceId}] {service.name}
                </option>
              ))}
            </select>
          </div>
          <button className="btn" type="submit">
            Vincular servicio
          </button>
        </form>
      </section>

      {/* Precios personalizados -------------------------------------- */}
      <section className="card">
        <h2 style={{ marginTop: 0, fontSize: 18 }}>Precios y ganancias</h2>
        <p className="hint" style={{ marginTop: 0 }}>
          El costo del proveedor y tu precio de venta se guardan por separado. Puedes usar precio por unidad o por cada
          1000 unidades (como cotiza PEAKERR).
        </p>
        {linked.length === 0 ? (
          <p className="muted" style={{ marginBottom: 0 }}>
            Ningún producto está vinculado todavía.
          </p>
        ) : (
          <div className="stack" style={{ gap: 14 }}>
            {linked.map((item) => {
              const unitProfit = item.saleCents - item.costCents;
              return (
                <div key={item.productId} className="card card--flat" style={{ padding: 14 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
                    <strong>{item.productName}</strong>
                    <span className="tiny muted">
                      Servicio {item.serviceId} {item.serviceName ? `· ${item.serviceName}` : ''}
                    </span>
                  </div>
                  <div style={{ display: 'flex', gap: 18, flexWrap: 'wrap', marginTop: 8 }}>
                    <span className="tiny">
                      Venta: <strong>{money(item.saleCents)}</strong>
                      {item.priceMode === 'PER_K' ? ' /1000' : ' /unidad'}
                    </span>
                    <span className="tiny">
                      Costo: <strong>{money(item.costCents)}</strong>
                    </span>
                    <span className="tiny">
                      Ganancia: <strong style={{ color: unitProfit >= 0 ? '#7ef0b0' : '#ff8f8f' }}>{money(unitProfit)}</strong>
                    </span>
                    {item.offerCents > 0 ? (
                      <span className="tiny">
                        Oferta: <strong>{money(item.offerCents)}</strong>
                        {item.offerEndsAt ? ` hasta ${item.offerEndsAt}` : ''}
                      </span>
                    ) : null}
                    {!item.providerActive ? <span className="tiny" style={{ color: '#ffcf7a' }}>Servicio oculto en el proveedor</span> : null}
                  </div>
                  <form action={saveProviderPricingAction} style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'flex-end', marginTop: 12 }}>
                    <input type="hidden" name="productId" value={item.productId} />
                    <div className="field" style={{ marginBottom: 0 }}>
                      <label className="label tiny" htmlFor={`sale-${item.productId}`}>
                        Precio de venta
                      </label>
                      <input
                        className="input"
                        id={`sale-${item.productId}`}
                        name="salePrice"
                        inputMode="decimal"
                        defaultValue={(item.saleCents / 100).toFixed(2)}
                        style={{ width: 110 }}
                      />
                    </div>
                    <div className="field" style={{ marginBottom: 0 }}>
                      <label className="label tiny" htmlFor={`cost-${item.productId}`}>
                        Costo proveedor
                      </label>
                      <input
                        className="input"
                        id={`cost-${item.productId}`}
                        name="costPrice"
                        inputMode="decimal"
                        defaultValue={(item.costCents / 100).toFixed(2)}
                        style={{ width: 110 }}
                      />
                    </div>
                    <div className="field" style={{ marginBottom: 0 }}>
                      <label className="label tiny" htmlFor={`mode-${item.productId}`}>
                        Modo
                      </label>
                      <select className="input" id={`mode-${item.productId}`} name="priceMode" defaultValue={item.priceMode} style={{ width: 130 }}>
                        <option value="UNIT">Por unidad</option>
                        <option value="PER_K">Por 1000</option>
                      </select>
                    </div>
                    <div className="field" style={{ marginBottom: 0 }}>
                      <label className="label tiny" htmlFor={`offer-${item.productId}`}>
                        Oferta
                      </label>
                      <input
                        className="input"
                        id={`offer-${item.productId}`}
                        name="offerPrice"
                        inputMode="decimal"
                        placeholder="0.00"
                        defaultValue={item.offerCents > 0 ? (item.offerCents / 100).toFixed(2) : ''}
                        style={{ width: 100 }}
                      />
                    </div>
                    <div className="field" style={{ marginBottom: 0 }}>
                      <label className="label tiny" htmlFor={`offerEnd-${item.productId}`}>
                        Fin de oferta
                      </label>
                      <input
                        className="input"
                        id={`offerEnd-${item.productId}`}
                        name="offerEndsAt"
                        type="date"
                        defaultValue={item.offerEndsAt ? item.offerEndsAt.slice(0, 10) : ''}
                        style={{ width: 150 }}
                      />
                    </div>
                    <button className="btn" type="submit">
                      Guardar
                    </button>
                  </form>
                  <form action={unlinkProductServiceAction} style={{ marginTop: 8 }}>
                    <input type="hidden" name="productId" value={item.productId} />
                    <button className="btn btn--ghost" type="submit">
                      Desvincular
                    </button>
                  </form>
                </div>
              );
            })}
          </div>
        )}
      </section>

      {/* Pedidos enviados -------------------------------------------- */}
      <section className="card">
        <h2 style={{ marginTop: 0, fontSize: 18 }}>Pedidos enviados a PEAKERR</h2>
        <div style={{ display: 'flex', gap: 18, flexWrap: 'wrap' }}>
          <span className="tiny">Total: <strong>{stats.orders}</strong></span>
          <span className="tiny">Completados: <strong>{stats.completed}</strong></span>
          <span className="tiny">En proceso: <strong>{stats.inProgress}</strong></span>
          <span className="tiny">Con error: <strong>{stats.failed}</strong></span>
          <span className="tiny">Facturado: <strong>{money(stats.revenueCents)}</strong></span>
          <span className="tiny">Costo: <strong>{money(stats.costCents)}</strong></span>
          <span className="tiny">Ganancia: <strong>{money(stats.profitCents)}</strong></span>
        </div>

        {orders.length === 0 ? (
          <p className="muted" style={{ marginBottom: 0 }}>
            Todavía no se ha enviado ningún pedido.
          </p>
        ) : (
          <div style={scroll}>
            <table style={tableStyle}>
              <thead>
                <tr>
                  <th style={head}>Pedido</th>
                  <th style={head}>Cliente</th>
                  <th style={head}>Servicio</th>
                  <th style={head}>Enlace</th>
                  <th style={head}>Cant.</th>
                  <th style={head}>Cobro</th>
                  <th style={head}>Costo</th>
                  <th style={head}>Ganancia</th>
                  <th style={head}>Estado</th>
                  <th style={head}>ID PEAKERR</th>
                  <th style={head} />
                </tr>
              </thead>
              <tbody>
                {orders.map((order) => (
                  <tr key={order.id}>
                    <td style={cell}>{order.orderCode || order.orderId}</td>
                    <td style={cell}>
                      {order.userName || '—'}
                      <div className="tiny muted">{order.userEmail}</div>
                    </td>
                    <td style={cell}>{order.serviceId}</td>
                    <td style={cell}>
                      <span className="tiny" style={{ wordBreak: 'break-all' }}>
                        {order.link || '—'}
                      </span>
                    </td>
                    <td style={cell}>{order.quantity}</td>
                    <td style={cell}>{money(order.chargeCents)}</td>
                    <td style={cell}>{money(order.costCents)}</td>
                    <td style={cell}>{money(order.profitCents)}</td>
                    <td style={cell}>
                      {PROVIDER_STATUS_LABEL[order.status] || order.status}
                      {order.remains !== null ? <div className="tiny muted">Faltan {order.remains}</div> : null}
                      {order.error ? <div className="tiny" style={{ color: '#ff8f8f' }}>{order.error}</div> : null}
                    </td>
                    <td style={cell}>{order.providerOrderId || '—'}</td>
                    <td style={cell}>
                      {!order.providerOrderId && (order.status === 'FAILED' || order.status === 'QUEUED') ? (
                        <form action={retryProviderOrderAction}>
                          <input type="hidden" name="providerOrderId" value={order.id} />
                          <button className="btn btn--ghost" type="submit">
                            Reintentar
                          </button>
                        </form>
                      ) : null}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* Registro ---------------------------------------------------- */}
      <section className="card">
        <h2 style={{ marginTop: 0, fontSize: 18 }}>Registro de actividad y errores</h2>
        {logs.length === 0 ? (
          <p className="muted" style={{ marginBottom: 0 }}>
            Sin actividad registrada.
          </p>
        ) : (
          <div className="stack" style={{ gap: 8 }}>
            {logs.map((log) => (
              <div key={log.id} className="tiny" style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                <span className="muted">{formatDate(log.createdAt)}</span>
                <span
                  style={{
                    color: log.level === 'error' ? '#ff8f8f' : log.level === 'warn' ? '#ffcf7a' : '#7ef0b0',
                    textTransform: 'uppercase',
                  }}
                >
                  {log.level}
                </span>
                <span className="muted">[{log.action}]</span>
                <span>{log.message}</span>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
