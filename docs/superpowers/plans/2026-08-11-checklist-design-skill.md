# Skill `checklist-design` — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Dar a los agentes del repo un corpus local de 112 checklists de UI/UX consultable por slug, más un gate en `front-design` que obligue a reportar cobertura.

**Architecture:** Un script Node sin dependencias baja la API JSON pública de `checklist.design` y la renderiza a `references/<categoría>/<slug>.md`. La lógica se parte en tres módulos: `api.mjs` (única I/O de red), `render.mjs` (funciones puras JSON→markdown, testeables sin red) y `sync.mjs` (CLI que orquesta y escribe). `SKILL.md` aporta el protocolo de uso y un índice bilingüe escrito a mano, más un bloque de catálogo regenerado por el script entre marcadores HTML.

**Tech Stack:** Node.js (ESM, `fetch` y `node --test` nativos). Sin `package.json`, sin dependencias, sin build. Markdown para skill y references.

**Spec de referencia:** `BRIEF_CHECKLIST_DESIGN.md` (en la raíz del repo). Leerlo antes de empezar.

## Global Constraints

- **Node ≥ 20.11.0** (versión del proyecto; la máquina tiene v22.12.0). `fetch` y `node --test` son nativos — **cero dependencias externas, sin `package.json`, sin `npm install`**.
- **ESM** en todos los `.mjs`: `import`/`export`, nunca `require`.
- **Contenido de `references/` en inglés literal**, tal como lo devuelve la API. La traducción vive solo en el índice bilingüe de `SKILL.md`.
- **Comentarios y documentación en español**, como el resto del repo.
- **`sync.mjs` es idempotente**: dos corridas seguidas sin cambios en la API deben dejar `git status` limpio.
- **Rate limiting**: peticiones **secuenciales** con `await sleep(120)` entre cada una. Nunca paralelizar contra un sitio ajeno.
- **`category` es obligatorio** en toda llamada a `by-slug`: 9 slugs viven en más de una categoría (`login`, `billing`, `pricing`, `cart`, `search`, `onboarding`, `account`, `chat`, `settings`).
- **Regla `items` vs `tabs`**: si `items.length > 0` → el checklist son los `items` y los `tabs` van a *Notas*. Si `items.length === 0` (las 13 de `flows`) → el checklist son los `tabs`, numerados como pasos secuenciales. Ignorarlo deja `flows` vacío.
- **Base URL**: `https://www.checklist.design` (con `www.`).
- **Fin de línea LF** en los archivos generados (`\n`), nunca `\r\n`.
- **Los tests de `api.mjs` son de integración en vivo, por decisión explícita del dueño del repo.**
  Pegan contra la API real y no se mockean: toda la herramienta depende de una API pública no
  documentada ni versionada, y el riesgo #1 del brief es que cambie el contrato. Queremos que eso
  rompa en `api.test.mjs` y no al escribir 112 archivos corruptos. **No es un defecto de test
  hygiene ni un test frágil: es el diseño acordado.** `render.mjs` —donde vive toda la lógica de
  formato— sí se testea en aislamiento total, sin red.

## File Structure

| Archivo | Responsabilidad |
|---|---|
| `.claude/skills/checklist-design/scripts/render.mjs` | Funciones **puras** JSON→markdown. Sin red ni filesystem. Todo lo testeable vive acá. |
| `.claude/skills/checklist-design/scripts/api.mjs` | **Único** módulo que toca la red. Valida la forma de la respuesta y falla ruidosamente. |
| `.claude/skills/checklist-design/scripts/sync.mjs` | CLI: parsea flags, orquesta `api` + `render`, escribe archivos, imprime resumen. |
| `.claude/skills/checklist-design/scripts/render.test.mjs` | Tests de `render.mjs` con `node --test`. Sin red. |
| `.claude/skills/checklist-design/scripts/api.test.mjs` | Un test de integración en vivo contra la API. |
| `.claude/skills/checklist-design/SKILL.md` | Protocolo (modos BUILD y AUDIT) + índice bilingüe a mano + bloque de catálogo generado. |
| `.claude/skills/checklist-design/references/<cat>/<slug>.md` | 112 archivos generados. Se commitean. |
| `.claude/agents/front-design.md` | **Modificar**: paso 0, gate final, regla anti-scope-creep. |

---

### Task 1: `render.mjs` — renderizado puro a markdown

Funciones puras, sin red ni disco. Es el único lugar con lógica de formato, así que es donde van los tests.

**Files:**
- Create: `.claude/skills/checklist-design/scripts/render.mjs`
- Test: `.claude/skills/checklist-design/scripts/render.test.mjs`

