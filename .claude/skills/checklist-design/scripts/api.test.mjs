// Tests de integración: pegan contra la API pública real.
// Es deliberado — la herramienta entera depende de esa API, y queremos que un
// cambio de contrato falle acá y no al escribir 112 archivos.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { fetchGrouped, fetchChecklist, ApiError, sleep } from './api.mjs';

test('sleep resuelve', async () => {
  await sleep(1);
});

test('fetchGrouped devuelve las categorías con sus checklists', async () => {
  const grouped = await fetchGrouped();
  assert.ok(Array.isArray(grouped) && grouped.length >= 5, 'al menos 5 categorías');
  const slugs = grouped.map((c) => c.slug);
  for (const esperado of ['design-system', 'web-app', 'flows', 'website', 'mobile']) {
    assert.ok(slugs.includes(esperado), `falta la categoría ${esperado}`);
  }
  const ds = grouped.find((c) => c.slug === 'design-system');
  assert.ok(ds.checklists.length >= 20);
  assert.ok(ds.checklists.every((c) => typeof c.slug === 'string' && c.slug.length > 0));
});

test('fetchChecklist devuelve items para design-system/button', async () => {
  const { checklist, items } = await fetchChecklist('button', 'design-system');
  assert.equal(checklist.slug, 'button');
  assert.ok(items.length > 0);
  assert.ok(items.every((i) => typeof i.title === 'string'));
});

test('fetchChecklist devuelve tabs y cero items para flows/saving-changes', async () => {
  const { items, tabs } = await fetchChecklist('saving-changes', 'flows');
  assert.equal(items.length, 0, 'flows no publica items');
  assert.ok(tabs.length > 0, 'flows publica su contenido en tabs');
});

test('fetchChecklist lanza ApiError con slug ambiguo sin categoría válida', async () => {
  await assert.rejects(
    () => fetchChecklist('login', 'design-system'),
    (err) => err instanceof ApiError && err.status === 404,
  );
});
