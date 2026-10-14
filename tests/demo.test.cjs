/* eslint-disable @typescript-eslint/no-require-imports -- Isolated CommonJS modules are reloaded to test persistence after a simulated reload. */
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { execFileSync } = require('node:child_process');
const { mkdtempSync, rmSync } = require('node:fs');
const { tmpdir } = require('node:os');
const path = require('node:path');

const compiled = mkdtempSync(path.join(tmpdir(), 'novabank-tests-'));
execFileSync(process.execPath, [require.resolve('typescript/bin/tsc'), 'app/demo-data.ts', 'app/demo-store.ts', 'app/spending.ts', '--outDir', compiled, '--module', 'commonjs', '--target', 'ES2020', '--strict', '--skipLibCheck'], { cwd: path.resolve(__dirname, '..'), stdio: 'pipe' });
process.on('exit', () => rmSync(compiled, { recursive: true, force: true }));
const data = require(path.join(compiled, 'demo-data.js'));
const { spendingSummary, previousPeriod } = require(path.join(compiled, 'spending.js'));
const storePath = path.join(compiled, 'demo-store.js');
const storage = new Map();
let blocked = false;
global.window = { localStorage: {
  getItem: key => { if (blocked) throw Error('Blocked'); return storage.get(key) ?? null; },
  setItem: (key, value) => { if (blocked) throw Error('Blocked'); storage.set(key, value); },
  removeItem: key => { if (blocked) throw Error('Blocked'); storage.delete(key); },
}, addEventListener() {}, removeEventListener() {} };
function loadStore() { delete require.cache[require.resolve(storePath)]; const store = require(storePath); store.subscribeToDemoState(() => {}); return store; }
function freshStore() { storage.clear(); blocked = false; return loadStore(); }
const transfer = (amountCents = 100) => ({ id: 'transfer-test', date: data.DEMO_REFERENCE_DATE, concept: 'Transferencia ficticia', type: 'expense', status: 'completed', category: 'Transferencia', amountCents });
const balance = store => store.getDemoStateSnapshot().movements.reduce((total, item) => total + (item.status === 'completed' ? (item.type === 'income' ? 1 : -1) * item.amountCents : 0), data.OPENING_BALANCE_CENTS);

test('resumen excluye pendientes y rechazados y suma las categorías', () => {
  const summary = spendingSummary(data.movements, '2026-10');
  assert.equal(summary.incomeCents, 18_625_000);
  assert.equal(summary.expenseCents, 9_710_090);
  assert.equal(summary.balanceCents, 8_914_910);
  assert.equal(summary.categories.reduce((total, item) => total + item.amountCents, 0), summary.expenseCents);
});
test('períodos equivalentes, categoría vacía y mes sin egresos', () => {
  assert.equal(previousPeriod('2026-01'), '2025-12');
  assert.equal(spendingSummary(data.movements, '2026-10', 5).expenseCents, 0);
  const summary = spendingSummary([{ ...data.movements[1], category: '' }], '2026-10');
  assert.equal(summary.categories[0].category, 'Otros');
  assert.equal(summary.categories[0].percentage, 100);
  assert.deepEqual(spendingSummary([data.movements[0]], '2026-10').categories, []);
});
test('transferencias válidas, duplicados, importes inválidos y saldo exacto', () => {
  const store = freshStore(); const initial = balance(store);
  assert.equal(store.addDemoTransfer(transfer(0)), false);
  assert.equal(store.addDemoTransfer(transfer(-1)), false);
  assert.equal(store.addDemoTransfer(transfer(1.5)), false);
  assert.equal(store.addDemoTransfer(transfer(initial + 1)), false);
  assert.equal(store.addDemoTransfer(transfer(initial)), true);
  assert.equal(balance(store), 0);
  assert.equal(store.addDemoTransfer(transfer(initial)), false);
});
test('concepto máximo generado por el formulario es válido', () => {
  const store = freshStore();
  assert.equal(store.addDemoTransfer({ ...transfer(), concept: `Transferencia a Valeria Gómez · ${'a'.repeat(100)}` }), true);
});
test('pago actualiza factura e historial una sola vez y persiste', () => {
  const store = freshStore(); const initial = balance(store);
  const service = data.services.find(item => item.status === 'pending');
  assert.equal(store.payDemoService(service.id), true);
  assert.equal(store.payDemoService(service.id), false);
  assert.equal(balance(store), initial - service.amountCents);
  const restored = loadStore();
  assert.equal(balance(restored), balance(store));
  assert.equal(restored.getDemoStateSnapshot().services.find(item => item.id === service.id).status, 'paid');
  assert.equal(restored.getDemoStateSnapshot().movements.filter(item => item.serviceId === service.id).length, 1);
});
test('saldo insuficiente no modifica la factura', () => {
  const store = freshStore(); store.addDemoTransfer(transfer(balance(store)));
  assert.equal(store.payDemoService('service-electricity'), false);
  assert.equal(store.getDemoStateSnapshot().services.find(item => item.id === 'service-electricity').status, 'pending');
});
test('restablecimiento conserva preferencias y recupera datos iniciales', () => {
  const store = freshStore(); storage.set('novabank-theme', 'light');
  store.addDemoTransfer(transfer()); store.payDemoService('service-electricity'); store.resetDemoState();
  assert.deepEqual(store.getDemoStateSnapshot().movements, data.movements);
  assert.deepEqual(store.getDemoStateSnapshot().services, data.services);
  assert.equal(storage.get('novabank-theme'), 'light');
});
test('datos corruptos se recuperan y se informa la recuperación', () => {
  freshStore(); storage.set('novabank-demo-state', '{bad-json');
  const store = loadStore();
  assert.equal(store.getDemoStateSnapshot().recoveredInvalidData, true);
  assert.deepEqual(store.getDemoStateSnapshot().movements, data.movements);
});
test('migración anterior conserva operaciones válidas y rechaza sobregiro', () => {
  const initial = balance(freshStore()); storage.set('novabank-demo-state', JSON.stringify([transfer()]));
  assert.equal(loadStore().getDemoStateSnapshot().movements.length, data.movements.length + 1);
  storage.set('novabank-demo-state', JSON.stringify([transfer(initial + 1)]));
  assert.equal(loadStore().getDemoStateSnapshot().recoveredInvalidData, true);
});
test('almacenamiento bloqueado mantiene operaciones durante la sesión', () => {
  freshStore(); blocked = true; const store = loadStore();
  assert.equal(store.getDemoStateSnapshot().persistenceAvailable, false);
  assert.equal(store.addDemoTransfer(transfer()), true);
  assert.equal(store.getDemoStateSnapshot().movements.length, data.movements.length + 1);
  blocked = false;
});
