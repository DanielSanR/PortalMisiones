#!/usr/bin/env node
/**
 * Verifica que los MockDataSource excluidos del build de producción (angular.json → configuración
 * `production` → `fileReplacements` hacia `core/mocks/excluded-mock.datasource.ts`) correspondan a
 * features que en `environment.prod.ts` resuelven a HTTP. Si alguno resuelve a `'mock'`, en prod se
 * instanciaría el stub (que lanza) → exit 1.
 *
 *   npm run check:prod-mocks
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const STUB = 'src/app/core/mocks/excluded-mock.datasource.ts';

const sinComentarios = (src) => src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');

const angular = JSON.parse(fs.readFileSync(path.join(ROOT, 'angular.json'), 'utf8'));
const prod = angular.projects.backoffice.architect.build.configurations.production;
const excluidos = (prod.fileReplacements ?? []).filter((r) => r.with === STUB).map((r) => r.replace);

const envSrc = sinComentarios(fs.readFileSync(path.join(ROOT, 'src/environments/environment.prod.ts'), 'utf8'));
const defaultKind = envSrc.match(/dataSource\s*:\s*'(mock|local|prod)'/)?.[1] ?? 'local';
const overridesBody = envSrc.match(/featureOverrides\s*:\s*\{([\s\S]*?)\}/)?.[1] ?? '';
const overrides = Object.fromEntries(
  [...overridesBody.matchAll(/(['"]?)([\w-]+)\1\s*:\s*'(mock|local|prod)'/g)].map((m) => [m[2], m[3]]),
);

const errores = [];
const authStub = (prod.fileReplacements ?? []).some((r) => r.with.endsWith('mock-auth-init.prod.ts'));
if (authStub && defaultKind === 'mock') {
  errores.push("src/app/core/mocks/mock-auth-init.ts: environment.prod.ts tiene dataSource 'mock' (main.ts siembra la sesión mock)");
}
for (const archivo of excluidos) {
  const dir = path.dirname(path.dirname(path.join(ROOT, archivo))); // core/features/<x>
  const providers = fs.readdirSync(dir).find((f) => f.endsWith('.providers.ts'));
  const src = providers ? fs.readFileSync(path.join(dir, providers), 'utf8') : '';
  const feature = src.match(/provideDataSource\(\s*\w+\s*,\s*'([\w-]+)'/)?.[1];
  if (!feature) {
    errores.push(`${archivo}: no se encontró provideDataSource(…, '<feature>', …) en ${dir}`);
    continue;
  }
  const kind = overrides[feature] ?? defaultKind;
  if (kind === 'mock') errores.push(`${archivo}: el feature '${feature}' resuelve a 'mock' en environment.prod.ts`);
}

if (errores.length) {
  console.error('[prod-mocks] Mocks excluidos del build de producción que prod SÍ necesita:');
  for (const e of errores) console.error(`  - ${e}`);
  console.error('  → quitá esas entradas de fileReplacements (angular.json, configuración production).');
  process.exit(1);
}
console.log(`[prod-mocks] OK: ${excluidos.length} MockDataSource excluidos de prod, todos con fuente HTTP.`);
