/**
 * Catálogo real de NovaStore exportado por scripts/snapshot-catalog.ts.
 * Se versiona en Git para que ningún despliegue pueda dejar la tienda sin
 * productos: la aplicación repone los que falten (nunca borra ni sobrescribe).
 *
 * Regenerar con: npm run snapshot:catalogo
 */

export type SnapshotImage = { mime: string; base64: string };

export type SnapshotProduct = {
  id: string;
  name: string;
  description: string;
  priceCents: number;
  stock: number;
  featured: boolean;
  categorySlug: string;
  image: SnapshotImage | null;
};

export type SnapshotCategory = { name: string; slug: string; icon: string; position: number };

export type CatalogSnapshot = {
  generatedAt: string;
  source: string;
  categories: SnapshotCategory[];
  products: SnapshotProduct[];
};

export const CATALOG_SNAPSHOT: CatalogSnapshot = {
  "generatedAt": "2026-11-08T00:31:31.040Z",
  "source": "data/novastore.db",
  "categories": [
    {
      "name": "Juegos",
      "slug": "juegos",
      "icon": "🎮",
      "position": 1
    },
    {
      "name": "Streaming",
      "slug": "streaming",
      "icon": "🎬",
      "position": 2
    },
    {
      "name": "Software",
      "slug": "software",
      "icon": "💻",
      "position": 3
    },
    {
      "name": "Servicios digitales",
      "slug": "servicios-digitales",
      "icon": "⚡",
      "position": 4
    },
    {
      "name": "Números virtuales",
      "slug": "numeros-virtuales",
      "icon": "📱",
      "position": 5
    }
  ],
  "products": [
    {
      "id": "prod_2dbab85c784f8840de",
      "name": "PlayStation Network $10",
      "description": "Tarjeta digital PSN de 10 USD para comprar juegos, DLC y suscripciones en tu cuenta de PlayStation.",
      "priceCents": 1099,
      "stock": 25,
      "featured": true,
      "categorySlug": "juegos",
      "image": {
        "mime": "image/svg+xml",
        "base64": "PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSI5MDAiIGhlaWdodD0iNjQwIiB2aWV3Qm94PSIwIDAgOTAwIDY0MCI+CiAgPGRlZnM+CiAgICA8bGluZWFyR3JhZGllbnQgaWQ9ImciIHgxPSIwIiB5MT0iMCIgeDI9IjEiIHkyPSIxIj4KICAgICAgPHN0b3Agb2Zmc2V0PSIwJSIgc3RvcC1jb2xvcj0iIzFlMWI0YiIvPgogICAgICA8c3RvcCBvZmZzZXQ9IjEwMCUiIHN0b3AtY29sb3I9IiM0YzFkOTUiLz4KICAgIDwvbGluZWFyR3JhZGllbnQ+CiAgICA8cmFkaWFsR3JhZGllbnQgaWQ9Imdsb3ciIGN4PSIwLjc1IiBjeT0iMC4yIiByPSIwLjgiPgogICAgICA8c3RvcCBvZmZzZXQ9IjAlIiBzdG9wLWNvbG9yPSIjZmZmZmZmIiBzdG9wLW9wYWNpdHk9IjAuMzUiLz4KICAgICAgPHN0b3Agb2Zmc2V0PSIxMDAlIiBzdG9wLWNvbG9yPSIjZmZmZmZmIiBzdG9wLW9wYWNpdHk9IjAiLz4KICAgIDwvcmFkaWFsR3JhZGllbnQ+CiAgPC9kZWZzPgogIDxyZWN0IHdpZHRoPSI5MDAiIGhlaWdodD0iNjQwIiBmaWxsPSJ1cmwoI2cpIi8+CiAgPHJlY3Qgd2lkdGg9IjkwMCIgaGVpZ2h0PSI2NDAiIGZpbGw9InVybCgjZ2xvdykiLz4KICA8Y2lyY2xlIGN4PSI3NjAiIGN5PSIxMTAiIHI9IjE3MCIgZmlsbD0iI2ZmZmZmZiIgb3BhY2l0eT0iMC4wOCIvPgogIDxjaXJjbGUgY3g9IjEyMCIgY3k9IjU2MCIgcj0iMjEwIiBmaWxsPSIjMDAwMDAwIiBvcGFjaXR5PSIwLjE4Ii8+CiAgPHRleHQgeD0iNjAiIHk9IjMwMCIgZm9udC1mYW1pbHk9IlNlZ29lIFVJLCBBcmlhbCwgc2Fucy1zZXJpZiIgZm9udC1zaXplPSIxMjAiIG9wYWNpdHk9IjAuOSI+8J+OrjwvdGV4dD4KICA8dGV4dCB4PSI2MCIgeT0iNDIwIiBmb250LWZhbWlseT0iU2Vnb2UgVUksIEFyaWFsLCBzYW5zLXNlcmlmIiBmb250LXNpemU9IjQ2IiBmb250LXdlaWdodD0iNzAwIiBmaWxsPSIjZmZmZmZmIj5QbGF5U3RhdGlvbiBOZXR3b3JrICQxMDwvdGV4dD4KICA8dGV4dCB4PSI2MCIgeT0iNDcwIiBmb250LWZhbWlseT0iU2Vnb2UgVUksIEFyaWFsLCBzYW5zLXNlcmlmIiBmb250LXNpemU9IjI0IiBmaWxsPSIjZmZmZmZmIiBvcGFjaXR5PSIwLjc1Ij5QbGF5U3RhdGlvbiBOZXR3b3JrICQxMDwvdGV4dD4KICA8dGV4dCB4PSI2MCIgeT0iNTgwIiBmb250LWZhbWlseT0iU2Vnb2UgVUksIEFyaWFsLCBzYW5zLXNlcmlmIiBmb250LXNpemU9IjIyIiBmb250LXdlaWdodD0iNzAwIiBmaWxsPSIjZmZmZmZmIiBvcGFjaXR5PSIwLjg1Ij5OT1ZBU1RPUkU8L3RleHQ+Cjwvc3ZnPg=="
      }
    },
    {
      "id": "prod_8c5ba5363d5eedb20f",
      "name": "Steam Wallet $20",
      "description": "Código Steam Wallet de 20 USD. Se entrega al aprobar el pedido, listo para canjear en tu cuenta.",
      "priceCents": 2199,
      "stock": 18,
      "featured": false,
      "categorySlug": "juegos",
      "image": {
        "mime": "image/svg+xml",
        "base64": "PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSI5MDAiIGhlaWdodD0iNjQwIiB2aWV3Qm94PSIwIDAgOTAwIDY0MCI+CiAgPGRlZnM+CiAgICA8bGluZWFyR3JhZGllbnQgaWQ9ImciIHgxPSIwIiB5MT0iMCIgeDI9IjEiIHkyPSIxIj4KICAgICAgPHN0b3Agb2Zmc2V0PSIwJSIgc3RvcC1jb2xvcj0iIzBmMTcyYSIvPgogICAgICA8c3RvcCBvZmZzZXQ9IjEwMCUiIHN0b3AtY29sb3I9IiMzMTJlODEiLz4KICAgIDwvbGluZWFyR3JhZGllbnQ+CiAgICA8cmFkaWFsR3JhZGllbnQgaWQ9Imdsb3ciIGN4PSIwLjc1IiBjeT0iMC4yIiByPSIwLjgiPgogICAgICA8c3RvcCBvZmZzZXQ9IjAlIiBzdG9wLWNvbG9yPSIjZmZmZmZmIiBzdG9wLW9wYWNpdHk9IjAuMzUiLz4KICAgICAgPHN0b3Agb2Zmc2V0PSIxMDAlIiBzdG9wLWNvbG9yPSIjZmZmZmZmIiBzdG9wLW9wYWNpdHk9IjAiLz4KICAgIDwvcmFkaWFsR3JhZGllbnQ+CiAgPC9kZWZzPgogIDxyZWN0IHdpZHRoPSI5MDAiIGhlaWdodD0iNjQwIiBmaWxsPSJ1cmwoI2cpIi8+CiAgPHJlY3Qgd2lkdGg9IjkwMCIgaGVpZ2h0PSI2NDAiIGZpbGw9InVybCgjZ2xvdykiLz4KICA8Y2lyY2xlIGN4PSI3NjAiIGN5PSIxMTAiIHI9IjE3MCIgZmlsbD0iI2ZmZmZmZiIgb3BhY2l0eT0iMC4wOCIvPgogIDxjaXJjbGUgY3g9IjEyMCIgY3k9IjU2MCIgcj0iMjEwIiBmaWxsPSIjMDAwMDAwIiBvcGFjaXR5PSIwLjE4Ii8+CiAgPHRleHQgeD0iNjAiIHk9IjMwMCIgZm9udC1mYW1pbHk9IlNlZ29lIFVJLCBBcmlhbCwgc2Fucy1zZXJpZiIgZm9udC1zaXplPSIxMjAiIG9wYWNpdHk9IjAuOSI+8J+Vue+4jzwvdGV4dD4KICA8dGV4dCB4PSI2MCIgeT0iNDIwIiBmb250LWZhbWlseT0iU2Vnb2UgVUksIEFyaWFsLCBzYW5zLXNlcmlmIiBmb250LXNpemU9IjQ2IiBmb250LXdlaWdodD0iNzAwIiBmaWxsPSIjZmZmZmZmIj5TdGVhbSBXYWxsZXQgJDIwPC90ZXh0PgogIDx0ZXh0IHg9IjYwIiB5PSI0NzAiIGZvbnQtZmFtaWx5PSJTZWdvZSBVSSwgQXJpYWwsIHNhbnMtc2VyaWYiIGZvbnQtc2l6ZT0iMjQiIGZpbGw9IiNmZmZmZmYiIG9wYWNpdHk9IjAuNzUiPlN0ZWFtIFdhbGxldCAkMjA8L3RleHQ+CiAgPHRleHQgeD0iNjAiIHk9IjU4MCIgZm9udC1mYW1pbHk9IlNlZ29lIFVJLCBBcmlhbCwgc2Fucy1zZXJpZiIgZm9udC1zaXplPSIyMiIgZm9udC13ZWlnaHQ9IjcwMCIgZmlsbD0iI2ZmZmZmZiIgb3BhY2l0eT0iMC44NSI+Tk9WQVNUT1JFPC90ZXh0Pgo8L3N2Zz4="
      }
    },
    {
      "id": "prod_3f33fd97a50e50d144",
      "name": "Robux 1.700",
      "description": "Paquete de 1.700 Robux para tu cuenta de Roblox. Entrega inmediata tras la confirmación.",
      "priceCents": 1999,
      "stock": 40,
      "featured": false,
      "categorySlug": "juegos",
      "image": {
        "mime": "image/svg+xml",
        "base64": "PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSI5MDAiIGhlaWdodD0iNjQwIiB2aWV3Qm94PSIwIDAgOTAwIDY0MCI+CiAgPGRlZnM+CiAgICA8bGluZWFyR3JhZGllbnQgaWQ9ImciIHgxPSIwIiB5MT0iMCIgeDI9IjEiIHkyPSIxIj4KICAgICAgPHN0b3Agb2Zmc2V0PSIwJSIgc3RvcC1jb2xvcj0iIzJlMTA2NSIvPgogICAgICA8c3RvcCBvZmZzZXQ9IjEwMCUiIHN0b3AtY29sb3I9IiM3YzNhZWQiLz4KICAgIDwvbGluZWFyR3JhZGllbnQ+CiAgICA8cmFkaWFsR3JhZGllbnQgaWQ9Imdsb3ciIGN4PSIwLjc1IiBjeT0iMC4yIiByPSIwLjgiPgogICAgICA8c3RvcCBvZmZzZXQ9IjAlIiBzdG9wLWNvbG9yPSIjZmZmZmZmIiBzdG9wLW9wYWNpdHk9IjAuMzUiLz4KICAgICAgPHN0b3Agb2Zmc2V0PSIxMDAlIiBzdG9wLWNvbG9yPSIjZmZmZmZmIiBzdG9wLW9wYWNpdHk9IjAiLz4KICAgIDwvcmFkaWFsR3JhZGllbnQ+CiAgPC9kZWZzPgogIDxyZWN0IHdpZHRoPSI5MDAiIGhlaWdodD0iNjQwIiBmaWxsPSJ1cmwoI2cpIi8+CiAgPHJlY3Qgd2lkdGg9IjkwMCIgaGVpZ2h0PSI2NDAiIGZpbGw9InVybCgjZ2xvdykiLz4KICA8Y2lyY2xlIGN4PSI3NjAiIGN5PSIxMTAiIHI9IjE3MCIgZmlsbD0iI2ZmZmZmZiIgb3BhY2l0eT0iMC4wOCIvPgogIDxjaXJjbGUgY3g9IjEyMCIgY3k9IjU2MCIgcj0iMjEwIiBmaWxsPSIjMDAwMDAwIiBvcGFjaXR5PSIwLjE4Ii8+CiAgPHRleHQgeD0iNjAiIHk9IjMwMCIgZm9udC1mYW1pbHk9IlNlZ29lIFVJLCBBcmlhbCwgc2Fucy1zZXJpZiIgZm9udC1zaXplPSIxMjAiIG9wYWNpdHk9IjAuOSI+8J+nqTwvdGV4dD4KICA8dGV4dCB4PSI2MCIgeT0iNDIwIiBmb250LWZhbWlseT0iU2Vnb2UgVUksIEFyaWFsLCBzYW5zLXNlcmlmIiBmb250LXNpemU9IjQ2IiBmb250LXdlaWdodD0iNzAwIiBmaWxsPSIjZmZmZmZmIj5Sb2J1eCAxLjcwMDwvdGV4dD4KICA8dGV4dCB4PSI2MCIgeT0iNDcwIiBmb250LWZhbWlseT0iU2Vnb2UgVUksIEFyaWFsLCBzYW5zLXNlcmlmIiBmb250LXNpemU9IjI0IiBmaWxsPSIjZmZmZmZmIiBvcGFjaXR5PSIwLjc1Ij5Sb2J1eCAxLjcwMDwvdGV4dD4KICA8dGV4dCB4PSI2MCIgeT0iNTgwIiBmb250LWZhbWlseT0iU2Vnb2UgVUksIEFyaWFsLCBzYW5zLXNlcmlmIiBmb250LXNpemU9IjIyIiBmb250LXdlaWdodD0iNzAwIiBmaWxsPSIjZmZmZmZmIiBvcGFjaXR5PSIwLjg1Ij5OT1ZBU1RPUkU8L3RleHQ+Cjwvc3ZnPg=="
      }
    },
    {
      "id": "prod_33d2adf316d29fc525",
      "name": "Netflix Premium 1 mes",
      "description": "Acceso a Netflix Premium 4K por 30 días en un perfil privado. Incluye garantía durante todo el periodo.",
      "priceCents": 599,
      "stock": 30,
      "featured": true,
      "categorySlug": "streaming",
      "image": {
        "mime": "image/svg+xml",
        "base64": "PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSI5MDAiIGhlaWdodD0iNjQwIiB2aWV3Qm94PSIwIDAgOTAwIDY0MCI+CiAgPGRlZnM+CiAgICA8bGluZWFyR3JhZGllbnQgaWQ9ImciIHgxPSIwIiB5MT0iMCIgeDI9IjEiIHkyPSIxIj4KICAgICAgPHN0b3Agb2Zmc2V0PSIwJSIgc3RvcC1jb2xvcj0iIzQ1MGEwYSIvPgogICAgICA8c3RvcCBvZmZzZXQ9IjEwMCUiIHN0b3AtY29sb3I9IiM3ZjFkMWQiLz4KICAgIDwvbGluZWFyR3JhZGllbnQ+CiAgICA8cmFkaWFsR3JhZGllbnQgaWQ9Imdsb3ciIGN4PSIwLjc1IiBjeT0iMC4yIiByPSIwLjgiPgogICAgICA8c3RvcCBvZmZzZXQ9IjAlIiBzdG9wLWNvbG9yPSIjZmZmZmZmIiBzdG9wLW9wYWNpdHk9IjAuMzUiLz4KICAgICAgPHN0b3Agb2Zmc2V0PSIxMDAlIiBzdG9wLWNvbG9yPSIjZmZmZmZmIiBzdG9wLW9wYWNpdHk9IjAiLz4KICAgIDwvcmFkaWFsR3JhZGllbnQ+CiAgPC9kZWZzPgogIDxyZWN0IHdpZHRoPSI5MDAiIGhlaWdodD0iNjQwIiBmaWxsPSJ1cmwoI2cpIi8+CiAgPHJlY3Qgd2lkdGg9IjkwMCIgaGVpZ2h0PSI2NDAiIGZpbGw9InVybCgjZ2xvdykiLz4KICA8Y2lyY2xlIGN4PSI3NjAiIGN5PSIxMTAiIHI9IjE3MCIgZmlsbD0iI2ZmZmZmZiIgb3BhY2l0eT0iMC4wOCIvPgogIDxjaXJjbGUgY3g9IjEyMCIgY3k9IjU2MCIgcj0iMjEwIiBmaWxsPSIjMDAwMDAwIiBvcGFjaXR5PSIwLjE4Ii8+CiAgPHRleHQgeD0iNjAiIHk9IjMwMCIgZm9udC1mYW1pbHk9IlNlZ29lIFVJLCBBcmlhbCwgc2Fucy1zZXJpZiIgZm9udC1zaXplPSIxMjAiIG9wYWNpdHk9IjAuOSI+8J+OrDwvdGV4dD4KICA8dGV4dCB4PSI2MCIgeT0iNDIwIiBmb250LWZhbWlseT0iU2Vnb2UgVUksIEFyaWFsLCBzYW5zLXNlcmlmIiBmb250LXNpemU9IjQ2IiBmb250LXdlaWdodD0iNzAwIiBmaWxsPSIjZmZmZmZmIj5OZXRmbGl4IFByZW1pdW0gMSBtZXM8L3RleHQ+CiAgPHRleHQgeD0iNjAiIHk9IjQ3MCIgZm9udC1mYW1pbHk9IlNlZ29lIFVJLCBBcmlhbCwgc2Fucy1zZXJpZiIgZm9udC1zaXplPSIyNCIgZmlsbD0iI2ZmZmZmZiIgb3BhY2l0eT0iMC43NSI+TmV0ZmxpeCBQcmVtaXVtIDE8L3RleHQ+CiAgPHRleHQgeD0iNjAiIHk9IjU4MCIgZm9udC1mYW1pbHk9IlNlZ29lIFVJLCBBcmlhbCwgc2Fucy1zZXJpZiIgZm9udC1zaXplPSIyMiIgZm9udC13ZWlnaHQ9IjcwMCIgZmlsbD0iI2ZmZmZmZiIgb3BhY2l0eT0iMC44NSI+Tk9WQVNUT1JFPC90ZXh0Pgo8L3N2Zz4="
      }
    },
    {
      "id": "prod_f123badd06c26d43cd",
      "name": "Disney+ 1 mes",
      "description": "Suscripción Disney+ por un mes con catálogo completo de películas y series.",
      "priceCents": 449,
      "stock": 22,
      "featured": false,
      "categorySlug": "streaming",
      "image": {
        "mime": "image/svg+xml",
        "base64": "PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSI5MDAiIGhlaWdodD0iNjQwIiB2aWV3Qm94PSIwIDAgOTAwIDY0MCI+CiAgPGRlZnM+CiAgICA8bGluZWFyR3JhZGllbnQgaWQ9ImciIHgxPSIwIiB5MT0iMCIgeDI9IjEiIHkyPSIxIj4KICAgICAgPHN0b3Agb2Zmc2V0PSIwJSIgc3RvcC1jb2xvcj0iIzBjMWEzYSIvPgogICAgICA8c3RvcCBvZmZzZXQ9IjEwMCUiIHN0b3AtY29sb3I9IiMxZTNhOGEiLz4KICAgIDwvbGluZWFyR3JhZGllbnQ+CiAgICA8cmFkaWFsR3JhZGllbnQgaWQ9Imdsb3ciIGN4PSIwLjc1IiBjeT0iMC4yIiByPSIwLjgiPgogICAgICA8c3RvcCBvZmZzZXQ9IjAlIiBzdG9wLWNvbG9yPSIjZmZmZmZmIiBzdG9wLW9wYWNpdHk9IjAuMzUiLz4KICAgICAgPHN0b3Agb2Zmc2V0PSIxMDAlIiBzdG9wLWNvbG9yPSIjZmZmZmZmIiBzdG9wLW9wYWNpdHk9IjAiLz4KICAgIDwvcmFkaWFsR3JhZGllbnQ+CiAgPC9kZWZzPgogIDxyZWN0IHdpZHRoPSI5MDAiIGhlaWdodD0iNjQwIiBmaWxsPSJ1cmwoI2cpIi8+CiAgPHJlY3Qgd2lkdGg9IjkwMCIgaGVpZ2h0PSI2NDAiIGZpbGw9InVybCgjZ2xvdykiLz4KICA8Y2lyY2xlIGN4PSI3NjAiIGN5PSIxMTAiIHI9IjE3MCIgZmlsbD0iI2ZmZmZmZiIgb3BhY2l0eT0iMC4wOCIvPgogIDxjaXJjbGUgY3g9IjEyMCIgY3k9IjU2MCIgcj0iMjEwIiBmaWxsPSIjMDAwMDAwIiBvcGFjaXR5PSIwLjE4Ii8+CiAgPHRleHQgeD0iNjAiIHk9IjMwMCIgZm9udC1mYW1pbHk9IlNlZ29lIFVJLCBBcmlhbCwgc2Fucy1zZXJpZiIgZm9udC1zaXplPSIxMjAiIG9wYWNpdHk9IjAuOSI+8J+PsDwvdGV4dD4KICA8dGV4dCB4PSI2MCIgeT0iNDIwIiBmb250LWZhbWlseT0iU2Vnb2UgVUksIEFyaWFsLCBzYW5zLXNlcmlmIiBmb250LXNpemU9IjQ2IiBmb250LXdlaWdodD0iNzAwIiBmaWxsPSIjZmZmZmZmIj5EaXNuZXkrIDEgbWVzPC90ZXh0PgogIDx0ZXh0IHg9IjYwIiB5PSI0NzAiIGZvbnQtZmFtaWx5PSJTZWdvZSBVSSwgQXJpYWwsIHNhbnMtc2VyaWYiIGZvbnQtc2l6ZT0iMjQiIGZpbGw9IiNmZmZmZmYiIG9wYWNpdHk9IjAuNzUiPkRpc25leSsgMSBtZXM8L3RleHQ+CiAgPHRleHQgeD0iNjAiIHk9IjU4MCIgZm9udC1mYW1pbHk9IlNlZ29lIFVJLCBBcmlhbCwgc2Fucy1zZXJpZiIgZm9udC1zaXplPSIyMiIgZm9udC13ZWlnaHQ9IjcwMCIgZmlsbD0iI2ZmZmZmZiIgb3BhY2l0eT0iMC44NSI+Tk9WQVNUT1JFPC90ZXh0Pgo8L3N2Zz4="
      }
    },
    {
      "id": "prod_a0076c6c5723547337",
      "name": "Spotify Premium 3 meses",
      "description": "Música sin anuncios, descargas offline y calidad alta durante 3 meses en tu propia cuenta.",
      "priceCents": 899,
      "stock": 26,
      "featured": false,
      "categorySlug": "streaming",
      "image": {
        "mime": "image/svg+xml",
        "base64": "PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSI5MDAiIGhlaWdodD0iNjQwIiB2aWV3Qm94PSIwIDAgOTAwIDY0MCI+CiAgPGRlZnM+CiAgICA8bGluZWFyR3JhZGllbnQgaWQ9ImciIHgxPSIwIiB5MT0iMCIgeDI9IjEiIHkyPSIxIj4KICAgICAgPHN0b3Agb2Zmc2V0PSIwJSIgc3RvcC1jb2xvcj0iIzA1MmUxNiIvPgogICAgICA8c3RvcCBvZmZzZXQ9IjEwMCUiIHN0b3AtY29sb3I9IiMxNjY1MzQiLz4KICAgIDwvbGluZWFyR3JhZGllbnQ+CiAgICA8cmFkaWFsR3JhZGllbnQgaWQ9Imdsb3ciIGN4PSIwLjc1IiBjeT0iMC4yIiByPSIwLjgiPgogICAgICA8c3RvcCBvZmZzZXQ9IjAlIiBzdG9wLWNvbG9yPSIjZmZmZmZmIiBzdG9wLW9wYWNpdHk9IjAuMzUiLz4KICAgICAgPHN0b3Agb2Zmc2V0PSIxMDAlIiBzdG9wLWNvbG9yPSIjZmZmZmZmIiBzdG9wLW9wYWNpdHk9IjAiLz4KICAgIDwvcmFkaWFsR3JhZGllbnQ+CiAgPC9kZWZzPgogIDxyZWN0IHdpZHRoPSI5MDAiIGhlaWdodD0iNjQwIiBmaWxsPSJ1cmwoI2cpIi8+CiAgPHJlY3Qgd2lkdGg9IjkwMCIgaGVpZ2h0PSI2NDAiIGZpbGw9InVybCgjZ2xvdykiLz4KICA8Y2lyY2xlIGN4PSI3NjAiIGN5PSIxMTAiIHI9IjE3MCIgZmlsbD0iI2ZmZmZmZiIgb3BhY2l0eT0iMC4wOCIvPgogIDxjaXJjbGUgY3g9IjEyMCIgY3k9IjU2MCIgcj0iMjEwIiBmaWxsPSIjMDAwMDAwIiBvcGFjaXR5PSIwLjE4Ii8+CiAgPHRleHQgeD0iNjAiIHk9IjMwMCIgZm9udC1mYW1pbHk9IlNlZ29lIFVJLCBBcmlhbCwgc2Fucy1zZXJpZiIgZm9udC1zaXplPSIxMjAiIG9wYWNpdHk9IjAuOSI+8J+OpzwvdGV4dD4KICA8dGV4dCB4PSI2MCIgeT0iNDIwIiBmb250LWZhbWlseT0iU2Vnb2UgVUksIEFyaWFsLCBzYW5zLXNlcmlmIiBmb250LXNpemU9IjQ2IiBmb250LXdlaWdodD0iNzAwIiBmaWxsPSIjZmZmZmZmIj5TcG90aWZ5IFByZW1pdW0gMyBtZXNlczwvdGV4dD4KICA8dGV4dCB4PSI2MCIgeT0iNDcwIiBmb250LWZhbWlseT0iU2Vnb2UgVUksIEFyaWFsLCBzYW5zLXNlcmlmIiBmb250LXNpemU9IjI0IiBmaWxsPSIjZmZmZmZmIiBvcGFjaXR5PSIwLjc1Ij5TcG90aWZ5IFByZW1pdW0gMzwvdGV4dD4KICA8dGV4dCB4PSI2MCIgeT0iNTgwIiBmb250LWZhbWlseT0iU2Vnb2UgVUksIEFyaWFsLCBzYW5zLXNlcmlmIiBmb250LXNpemU9IjIyIiBmb250LXdlaWdodD0iNzAwIiBmaWxsPSIjZmZmZmZmIiBvcGFjaXR5PSIwLjg1Ij5OT1ZBU1RPUkU8L3RleHQ+Cjwvc3ZnPg=="
      }
    },
    {
      "id": "prod_472bacc74b3c2e1148",
      "name": "Office 365 1 año",
      "description": "Licencia Microsoft 365 Personal por 12 meses: Word, Excel, PowerPoint y 1 TB en OneDrive.",
      "priceCents": 2499,
      "stock": 12,
      "featured": true,
      "categorySlug": "software",
      "image": {
        "mime": "image/svg+xml",
        "base64": "PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSI5MDAiIGhlaWdodD0iNjQwIiB2aWV3Qm94PSIwIDAgOTAwIDY0MCI+CiAgPGRlZnM+CiAgICA8bGluZWFyR3JhZGllbnQgaWQ9ImciIHgxPSIwIiB5MT0iMCIgeDI9IjEiIHkyPSIxIj4KICAgICAgPHN0b3Agb2Zmc2V0PSIwJSIgc3RvcC1jb2xvcj0iIzFlMjkzYiIvPgogICAgICA8c3RvcCBvZmZzZXQ9IjEwMCUiIHN0b3AtY29sb3I9IiMwZTc0OTAiLz4KICAgIDwvbGluZWFyR3JhZGllbnQ+CiAgICA8cmFkaWFsR3JhZGllbnQgaWQ9Imdsb3ciIGN4PSIwLjc1IiBjeT0iMC4yIiByPSIwLjgiPgogICAgICA8c3RvcCBvZmZzZXQ9IjAlIiBzdG9wLWNvbG9yPSIjZmZmZmZmIiBzdG9wLW9wYWNpdHk9IjAuMzUiLz4KICAgICAgPHN0b3Agb2Zmc2V0PSIxMDAlIiBzdG9wLWNvbG9yPSIjZmZmZmZmIiBzdG9wLW9wYWNpdHk9IjAiLz4KICAgIDwvcmFkaWFsR3JhZGllbnQ+CiAgPC9kZWZzPgogIDxyZWN0IHdpZHRoPSI5MDAiIGhlaWdodD0iNjQwIiBmaWxsPSJ1cmwoI2cpIi8+CiAgPHJlY3Qgd2lkdGg9IjkwMCIgaGVpZ2h0PSI2NDAiIGZpbGw9InVybCgjZ2xvdykiLz4KICA8Y2lyY2xlIGN4PSI3NjAiIGN5PSIxMTAiIHI9IjE3MCIgZmlsbD0iI2ZmZmZmZiIgb3BhY2l0eT0iMC4wOCIvPgogIDxjaXJjbGUgY3g9IjEyMCIgY3k9IjU2MCIgcj0iMjEwIiBmaWxsPSIjMDAwMDAwIiBvcGFjaXR5PSIwLjE4Ii8+CiAgPHRleHQgeD0iNjAiIHk9IjMwMCIgZm9udC1mYW1pbHk9IlNlZ29lIFVJLCBBcmlhbCwgc2Fucy1zZXJpZiIgZm9udC1zaXplPSIxMjAiIG9wYWNpdHk9IjAuOSI+8J+SuzwvdGV4dD4KICA8dGV4dCB4PSI2MCIgeT0iNDIwIiBmb250LWZhbWlseT0iU2Vnb2UgVUksIEFyaWFsLCBzYW5zLXNlcmlmIiBmb250LXNpemU9IjQ2IiBmb250LXdlaWdodD0iNzAwIiBmaWxsPSIjZmZmZmZmIj5PZmZpY2UgMzY1IDEgYcOxbzwvdGV4dD4KICA8dGV4dCB4PSI2MCIgeT0iNDcwIiBmb250LWZhbWlseT0iU2Vnb2UgVUksIEFyaWFsLCBzYW5zLXNlcmlmIiBmb250LXNpemU9IjI0IiBmaWxsPSIjZmZmZmZmIiBvcGFjaXR5PSIwLjc1Ij5PZmZpY2UgMzY1IDE8L3RleHQ+CiAgPHRleHQgeD0iNjAiIHk9IjU4MCIgZm9udC1mYW1pbHk9IlNlZ29lIFVJLCBBcmlhbCwgc2Fucy1zZXJpZiIgZm9udC1zaXplPSIyMiIgZm9udC13ZWlnaHQ9IjcwMCIgZmlsbD0iI2ZmZmZmZiIgb3BhY2l0eT0iMC44NSI+Tk9WQVNUT1JFPC90ZXh0Pgo8L3N2Zz4="
      }
    },
    {
      "id": "prod_7ca76d906d43582f42",
      "name": "Antivirus Premium 1 año",
      "description": "Protección completa para 3 dispositivos durante un año, con licencia original.",
      "priceCents": 1299,
      "stock": 15,
      "featured": false,
      "categorySlug": "software",
      "image": {
        "mime": "image/svg+xml",
        "base64": "PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSI5MDAiIGhlaWdodD0iNjQwIiB2aWV3Qm94PSIwIDAgOTAwIDY0MCI+CiAgPGRlZnM+CiAgICA8bGluZWFyR3JhZGllbnQgaWQ9ImciIHgxPSIwIiB5MT0iMCIgeDI9IjEiIHkyPSIxIj4KICAgICAgPHN0b3Agb2Zmc2V0PSIwJSIgc3RvcC1jb2xvcj0iIzExMTgyNyIvPgogICAgICA8c3RvcCBvZmZzZXQ9IjEwMCUiIHN0b3AtY29sb3I9IiM0MzM4Y2EiLz4KICAgIDwvbGluZWFyR3JhZGllbnQ+CiAgICA8cmFkaWFsR3JhZGllbnQgaWQ9Imdsb3ciIGN4PSIwLjc1IiBjeT0iMC4yIiByPSIwLjgiPgogICAgICA8c3RvcCBvZmZzZXQ9IjAlIiBzdG9wLWNvbG9yPSIjZmZmZmZmIiBzdG9wLW9wYWNpdHk9IjAuMzUiLz4KICAgICAgPHN0b3Agb2Zmc2V0PSIxMDAlIiBzdG9wLWNvbG9yPSIjZmZmZmZmIiBzdG9wLW9wYWNpdHk9IjAiLz4KICAgIDwvcmFkaWFsR3JhZGllbnQ+CiAgPC9kZWZzPgogIDxyZWN0IHdpZHRoPSI5MDAiIGhlaWdodD0iNjQwIiBmaWxsPSJ1cmwoI2cpIi8+CiAgPHJlY3Qgd2lkdGg9IjkwMCIgaGVpZ2h0PSI2NDAiIGZpbGw9InVybCgjZ2xvdykiLz4KICA8Y2lyY2xlIGN4PSI3NjAiIGN5PSIxMTAiIHI9IjE3MCIgZmlsbD0iI2ZmZmZmZiIgb3BhY2l0eT0iMC4wOCIvPgogIDxjaXJjbGUgY3g9IjEyMCIgY3k9IjU2MCIgcj0iMjEwIiBmaWxsPSIjMDAwMDAwIiBvcGFjaXR5PSIwLjE4Ii8+CiAgPHRleHQgeD0iNjAiIHk9IjMwMCIgZm9udC1mYW1pbHk9IlNlZ29lIFVJLCBBcmlhbCwgc2Fucy1zZXJpZiIgZm9udC1zaXplPSIxMjAiIG9wYWNpdHk9IjAuOSI+8J+boe+4jzwvdGV4dD4KICA8dGV4dCB4PSI2MCIgeT0iNDIwIiBmb250LWZhbWlseT0iU2Vnb2UgVUksIEFyaWFsLCBzYW5zLXNlcmlmIiBmb250LXNpemU9IjQ2IiBmb250LXdlaWdodD0iNzAwIiBmaWxsPSIjZmZmZmZmIj5BbnRpdmlydXMgUHJlbWl1bSAxIGHDsW88L3RleHQ+CiAgPHRleHQgeD0iNjAiIHk9IjQ3MCIgZm9udC1mYW1pbHk9IlNlZ29lIFVJLCBBcmlhbCwgc2Fucy1zZXJpZiIgZm9udC1zaXplPSIyNCIgZmlsbD0iI2ZmZmZmZiIgb3BhY2l0eT0iMC43NSI+QW50aXZpcnVzIFByZW1pdW0gMTwvdGV4dD4KICA8dGV4dCB4PSI2MCIgeT0iNTgwIiBmb250LWZhbWlseT0iU2Vnb2UgVUksIEFyaWFsLCBzYW5zLXNlcmlmIiBmb250LXNpemU9IjIyIiBmb250LXdlaWdodD0iNzAwIiBmaWxsPSIjZmZmZmZmIiBvcGFjaXR5PSIwLjg1Ij5OT1ZBU1RPUkU8L3RleHQ+Cjwvc3ZnPg=="
      }
    },
    {
      "id": "prod_0ad15dc88aae41e2b0",
      "name": "Diseño de logo profesional",
      "description": "Diseño personalizado de logo con tres propuestas y archivos vectoriales listos para usar.",
      "priceCents": 1899,
      "stock": 10,
      "featured": false,
      "categorySlug": "servicios-digitales",
      "image": {
        "mime": "image/svg+xml",
        "base64": "PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSI5MDAiIGhlaWdodD0iNjQwIiB2aWV3Qm94PSIwIDAgOTAwIDY0MCI+CiAgPGRlZnM+CiAgICA8bGluZWFyR3JhZGllbnQgaWQ9ImciIHgxPSIwIiB5MT0iMCIgeDI9IjEiIHkyPSIxIj4KICAgICAgPHN0b3Agb2Zmc2V0PSIwJSIgc3RvcC1jb2xvcj0iIzRhMDQ0ZSIvPgogICAgICA8c3RvcCBvZmZzZXQ9IjEwMCUiIHN0b3AtY29sb3I9IiNhMjFjYWYiLz4KICAgIDwvbGluZWFyR3JhZGllbnQ+CiAgICA8cmFkaWFsR3JhZGllbnQgaWQ9Imdsb3ciIGN4PSIwLjc1IiBjeT0iMC4yIiByPSIwLjgiPgogICAgICA8c3RvcCBvZmZzZXQ9IjAlIiBzdG9wLWNvbG9yPSIjZmZmZmZmIiBzdG9wLW9wYWNpdHk9IjAuMzUiLz4KICAgICAgPHN0b3Agb2Zmc2V0PSIxMDAlIiBzdG9wLWNvbG9yPSIjZmZmZmZmIiBzdG9wLW9wYWNpdHk9IjAiLz4KICAgIDwvcmFkaWFsR3JhZGllbnQ+CiAgPC9kZWZzPgogIDxyZWN0IHdpZHRoPSI5MDAiIGhlaWdodD0iNjQwIiBmaWxsPSJ1cmwoI2cpIi8+CiAgPHJlY3Qgd2lkdGg9IjkwMCIgaGVpZ2h0PSI2NDAiIGZpbGw9InVybCgjZ2xvdykiLz4KICA8Y2lyY2xlIGN4PSI3NjAiIGN5PSIxMTAiIHI9IjE3MCIgZmlsbD0iI2ZmZmZmZiIgb3BhY2l0eT0iMC4wOCIvPgogIDxjaXJjbGUgY3g9IjEyMCIgY3k9IjU2MCIgcj0iMjEwIiBmaWxsPSIjMDAwMDAwIiBvcGFjaXR5PSIwLjE4Ii8+CiAgPHRleHQgeD0iNjAiIHk9IjMwMCIgZm9udC1mYW1pbHk9IlNlZ29lIFVJLCBBcmlhbCwgc2Fucy1zZXJpZiIgZm9udC1zaXplPSIxMjAiIG9wYWNpdHk9IjAuOSI+8J+OqDwvdGV4dD4KICA8dGV4dCB4PSI2MCIgeT0iNDIwIiBmb250LWZhbWlseT0iU2Vnb2UgVUksIEFyaWFsLCBzYW5zLXNlcmlmIiBmb250LXNpemU9IjQ2IiBmb250LXdlaWdodD0iNzAwIiBmaWxsPSIjZmZmZmZmIj5EaXNlw7FvIGRlIGxvZ28gcHJvZmVzaW9uYWw8L3RleHQ+CiAgPHRleHQgeD0iNjAiIHk9IjQ3MCIgZm9udC1mYW1pbHk9IlNlZ29lIFVJLCBBcmlhbCwgc2Fucy1zZXJpZiIgZm9udC1zaXplPSIyNCIgZmlsbD0iI2ZmZmZmZiIgb3BhY2l0eT0iMC43NSI+RGlzZcOxbyBkZSBsb2dvPC90ZXh0PgogIDx0ZXh0IHg9IjYwIiB5PSI1ODAiIGZvbnQtZmFtaWx5PSJTZWdvZSBVSSwgQXJpYWwsIHNhbnMtc2VyaWYiIGZvbnQtc2l6ZT0iMjIiIGZvbnQtd2VpZ2h0PSI3MDAiIGZpbGw9IiNmZmZmZmYiIG9wYWNpdHk9IjAuODUiPk5PVkFTVE9SRTwvdGV4dD4KPC9zdmc+"
      }
    },
    {
      "id": "prod_792ee6cd5f5c0a4dd0",
      "name": "Recarga de seguidores 1K",
      "description": "Servicio de crecimiento para redes sociales con entrega gradual y soporte durante el proceso.",
      "priceCents": 799,
      "stock": 35,
      "featured": false,
      "categorySlug": "servicios-digitales",
      "image": {
        "mime": "image/svg+xml",
        "base64": "PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSI5MDAiIGhlaWdodD0iNjQwIiB2aWV3Qm94PSIwIDAgOTAwIDY0MCI+CiAgPGRlZnM+CiAgICA8bGluZWFyR3JhZGllbnQgaWQ9ImciIHgxPSIwIiB5MT0iMCIgeDI9IjEiIHkyPSIxIj4KICAgICAgPHN0b3Agb2Zmc2V0PSIwJSIgc3RvcC1jb2xvcj0iIzNiMDc2NCIvPgogICAgICA8c3RvcCBvZmZzZXQ9IjEwMCUiIHN0b3AtY29sb3I9IiM2ZDI4ZDkiLz4KICAgIDwvbGluZWFyR3JhZGllbnQ+CiAgICA8cmFkaWFsR3JhZGllbnQgaWQ9Imdsb3ciIGN4PSIwLjc1IiBjeT0iMC4yIiByPSIwLjgiPgogICAgICA8c3RvcCBvZmZzZXQ9IjAlIiBzdG9wLWNvbG9yPSIjZmZmZmZmIiBzdG9wLW9wYWNpdHk9IjAuMzUiLz4KICAgICAgPHN0b3Agb2Zmc2V0PSIxMDAlIiBzdG9wLWNvbG9yPSIjZmZmZmZmIiBzdG9wLW9wYWNpdHk9IjAiLz4KICAgIDwvcmFkaWFsR3JhZGllbnQ+CiAgPC9kZWZzPgogIDxyZWN0IHdpZHRoPSI5MDAiIGhlaWdodD0iNjQwIiBmaWxsPSJ1cmwoI2cpIi8+CiAgPHJlY3Qgd2lkdGg9IjkwMCIgaGVpZ2h0PSI2NDAiIGZpbGw9InVybCgjZ2xvdykiLz4KICA8Y2lyY2xlIGN4PSI3NjAiIGN5PSIxMTAiIHI9IjE3MCIgZmlsbD0iI2ZmZmZmZiIgb3BhY2l0eT0iMC4wOCIvPgogIDxjaXJjbGUgY3g9IjEyMCIgY3k9IjU2MCIgcj0iMjEwIiBmaWxsPSIjMDAwMDAwIiBvcGFjaXR5PSIwLjE4Ii8+CiAgPHRleHQgeD0iNjAiIHk9IjMwMCIgZm9udC1mYW1pbHk9IlNlZ29lIFVJLCBBcmlhbCwgc2Fucy1zZXJpZiIgZm9udC1zaXplPSIxMjAiIG9wYWNpdHk9IjAuOSI+8J+TiDwvdGV4dD4KICA8dGV4dCB4PSI2MCIgeT0iNDIwIiBmb250LWZhbWlseT0iU2Vnb2UgVUksIEFyaWFsLCBzYW5zLXNlcmlmIiBmb250LXNpemU9IjQ2IiBmb250LXdlaWdodD0iNzAwIiBmaWxsPSIjZmZmZmZmIj5SZWNhcmdhIGRlIHNlZ3VpZG9yZXMgMUs8L3RleHQ+CiAgPHRleHQgeD0iNjAiIHk9IjQ3MCIgZm9udC1mYW1pbHk9IlNlZ29lIFVJLCBBcmlhbCwgc2Fucy1zZXJpZiIgZm9udC1zaXplPSIyNCIgZmlsbD0iI2ZmZmZmZiIgb3BhY2l0eT0iMC43NSI+UmVjYXJnYSBkZSBzZWd1aWRvcmVzPC90ZXh0PgogIDx0ZXh0IHg9IjYwIiB5PSI1ODAiIGZvbnQtZmFtaWx5PSJTZWdvZSBVSSwgQXJpYWwsIHNhbnMtc2VyaWYiIGZvbnQtc2l6ZT0iMjIiIGZvbnQtd2VpZ2h0PSI3MDAiIGZpbGw9IiNmZmZmZmYiIG9wYWNpdHk9IjAuODUiPk5PVkFTVE9SRTwvdGV4dD4KPC9zdmc+"
      }
    },
    {
      "id": "prod_7672c734a624e4007e",
      "name": "Número virtual USA",
      "description": "Número virtual de Estados Unidos para recibir SMS de verificación. Activación inmediata.",
      "priceCents": 349,
      "stock": 50,
      "featured": true,
      "categorySlug": "numeros-virtuales",
      "image": {
        "mime": "image/svg+xml",
        "base64": "PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSI5MDAiIGhlaWdodD0iNjQwIiB2aWV3Qm94PSIwIDAgOTAwIDY0MCI+CiAgPGRlZnM+CiAgICA8bGluZWFyR3JhZGllbnQgaWQ9ImciIHgxPSIwIiB5MT0iMCIgeDI9IjEiIHkyPSIxIj4KICAgICAgPHN0b3Agb2Zmc2V0PSIwJSIgc3RvcC1jb2xvcj0iIzA4MmY0OSIvPgogICAgICA8c3RvcCBvZmZzZXQ9IjEwMCUiIHN0b3AtY29sb3I9IiMwZTc0OTAiLz4KICAgIDwvbGluZWFyR3JhZGllbnQ+CiAgICA8cmFkaWFsR3JhZGllbnQgaWQ9Imdsb3ciIGN4PSIwLjc1IiBjeT0iMC4yIiByPSIwLjgiPgogICAgICA8c3RvcCBvZmZzZXQ9IjAlIiBzdG9wLWNvbG9yPSIjZmZmZmZmIiBzdG9wLW9wYWNpdHk9IjAuMzUiLz4KICAgICAgPHN0b3Agb2Zmc2V0PSIxMDAlIiBzdG9wLWNvbG9yPSIjZmZmZmZmIiBzdG9wLW9wYWNpdHk9IjAiLz4KICAgIDwvcmFkaWFsR3JhZGllbnQ+CiAgPC9kZWZzPgogIDxyZWN0IHdpZHRoPSI5MDAiIGhlaWdodD0iNjQwIiBmaWxsPSJ1cmwoI2cpIi8+CiAgPHJlY3Qgd2lkdGg9IjkwMCIgaGVpZ2h0PSI2NDAiIGZpbGw9InVybCgjZ2xvdykiLz4KICA8Y2lyY2xlIGN4PSI3NjAiIGN5PSIxMTAiIHI9IjE3MCIgZmlsbD0iI2ZmZmZmZiIgb3BhY2l0eT0iMC4wOCIvPgogIDxjaXJjbGUgY3g9IjEyMCIgY3k9IjU2MCIgcj0iMjEwIiBmaWxsPSIjMDAwMDAwIiBvcGFjaXR5PSIwLjE4Ii8+CiAgPHRleHQgeD0iNjAiIHk9IjMwMCIgZm9udC1mYW1pbHk9IlNlZ29lIFVJLCBBcmlhbCwgc2Fucy1zZXJpZiIgZm9udC1zaXplPSIxMjAiIG9wYWNpdHk9IjAuOSI+8J+TsTwvdGV4dD4KICA8dGV4dCB4PSI2MCIgeT0iNDIwIiBmb250LWZhbWlseT0iU2Vnb2UgVUksIEFyaWFsLCBzYW5zLXNlcmlmIiBmb250LXNpemU9IjQ2IiBmb250LXdlaWdodD0iNzAwIiBmaWxsPSIjZmZmZmZmIj5Ow7ptZXJvIHZpcnR1YWwgVVNBPC90ZXh0PgogIDx0ZXh0IHg9IjYwIiB5PSI0NzAiIGZvbnQtZmFtaWx5PSJTZWdvZSBVSSwgQXJpYWwsIHNhbnMtc2VyaWYiIGZvbnQtc2l6ZT0iMjQiIGZpbGw9IiNmZmZmZmYiIG9wYWNpdHk9IjAuNzUiPk7Dum1lcm8gdmlydHVhbCBVU0E8L3RleHQ+CiAgPHRleHQgeD0iNjAiIHk9IjU4MCIgZm9udC1mYW1pbHk9IlNlZ29lIFVJLCBBcmlhbCwgc2Fucy1zZXJpZiIgZm9udC1zaXplPSIyMiIgZm9udC13ZWlnaHQ9IjcwMCIgZmlsbD0iI2ZmZmZmZiIgb3BhY2l0eT0iMC44NSI+Tk9WQVNUT1JFPC90ZXh0Pgo8L3N2Zz4="
      }
    },
    {
      "id": "prod_4f5591b903e48dfd60",
      "name": "Número virtual WhatsApp",
      "description": "Número virtual verificado para WhatsApp, ideal para negocios y atención al cliente.",
      "priceCents": 499,
      "stock": 28,
      "featured": false,
      "categorySlug": "numeros-virtuales",
      "image": {
        "mime": "image/svg+xml",
        "base64": "PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSI5MDAiIGhlaWdodD0iNjQwIiB2aWV3Qm94PSIwIDAgOTAwIDY0MCI+CiAgPGRlZnM+CiAgICA8bGluZWFyR3JhZGllbnQgaWQ9ImciIHgxPSIwIiB5MT0iMCIgeDI9IjEiIHkyPSIxIj4KICAgICAgPHN0b3Agb2Zmc2V0PSIwJSIgc3RvcC1jb2xvcj0iIzEzNGU0YSIvPgogICAgICA8c3RvcCBvZmZzZXQ9IjEwMCUiIHN0b3AtY29sb3I9IiMwZjc2NmUiLz4KICAgIDwvbGluZWFyR3JhZGllbnQ+CiAgICA8cmFkaWFsR3JhZGllbnQgaWQ9Imdsb3ciIGN4PSIwLjc1IiBjeT0iMC4yIiByPSIwLjgiPgogICAgICA8c3RvcCBvZmZzZXQ9IjAlIiBzdG9wLWNvbG9yPSIjZmZmZmZmIiBzdG9wLW9wYWNpdHk9IjAuMzUiLz4KICAgICAgPHN0b3Agb2Zmc2V0PSIxMDAlIiBzdG9wLWNvbG9yPSIjZmZmZmZmIiBzdG9wLW9wYWNpdHk9IjAiLz4KICAgIDwvcmFkaWFsR3JhZGllbnQ+CiAgPC9kZWZzPgogIDxyZWN0IHdpZHRoPSI5MDAiIGhlaWdodD0iNjQwIiBmaWxsPSJ1cmwoI2cpIi8+CiAgPHJlY3Qgd2lkdGg9IjkwMCIgaGVpZ2h0PSI2NDAiIGZpbGw9InVybCgjZ2xvdykiLz4KICA8Y2lyY2xlIGN4PSI3NjAiIGN5PSIxMTAiIHI9IjE3MCIgZmlsbD0iI2ZmZmZmZiIgb3BhY2l0eT0iMC4wOCIvPgogIDxjaXJjbGUgY3g9IjEyMCIgY3k9IjU2MCIgcj0iMjEwIiBmaWxsPSIjMDAwMDAwIiBvcGFjaXR5PSIwLjE4Ii8+CiAgPHRleHQgeD0iNjAiIHk9IjMwMCIgZm9udC1mYW1pbHk9IlNlZ29lIFVJLCBBcmlhbCwgc2Fucy1zZXJpZiIgZm9udC1zaXplPSIxMjAiIG9wYWNpdHk9IjAuOSI+8J+SrDwvdGV4dD4KICA8dGV4dCB4PSI2MCIgeT0iNDIwIiBmb250LWZhbWlseT0iU2Vnb2UgVUksIEFyaWFsLCBzYW5zLXNlcmlmIiBmb250LXNpemU9IjQ2IiBmb250LXdlaWdodD0iNzAwIiBmaWxsPSIjZmZmZmZmIj5Ow7ptZXJvIHZpcnR1YWwgV2hhdHNBcHA8L3RleHQ+CiAgPHRleHQgeD0iNjAiIHk9IjQ3MCIgZm9udC1mYW1pbHk9IlNlZ29lIFVJLCBBcmlhbCwgc2Fucy1zZXJpZiIgZm9udC1zaXplPSIyNCIgZmlsbD0iI2ZmZmZmZiIgb3BhY2l0eT0iMC43NSI+TsO6bWVybyB2aXJ0dWFsIFdoYXRzQXBwPC90ZXh0PgogIDx0ZXh0IHg9IjYwIiB5PSI1ODAiIGZvbnQtZmFtaWx5PSJTZWdvZSBVSSwgQXJpYWwsIHNhbnMtc2VyaWYiIGZvbnQtc2l6ZT0iMjIiIGZvbnQtd2VpZ2h0PSI3MDAiIGZpbGw9IiNmZmZmZmYiIG9wYWNpdHk9IjAuODUiPk5PVkFTVE9SRTwvdGV4dD4KPC9zdmc+"
      }
    }
  ]
};
