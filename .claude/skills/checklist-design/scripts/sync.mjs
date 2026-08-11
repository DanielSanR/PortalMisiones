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

// Estado de progreso visible fuera de `main()`: si la corrida se corta a mitad de
// camino, el catch de abajo necesita saber cuánto se alcanzó a escribir para no dejar
// que el corpus parcial en disco pase desapercibido.
const progreso = { escritos: 0, total: 0, dryRun: false };

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
  progreso.total = objetivos.length;
  progreso.dryRun = args.dryRun;
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
    progreso.escritos = escritos;
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
  // Si la corrida se cortó a mitad de camino, el corpus en disco quedó parcialmente
  // actualizado (algunas categorías nuevas, otras viejas): avisarlo fuerte acá, no
  // dejar que se infiera scrolleando el log de progreso.
  const huboEscritura = !progreso.dryRun && progreso.total > 0 && progreso.escritos < progreso.total;
  const aviso = huboEscritura
    ? `\n  ⚠ Corpus PARCIAL: se escribieron ${progreso.escritos}/${progreso.total} archivo(s) antes de la falla. No commitear sin volver a correr sync.mjs hasta el final.`
    : '';
  if (error instanceof ApiError) {
    console.error(`\n✗ Error de API (${error.status}) en ${error.url}\n  ${error.message}${aviso}`);
  } else {
    console.error(`\n✗ ${error.message}${aviso}`);
  }
  process.exitCode = 1;
});
