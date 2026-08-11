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
