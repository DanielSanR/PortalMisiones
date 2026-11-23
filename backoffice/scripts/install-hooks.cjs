/**
 * Activa los git hooks versionados del backoffice (`backoffice/.githooks`) seteando `core.hooksPath` en el
 * clon LOCAL (no toca la config global).
 *
 *   npm run hooks:install          (o automático vía `prepare` en `npm install` / `npm ci`)
 *
 * Tolerante por diseño — nunca rompe una instalación: no hace nada si no hay git, si no es un repo
 * (p. ej. `npm ci` dentro del Dockerfile), en CI, o si ya hay OTRO `core.hooksPath` configurado
 * (p. ej. husky del portal): en ese caso avisa y no lo pisa.
 *
 * Desactivar:  git config --unset core.hooksPath
 */
const path = require('node:path');
const fs = require('node:fs');
const { execFileSync } = require('node:child_process');

function instalar() {
  if (process.env.CI) return;
  const git = (args, cwd) => execFileSync('git', args, { cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim();

  let raiz;
  try {
    raiz = git(['rev-parse', '--show-toplevel'], __dirname);
  } catch {
    return; // sin git o fuera de un repo
  }
  const hooksDir = path.resolve(__dirname, '..', '.githooks');
  if (!fs.existsSync(hooksDir)) return;
  const destino = path.relative(path.resolve(raiz), hooksDir).split(path.sep).join('/'); // backoffice/.githooks

  let actual = '';
  try { actual = git(['config', '--local', '--get', 'core.hooksPath'], raiz); } catch { /* sin configurar */ }
  if (actual === destino) return;
  if (actual) {
    console.warn(`[hooks] core.hooksPath ya apunta a "${actual}"; no se pisa. Para usar los del backoffice: git config core.hooksPath ${destino}`);
    return;
  }
  git(['config', '--local', 'core.hooksPath', destino], raiz);
  console.log(`[hooks] git hooks activados: core.hooksPath = ${destino} (pre-commit y pre-push del backoffice).`);
}

try {
  instalar();
} catch (e) {
  console.warn(`[hooks] no se pudieron activar los git hooks (se sigue): ${e.message}`);
}
