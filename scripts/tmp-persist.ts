import fs from 'node:fs';
import { runOpsSync, selectOp, upsertOp } from '../lib/supabase-db';

type Row = Record<string, unknown>;
const FILE = '/tmp/nova-orig-stock.json';

function remote(table: string): Row[] {
  const [r] = runOpsSync([selectOp(table)], 25000);
  if (!r?.ok) throw new Error(`${table}: ${JSON.stringify(r?.data ?? r?.error)}`);
  return Array.isArray(r.data) ? (r.data as Row[]) : [];
}

function upsert(table: string, rows: Row[]) {
  const [r] = runOpsSync([upsertOp(table, rows)], 25000);
  if (!r?.ok) throw new Error(`upsert ${table}: ${JSON.stringify(r?.data ?? r?.error)}`);
}

const mode = process.argv[2] ?? 'check';
const products = remote('products');
console.log('productos en Supabase:', products.length);

if (mode === 'set') {
  const target = products.find((p) => Number(p.stock) !== 3) ?? products[0];
  fs.writeFileSync(FILE, JSON.stringify({ id: target.id, stock: target.stock }));
  upsert('products', [{ ...target, stock: 3 }]);
  const after = remote('products').find((p) => p.id === target.id);
  console.log(`cambio aplicado → producto ${String(target.id)} stock ${String(after?.stock)} (antes ${String(target.stock)})`);
} else if (mode === 'restore') {
  const orig = JSON.parse(fs.readFileSync(FILE, 'utf8')) as { id: string; stock: unknown };
  const row = remote('products').find((p) => p.id === orig.id);
  if (!row) throw new Error('producto original no encontrado');
  upsert('products', [{ ...row, stock: orig.stock }]);
  const after = remote('products').find((p) => p.id === orig.id);
  console.log(`stock restaurado → ${String(after?.stock)}`);
} else {
  const orig = fs.existsSync(FILE) ? (JSON.parse(fs.readFileSync(FILE, 'utf8')) as { id: string; stock: unknown }) : null;
  const ids = new Set(products.map((p) => String(p.id)));
  console.log('productos únicos:', ids.size, '| categorías:', remote('categories').length);
  if (orig) {
    const row = products.find((p) => p.id === orig.id);
    console.log(`producto vigilado ${orig.id}: stock remoto ${String(row?.stock)} (esperado 3 tras publicar)`);
  }
}