**Interfaces:**
- Consumes: nada (primera tarea).
- Produces:
  - `oneLine(text: string|null): string`
  - `bySortOrder<T>(list: T[]): T[]`
  - `renderRelated(related: object[]): string[]` → `['design-system/checkbox', …]`
  - `renderChecklist(payload: {checklist, items, tabs, related}, meta: {category: string, syncedAt: string}): string`
  - `renderIndexBlock(grouped: object[], syncedAt: string): string`
  - `replaceIndexBlock(skillMd: string, block: string): string`
  - `INDEX_BEGIN: string`, `INDEX_END: string`

- [ ] **Step 1: Escribir el test que falla**

Crear `.claude/skills/checklist-design/scripts/render.test.mjs`:

```js
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
```

- [ ] **Step 2: Correr el test para verificar que falla**

```bash
node --test .claude/skills/checklist-design/scripts/render.test.mjs
```

Esperado: FALLA con `Cannot find module … render.mjs`.

- [ ] **Step 3: Escribir la implementación mínima**

Crear `.claude/skills/checklist-design/scripts/render.mjs`:

```js
// Renderizadores puros: payload de la API de checklist.design → markdown.
// Sin red y sin filesystem: todo lo de acá es testeable en aislamiento.

export const BASE_URL = 'https://www.checklist.design';

export const INDEX_BEGIN = '<!-- BEGIN:CATALOGO-GENERADO -->';
export const INDEX_END = '<!-- END:CATALOGO-GENERADO -->';

/** Colapsa saltos de línea y espacios repetidos. Null/undefined → ''. */
export function oneLine(text) {
  return String(text ?? '').replace(/\s+/g, ' ').trim();
}

/** Copia ordenada ascendentemente por `sort_order`. No muta la entrada. */
export function bySortOrder(list) {
  return [...(list ?? [])].sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0));
}

/** `related[]` de la API → ['categoria/slug', …], en orden. */
export function renderRelated(related) {
  return bySortOrder(related)
    .map((entry) => entry?.related)
    .filter((r) => r?.slug)
    .map((r) => `${r.website_categories?.slug ?? 'sin-categoria'}/${r.slug}`);
}

/** Un punto del checklist, con su sugerencia indentada si existe. */
function renderPoint(point, { numbered, index }) {
  const marker = numbered ? `${index + 1}. ` : '- [ ] ';
  const title = oneLine(point.title);
  const description = oneLine(point.description);
  let line = description ? `${marker}**${title}** — ${description}` : `${marker}**${title}**`;
  const suggestion = oneLine(point.suggestion);
  if (suggestion) line += `\n      💡 ${suggestion}`;
  return line;
}

/**
 * Documento markdown completo de un checklist.
 * Regla clave: si no hay `items` (categoría `flows`), los `tabs` SON el checklist
 * y se numeran como pasos secuenciales.
 *
 * @param {{checklist: object, items: object[], tabs: object[], related: object[]}} payload
 * @param {{category: string, syncedAt: string}} meta
 * @returns {string}
 */
export function renderChecklist(payload, meta) {
  const { checklist, items = [], tabs = [], related = [] } = payload;
  const { category, syncedAt } = meta;
  const slug = checklist.slug;
  const flowMode = items.length === 0;

  const out = [
    '---',
    `slug: ${slug}`,
    `category: ${category}`,
    `source: ${BASE_URL}/${category}/${slug}`,
    `synced: ${syncedAt}`,
    '---',
    '',
    `# ${oneLine(checklist.name)}`,
  ];

  const description = oneLine(checklist.description);
  if (description) out.push('', `> ${description}`);

  const points = bySortOrder(flowMode ? tabs : items);
  out.push('', flowMode ? '## Checklist — pasos del flujo' : '## Checklist', '');
  if (points.length === 0) {
    out.push('_(sin puntos publicados en la fuente)_');
  } else {
    points.forEach((point, index) => out.push(renderPoint(point, { numbered: flowMode, index })));
  }

  if (!flowMode && tabs.length > 0) {
    out.push('', '## Notas', '');
    for (const tab of bySortOrder(tabs)) {
      const d = oneLine(tab.description);
      out.push(d ? `- **${oneLine(tab.title)}** — ${d}` : `- **${oneLine(tab.title)}**`);
    }
  }

  const relatedRefs = renderRelated(related);
  if (relatedRefs.length > 0) {
    out.push('', '## Relacionados', '', relatedRefs.map((r) => `\`${r}\``).join(' · '));
  }

  out.push('');
  return out.join('\n');
}

