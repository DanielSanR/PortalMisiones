import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  oneLine, bySortOrder, renderRelated, renderChecklist,
  renderIndexBlock, replaceIndexBlock, INDEX_BEGIN, INDEX_END,
} from './render.mjs';

const META = { category: 'design-system', syncedAt: '2026-08-11' };

test('oneLine colapsa saltos de línea y espacios repetidos', () => {
  assert.equal(oneLine('  hola\n  mundo   '), 'hola mundo');
  assert.equal(oneLine(null), '');
  assert.equal(oneLine(undefined), '');
});

test('bySortOrder ordena ascendente sin mutar el original', () => {
  const input = [{ sort_order: 2 }, { sort_order: 0 }, { sort_order: 1 }];
  const out = bySortOrder(input);
  assert.deepEqual(out.map((x) => x.sort_order), [0, 1, 2]);
  assert.equal(input[0].sort_order, 2, 'no debe mutar el array de entrada');
});

test('renderRelated proyecta a categoría/slug', () => {
  const related = [
    { sort_order: 1, related: { slug: 'checkbox', website_categories: { slug: 'design-system' } } },
    { sort_order: 0, related: { slug: 'empty-state', website_categories: { slug: 'web-app' } } },
  ];
  assert.deepEqual(renderRelated(related), ['web-app/empty-state', 'design-system/checkbox']);
});

test('renderChecklist con items usa items y manda tabs a Notas', () => {
  const payload = {
    checklist: { name: 'Button', slug: 'button', description: 'Un botón.' },
    items: [
      { title: 'Copy', description: 'Texto del botón', suggestion: 'Sé explícito', sort_order: 1 },
      { title: 'Base style', description: 'fill, outline', suggestion: null, sort_order: 0 },
    ],
    tabs: [{ title: 'Sizes', description: 'Varios tamaños', sort_order: 0 }],
    related: [],
  };
  const md = renderChecklist(payload, META);

  assert.match(md, /^---\nslug: button\ncategory: design-system\n/);
  assert.match(md, /source: https:\/\/www\.checklist\.design\/design-system\/button/);
  assert.match(md, /synced: 2026-08-11/);
  assert.match(md, /^# Button$/m);
  assert.match(md, /^> Un botón\.$/m);
  assert.match(md, /^## Checklist$/m);
  // respeta sort_order: Base style (0) antes que Copy (1)
  assert.ok(md.indexOf('Base style') < md.indexOf('**Copy**'));
  assert.match(md, /- \[ \] \*\*Base style\*\* — fill, outline/);
  assert.match(md, /💡 Sé explícito/);
  assert.match(md, /^## Notas$/m);
  assert.match(md, /- \*\*Sizes\*\* — Varios tamaños/);
  assert.ok(!md.includes('## Relacionados'), 'sin related no debe emitir la sección');
});

test('renderChecklist sin items usa tabs como pasos numerados del flujo', () => {
  const payload = {
    checklist: { name: 'Saving changes', slug: 'saving-changes', description: 'Guardar.' },
    items: [],
    tabs: [
      { title: 'Notify changes have been saved', description: 'Avisar al usuario', sort_order: 4 },
      { title: 'Show action that enables change', description: 'Debe haber una acción', sort_order: 0 },
    ],
    related: [{ sort_order: 0, related: { slug: 'toast', website_categories: { slug: 'design-system' } } }],
  };
  const md = renderChecklist(payload, { category: 'flows', syncedAt: '2026-08-11' });

  assert.match(md, /^## Checklist — pasos del flujo$/m);
  assert.match(md, /^1\. \*\*Show action that enables change\*\* — Debe haber una acción$/m);
  assert.match(md, /^2\. \*\*Notify changes have been saved\*\*/m);
  assert.ok(!md.includes('## Notas'), 'en modo flujo los tabs no se duplican en Notas');
  assert.match(md, /^## Relacionados$/m);
  assert.match(md, /design-system\/toast/);
});

test('renderChecklist tolera un checklist sin puntos publicados', () => {
  const md = renderChecklist(
    { checklist: { name: 'Vacío', slug: 'vacio', description: '' }, items: [], tabs: [], related: [] },
    META,
  );
  assert.match(md, /_\(sin puntos publicados en la fuente\)_/);
  assert.ok(!md.includes('> '), 'sin descripción no debe emitir la cita');
});

test('renderIndexBlock lista categorías con su conteo entre marcadores', () => {
  const grouped = [
    { name: 'Flows', slug: 'flows', sort_order: 1, checklists: [{ slug: 'saving-changes', sort_order: 0 }] },
    { name: 'Design system', slug: 'design-system', sort_order: 0, checklists: [{ slug: 'button', sort_order: 0 }, { slug: 'table', sort_order: 1 }] },
  ];
  const block = renderIndexBlock(grouped, '2026-08-11');
  assert.ok(block.startsWith(INDEX_BEGIN));
  assert.ok(block.endsWith(INDEX_END));
  assert.match(block, /\*\*3 checklists\*\* en 2 categorías/);
  // respeta sort_order de categorías: design-system (0) antes que flows (1)
  assert.ok(block.indexOf('`design-system`') < block.indexOf('`flows`'));
  assert.match(block, /### `design-system` — Design system \(2\)/);
  assert.match(block, /`button` · `table`/);
});

test('replaceIndexBlock reemplaza solo el bloque y es idempotente', () => {
  const skill = `# Skill\n\ntexto previo\n\n${INDEX_BEGIN}\nviejo\n${INDEX_END}\n\ntexto posterior\n`;
  const nuevo = `${INDEX_BEGIN}\nnuevo\n${INDEX_END}`;
  const out = replaceIndexBlock(skill, nuevo);
  assert.match(out, /texto previo/);
  assert.match(out, /texto posterior/);
  assert.match(out, /nuevo/);
  assert.ok(!out.includes('viejo'));
  assert.equal(replaceIndexBlock(out, nuevo), out, 'debe ser idempotente');
});

test('replaceIndexBlock falla ruidosamente si faltan los marcadores', () => {
  assert.throws(() => replaceIndexBlock('# Skill sin marcadores\n', 'x'), /marcadores/);
});
