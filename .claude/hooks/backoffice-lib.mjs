/**
 * Utilidades compartidas por los hooks del backoffice (Node puro: sin jq, sin bash; anda igual en
 * Git Bash de Windows, PowerShell y Linux).
 *
 * Estado de los hooks (huellas, contadores, debounce): fuera del repo, en
 * `<tmp>/claude-backoffice-hooks/<hash del proyecto>/`.
 */
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';
import { execFileSync, spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

export const PROJECT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
export const BACKOFFICE = path.join(PROJECT, 'backoffice');
export const posix = (p) => p.split('\\').join('/');

const sha1 = (s) => crypto.createHash('sha1').update(s).digest('hex');

export const STATE = path.join(os.tmpdir(), 'claude-backoffice-hooks', sha1(PROJECT.toLowerCase()).slice(0, 12));
export const estado = {
  ruta: (nombre) => path.join(STATE, nombre),
  leer: (nombre) => { try { return fs.readFileSync(path.join(STATE, nombre), 'utf8'); } catch { return null; } },
  escribir: (nombre, valor) => { fs.mkdirSync(STATE, { recursive: true }); fs.writeFileSync(path.join(STATE, nombre), String(valor)); },
  borrar: (nombre) => { try { fs.rmSync(path.join(STATE, nombre)); } catch { /* no existía */ } },
};

/** JSON del evento (stdin). Nunca lanza: ante entrada vacía o inválida devuelve {}. */
export function leerEvento() {
  try {
    const raw = fs.readFileSync(0, 'utf8');
    return raw.trim() ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

/** Id de sesión apto para nombre de archivo. */
export const idSesion = (ev) => String(ev.session_id ?? 'sin-sesion').replace(/[^\w-]/g, '_').slice(0, 64);

/**
 * Archivo editado por Edit/Write/MultiEdit, si está bajo backoffice/src. Devuelve
 * `{ abs, rel }` (rel = relativa a backoffice/, con `/`) o null. Tolera `\`, `/` y rutas /d/… de Git Bash.
 */
export function archivoEditado(ev) {
  let f = ev?.tool_input?.file_path ?? ev?.tool_response?.filePath ?? '';
  if (!f || typeof f !== 'string') return null;
  const m = /^\/([a-zA-Z])\/(.*)$/.exec(f); // /d/proyectos/… → D:/proyectos/…
  if (m && process.platform === 'win32') f = `${m[1].toUpperCase()}:/${m[2]}`;
  const abs = path.resolve(ev.cwd && !path.isAbsolute(f) ? path.join(ev.cwd, f) : f);
  const rel = posix(path.relative(BACKOFFICE, abs));
  if (rel.startsWith('..') || path.isAbsolute(rel) || !rel.startsWith('src/')) return null;
  return { abs, rel };
}

export const hayNodeModules = () => fs.existsSync(path.join(BACKOFFICE, 'node_modules'));

const git = (args) => execFileSync('git', args, { cwd: PROJECT, encoding: 'utf8', maxBuffer: 256 * 1024 * 1024, stdio: ['ignore', 'pipe', 'ignore'] });

/**
 * Huella del estado de backoffice/: commit (tree de HEAD:backoffice) + diff contra HEAD (staged y sin
 * stagear) + archivos sin trackear con su contenido. Cambia si se edita, crea, borra o commitea algo.
 * Devuelve null si no hay git.
 */
export function huella() {
  try {
    const h = crypto.createHash('sha1');
    let tree = '';
    try { tree = git(['rev-parse', 'HEAD:backoffice']).trim(); } catch { /* repo sin commits */ }
    h.update(`tree:${tree}\n`);
    h.update(git(['diff', 'HEAD', '--no-ext-diff', '--', 'backoffice']));
    const sueltos = git(['ls-files', '--others', '--exclude-standard', '-z', '--', 'backoffice']).split('\0').filter(Boolean).sort();
    for (const f of sueltos) {
      h.update(`\nuntracked:${f}:`);
      try {
        const abs = path.join(PROJECT, f);
        const st = fs.statSync(abs);
        if (st.size > 5 * 1024 * 1024) h.update(`${st.size}:${st.mtimeMs}`);
        else h.update(fs.readFileSync(abs));
      } catch { /* desapareció entre el listado y la lectura */ }
    }
    return h.digest('hex');
  } catch {
    return null;
  }
}

/** ¿Hay algo sin commitear en backoffice/? (fallback cuando no hay huella base de la sesión). */
export function backofficeSucio() {
  try { return git(['status', '--porcelain', '--', 'backoffice']).trim() !== ''; } catch { return false; }
}

/** Corre `npm run <script>` en backoffice/. Devuelve { ok, salida } con stdout+stderr sin colores. */
export function npmRun(script, { timeoutMs = 540_000 } = {}) {
  const r = spawnSync(`npm run --silent ${script}`, {
    cwd: BACKOFFICE,
    shell: true,
    encoding: 'utf8',
    timeout: timeoutMs,
    maxBuffer: 64 * 1024 * 1024,
    env: { ...process.env, FORCE_COLOR: '0', NO_COLOR: '1', NG_CLI_ANALYTICS: 'false' },
  });
  // eslint-disable-next-line no-control-regex
  const limpio = `${r.stdout ?? ''}\n${r.stderr ?? ''}`.replace(/\u001b\[[0-9;]*[A-Za-z]/g, '').replace(/\r/g, '');
  const vencido = r.error?.code === 'ETIMEDOUT' || r.signal === 'SIGTERM';
  return { ok: r.status === 0, salida: vencido ? `${limpio}\n[timeout a los ${Math.round(timeoutMs / 1000)} s]` : limpio };
}

/** Últimas `n` líneas no vacías. */
export const cola = (texto, n) => texto.split('\n').filter((l) => l.trim() !== '').slice(-n).join('\n');

/**
 * Escribe y termina. Usa escritura SÍNCRONA sobre el descriptor: `process.stderr.write` seguido de
 * `process.exit` puede truncar la salida cuando stdout/stderr son pipes (así los abre Claude Code).
 */
export function salir(codigo, { stderr, stdout } = {}) {
  const escribir = (fd, texto) => {
    if (!texto) return;
    try { fs.writeSync(fd, texto.endsWith('\n') ? texto : `${texto}\n`); } catch { /* pipe cerrado */ }
  };
  escribir(1, stdout);
  escribir(2, stderr);
  process.exit(codigo);
}