/** Bloque de catálogo que `sync.mjs` inyecta en SKILL.md entre los marcadores. */
export function renderIndexBlock(grouped, syncedAt) {
  const total = grouped.reduce((n, cat) => n + cat.checklists.length, 0);
  const out = [
    INDEX_BEGIN,
    `<!-- Generado por scripts/sync.mjs — no editar a mano. Última sync: ${syncedAt} -->`,
    '',
    `Catálogo completo: **${total} checklists** en ${grouped.length} categorías.`,
  ];

  for (const cat of bySortOrder(grouped)) {
    out.push('', `### \`${cat.slug}\` — ${cat.name} (${cat.checklists.length})`, '');
    out.push(bySortOrder(cat.checklists).map((c) => `\`${c.slug}\``).join(' · '));
  }

  out.push('', INDEX_END);
  return out.join('\n');
}

/** Sustituye el bloque generado dentro de SKILL.md, dejando el resto intacto. */
export function replaceIndexBlock(skillMd, block) {
  const start = skillMd.indexOf(INDEX_BEGIN);
  const end = skillMd.indexOf(INDEX_END);
  if (start === -1 || end === -1) {
    throw new Error(`SKILL.md no tiene los marcadores ${INDEX_BEGIN} / ${INDEX_END}`);
  }
  return skillMd.slice(0, start) + block + skillMd.slice(end + INDEX_END.length);
}
```

- [ ] **Step 4: Correr los tests para verificar que pasan**

```bash
node --test .claude/skills/checklist-design/scripts/render.test.mjs
```

Esperado: `pass 9`, `fail 0`.

- [ ] **Step 5: Commit**

```bash
git add .claude/skills/checklist-design/scripts/render.mjs .claude/skills/checklist-design/scripts/render.test.mjs
git commit -m "feat(skills): render puro de checklists de checklist.design a markdown"
```

---

### Task 2: `api.mjs` — cliente de la API pública

Único módulo con red. Valida la forma de la respuesta para que un cambio en la API rompa acá, ruidosamente, y no genere 112 archivos corruptos.

**Files:**
- Create: `.claude/skills/checklist-design/scripts/api.mjs`
- Test: `.claude/skills/checklist-design/scripts/api.test.mjs`

**Interfaces:**
- Consumes: `BASE_URL` de `render.mjs`.
- Produces:
  - `class ApiError extends Error` con props `url`, `status`
  - `fetchGrouped(): Promise<object[]>` → array de categorías `{id, name, slug, sort_order, checklists[]}`
  - `fetchChecklist(slug: string, category: string): Promise<{checklist, items, tabs, related}>`
  - `sleep(ms: number): Promise<void>`

- [ ] **Step 1: Escribir el test que falla**

Crear `.claude/skills/checklist-design/scripts/api.test.mjs`:

```js
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
```

- [ ] **Step 2: Correr el test para verificar que falla**

```bash
node --test .claude/skills/checklist-design/scripts/api.test.mjs
```

Esperado: FALLA con `Cannot find module … api.mjs`.

- [ ] **Step 3: Escribir la implementación mínima**

Crear `.claude/skills/checklist-design/scripts/api.mjs`:

```js
// Único módulo que toca la red. La API de checklist.design es pública y sin auth,
// pero no está documentada ni versionada: validamos la forma y fallamos fuerte.
import { BASE_URL } from './render.mjs';

export class ApiError extends Error {
  constructor(message, { url, status }) {
    super(message);
    this.name = 'ApiError';
    this.url = url;
    this.status = status;
  }
}

export const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function getJson(url) {
  let res;
  try {
    res = await fetch(url, { headers: { accept: 'application/json' } });
  } catch (cause) {
    throw new ApiError(`Fallo de red en ${url}: ${cause.message}`, { url, status: 0 });
  }
  if (!res.ok) {
    throw new ApiError(`HTTP ${res.status} en ${url}`, { url, status: res.status });
  }
  const body = await res.json();
  if (body?.success !== true) {
    throw new ApiError(
      `Respuesta sin success:true en ${url} — ${body?.error ?? 'sin detalle'}`,
      { url, status: res.status },
    );
  }
  return body;
}

/** Índice completo: categorías con sus checklists. Una sola petición. */
export async function fetchGrouped() {
  const url = `${BASE_URL}/api/checklists/grouped`;
  const body = await getJson(url);
  if (!Array.isArray(body.grouped) || body.grouped.length === 0) {
    throw new ApiError('`grouped` vacío o ausente: cambió la forma de la API', { url, status: 200 });
  }
  for (const cat of body.grouped) {
    if (!cat.slug || !Array.isArray(cat.checklists)) {
      throw new ApiError(`Categoría malformada en ${url}: ${JSON.stringify(cat).slice(0, 120)}`, { url, status: 200 });
    }
  }
  return body.grouped;
}

