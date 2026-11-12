import { runOpsSync, selectOp, syncStatus } from '../lib/supabase-db';

const tables = ['users','categories','products','orders','order_items','conversations','messages','settings','support_tickets','support_messages','uploads'];
const status = syncStatus();
console.log('sync:', status.enabled, status.mode);
const results = runOpsSync(tables.map((t) => selectOp(t)), 25000);
results.forEach((r, i) => {
  const rows = Array.isArray(r.data) ? r.data.length : -1;
  console.log(`${tables[i]}: ${r.ok ? rows : 'ERROR ' + JSON.stringify(r.data ?? r.error).slice(0, 120)}`);
});