/**
 * Un checklist completo. `category` NO es opcional: 9 slugs viven en más de una
 * categoría (login, billing, pricing, cart, search, onboarding, account, chat, settings)
 * y sin él la API responde 404.
 */
export async function fetchChecklist(slug, category) {
  const params = new URLSearchParams({ slug, category });
  const url = `${BASE_URL}/api/checklists/by-slug?${params}`;
  const body = await getJson(url);
  if (!body.checklist?.slug) {
    throw new ApiError(`Respuesta sin checklist.slug en ${url}`, { url, status: 200 });
  }
  return {
    checklist: body.checklist,
    items: body.items ?? [],
    tabs: body.tabs ?? [],
    related: body.related ?? [],
  };
}
```

- [ ] **Step 4: Correr los tests para verificar que pasan**

```bash
node --test .claude/skills/checklist-design/scripts/api.test.mjs
```

Esperado: `pass 5`, `fail 0`. Si falla por red, reintentar una vez antes de investigar.

- [ ] **Step 5: Commit**

```bash
git add .claude/skills/checklist-design/scripts/api.mjs .claude/skills/checklist-design/scripts/api.test.mjs
git commit -m "feat(skills): cliente de la API publica de checklist.design"
```

---

### Task 3: `SKILL.md` — protocolo e índice bilingüe

Se escribe antes que `sync.mjs` porque el script inyecta el catálogo dentro de este archivo y necesita encontrar los marcadores.

**Files:**
- Create: `.claude/skills/checklist-design/SKILL.md`

**Interfaces:**
- Consumes: `INDEX_BEGIN` / `INDEX_END` de `render.mjs` — los marcadores deben coincidir **literalmente**.
- Produces: el archivo que `sync.mjs` (Task 4) modifica y que los agentes leen.

- [ ] **Step 1: Escribir `SKILL.md`**

Crear `.claude/skills/checklist-design/SKILL.md` con exactamente este contenido:

````markdown
---
name: checklist-design
description: Corpus local de 112 checklists de UI/UX (checklist.design) para implementar o auditar interfaz. Úsalo al crear o pulir cualquier pantalla, componente o flujo del backoffice/portal, y para auditar UX de lo ya construido. Resuelve el checklist aplicable desde un pedido en español y obliga a reportar cobertura.
---

# Checklist Design — patrones de UI/UX

Corpus local de **112 checklists** (**818 puntos de verificación**) extraídos de
[checklist.design](https://www.checklist.design/). Sirven para no improvisar qué estados,
casos borde y feedback tiene que cubrir una interfaz.

**Los checklists dicen QUÉ considerar, nunca CÓMO implementarlo.** El *cómo* lo mandan
`.claude/rules/`, los tokens `var(--theme-*)` y Angular Material.

## Cómo leer un checklist

1. Resolvé el par `categoría/slug` con el **índice bilingüe** de más abajo.
2. Leé `references/<categoría>/<slug>.md`.
3. Si el archivo no existe, traelo y cacheálo:
   `node .claude/skills/checklist-design/scripts/sync.mjs --category <cat> --slug <slug>`

**Nunca inventes un slug.** Si el pedido no mapea a ninguno, seguí sin checklist y decilo.

## Modo BUILD — implementar o pulir

1. **Resolver** los checklists aplicables. Una pantalla casi nunca es uno solo:
   *"listado de trámites con filtros"* = `design-system/table` + `design-system/searchbar`
   + `flows/filtering-items` + `web-app/empty-state`.
2. **Leer** los references correspondientes.
3. **Reconciliar.** Ante conflicto gana, en este orden: `.claude/rules/` → tokens del tema →
   Material y componentes de `@shared`. Un ítem que no aplica se marca **N/A con motivo**.
4. **Reportar el gate.** Al terminar, tabla de cobertura:

   | Ítem | Estado | Nota |
   |---|---|---|
   | Empty state | ✅ | `tramites-list.html:42` |
   | Loading skeleton | ⬜ | pendiente sugerido — fuera del pedido |
   | Dark mode | N/A | el backoffice no tiene tema oscuro |

   **Sin esa tabla el trabajo no está terminado.**

**Anti-scope-creep (crítico):** un ítem del checklist **no autoriza** features fuera de lo que
pidió el usuario. Lo no pedido va como ⬜ *pendiente sugerido*; no se implementa.

## Modo AUDIT — revisar lo existente

1. **Inventariar** pantallas y componentes (`backoffice/src/app/pages/**`, `shared/components/**`).
2. **Mapear** cada uno a sus checklists vía el índice bilingüe.
3. **Contrastar** punto por punto contra el código real (HTML + SCSS + TS de presentación).
   Cada veredicto se ancla a `archivo:línea`. **Un gap sin evidencia en el código no se reporta.**
4. **Clasificar**:
   - 🔴 **Bloqueante** — rompe accesibilidad o deja al usuario sin feedback (error sin mensaje,
     acción destructiva sin confirmación, foco no visible).
   - 🟡 **Mejora** — el patrón existe pero incompleto (tabla sin empty-state, sin estado de carga).
   - 🔵 **Nice-to-have** — pulido (skeletons, densidad, microcopy).
5. **Entregar** informe por pantalla + backlog consolidado y priorizado.
   El informe **propone, no implementa**: cada ítem se ejecuta después con el modo BUILD.

**Fuera de alcance:** copiar la estética de checklist.design. El lenguaje visual del backoffice
es el de la marca Misiones y no se toca. Se importa UX funcional, no diseño gráfico.

## Índice bilingüe — pedido en español → checklist

| Pedido | Checklist(s) |
|---|---|
| tabla, listado, grilla | `design-system/table` |
| filtros, filtrar resultados | `flows/filtering-items` |
| formulario, alta, edición | `flows/submitting-a-form` + `design-system/input-field` |
| error de validación, campo inválido | `flows/showing-input-error` |
| guardar, confirmar cambios | `flows/saving-changes` |
| sin resultados, lista vacía | `web-app/empty-state` |
| buscador, búsqueda | `design-system/searchbar` + `web-app/search-results` |
| usuarios, roles, permisos | `web-app/user-management` |
| dashboard, panel, home | `web-app/admin-panel` + `web-app/analytics` |
| detalle de trámite/organismo | `web-app/single-item-detail` |
| notificaciones, avisos, toast | `design-system/toast` + `web-app/notifications` |
| eliminar, baja, borrar | `flows/deleting-account` (patrón de confirmación destructiva) |
| wizard, alta en pasos | `web-app/multi-step-form` |
| carga de archivos, adjuntos | `flows/uploading-media` |
| login, ingreso, acceso | `web-app/login` |
| configuración, preferencias | `web-app/settings` |
| perfil, mi cuenta | `web-app/account` |
| modal, diálogo, popup | `design-system/modal` |
| panel lateral, drawer | `design-system/drawer` |
| menú desplegable, select | `design-system/dropdown-menu` |
| pestañas, solapas | `design-system/tabs` |
| tarjeta, card, widget | `design-system/card` |
| botón, acción | `design-system/button` |
| chip, etiqueta, estado | `design-system/badge` |
| carga, spinner, esqueleto | `design-system/loading` + `design-system/skeleton` |
| fecha, calendario, rango | `design-system/date-picker` |
| tooltip, ayuda contextual | `design-system/tooltip` |
| aviso, banner, alerta | `design-system/banner` |
| accesibilidad, contraste, foco | `design-system/accessibility` |
| tokens, tema, colores, espaciados | `design-system/tokens` + `design-system/color-system` + `design-system/spacing-and-grid` |
| tipografía, jerarquía de texto | `design-system/typography` |
| onboarding, primeros pasos | `web-app/onboarding` |
| historial, versiones, auditoría | `web-app/version-history` |
| ayuda, soporte | `web-app/help-center` + `flows/contacting-support` |
| mantenimiento, caída | `web-app/maintenance` |
| 2FA, doble factor | `web-app/2-factor-authentication` |
| recuperar contraseña | `flows/resetting-password` |
| verificar cuenta, validar mail | `flows/verifying-account` |

Para lo que no esté en esta tabla, buscá el slug en el catálogo de abajo.

## Catálogo completo

<!-- BEGIN:CATALOGO-GENERADO -->
<!-- Se llena al correr scripts/sync.mjs -->
<!-- END:CATALOGO-GENERADO -->

## Mantenimiento

```bash
node .claude/skills/checklist-design/scripts/sync.mjs                       # las 112
node .claude/skills/checklist-design/scripts/sync.mjs --category flows      # una categoría
node .claude/skills/checklist-design/scripts/sync.mjs --category design-system --slug table
node --test .claude/skills/checklist-design/scripts/                        # tests
```

Fuente y contrato de la API: `BRIEF_CHECKLIST_DESIGN.md` en la raíz del repo.
````

- [ ] **Step 2: Verificar que los marcadores coinciden con `render.mjs`**

```bash
grep -n "CATALOGO-GENERADO" .claude/skills/checklist-design/SKILL.md .claude/skills/checklist-design/scripts/render.mjs
```

Esperado: `BEGIN` y `END` presentes en ambos archivos, con texto idéntico.

- [ ] **Step 3: Commit**

```bash
git add .claude/skills/checklist-design/SKILL.md
git commit -m "docs(skills): protocolo e indice bilingue de checklist-design"
```

---

### Task 4: `sync.mjs` — CLI y generación del corpus

**Files:**
- Create: `.claude/skills/checklist-design/scripts/sync.mjs`
- Modify: `.claude/skills/checklist-design/SKILL.md` (lo reescribe el script, no a mano)
- Create: `.claude/skills/checklist-design/references/**` (112 archivos generados)

**Interfaces:**
- Consumes: `fetchGrouped`, `fetchChecklist`, `sleep`, `ApiError` de `api.mjs`; `renderChecklist`, `renderIndexBlock`, `replaceIndexBlock` de `render.mjs`.
- Produces: el corpus en disco. Nada importa de `sync.mjs`.

- [ ] **Step 1: Escribir el CLI**

Crear `.claude/skills/checklist-design/scripts/sync.mjs`:

```js
#!/usr/bin/env node
// Regenera references/ y el catálogo de SKILL.md desde la API de checklist.design.
// Idempotente: dos corridas seguidas sin cambios upstream dejan git limpio.
//
//   node sync.mjs                                     todas
//   node sync.mjs --category flows                    una categoría
//   node sync.mjs --category design-system --slug table   una sola
//   node sync.mjs --dry-run                           no escribe, solo informa

import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { ApiError, fetchChecklist, fetchGrouped, sleep } from './api.mjs';
import { renderChecklist, renderIndexBlock, replaceIndexBlock } from './render.mjs';

const SCRIPT_DIR = dirname(fileURLToPath(import.meta.url));
const SKILL_DIR = join(SCRIPT_DIR, '..');
const REFERENCES_DIR = join(SKILL_DIR, 'references');
const SKILL_MD = join(SKILL_DIR, 'SKILL.md');
const PAUSA_MS = 120;

function parseArgs(argv) {
  const args = { category: null, slug: null, dryRun: false };
  for (let i = 0; i < argv.length; i += 1) {
    const flag = argv[i];
    if (flag === '--dry-run') {
      args.dryRun = true;
    } else if (flag === '--category' || flag === '--slug') {
      const valor = argv[++i];
      // Sin esta guarda, `--category` al final del comando dejaría el filtro en
      // undefined y sincronizaría las 112 en silencio.
      if (!valor || valor.startsWith('--')) throw new Error(`${flag} requiere un valor`);
      args[flag === '--category' ? 'category' : 'slug'] = valor;
    } else {
      throw new Error(`Flag desconocido: ${flag}`);
    }
  }
  if (args.slug && !args.category) {
    throw new Error('--slug requiere --category (9 slugs existen en más de una categoría)');
  }
  return args;
}

/** Fecha en formato YYYY-MM-DD, para el frontmatter `synced`. */
function hoy() {
  return new Date().toISOString().slice(0, 10);
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const syncedAt = hoy();

  console.log('→ Bajando el índice…');
  const grouped = await fetchGrouped();
  const total = grouped.reduce((n, c) => n + c.checklists.length, 0);
  console.log(`  ${grouped.length} categorías, ${total} checklists.`);

  // Aplanamos a la lista de trabajo, filtrando por los flags.
  const objetivos = [];
  for (const cat of grouped) {
    if (args.category && cat.slug !== args.category) continue;
    for (const entry of cat.checklists) {
      if (args.slug && entry.slug !== args.slug) continue;
      objetivos.push({ category: cat.slug, slug: entry.slug });
    }
  }
  if (objetivos.length === 0) {
    throw new Error(`Ningún checklist coincide con category=${args.category} slug=${args.slug}`);
  }

  console.log(`→ Sincronizando ${objetivos.length} checklist(s)…`);
  let escritos = 0;
  let vacios = 0;
  for (const [i, objetivo] of objetivos.entries()) {
    const payload = await fetchChecklist(objetivo.slug, objetivo.category);
    const puntos = payload.items.length || payload.tabs.length;
    if (puntos === 0) vacios += 1;

    const markdown = renderChecklist(payload, { category: objetivo.category, syncedAt });
    const destino = join(REFERENCES_DIR, objetivo.category, `${objetivo.slug}.md`);

    if (!args.dryRun) {
      await mkdir(dirname(destino), { recursive: true });
      await writeFile(destino, markdown, 'utf8');
    }
    escritos += 1;
    console.log(`  [${i + 1}/${objetivos.length}] ${objetivo.category}/${objetivo.slug} (${puntos} puntos)`);
    if (i < objetivos.length - 1) await sleep(PAUSA_MS);
  }

  // El catálogo de SKILL.md siempre refleja el índice completo, aunque se haya
  // sincronizado una sola categoría.
  if (!args.dryRun) {
    const skillMd = await readFile(SKILL_MD, 'utf8');
    await writeFile(SKILL_MD, replaceIndexBlock(skillMd, renderIndexBlock(grouped, syncedAt)), 'utf8');
  }

  console.log(`\n✓ ${escritos} archivo(s)${args.dryRun ? ' (dry-run, no se escribió nada)' : ''}.`);
  if (vacios > 0) console.log(`⚠ ${vacios} checklist(s) sin puntos publicados en la fuente.`);
}

main().catch((error) => {
  if (error instanceof ApiError) {
    console.error(`\n✗ Error de API (${error.status}) en ${error.url}\n  ${error.message}`);
  } else {
    console.error(`\n✗ ${error.message}`);
  }
  process.exitCode = 1;
});
```

- [ ] **Step 2: Probar en seco sobre una categoría chica**

```bash
node .claude/skills/checklist-design/scripts/sync.mjs --category flows --dry-run
```

Esperado: lista las 13 de `flows`, cada una con **>0 puntos** (vienen de `tabs`), y cierra con
`13 archivo(s) (dry-run, no se escribió nada)`. Sin archivos nuevos en `git status`.

- [ ] **Step 3: Correr la sincronización completa**

```bash
node .claude/skills/checklist-design/scripts/sync.mjs
```

Esperado: `5 categorías, 112 checklists`, las 112 líneas de progreso, `✓ 112 archivo(s)`,
sin advertencia de vacíos. Tarda ~30 s.

- [ ] **Step 4: Verificar el corpus generado**

```bash
find .claude/skills/checklist-design/references -name '*.md' | wc -l
grep -c '^- \[ \]' .claude/skills/checklist-design/references/design-system/table.md
grep -c '^[0-9]\+\. ' .claude/skills/checklist-design/references/flows/saving-changes.md
grep -c 'CATALOGO-GENERADO' .claude/skills/checklist-design/SKILL.md
grep -n '112 checklists' .claude/skills/checklist-design/SKILL.md
```

Esperado: `112` archivos · `8` puntos en `table.md` · `5` pasos numerados en `saving-changes.md` ·
`2` marcadores · el catálogo de `SKILL.md` diciendo `**112 checklists** en 5 categorías`.

- [ ] **Step 5: Verificar idempotencia**

```bash
git add -A .claude/skills/checklist-design
git commit -m "feat(skills): sync.mjs + corpus de 112 checklists de checklist.design"
node .claude/skills/checklist-design/scripts/sync.mjs
git status --porcelain .claude/skills/checklist-design
```

Esperado: la salida de `git status` es **vacía**. Si aparecen archivos modificados, la causa más
probable es el campo `synced` con otra fecha (solo si cruzaste la medianoche) o un orden inestable
en el render: investigar antes de seguir, no commitear el diff.

- [ ] **Step 6: Correr toda la suite de tests**

```bash
node --test .claude/skills/checklist-design/scripts/
```

Esperado: `pass 14`, `fail 0` (9 de `render.test.mjs` + 5 de `api.test.mjs`).

---

### Task 5: gate en el agente `front-design`

Tres ediciones quirúrgicas. **No se reescribe el agente**: el resto del archivo queda intacto.

**Files:**
- Modify: `.claude/agents/front-design.md` (sección `## Flujo`, líneas 25-29)

**Interfaces:**
- Consumes: la skill `checklist-design` de las tareas 1-4 (debe existir `SKILL.md` y `references/`).
- Produces: nada que otra tarea consuma.

- [ ] **Step 1: Reemplazar la sección `## Flujo`**

En `.claude/agents/front-design.md`, reemplazar el bloque que hoy dice:

```markdown
## Flujo
1. Mirá pantallas/estilos existentes para mantener consistencia (no partir de cero).
2. Implementá con tokens + BEM + componentes shared.
3. Verificá build (`cd backoffice && npx ng build`) y dejá la vista en archivos separados.
4. Si tocás lógica, respetá las capas; ante dudas de arquitectura, derivá a `arquitecto-capas`.
```

por:

```markdown
## Flujo
0. **Identificá los checklists aplicables** con la skill `checklist-design` (índice bilingüe en
   `.claude/skills/checklist-design/SKILL.md`) y leé los `references/` correspondientes **antes**
   de escribir código. Una pantalla suele necesitar varios (tabla + buscador + filtros + empty state).
   Si nada mapea, seguí sin checklist y decilo explícitamente.
1. Mirá pantallas/estilos existentes para mantener consistencia (no partir de cero).
2. Implementá con tokens + BEM + componentes shared.
3. Verificá build (`cd backoffice && npx ng build`) y dejá la vista en archivos separados.
4. Si tocás lógica, respetá las capas; ante dudas de arquitectura, derivá a `arquitecto-capas`.
5. **Cerrá con la tabla de cobertura** de los checklists del paso 0:

   | Ítem | Estado | Nota |
   |---|---|---|
   | Empty state | ✅ | `tramites-list.html:42` |
   | Loading skeleton | ⬜ | pendiente sugerido — fuera del pedido |
   | Dark mode | N/A | el backoffice no tiene tema oscuro |

   Sin esa tabla el trabajo no está terminado.

## Alcance
El checklist dice **qué considerar**, nunca **cómo implementarlo**: ante conflicto ganan
`.claude/rules/`, los tokens del tema y Material, en ese orden.

Un ítem del checklist **no autoriza** features fuera de lo que pidió el usuario. Lo no pedido va
a la tabla como ⬜ *pendiente sugerido* y **no se implementa**.
```

- [ ] **Step 2: Verificar que el resto del agente quedó intacto**

```bash
git diff --stat .claude/agents/front-design.md
grep -n 'RxJS, NUNCA signals' .claude/agents/front-design.md
grep -n 'checklist-design' .claude/agents/front-design.md
```

Esperado: un solo archivo tocado; las reglas técnicas siguen presentes; aparece la referencia a la skill.

- [ ] **Step 3: Commit**

```bash
git add .claude/agents/front-design.md
git commit -m "feat(agents): gate de checklist-design en front-design"
```

---

### Task 6: validación end-to-end

Verifica que la skill funciona de punta a punta sobre una pantalla real del backoffice, en los dos modos.

**Files:**
- Ninguno que se modifique. Se produce evidencia, no código.

**Interfaces:**
- Consumes: todo lo anterior.
- Produces: la confirmación de que el criterio de terminado del brief se cumple.

- [ ] **Step 1: Elegir la pantalla de prueba**

```bash
ls backoffice/src/app/pages/tramites/
```

Usar el listado de trámites. Si no existe esa carpeta, usar `organismos/` o `usuarios/`.

- [ ] **Step 2: Probar el modo AUDIT**

Despachar el agente `front-design` con este pedido literal:

> Audit mode: auditá la pantalla de listado de trámites contra los checklists aplicables de la
> skill `checklist-design`. No implementes nada — entregá el informe de gaps clasificado
> 🔴/🟡/🔵, con cada hallazgo anclado a `archivo:línea`.

**Criterios de aceptación** (los tres, o la tarea no está lista):
1. Resolvió al menos `design-system/table` y `web-app/empty-state` vía el índice bilingüe.
2. Cada gap cita un `archivo:línea` real y verificable del backoffice.
3. **No modificó ningún archivo** — confirmar con `git status --porcelain`.

- [ ] **Step 3: Probar el modo BUILD**

Tomar el gap 🟡 más chico del informe anterior y despachar `front-design` para implementarlo.

**Criterios de aceptación:**
1. Emitió la tabla de cobertura ✅/⬜/N/A.
2. Usó tokens `var(--theme-*)` y BEM anidado — sin valores hardcodeados.
3. `cd backoffice && npx ng build` cierra limpio.
4. **No implementó ítems del checklist fuera del pedido**: los extra figuran como ⬜ *pendiente sugerido*.

- [ ] **Step 4: Registrar el resultado y commitear si hubo cambios**

Si el paso 3 produjo código válido:

```bash
cd backoffice && npx ng build
cd .. && git add -A backoffice
git commit -m "fix(backoffice): <gap implementado> (via checklist-design)"
```

Si algún criterio falló, **no commitear**: corregir `SKILL.md` o `front-design.md` y repetir.

---

## Criterio de terminado (del brief §8)

- [ ] `references/` con 112 archivos generados por `sync.mjs`
- [ ] `SKILL.md` con protocolo (modos BUILD y AUDIT) + índice bilingüe + catálogo generado
- [ ] `sync.mjs` idempotente (segunda corrida = `git status` vacío)
- [ ] `front-design.md` con paso 0, gate final y regla anti-scope-creep
- [ ] `node --test .claude/skills/checklist-design/scripts/` en verde (13 tests)
- [ ] Prueba end-to-end en los dos modos sobre una pantalla real
