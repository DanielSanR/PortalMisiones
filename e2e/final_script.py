"""E2E del backoffice (Angular) vía el dev server en :4200, contra staging (default) o contra el backend LOCAL.

Uso (desde la raíz del repo):
    # staging (default): `npm run start:staging` corriendo en backoffice/
    py -3.12 e2e/final_script.py
    # local: backend Docker (rama dev) en :8080 + `npm run start:local` en backoffice/
    E2E_TARGET=local py -3.12 e2e/final_script.py

E2E_TARGET=local cambia los CPs de Trámites/Etiquetas: en local esas pantallas van contra la API REAL
(etiquetas, plantillas, adopciones, fichas y puntos de atención: CP13–CP18) en vez de los mocks de staging
(CP10/CP11). Las expectativas de gating salen de `GET /api/auth/me` de cada usuario, no de supuestos.
Cada request a /api/ queda registrada (método, ruta, status); las respuestas inesperadas del backend (5xx,
4xx sin `code`, campos faltantes) se listan como HALLAZGOS DE BACKEND al final del log.

Cada ejecución crea `e2e/final_runs/run_<n>/` con una copia de este script, `screenshots/` y
`final_script_log.txt`. Staging es COMPARTIDO: todo dato creado lleva el prefijo `E2E-<timestamp>` y se
borra al final (UI y, si algo falló a mitad, por API con el token del SA). Ver e2e/README.md y e2e/plan.md.

Organismos y Tipos de organismo solo tienen baja lógica (soft-delete): para no acumular un registro inactivo por
corrida, el ABM de esos dos recursos NO crea nada. Reutiliza un registro fijo (`E2E-fijo Organismo…` / `E2E-fijo
Tipo…`): lo reactiva y renombra desde el form de edición, y al final lo vuelve a dar de baja. Si todavía no existe,
adopta el residuo `E2E-*` inactivo más reciente; solo si no hay ninguno lo crea (una única vez en la vida de staging).
Al final del log se compara el conteo de residuos `E2E` inactivos antes y después de la corrida.
"""
import asyncio
import json
import os
import re
import shutil
import subprocess
import sys
import time
import traceback
import unicodedata
import urllib.error
import urllib.request
from pathlib import Path

from playwright.async_api import async_playwright, expect

def _cargar_env_local() -> None:
    """Carga `e2e/.env` (KEY=valor por línea) si existe. No pisa variables ya definidas en el entorno.
    El archivo está ignorado por git (`.env.*` / `.env` en el .gitignore del repo): ver `e2e/.env.example`."""
    archivo = Path(__file__).resolve().parent / ".env"
    if not archivo.exists():
        return
    for linea in archivo.read_text(encoding="utf-8").splitlines():
        linea = linea.strip()
        if not linea or linea.startswith("#") or "=" not in linea:
            continue
        clave, valor = linea.split("=", 1)
        os.environ.setdefault(clave.strip(), valor.strip())


def _requerida(nombre: str) -> str:
    valor = os.environ.get(nombre, "").strip()
    if not valor:
        sys.exit(f"Falta la variable {nombre}. Definila en el entorno o en e2e/.env (ver e2e/.env.example).")
    return valor


_cargar_env_local()
BASE = os.environ.get("E2E_BASE_URL", "http://localhost:4200")
# Credenciales de los usuarios de prueba de staging: NUNCA en el código (ver e2e/.env.example).
PASSWORD = _requerida("E2E_PASSWORD")
SA = _requerida("E2E_SA_EMAIL")
AB = _requerida("E2E_AB_EMAIL")
AO = _requerida("E2E_AO_EMAIL")
TS = str(int(time.time()))
PFX = f"E2E-{TS}"
ACR = f"E2E{TS[-6:]}"
VIEWPORT = {"width": 1280, "height": 1800}
# Registros fijos y reutilizables de los recursos con baja lógica (ver docstring). El sufijo r<TS> solo marca la
# última corrida que los editó; se buscan por prefijo.
FIXED_ORG = "E2E-fijo Organismo"
FIXED_ORG_ACR = "E2EFIJO"
FIXED_TIPO = "E2E-fijo Tipo"
# Permisos que staging no otorga a nadie (bug R-3 / sin grants de tags) y que solo se inyectan en el
# contexto "SA+inyectado" para poder ejercitar pantallas MOCK (Etiquetas, puntos de atención).
INJECTED = ["READ_TAG", "CREATE_TAG", "UPDATE_TAG", "DELETE_TAG",
            "READ_ATTENTION_POINT", "CREATE_ATTENTION_POINT", "UPDATE_ATTENTION_POINT", "DELETE_ATTENTION_POINT"]
FONT_NOISE = "downloadable font"  # Firefox: aborto de descarga de Phosphor.woff2 al navegar (no es error de la app)
# Destino: 'staging' (default, no rompe lo existente) o 'local' (backend Docker con trámites/etiquetas en real).
TARGET = os.environ.get("E2E_TARGET", "staging").strip().lower()
if TARGET not in ("staging", "local"):
    sys.exit(f"E2E_TARGET inválido: {TARGET!r} (usar 'local' o 'staging')")
LOCAL = TARGET == "local"
# Solo local: si `POST /api/organism-procedure` falla (bug de backend), se siembra UNA adopción por SQL en la base
# local descartable para poder seguir con fichas y puntos de atención. Desactivable con E2E_SEED_SQL=0.
SEED_SQL = LOCAL and os.environ.get("E2E_SEED_SQL", "1") != "0"
PG_CONTAINER = os.environ.get("E2E_PG_CONTAINER", "portal-tramite-postgres-1")
PG_USER = os.environ.get("E2E_PG_USER", "portal")
PG_DB = os.environ.get("E2E_PG_DB", "portal_tramite")
# Categoría fija (local) para las plantillas: una categoría referenciada por una plantilla no se puede borrar
# (el backend responde 500 por la FK, ver hallazgos), así que se reutiliza en vez de crear una por corrida.
FIXED_CAT = "E2E-fijo Cat plantilla"
FIXED_CAT_SLUG = "e2e-fijo-cat-plantilla"

# ── Carpeta de la corrida ────────────────────────────────────────────────────────────────────────
HERE = Path(__file__).resolve().parent
if HERE.name.startswith("run_"):
    RUN_DIR = HERE
else:
    runs = HERE / "final_runs"
    runs.mkdir(exist_ok=True)
    n = max([int(p.name[4:]) for p in runs.glob("run_*") if p.name[4:].isdigit()] + [0]) + 1
    RUN_DIR = runs / f"run_{n}"
    RUN_DIR.mkdir()
    shutil.copy2(__file__, RUN_DIR / "final_script.py")
SHOTS = RUN_DIR / "screenshots"
SHOTS.mkdir(parents=True, exist_ok=True)
LOG = RUN_DIR / "final_script_log.txt"
LOG.write_text("", encoding="utf-8")

STEP = 0
RESULTS: dict[str, tuple[str, str]] = {}
CONSOLE: list[str] = []
NOISE: list[str] = []
SECTION = ["init"]
CREATED_USER_IDS: list[str] = []
# Registro de red: cada respuesta a /api/ (método, ruta, status, body resumido si no es GET o si es >=400).
NET: list[dict] = []
BACKEND_FINDINGS: list[str] = []
FRONT_FINDINGS: list[str] = []
# Ids creados en ESTA corrida contra la API real (local), para la limpieza final.
CREATED: dict[str, list[str]] = {"tag": [], "procedure-template": [], "organism-procedure": [],
                                 "organism-procedure-location": [], "attention-point": []}
# Permisos y roles reales de cada usuario (GET /api/auth/me), base de las expectativas de gating.
PERMS: dict[str, set] = {}
ROLES: dict[str, set] = {}
UUID_RE = re.compile(r"[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}")


def log(msg: str) -> int:
    global STEP
    STEP += 1
    line = f"step {STEP} action: {msg}\n"
    with LOG.open("a", encoding="utf-8") as f:
        f.write(line)
    print(line, end="", flush=True)
    return STEP


def note(msg: str) -> None:
    with LOG.open("a", encoding="utf-8") as f:
        f.write(msg + "\n")
    print(msg, flush=True)


async def shot(page, action: str) -> str:
    name = f"final_execution_{STEP}_{action}.png"
    await page.screenshot(path=str(SHOTS / name))
    return name


def result(cp: str, status: str, evidence: str) -> None:
    RESULTS[cp] = (status, evidence)
    note(f"RESULT {cp}: {status} — {evidence}")


def check(cond: bool, msg: str) -> None:
    if not cond:
        raise AssertionError(msg)


def backend_finding(desc: str, method: str = "", path: str = "", status=None, body: str = "") -> None:
    """Respuesta inesperada del backend: NO es falla del front. Insumo para el pedido a backend."""
    path = UUID_RE.sub("{id}", path or "").split("?")[0]
    line = f"{desc} | {method} {path} -> {status} | body: {(body or '')[:300]}"
    key = f"| {method} {path} -> {status} |"
    for i, prev in enumerate(BACKEND_FINDINGS):
        if key in prev:  # misma request/status: se queda la descripción más específica
            if prev.startswith("respuesta inesperada") and not desc.startswith("respuesta inesperada"):
                BACKEND_FINDINGS[i] = line
            return
    BACKEND_FINDINGS.append(line)
    note(f"  HALLAZGO BACKEND: {line}")


def front_finding(desc: str) -> None:
    if desc not in FRONT_FINDINGS:
        FRONT_FINDINGS.append(desc)
        note(f"  HALLAZGO FRONT: {desc}")


def canon_slug(texto: str) -> str:
    """Espejo de `canonicalizarSlug` (core/utils/slug.utils.ts) y de la canonicalización del backend."""
    t = unicodedata.normalize("NFD", texto or "")
    t = "".join(c for c in t if not unicodedata.combining(c)).lower()
    return re.sub(r"(^-+)|(-+$)", "", re.sub(r"[^a-z0-9]+", "-", t))


def net_since(i: int, method: str = None, contains: str = "") -> list[dict]:
    return [n for n in NET[i:] if (method is None or n["m"] == method) and contains in n["path"]]


def body_code(body: str):
    try:
        return json.loads(body).get("code")
    except Exception:
        return None


def check_response(desc: str, m: str, path: str, status: int, body: str, ok_status=(200, 201)) -> bool:
    """Si el status no es el esperado, lo anota como hallazgo de backend (5xx o 4xx sin `code`) o lo deja
    para el CP. Devuelve True si fue el esperado."""
    if status in ok_status:
        return True
    if status >= 500 or (status >= 400 and body_code(body) is None):
        backend_finding(desc, m, path, status, body)
    return False


# ── Permisos reales (/me) y reglas de acceso de la app (espejo de role-mapping/policy-overrides) ─────────
SA_R, SA_AB_R, SA_AB_AO_R = {"SUPERADMIN"}, {"SUPERADMIN", "ADMIN_BACKOFFICE"}, {"SUPERADMIN", "ADMIN_BACKOFFICE", "ADMIN_ORGANIZATION"}
NAV_RULES = [
    ("Inicio", None),
    ("Organismos", {"p": ["READ_ORGANISM"]}),
    ("Tipos de Organismo", {"p": ["READ_ORGANISM_TYPE"]}),
    ("Categorías", {"p": ["CREATE_CATEGORY", "UPDATE_CATEGORY", "DELETE_CATEGORY"]}),
    ("Etiquetas", {"p": ["READ_TAG"]}),
    ("Modalidades", {"p": ["CREATE_MODALITY", "UPDATE_MODALITY", "DELETE_MODALITY"]}),
    ("Eventos de Vida", {"p": ["CREATE_LIFE_EVENT", "UPDATE_LIFE_EVENT", "DELETE_LIFE_EVENT"]}),
    ("Destinatarios", {"p": ["CREATE_RECIPIENT", "UPDATE_RECIPIENT", "DELETE_RECIPIENT"]}),
    ("Plantillas provinciales", {"p": ["READ_PROCEDURE"]}),
    ("Trámites del organismo", {"p": ["READ_ADOPTION"]}),
    ("Fichas por localidad", {"p": ["READ_VARIANT"]}),
    ("Usuarios", {"p": ["READ_USER"]}),
    ("Roles", {"r": SA_AB_R}),
    ("Permisos", {"r": SA_AB_R}),
    ("Auditoría", {"r": SA_R}),
    ("Feedback Ciudadano", {"r": SA_AB_AO_R}),
]
CREAR_ETIQUETA_RULE = {"p": ["CREATE_TAG"], "anyOf": [{"p": ["READ_ORGANISM"]}, {"r": SA_AB_R}]}
ADOPTAR_RULE = {"p": ["CREATE_ADOPTION", "READ_PROCEDURE", "READ_ORGANISM"], "all": True}
ROUTE_RULES = [
    ("/dashboard/organismos/lista", {"p": ["READ_ORGANISM"]}),
    ("/dashboard/tipos-organismo/lista", {"p": ["READ_ORGANISM_TYPE"]}),
    ("/dashboard/categorias/lista", {"p": ["CREATE_CATEGORY", "UPDATE_CATEGORY", "DELETE_CATEGORY"]}),
    ("/dashboard/etiquetas/lista", {"p": ["READ_TAG"]}),
    ("/dashboard/etiquetas/nuevo", CREAR_ETIQUETA_RULE),
    ("/dashboard/tramites/plantillas", {"p": ["READ_PROCEDURE"]}),
    ("/dashboard/tramites/plantillas/nueva", {"p": ["CREATE_PROCEDURE"]}),
    ("/dashboard/tramites/adopciones", {"p": ["READ_ADOPTION"]}),
    ("/dashboard/tramites/fichas", {"p": ["READ_VARIANT"]}),
    ("/dashboard/usuarios/nuevo", {"p": ["CREATE_USER"]}),
    ("/dashboard/roles/lista", {"r": SA_AB_R}),
    ("/dashboard/roles/nuevo", {"r": SA_R}),
    ("/dashboard/permisos/nuevo", {"r": SA_R}),
    ("/dashboard/auditoria", {"r": SA_R}),
]


def load_me(who: str, email: str) -> None:
    _, b = api("POST", "/api/auth/login", {"email": email, "password": PASSWORD})
    token = json.loads(b)["data"]["accessToken"]
    _, b = api("GET", "/api/auth/me", token=token)
    d = json.loads(b)["data"]
    roles = {r.replace("ROLE_", "") for r in (d.get("roles") or [])}
    perms = set(d.get("permissions") or [])
    # Prerrequisito de la UI (PERMISSION_PREREQUISITES): CREATE_USER solo con READ_ORGANISM y rol admin.
    if "CREATE_USER" in perms and not ("READ_ORGANISM" in perms and roles & SA_AB_AO_R):
        perms.discard("CREATE_USER")
    PERMS[who], ROLES[who] = perms, roles


def allowed(who: str, rule) -> bool:
    if rule is None:
        return True
    perms, roles = PERMS[who], ROLES[who]
    ok = True
    if "p" in rule:
        ok = (all if rule.get("all") else any)(p in perms for p in rule["p"])
    if ok and "r" in rule:
        ok = bool(roles & rule["r"])
    if ok and "anyOf" in rule:
        ok = any(allowed(who, sub) for sub in rule["anyOf"])
    return ok


def expected_menu(who: str) -> list[str]:
    return [label for label, rule in NAV_RULES if allowed(who, rule)]


# ── API (limpieza / verificación) ────────────────────────────────────────────────────────────────
def api(method: str, path: str, body=None, token=None):
    headers = {"Content-Type": "application/json"}
    if token:
        headers["Authorization"] = "Bearer " + token
    req = urllib.request.Request(BASE + path, data=json.dumps(body).encode() if body is not None else None,
                                 headers=headers, method=method)
    try:
        with urllib.request.urlopen(req, timeout=30) as r:
            return r.status, r.read().decode("utf-8", "replace")
    except urllib.error.HTTPError as e:
        return e.code, e.read().decode("utf-8", "replace")


def sa_token() -> str:
    _, b = api("POST", "/api/auth/login", {"email": SA, "password": PASSWORD})
    return json.loads(b)["data"]["accessToken"]


RESOURCES = ["organism", "organism-type", "category", "modality", "life-event", "recipient", "role", "permission"]
if LOCAL:
    # En local también se crean etiquetas y plantillas reales (las adopciones/fichas/puntos se limpian por id).
    RESOURCES += ["tag", "procedure-template"]


def is_fixed_cat(i: dict) -> bool:
    """La categoría fija de las plantillas (local) queda activa a propósito: no cuenta como residuo."""
    return (i.get("name") or "") == FIXED_CAT


def e2e_items(token: str, res: str, only_this_run: bool):
    _, b = api("GET", f"/api/{res}", token=token)
    items = json.loads(b).get("data") or []
    tag = PFX if only_this_run else "E2E"
    out = []
    for i in items:
        vals = [v for k, v in i.items() if isinstance(v, str) and k not in ("id",)]
        if any(tag.upper() in v.upper() for v in vals) or (not only_this_run and any(ACR in v for v in vals)):
            out.append(i)
    return out


def fixed_target(res: str, prefix: str):
    """Registro reutilizable para un recurso con baja lógica: (item|None, origen).
    origen = 'fijo' (ya existe uno con el prefijo fijo), 'adoptado' (residuo E2E-* inactivo de corridas viejas que se
    convierte en el fijo al renombrarlo) o 'nuevo' (no hay nada: se crea una única vez)."""
    _, b = api("GET", f"/api/{res}", token=sa_token())
    items = json.loads(b).get("data") or []
    fixed = [i for i in items if (i.get("name") or "").startswith(prefix)]
    if fixed:
        if len(fixed) > 1:
            note(f"  (hay {len(fixed)} registros '{prefix}*' en /api/{res}; se usa el primero: {fixed[0]['id']})")
        return fixed[0], "fijo"
    leftovers = [i for i in items if (i.get("name") or "").upper().startswith("E2E-") and i.get("active") is False]
    if leftovers:
        leftovers.sort(key=lambda i: i.get("updatedAt") or "")
        return leftovers[-1], "adoptado"
    return None, "nuevo"


RESIDUE_RESOURCES = list(RESOURCES)


def residue_snapshot() -> dict:
    """{recurso: (activos E2E, inactivos E2E)} sobre TODO el entorno (cualquier corrida)."""
    token = sa_token()
    out = {}
    for res in RESIDUE_RESOURCES:
        items = [i for i in e2e_items(token, res, only_this_run=False) if not is_fixed_cat(i)]
        out[res] = (sum(1 for i in items if i.get("active", True) is not False),
                    sum(1 for i in items if i.get("active", True) is False))
    return out


def api_cleanup_and_verify() -> None:
    token = sa_token()
    note("\n== Limpieza por API (solo datos de ESTA corrida, prefijo %s / sigla %s) ==" % (PFX, ACR))
    for res in RESOURCES:
        for i in e2e_items(token, res, only_this_run=True):
            if res in ("organism", "organism-type") and i.get("active") is False:
                continue  # ya dado de baja (soft-delete): el backend no tiene borrado físico
            s, b = api("DELETE", f"/api/{res}/{i['id']}", token=token)
            note(f"  API DELETE /api/{res}/{i['id']} ({i.get('name') or i.get('code')}) -> {s}")
    # Los registros fijos tienen que terminar dados de baja (si la UI se cortó a mitad, quedaron activos).
    for res, prefix in (("organism", FIXED_ORG), ("organism-type", FIXED_TIPO)):
        _, b = api("GET", f"/api/{res}", token=token)
        for i in json.loads(b).get("data") or []:
            if (i.get("name") or "").startswith(prefix) and i.get("active") is not False:
                s, _ = api("DELETE", f"/api/{res}/{i['id']}", token=token)
                note(f"  API DELETE /api/{res}/{i['id']} (registro fijo '{i.get('name')}' quedó activo) -> {s}")
    # Local: lo creado por id contra la API real de trámites. Solo hay baja lógica (DELETE desactiva), salvo
    # etiquetas, que se borran de verdad. Orden: de las hojas a la raíz.
    for res in ("attention-point", "organism-procedure-location", "organism-procedure", "procedure-template", "tag"):
        for iid in CREATED.get(res, []):
            s, b = api("GET", f"/api/{res}/{iid}", token=token)
            if s == 404:
                note(f"  CLEANUP {res}/{iid}: ya no existe (404)")
                continue
            d = (json.loads(b).get("data") or {}) if s == 200 else {}
            alive = d.get("active", d.get("enabled", True))
            if alive is not False:
                s2, b2 = api("DELETE", f"/api/{res}/{iid}", token=token)
                note(f"  API DELETE /api/{res}/{iid} -> {s2}")
                check_response(f"limpieza: DELETE de {res}", "DELETE", f"/api/{res}/{iid}", s2, b2, (200, 204))
                s, b = api("GET", f"/api/{res}/{iid}", token=token)
                d = (json.loads(b).get("data") or {}) if s == 200 else {}
            note(f"  CLEANUP {res}/{iid}: GET -> {s} active/enabled={d.get('active', d.get('enabled'))}"
                 + (" (baja lógica: el registro queda, la API no tiene borrado físico)" if s == 200 else ""))
    for uid in CREATED_USER_IDS:
        s, _ = api("GET", f"/api/user/{uid}", token=token)
        if s == 200:
            s2, _ = api("DELETE", f"/api/user/{uid}/admin", token=token)
            note(f"  API DELETE /api/user/{uid}/admin -> {s2}")
            if s2 not in (200, 204):
                s3, _ = api("PUT", f"/api/user/{uid}", token=token)
                note(f"  API PUT /api/user/{uid} (borrado lógico, fallback) -> {s3}")
    note("== Verificación final de staging (cualquier 'E2E' en cualquier corrida) ==")
    leftovers_active = 0
    for res in RESOURCES:
        items = [i for i in e2e_items(token, res, only_this_run=False) if not is_fixed_cat(i)]
        active = [i for i in items if i.get("active", True) is not False]
        inactive = [i for i in items if i.get("active", True) is False]
        leftovers_active += len(active)
        note(f"  CLEANUP {res}: activos E2E={len(active)} {[(i['id'], i.get('name') or i.get('code')) for i in active]}"
             f" | dados de baja (soft-delete, sin borrado físico en backend)={len(inactive)}"
             f" {[(i['id'], i.get('name')) for i in inactive]}")
    for uid in CREATED_USER_IDS:
        s, _ = api("GET", f"/api/user/{uid}", token=token)
        note(f"  CLEANUP user {uid}: GET -> {s} (esperado 404)")
        if s == 200:
            leftovers_active += 1
    note(f"CLEANUP_SUMMARY: datos E2E activos remanentes = {leftovers_active}")


# ── Helpers de UI ────────────────────────────────────────────────────────────────────────────────
async def new_page(browser, inject=False, tag=""):
    ctx = await browser.new_context(viewport=VIEWPORT)
    page = await ctx.new_page()

    def on_console(m):
        if m.type == "error":
            (NOISE if FONT_NOISE in m.text else CONSOLE).append(f"[{tag}:{SECTION[0]}] {m.text[:300]}")

    page.on("console", on_console)
    page.on("pageerror", lambda e: CONSOLE.append(f"[{tag}:{SECTION[0]}] PAGEERROR {str(e)[:300]}"))

    async def on_response(r):
        if "/api/" not in r.url or r.request.method == "OPTIONS":
            return
        entry = {"who": tag, "sec": SECTION[0], "m": r.request.method,
                 "path": "/api/" + r.url.split("/api/", 1)[1], "status": r.status, "body": "", "req": ""}
        NET.append(entry)  # se agrega ya (orden real); el body se completa después
        if "auth/login" in entry["path"]:
            entry["body"] = "(omitido: credenciales/token)"
            return
        if r.request.method != "GET":
            entry["req"] = (r.request.post_data or "")[:250]
        if r.request.method != "GET" or r.status >= 400:
            try:
                entry["body"] = (await r.text())[:400]
            except Exception:
                pass
        if r.status >= 500 or (r.status >= 400 and r.status != 401 and body_code(entry["body"]) is None):
            backend_finding(f"respuesta inesperada en [{tag}:{SECTION[0]}]", entry["m"],
                            UUID_RE.sub("{id}", entry["path"]), r.status, entry["body"])

    page.on("response", lambda r: asyncio.ensure_future(on_response(r)))
    if inject:
        async def handler(route):
            resp = await route.fetch()
            body = await resp.json()
            body["data"]["permissions"] = list(dict.fromkeys(body["data"]["permissions"] + INJECTED))
            await route.fulfill(response=resp, body=json.dumps(body),
                                headers={**resp.headers, "content-type": "application/json"})
        await page.route("**/api/auth/me", handler)
    return ctx, page


async def login(page, email):
    await page.goto(BASE + "/auth/login", wait_until="networkidle")
    await page.get_by_role("textbox", name="Email").fill(email)
    await page.get_by_role("textbox", name="Contraseña").fill(PASSWORD)
    await page.get_by_role("button", name="Iniciar sesión").click()
    await page.wait_for_url("**/dashboard/**", timeout=30000)
    await page.wait_for_load_state("networkidle")


async def settle(page, ms=900):
    await page.wait_for_load_state("networkidle")
    await page.wait_for_timeout(ms)


def content(page):
    return page.locator("mat-sidenav-content")


def nav(page):
    return page.get_by_role("navigation", name="Secciones del backoffice")


async def nav_links(page):
    return [t.strip() for t in await nav(page).get_by_role("link").all_inner_texts()]


async def go_nav(page, label):
    await nav(page).get_by_role("link", name=label, exact=True).click()
    await page.wait_for_timeout(500)
    leave = page.locator("mat-dialog-container").get_by_role("button", name="Salir sin guardar")
    if await leave.count():
        note(f"  (aviso de cambios sin guardar al ir a '{label}': se confirma 'Salir sin guardar')")
        await leave.click()
    await settle(page)


def row_of(page, text):
    return page.locator("[role=row], [role=treeitem]").filter(has_text=text)


async def snackbar_text(page):
    sb = page.locator("mat-snack-bar-container, .mat-mdc-snack-bar-container")
    try:
        await sb.first.wait_for(state="visible", timeout=6000)
        return (await sb.first.inner_text()).replace("\n", " ").strip()
    except Exception:
        return ""


async def open_row_menu(page, text):
    await row_of(page, text).first.get_by_role("button", name="Más acciones").click()
    await page.wait_for_timeout(400)


async def confirm_dialog(page):
    d = page.locator("mat-dialog-container")
    await d.get_by_role("button", name=re.compile(r"^Sí, ")).click()


async def search_list(page, text):
    """Filtra la lista con su buscador (si lo tiene) para que la fila buscada quede en la página visible."""
    inp = page.locator("app-list-search input").first
    if await inp.count():
        await inp.fill(text)
        await page.wait_for_timeout(900)


async def api_get_item(res, item_id):
    s, b = api("GET", f"/api/{res}/{item_id}", token=sa_token())
    try:
        return s, json.loads(b).get("data") or {}
    except Exception:
        return s, {}


# ── CPs ──────────────────────────────────────────────────────────────────────────────────────────
async def cp1_login(browser):
    SECTION[0] = "CP1"
    ctx, page = await new_page(browser, tag="SA")
    me_reqs = []
    page.on("request", lambda r: "/api/auth/me" in r.url and me_reqs.append((r.method, r.headers.get("authorization", ""))))
    await page.goto(BASE + "/auth/login", wait_until="networkidle")
    await page.get_by_role("textbox", name="Email").fill(SA)
    await page.get_by_role("textbox", name="Contraseña").fill("ClaveInvalida999")
    await page.get_by_role("button", name="Iniciar sesión").click()
    alert = page.get_by_role("alert")
    await alert.first.wait_for(timeout=15000)
    txt = (await alert.first.inner_text()).strip()
    log(f"CP1 login SA con contraseña inválida -> alerta inline: '{txt}', URL={page.url}")
    s1 = await shot(page, "login_password_invalida")
    check("incorrecta" in txt.lower() and "/auth/login" in page.url, "no se vio el error inline")
    await page.get_by_role("textbox", name="Contraseña").fill(PASSWORD)
    await page.get_by_role("button", name="Iniciar sesión").click()
    await page.wait_for_url("**/dashboard/home", timeout=30000)
    await settle(page)
    bearer = [m for m, a in me_reqs if a.startswith("Bearer ")]
    log(f"CP1 login SA OK -> {page.url}; requests a /api/auth/me: {[(m, a[:15] + '…') for m, a in me_reqs]}")
    s2 = await shot(page, "login_sa_home")
    check(len(bearer) >= 1, "GET /api/auth/me sin Authorization: Bearer")
    result("CP1", "OK", f"{s1}, {s2}; GET /api/auth/me con 'Authorization: Bearer …' ({len(bearer)} req)")
    return ctx, page


async def cp2_smoke(page):
    SECTION[0] = "CP2"
    links = await nav_links(page)
    exp = expected_menu("SA")
    log(f"CP2 menú lateral SA: {links} | esperado según /me: {exp} -> {'coincide' if links == exp else 'NO coincide'}")
    shots, bad = [], []
    if links != exp:
        bad.append(f"menú distinto al esperado por /me: sobran {set(links) - set(exp)}, faltan {set(exp) - set(links)}")
    for label in links:
        SECTION[0] = f"CP2:{label}"
        before = len(CONSOLE)
        await go_nav(page, label)
        await page.wait_for_timeout(600)
        text = (await content(page).inner_text()).strip()
        crumbs = (await page.get_by_role("navigation", name="Ruta de navegación").inner_text()).replace("\n", " > ")
        errs = CONSOLE[before:]
        dialogs = await page.locator("mat-dialog-container").count()
        ok = len(text) > 40 and not errs and dialogs == 0  # 40: un estado vacío legítimo ronda 70
        log(f"CP2 abrir '{label}' -> {page.url} | breadcrumb='{crumbs}' | {len(text)} chars de contenido | "
            f"errores consola={len(errs)} | diálogos={dialogs}")
        shots.append(await shot(page, "smoke_" + re.sub(r"\W+", "_", label.lower()).strip("_")))
        if not ok:
            bad.append(f"{label}: len={len(text)} errs={errs} dialogs={dialogs}")
    SECTION[0] = "CP2:dashboard"
    await go_nav(page, "Inicio")
    dash_ok = await page.get_by_role("heading", name="Núcleo operativo").count() > 0
    log(f"CP2 Dashboard con contenido (heading 'Núcleo operativo'): {dash_ok}")
    trams = [l for l in links if l in ("Plantillas provinciales", "Trámites del organismo", "Fichas por localidad")]
    if bad or not dash_ok:
        result("CP2", "FALLA", f"pantallas con problema: {bad}")
    else:
        result("CP2", "OK", f"{len(links)} ítems (= menú esperado por /me) sin pantalla en blanco, sin errores de consola "
                            f"y sin diálogo global (grupo Trámites visible: {trams}). Capturas {shots[0]} … {shots[-1]}")


async def abm_simple(page, cp_key, nav_label, new_btn, create_btn, extra_fields=None, soft=False, block_delete=False):
    """crear → editar → eliminar en un ABM simple de taxonomía. Devuelve evidencia."""
    SECTION[0] = f"CP4:{nav_label}"
    name = f"{PFX} {nav_label[:12]}"
    await go_nav(page, nav_label)
    await page.get_by_role("button", name=new_btn).first.click()
    await settle(page, 1300)  # el form se re-arma cuando llegan los catálogos (ver bug B-2)
    await page.get_by_role("textbox", name="Nombre", exact=True).fill(name)
    for label, value in (extra_fields or []):
        await page.get_by_role("textbox", name=label, exact=True).fill(value)
    await page.wait_for_timeout(400)
    preview = ""
    form_txt = await page.locator("form").first.inner_text()
    m = re.search(r"(Identificador \(slug\):|Formato sugerido:|Se guardará como:)\s*(\S+)", form_txt)
    if m:
        preview = f" vista previa '{m.group(1)} {m.group(2)}'"
    async with page.expect_response(lambda r: r.request.method == "POST" and "/api/" in r.url) as rinfo:
        await page.get_by_role("button", name=create_btn).click()
    resp = await rinfo.value
    res_path = resp.url.split("/api/")[-1].split("?")[0].strip("/")
    try:
        created_id = ((await resp.json()).get("data") or {}).get("id")
    except Exception:
        created_id = None
    await settle(page)
    sb = await snackbar_text(page)
    rows = await row_of(page, name).count()
    log(f"CP4 {nav_label}: crear '{name}' -> POST {resp.url.split(BASE)[-1]} {resp.status} (id={created_id}); snackbar='{sb}'; filas={rows};{preview}")
    s_create = await shot(page, f"abm_{cp_key}_creado")
    check(resp.status in (200, 201) and rows == 1, f"{nav_label}: alta no visible")

    await row_of(page, name).first.get_by_role("button", name=re.compile(r"^Editar")).click()
    await settle(page, 1300)
    edited = name + " ed"
    await page.get_by_role("textbox", name="Nombre", exact=True).fill(edited)
    async with page.expect_response(lambda r: r.request.method == "PUT" and "/api/" in r.url) as rinfo:
        await page.get_by_role("button", name="Guardar cambios").click()
    resp = await rinfo.value
    await settle(page)
    rows = await row_of(page, edited).count()
    log(f"CP4 {nav_label}: editar -> PUT {resp.status}; vuelve a {page.url}; fila '{edited}'={rows}")
    s_edit = await shot(page, f"abm_{cp_key}_editado")
    check(resp.status in (200, 201) and rows == 1 and "/lista" in page.url, f"{nav_label}: edición no visible")

    extra = ""
    await open_row_menu(page, edited)
    await page.get_by_role("menuitem", name=re.compile(r"Eliminar")).click()
    dlg = page.locator("mat-dialog-container")
    await dlg.wait_for()
    if block_delete:
        SECTION[0] = "CP5"

        async def abort_delete(route):
            if route.request.method == "DELETE":
                await route.abort()
            else:
                await route.continue_()
        await page.route("**/api/**", abort_delete)
        await confirm_dialog(page)
        await page.wait_for_timeout(2000)
        n_dialogs = await page.locator("mat-dialog-container").count()
        err = (await dlg.get_by_role("alert").inner_text()).strip() if await dlg.get_by_role("alert").count() else ""
        btn_enabled = await dlg.get_by_role("button", name=re.compile(r"^Sí, ")).is_enabled()
        log(f"CP5 {nav_label}: DELETE bloqueado con page.route -> diálogos abiertos={n_dialogs}, error inline='{err}', botón habilitado={btn_enabled}")
        s_err = await shot(page, f"cp5_delete_bloqueado_{cp_key}")
        await page.unroute("**/api/**", abort_delete)
        cp5_ok = n_dialogs == 1 and bool(err) and btn_enabled
        extra = (s_err, err, cp5_ok)
        SECTION[0] = f"CP4:{nav_label}"
    async with page.expect_response(lambda r: r.request.method == "DELETE" and "/api/" in r.url) as rinfo:
        await confirm_dialog(page)
    resp = await rinfo.value
    await settle(page)
    sb = await snackbar_text(page)
    left = await row_of(page, edited).count()
    open_d = await page.locator("mat-dialog-container").count()
    log(f"CP4 {nav_label}: eliminar -> DELETE {resp.status}; snackbar='{sb}'; diálogo abierto={open_d}; filas restantes con el nombre={left}"
        + (" (soft-delete: queda como inactivo)" if soft else ""))
    s_del = await shot(page, f"abm_{cp_key}_eliminado")
    check(resp.status in (200, 204) and open_d == 0, f"{nav_label}: borrado falló")
    if not soft:
        check(left == 0, f"{nav_label}: la fila sigue en la lista")
        # ¿Borrado físico o baja lógica? Si el GET por id todavía devuelve el registro, deja residuo.
        g_status, g_data = await api_get_item(res_path, created_id) if created_id else (None, {})
        physical = g_status == 404
        log(f"CP4 {nav_label}: verificación por API GET /api/{res_path}/{created_id} -> {g_status}"
            + (" (borrado físico: el registro ya no existe)" if physical else f" (¡sigue existiendo! active={g_data.get('active')})"))
        check(physical, f"{nav_label}: el DELETE no es físico (GET {g_status}); aplicar la política de registros fijos")
    if block_delete:
        s_err, err, cp5_ok = extra
        if cp5_ok:
            result("CP5", "OK", f"{s_err} (modal abierto con '{err}'), reintento sin bloqueo -> DELETE {resp.status}, snackbar '{sb}' ({s_del})")
        else:
            result("CP5", "FALLA", f"{s_err}: el modal no quedó abierto con el error")
    return f"{s_create}, {s_edit}, {s_del}{preview}"


async def cp4_abms(page):
    ev = {}
    specs = [
        ("categorias", "Categorías", "Nueva categoría", "Crear categoría", [("Slug", f"e2e-{TS}-cat")], False, False),
        ("modalidades", "Modalidades", "Nueva modalidad", "Crear modalidad", None, False, True),
        ("destinatarios", "Destinatarios", "Nuevo destinatario", "Crear destinatario", None, False, False),
        ("eventos", "Eventos de Vida", "Nuevo evento", "Crear evento de vida", None, False, False),
    ]
    for key, label, nb, cb, extra, soft, block in specs:
        try:
            ev[label] = ("OK", await abm_simple(page, key, label, nb, cb, extra, soft, block))
        except Exception as e:
            ev[label] = ("FALLA", f"{type(e).__name__}: {e}")
            note(traceback.format_exc())
            await shot(page, f"abm_{key}_error")
            await page.goto(BASE + "/dashboard/home", wait_until="networkidle")
            if block and "CP5" not in RESULTS:
                result("CP5", "FALLA", f"el flujo de {label} falló antes de verificar: {e}")
    try:
        ev["Tipos de Organismo"] = ("OK", await abm_tipo_fijo(page))
    except Exception as e:
        ev["Tipos de Organismo"] = ("FALLA", f"{type(e).__name__}: {e}")
        note(traceback.format_exc())
        await shot(page, "abm_tipos_error")
        await page.goto(BASE + "/dashboard/home", wait_until="networkidle")
    return ev


async def edit_reactivate(page, nav_label, current_name, new_name, switch_label, cp_key, fills=()):
    """Desde la lista: Editar el registro fijo, renombrarlo y dejar el switch de 'activo' prendido (reactivación).
    Devuelve (status PUT, url de edición, url final, filas con new_name, texto de la fila, payload PUT, captura)."""
    await go_nav(page, nav_label)
    await search_list(page, current_name)
    await row_of(page, current_name).first.get_by_role("button", name=re.compile(r"^Editar")).click()
    await settle(page, 1300)
    edit_url = page.url
    await page.get_by_role("textbox", name="Nombre", exact=True).fill(new_name)
    for label, value in fills:
        await page.get_by_role("textbox", name=label).fill(value)
    sw = page.get_by_role("switch", name=switch_label)
    was = await sw.get_attribute("aria-checked")
    if was != "true":
        await sw.click()
    async with page.expect_response(lambda r: r.request.method == "PUT" and "/api/" in r.url) as rinfo:
        await page.get_by_role("button", name="Guardar cambios").first.click()
    resp = await rinfo.value
    try:
        sent = resp.request.post_data_json or {}
    except Exception:
        sent = {}
    await settle(page)
    final_url = page.url
    await search_list(page, new_name)
    rows = await row_of(page, new_name).count()
    row_txt = (await row_of(page, new_name).first.inner_text()).replace("\n", " ") if rows else ""
    log(f"CP4 {nav_label}: editar desde la lista '{current_name}' -> '{new_name}' ({edit_url}); switch '{switch_label}' "
        f"antes={was} -> prendido; PUT {resp.status} con active={sent.get('active')}; vuelve a {final_url}; fila='{row_txt}'")
    s = await shot(page, f"abm_{cp_key}_reactivado_editado")
    return resp.status, edit_url, final_url, rows, row_txt, sent, s


async def delete_soft(page, nav_label, name, res, item_id, cp_key):
    """Eliminar desde el menú de la fila (el backend hace baja lógica) y verificar por API que quedó inactivo."""
    await go_nav(page, nav_label)
    await search_list(page, name)
    await open_row_menu(page, name)
    await page.get_by_role("menuitem", name=re.compile("Eliminar")).click()
    await page.locator("mat-dialog-container").wait_for()
    async with page.expect_response(lambda r: r.request.method == "DELETE" and "/api/" in r.url) as rinfo:
        await confirm_dialog(page)
    r = await rinfo.value
    await settle(page)
    sb = await snackbar_text(page)
    open_d = await page.locator("mat-dialog-container").count()
    await search_list(page, name)
    row_txt = (await row_of(page, name).first.inner_text()).replace("\n", " ") if await row_of(page, name).count() else "(no está en la lista)"
    g_status, g_data = await api_get_item(res, item_id)
    log(f"CP4 {nav_label}: eliminar '{name}' -> DELETE {r.status}; snackbar='{sb}'; diálogo abierto={open_d}; fila ahora: {row_txt}; "
        f"API GET /api/{res}/{item_id} -> {g_status} active={g_data.get('active')} (baja lógica: vuelve a quedar inactivo, no suma residuo)")
    s = await shot(page, f"abm_{cp_key}_eliminado")
    check(r.status in (200, 204) and open_d == 0 and g_data.get("active") is False, f"{nav_label}: la baja no quedó registrada")
    return s


async def abm_tipo_fijo(page):
    """Tipos de organismo SIN crear registros: reutiliza 'E2E-fijo Tipo…' (reactivar+editar -> eliminar)."""
    SECTION[0] = "CP4:Tipos de Organismo"
    target, origin = fixed_target("organism-type", FIXED_TIPO)
    new_name = f"{FIXED_TIPO} r{TS}"
    if target is None:
        # Primera vez en la vida de staging: se crea el registro fijo (no se vuelve a crear nunca).
        await go_nav(page, "Tipos de Organismo")
        await page.get_by_role("button", name="Nuevo tipo").first.click()
        await settle(page, 1300)
        first = f"{FIXED_TIPO} alta"
        await page.get_by_role("textbox", name="Nombre", exact=True).fill(first)
        async with page.expect_response(lambda r: r.request.method == "POST" and "/api/organism-type" in r.url) as rinfo:
            await page.get_by_role("button", name="Crear tipo").click()
        r = await rinfo.value
        await settle(page)
        log(f"CP4 Tipos de Organismo: no existía el registro fijo ni residuos para adoptar -> alta única '{first}' POST {r.status}")
        check(r.status in (200, 201), "alta del tipo fijo falló")
        target, _ = fixed_target("organism-type", FIXED_TIPO)
        check(target is not None, "no aparece el tipo fijo recién creado")
    log(f"CP4 Tipos de Organismo: registro reutilizado ({origin}) id={target['id']} '{target['name']}' active={target.get('active')} "
        f"— no se crea ningún tipo nuevo")
    st, _, final_url, rows, row_txt, sent, s_ed = await edit_reactivate(
        page, "Tipos de Organismo", target["name"], new_name, "Tipo activo", "tipos")
    check(st in (200, 201) and rows == 1 and "/lista" in final_url and sent.get("active") is True
          and "Inactivo" not in row_txt and "Activo" in row_txt, "tipos: reactivación/edición no visible")
    s_del = await delete_soft(page, "Tipos de Organismo", new_name, "organism-type", target["id"], "tipos")
    return f"{s_ed}, {s_del} (registro fijo {origin}, sin altas nuevas)"


async def cp4_organismos(page):
    """Organismos SIN crear registros (baja lógica en el backend): reutiliza 'E2E-fijo Organismo…'.
    Reactivar+editar desde la lista vuelve a la lista (CP4-origen), acrónimo duplicado contra la sigla del fijo
    (POST 409, no crea nada — CP4-dup), salir sin guardar (CP6), breadcrumb del detalle (CP3) y eliminar (baja
    lógica: el fijo vuelve a quedar inactivo)."""
    SECTION[0] = "CP4:Organismos"
    target, origin = fixed_target("organism", FIXED_ORG)
    new_name = f"{FIXED_ORG} r{TS}"

    async def fill_new(name, acr):
        await go_nav(page, "Organismos")
        await page.get_by_role("button", name="Nuevo organismo").first.click()
        await settle(page, 1300)
        await page.get_by_role("textbox", name="Nombre", exact=True).fill(name)
        await page.get_by_role("textbox", name="Sigla (opcional)").fill(acr)
        await page.get_by_role("combobox", name="Seleccione un tipo").click()
        await page.get_by_role("option", name="Ministerio", exact=True).click()

    s_a = ""
    if target is None:
        # Primera vez en la vida de staging: se crea el registro fijo (no se vuelve a crear nunca).
        first = f"{FIXED_ORG} alta"
        await fill_new(first, FIXED_ORG_ACR)
        async with page.expect_response(lambda r: r.request.method == "POST" and "/api/organism" in r.url) as rinfo:
            await page.get_by_role("button", name="Crear organismo").click()
        r = await rinfo.value
        await settle(page)
        log(f"CP4 Organismos: no existía el registro fijo ni residuos para adoptar -> alta única '{first}' sigla {FIXED_ORG_ACR} POST {r.status}")
        s_a = await shot(page, "org_fijo_alta_unica")
        check(r.status in (200, 201), "alta del organismo fijo falló")
        target, _ = fixed_target("organism", FIXED_ORG)
        check(target is not None, "no aparece el organismo fijo recién creado")
    log(f"CP4 Organismos: registro reutilizado ({origin}) id={target['id']} '{target['name']}' sigla={target.get('acronym')} "
        f"active={target.get('active')} — no se crea ningún organismo nuevo")

    # Reactivar + editar desde la lista -> vuelve a la lista (CP4-origen)
    SECTION[0] = "CP4:Organismos-edit"
    st, edit_url, final_url, rows, row_txt, sent, s_ed = await edit_reactivate(
        page, "Organismos", target["name"], new_name, "Organismo activo", "organismos",
        fills=[("Sigla (opcional)", FIXED_ORG_ACR)])
    origin_ok = (st in (200, 201) and "origen=lista" in edit_url and final_url.endswith("/organismos/lista") and rows == 1
                 and sent.get("active") is True and "Inactivo" not in row_txt and "Activo" in row_txt)
    result("CP4-origen", "OK" if origin_ok else "FALLA",
           f"{s_ed}: edición desde la lista ({edit_url.replace(BASE, '')}) vuelve a {final_url.replace(BASE, '')}; "
           f"PUT {st} active={sent.get('active')} (reactivación del fijo); fila='{row_txt}'")

    # Acrónimo duplicado contra la sigla del organismo fijo: el alta falla con 409 y no crea nada.
    SECTION[0] = "CP4:Organismos-dup"
    dup_name = f"{PFX} dup"
    await fill_new(dup_name, FIXED_ORG_ACR)
    async with page.expect_response(lambda r: r.request.method == "POST" and "/api/organism" in r.url) as rinfo:
        await page.get_by_role("button", name="Crear organismo").click()
    r = await rinfo.value
    await page.wait_for_timeout(1500)
    banner = (await content(page).get_by_role("alert").first.inner_text()).replace("\n", " ") if await content(page).get_by_role("alert").count() else ""
    field_err = (await page.locator("mat-form-field").filter(has=page.get_by_role("textbox", name="Sigla (opcional)")).locator("mat-error").all_inner_texts())
    dialogs = await page.locator("mat-dialog-container").count()
    log(f"CP4 Organismos: crear '{dup_name}' con la sigla del fijo ({FIXED_ORG_ACR}) -> POST {r.status}; banner='{banner}'; "
        f"error del campo Sigla={field_err}; diálogos modales={dialogs}; URL={page.url}")
    s_dup = await shot(page, "org_dup_acronimo_del_fijo")
    # El texto del error pasó de "ese acrónimo" (run_3) a "esa sigla" (run_4): se aceptan ambos.
    dup_ok = (r.status == 409 and any(re.search(r"Ya existe un organismo con (ese acrónimo|esa sigla)", t) for t in field_err)
              and "Revisá el campo marcado." in banner and dialogs == 0)
    result("CP4-dup", "OK" if dup_ok else "FALLA",
           f"{s_dup}: POST {r.status} (no se creó nada), campo Sigla='{' '.join(field_err)}', banner='{banner}', diálogos={dialogs}")

    # CP6: salir sin guardar (el form del alta fallida sigue con cambios)
    SECTION[0] = "CP6"
    await nav(page).get_by_role("link", name="Organismos", exact=True).click()
    dlg = page.locator("mat-dialog-container")
    await dlg.wait_for(timeout=5000)
    await page.wait_for_timeout(700)  # la animación de apertura: que la captura muestre el diálogo entero
    dtxt = (await dlg.inner_text()).replace("\n", " ")
    log(f"CP6 form de organismo con cambios -> clic en el menú 'Organismos' -> diálogo: '{dtxt}'")
    s_un = await shot(page, "cp6_salir_sin_guardar")
    still = "/organismos/nuevo" in page.url
    await dlg.get_by_role("button", name="Salir sin guardar").click()
    await settle(page)
    log(f"CP6 'Salir sin guardar' -> {page.url}")
    result("CP6", "OK" if ("Salir sin guardar" in dtxt and still and "/organismos/lista" in page.url) else "FALLA",
           f"{s_un}: '{dtxt[:90]}…' (la URL se mantuvo hasta confirmar; después -> lista)")

    # CP3 breadcrumb (detalle del fijo)
    SECTION[0] = "CP3"
    await search_list(page, new_name)
    await open_row_menu(page, new_name)
    await page.get_by_role("menuitem", name=re.compile("Ver detalle")).click()
    await settle(page)
    det_url = page.url
    crumbs = (await page.get_by_role("navigation", name="Ruta de navegación").inner_text()).replace("\n", " > ")
    log(f"CP3 detalle del organismo {det_url}; breadcrumb='{crumbs}'")
    s_det = await shot(page, "cp3_detalle_organismo")
    await page.get_by_role("navigation", name="Ruta de navegación").get_by_role("link", name="Organismos").click()
    await settle(page)
    log(f"CP3 clic en el segmento 'Organismos' del breadcrumb -> {page.url}")
    s_bc = await shot(page, "cp3_breadcrumb_vuelve_a_lista")
    result("CP3", "OK" if ("/organismos/detalle/" in det_url and page.url.endswith("/organismos/lista")) else "FALLA",
           f"{s_det} -> {s_bc}")

    # Eliminar (baja lógica): el fijo vuelve a quedar inactivo
    SECTION[0] = "CP4:Organismos-del"
    s_del = await delete_soft(page, "Organismos", new_name, "organism", target["id"], "organismos")
    return ", ".join(x for x in (s_a, s_ed, s_del) if x) + f" (registro fijo {origin}, sin altas nuevas)"


async def cp7_usuarios(page):
    """Usuarios con fuente real (`usuarios: 'local'` en local y en staging): las acciones de cuenta que antes
    reportaban éxito falso (Cambiar email, Cambiar contraseña, Activar/Desactivar cuenta, Eliminar
    definitivamente) ya NO se ofrecen. Se verifica que no aparezcan en ninguna fila y que 'Editar' siga."""
    SECTION[0] = "CP7"
    removed = ["Cambiar email", "Cambiar contraseña", "Desactivar cuenta", "Activar cuenta", "Eliminar definitivamente"]
    await go_nav(page, "Usuarios")
    rows = content(page).get_by_role("grid").get_by_role("row")
    n_rows = await rows.count() - 1
    edit_btns = await content(page).get_by_role("grid").get_by_role("button", name=re.compile(r"^Editar")).count()
    more_btns = await content(page).get_by_role("grid").get_by_role("button", name="Más acciones").count()
    menu_items = []
    for i in range(more_btns):  # si hubiera menú de fila, se abren todos y se juntan sus ítems
        await content(page).get_by_role("grid").get_by_role("button", name="Más acciones").nth(i).click()
        await page.wait_for_timeout(300)
        menu_items += [t.strip() for t in await page.get_by_role("menuitem").all_inner_texts()]
        await page.keyboard.press("Escape")
    grid_txt = await content(page).get_by_role("grid").inner_text()
    present = [x for x in removed if any(x in m for m in menu_items) or x in grid_txt]
    log(f"CP7 Usuarios (SA): filas={n_rows}; botones 'Editar'={edit_btns}; botones 'Más acciones'={more_btns}; "
        f"ítems de menú de fila={menu_items}; acciones retiradas presentes={present}")
    s = await shot(page, "cp7_usuarios_sin_acciones_de_cuenta")
    ok = n_rows >= 1 and edit_btns == n_rows and not present
    result("CP7", "OK" if ok else "FALLA",
           f"{s}: {n_rows} filas, todas con 'Editar' ({edit_btns}); no se ofrece ninguna de {removed} "
           f"(menús de fila: {more_btns}, ítems {menu_items})")


async def cp7b_alta_usuario_real(page):
    """Alta REAL (POST /api/user) solo si se puede borrar después con DELETE /api/user/{id}/admin."""
    SECTION[0] = "CP7b"
    if os.environ.get("E2E_ALTA_USUARIO") != "1":
        log("CP7b alta real de usuario SALTEADA: en staging `DELETE /api/user/{id}/admin` responde 500 (ver run_2), "
            "así que no se puede garantizar la limpieza. Habilitar con E2E_ALTA_USUARIO=1 cuando se corrija.")
        result("CP7b", "no cubierto", "borrado físico de usuarios roto en staging (500); alta real deshabilitada por defecto")
        return
    await go_nav(page, "Usuarios")
    await page.get_by_role("button", name="Nuevo usuario").first.click()
    await settle(page, 1300)
    email = f"e2e.{TS}@example.com"
    await page.get_by_role("textbox", name="Nombre", exact=True).fill("E2E")
    await page.get_by_role("textbox", name="Apellido").fill(PFX)
    await page.get_by_role("textbox", name="Email").fill(email)
    await page.get_by_role("textbox", name="Contraseña").fill("Prueba123")
    await page.get_by_role("combobox", name="Rol").click()
    opts = [t.strip() for t in await page.get_by_role("option").all_inner_texts()]
    pick = next((o for o in opts if re.fullmatch(r"(User|USER|Usuario|Ciudadano)", o)), None) or next((o for o in opts if o in ("Statistics Viewer", "MANAGER")), None)
    log(f"CP7b opciones de rol: {opts}; elegido='{pick}' (cuenta queda INACTIVA: switch 'Activar la cuenta al crear' sin tildar)")
    if not pick:
        await page.keyboard.press("Escape")
        result("CP7b", "no cubierto", "no hay un rol de bajo privilegio para el alta de prueba")
        return
    await page.get_by_role("option", name=pick, exact=True).click()
    async with page.expect_response(lambda r: r.request.method == "POST" and r.url.endswith("/api/user")) as rinfo:
        await page.get_by_role("button", name="Crear usuario").click()
    r = await rinfo.value
    body = {}
    try:
        body = await r.json()
    except Exception:
        pass
    uid = (body.get("data") or {}).get("id") if isinstance(body, dict) else None
    if uid:
        CREATED_USER_IDS.append(uid)
    await settle(page)
    sb = await snackbar_text(page)
    log(f"CP7b alta real '{email}' -> POST /api/user {r.status}, id={uid}, snackbar='{sb}', URL={page.url}")
    s = await shot(page, "cp7b_alta_usuario_real")
    if uid:
        token = sa_token()
        s_del, _ = api("DELETE", f"/api/user/{uid}/admin", token=token)
        if s_del not in (200, 204):
            s_log, _ = api("PUT", f"/api/user/{uid}", token=token)  # fallback: borrado lógico
            log(f"CP7b borrado físico falló ({s_del}); fallback borrado lógico PUT /api/user/{uid} -> {s_log}")
        s_get, _ = api("GET", f"/api/user/{uid}", token=token)
        log(f"CP7b limpieza: DELETE /api/user/{uid}/admin -> {s_del}; GET /api/user/{uid} -> {s_get}")
        ok = r.status in (200, 201) and s_del in (200, 204) and s_get == 404
        result("CP7b", "OK" if ok else "FALLA", f"{s}: POST {r.status}, borrado físico {s_del}, GET posterior {s_get}")
    else:
        result("CP7b", "FALLA" if r.status in (200, 201) else "no cubierto",
               f"{s}: POST {r.status} sin id en la respuesta: {str(body)[:200]}")


async def cp8_roles_sa(page):
    SECTION[0] = "CP8:SA"
    await go_nav(page, "Roles")
    has_new = await page.get_by_role("button", name="Nuevo rol").count()
    row_btns = await row_of(page, "AGENT").first.get_by_role("button").all_inner_texts()
    log(f"CP8 SA Roles: 'Nuevo rol'={has_new}; botones de la fila AGENT={[b.strip() for b in row_btns]}")
    s1 = await shot(page, "cp8_sa_roles_lista")
    await page.get_by_role("button", name="Nuevo rol").first.click()
    await settle(page, 1300)
    tog = page.get_by_role("switch", name="Asignable por Administrador de Backoffice")
    try:
        await tog.wait_for(timeout=10000)
    except Exception:
        pass
    has_tog = await tog.count()
    log(f"CP8 SA form 'Nuevo rol': toggle 'Asignable por Administrador de Backoffice'={has_tog} (no se guarda nada)")
    s2 = await shot(page, "cp8_sa_form_rol_toggle_backoffice")
    await page.get_by_role("button", name="Cancelar").click()
    await settle(page)
    await go_nav(page, "Permisos")
    has_newp = await page.get_by_role("button", name="Nuevo permiso").count()
    log(f"CP8 SA Permisos: 'Nuevo permiso'={has_newp}")
    return has_new > 0 and has_tog > 0 and has_newp > 0 and any("Editar" in b for b in row_btns), f"{s1}, {s2}"


async def breadcrumb_hrefs(page):
    nav_bc = page.get_by_role("navigation", name="Ruta de navegación")
    out = []
    for a in await nav_bc.get_by_role("link").all():
        out.append(((await a.inner_text()).strip(), (await a.get_attribute("href") or "")))
    return out


async def role_checks(browser, who, email, detail_paths=()):
    """Gating de un rol contra lo que dice su `GET /api/auth/me`: menú, humo de cada ítem (sin errores de consola
    ni diálogo global), breadcrumb que solo linkea secciones visibles, acciones por permiso (usuarios, etiquetas,
    adopciones, roles/permisos) y redirección por URL directa. Devuelve un dict con evidencia."""
    SECTION[0] = f"CP9:{who}"
    ctx, page = await new_page(browser, tag=who)
    out = {"who": who, "shots": [], "fails": [], "cp8": None, "cp14": None, "bc_bad": []}
    try:
        await login(page, email)
        links = await nav_links(page)
        exp = expected_menu(who)
        nav_hrefs = {(await a.get_attribute("href") or "") for a in await nav(page).get_by_role("link").all()}
        log(f"CP9 {who} menú: {links} | esperado según /me: {exp} -> {'coincide' if links == exp else 'NO coincide'}")
        out["links"] = links
        out["shots"].append(await shot(page, f"cp9_{who.lower()}_menu"))
        if links != exp:
            out["fails"].append(f"menú: sobran {set(links) - set(exp)}, faltan {set(exp) - set(links)}")

        def bc_check(where, hrefs):
            bad = [(t, h) for t, h in hrefs if h != "/dashboard/home" and h not in nav_hrefs]
            if bad:
                out["bc_bad"].append(f"{where}: {bad}")

        # Humo del menú del rol
        smoke_bad = []
        for label in links:
            SECTION[0] = f"CP9:{who}:{label}"
            before = len(CONSOLE)
            await go_nav(page, label)
            await page.wait_for_timeout(500)
            dialogs = await page.locator("mat-dialog-container").count()
            errs = CONSOLE[before:]
            bc_check(label, await breadcrumb_hrefs(page))
            if dialogs or errs:
                smoke_bad.append(f"{label}: diálogos={dialogs} errores={errs}")
        log(f"CP9 {who} humo de {len(links)} ítems del menú: problemas={smoke_bad or 'ninguno'}")
        if smoke_bad:
            out["fails"].append(f"humo: {smoke_bad}")

        # CP8 (AB): Roles y Permisos en lectura (escape por rol, sin escritura)
        if who == "AB":
            SECTION[0] = "CP8:AB"
            await go_nav(page, "Roles")
            new_r = await page.get_by_role("button", name="Nuevo rol").count()
            btns = await content(page).get_by_role("grid").get_by_role("button", name=re.compile("^(Editar|Más acciones)")).count()
            log(f"CP8 AB Roles: 'Nuevo rol'={new_r}; botones Editar/Más acciones en filas={btns}")
            s_r = await shot(page, "cp8_ab_roles_sin_acciones")
            await go_nav(page, "Permisos")
            new_p = await page.get_by_role("button", name="Nuevo permiso").count()
            btns_p = await content(page).get_by_role("grid").get_by_role("button", name=re.compile("^(Editar|Más acciones)")).count()
            log(f"CP8 AB Permisos: 'Nuevo permiso'={new_p}; botones Editar/Más acciones en filas={btns_p}")
            out["cp8"] = (new_r == 0 and btns == 0 and new_p == 0 and btns_p == 0, s_r)

        # Usuarios: alta y edición según permisos efectivos (prerrequisito READ_ORGANISM + rol admin)
        if "Usuarios" in links:
            SECTION[0] = f"CP9:{who}:usuarios"
            await go_nav(page, "Usuarios")
            new_u = await page.get_by_role("button", name="Nuevo usuario").count()
            row_btns = await content(page).get_by_role("grid").get_by_role("button", name=re.compile("^(Editar|Más acciones)")).count()
            exp_new = allowed(who, {"p": ["CREATE_USER"]})
            exp_edit = allowed(who, {"p": ["UPDATE_USER", "READ_ORGANISM"], "all": True, "r": SA_AB_AO_R})
            log(f"CP9 {who} Usuarios: 'Nuevo usuario'={new_u} (esperado {int(exp_new)}); botones de fila={row_btns} "
                f"(esperado {'>0' if exp_edit else '0'})")
            out["shots"].append(await shot(page, f"cp9_{who.lower()}_usuarios"))
            if bool(new_u) != exp_new or bool(row_btns) != exp_edit:
                out["fails"].append(f"usuarios: nuevo={new_u} filas={row_btns}")

        # CP14: Etiquetas (crear exige CREATE_TAG y READ_ORGANISM o rol SA/AB; sin READ_ORGANISM no se pide /api/organism)
        if "Etiquetas" in links:
            SECTION[0] = f"CP14:{who}"
            i0 = len(NET)
            await go_nav(page, "Etiquetas")
            await page.wait_for_timeout(600)
            new_t = await page.get_by_role("button", name="Nueva etiqueta").count()
            exp_t = allowed(who, CREAR_ETIQUETA_RULE)
            rows_t = max(await content(page).get_by_role("grid").get_by_role("row").count() - 1, 0)
            # Lo que el backend le devuelve a ESTE usuario (la UI tiene que mostrar exactamente eso)
            _, tb = api("POST", "/api/auth/login", {"email": email, "password": PASSWORD})
            _, tb = api("GET", "/api/tag", token=json.loads(tb)["data"]["accessToken"])
            api_tags = json.loads(tb).get("data") or []
            _, sb = api("GET", "/api/tag", token=sa_token())
            globals_sa = [t["slug"] for t in json.loads(sb).get("data") or [] if not t.get("local")]
            if globals_sa and not any(not t.get("local") for t in api_tags):
                backend_finding(f"GET /api/tag con {who} (READ_TAG, sin organismo asignado) no devuelve ninguna etiqueta global "
                                f"(el SA ve {globals_sa}): el alcance por organismo deja afuera las globales",
                                "GET", "/api/tag", 200, tb[:200])
            dialogs = await page.locator("mat-dialog-container").count()
            org_reqs = net_since(i0, "GET", "/api/organism")
            org_reqs = [n for n in org_reqs if re.match(r"^/api/organism(\?|$)", n["path"])]
            has_ro = "READ_ORGANISM" in PERMS[who]
            form_opts, form_org_reqs = None, []
            if new_t:
                i1 = len(NET)
                await page.get_by_role("button", name="Nueva etiqueta").first.click()
                await settle(page, 1200)
                await page.locator("form mat-select").first.click()
                await page.wait_for_timeout(400)
                form_opts = [t.strip() for t in await page.get_by_role("option").all_inner_texts()]
                await page.keyboard.press("Escape")
                form_org_reqs = [n for n in net_since(i1, "GET", "/api/organism") if re.match(r"^/api/organism(\?|$)", n["path"])]
                s_form = await shot(page, f"cp14_{who.lower()}_form_etiqueta")
                await page.get_by_role("button", name="Cancelar").click()
                await settle(page, 500)
            s_t = await shot(page, f"cp14_{who.lower()}_etiquetas")
            log(f"CP14 {who} Etiquetas: filas={rows_t} (GET /api/tag con su token devuelve {len(api_tags)}); 'Nueva etiqueta'={new_t} (esperado {int(exp_t)}); diálogos={dialogs}; "
                f"GET /api/organism en la lista={len(org_reqs)} (READ_ORGANISM={has_ro}); opciones de organismo en el form={form_opts}; "
                f"GET /api/organism en el form={len(form_org_reqs)}")
            ok14 = (rows_t == min(len(api_tags), 10) and bool(new_t) == exp_t and dialogs == 0 and (has_ro or (not org_reqs and not form_org_reqs))
                    and (form_opts is None or has_ro or form_opts == ["Ninguno — etiqueta global"]))
            out["cp14"] = (ok14, f"{s_t}: {who} ve {rows_t} etiquetas (= las {len(api_tags)} que le devuelve el backend),'Nueva etiqueta'={new_t} (esperado {int(exp_t)}), "
                                 f"GET /api/organism={len(org_reqs) + len(form_org_reqs)} (READ_ORGANISM={has_ro}), "
                                 f"opciones del form={form_opts}, diálogos={dialogs}")

        # Adopciones: "Adoptar trámite" exige CREATE_ADOPTION + READ_PROCEDURE + READ_ORGANISM
        if "Trámites del organismo" in links:
            SECTION[0] = f"CP9:{who}:adopciones"
            await go_nav(page, "Trámites del organismo")
            adopt = await page.get_by_role("button", name="Adoptar trámite").count()
            exp_a = allowed(who, ADOPTAR_RULE)
            log(f"CP9 {who} Trámites del organismo: 'Adoptar trámite'={adopt} (esperado {int(exp_a)}); "
                f"diálogos={await page.locator('mat-dialog-container').count()}")
            if bool(adopt) != exp_a:
                out["fails"].append(f"adoptar visible={adopt} esperado={exp_a}")

        # Detalles (breadcrumb solo con secciones visibles)
        for path in detail_paths:
            rule = next((r for p, r in ROUTE_RULES if path.startswith(p)), None)
            SECTION[0] = f"CP3:{who}:bc"
            await page.goto(BASE + path, wait_until="networkidle")
            await page.wait_for_timeout(700)
            if page.url.endswith("/dashboard/home"):
                continue
            hrefs = await breadcrumb_hrefs(page)
            bc_check(path, hrefs)
            log(f"CP3 {who} breadcrumb en {path.replace(BASE, '')}: links={hrefs}")

        # URL directa: lo no permitido redirige a Home; lo permitido no
        SECTION[0] = f"CP9:{who}:url"
        redirects, red_bad = {}, []
        for path, rule in ROUTE_RULES:
            await page.goto(BASE + path, wait_until="networkidle")
            await page.wait_for_timeout(500)
            leave = page.locator("mat-dialog-container").get_by_role("button", name="Salir sin guardar")
            if await leave.count():
                await leave.click()
            final = page.url.replace(BASE, "")
            exp_ok = allowed(who, rule)
            redirects[path] = final
            if exp_ok == final.endswith("/dashboard/home"):
                red_bad.append(f"{path} -> {final} (permitido={exp_ok})")
        log(f"CP9 {who} por URL directa: {redirects} | inconsistencias con /me: {red_bad or 'ninguna'}")
        out["shots"].append(await shot(page, f"cp9_{who.lower()}_url_directa"))
        if red_bad:
            out["fails"].append(f"URL: {red_bad}")
        if out["bc_bad"]:
            log(f"CP3 {who} breadcrumb con links a secciones NO visibles: {out['bc_bad']}")
    finally:
        await ctx.close()
    return out


async def cp10_plantillas(page):
    SECTION[0] = "CP10:plantillas"
    await go_nav(page, "Plantillas provinciales")
    await page.get_by_role("button", name="Nueva plantilla").first.click()
    await settle(page, 1300)
    title = f"Obtener certificado {PFX} de prueba"
    await page.get_by_role("textbox", name="Título").fill(title)
    await page.wait_for_timeout(500)
    auto_slug = await page.get_by_role("textbox", name="Slug").input_value()
    await page.get_by_role("textbox", name="Slug").fill(f"Obtener Cert {PFX}!")
    await page.wait_for_timeout(500)
    form_txt = await page.locator("form").first.inner_text()
    m = re.search(r"Se guardará como:\s*(\S+)", form_txt)
    preview = m.group(1) if m else ""
    log(f"CP10 plantilla: título='{title}' -> slug autogenerado='{auto_slug}'; slug editado -> 'Se guardará como: {preview}'")
    s_f = await shot(page, "cp10_plantilla_form_slug")
    await page.get_by_role("button", name="Crear plantilla").click()
    await settle(page)
    heading = await content(page).get_by_role("heading", level=2).first.inner_text()
    code = await content(page).locator("code").first.inner_text()
    log(f"CP10 plantilla creada (mock) -> detalle {page.url}; heading='{heading}', slug='{code}'")
    s_d = await shot(page, "cp10_plantilla_detalle")
    ok = auto_slug == f"obtener-certificado-e2e-{TS}-de-prueba" and preview == f"obtener-cert-e2e-{TS}" and "/plantillas/detalle/" in page.url and code == preview
    # No dejar estado colgado: desactivar la plantilla de prueba (mock).
    await page.get_by_role("button", name="Desactivar").click()
    await page.locator("mat-dialog-container").wait_for()
    await page.locator("mat-dialog-container").get_by_role("button").last.click()
    await settle(page)
    sb = await snackbar_text(page)
    log(f"CP10 plantilla de prueba desactivada (mock) -> {page.url}; snackbar='{sb}'")
    return ok, f"{s_f}, {s_d}"


async def cp10_fichas(page):
    SECTION[0] = "CP10:fichas"
    await go_nav(page, "Fichas por localidad")
    await page.get_by_role("link", name="obtener-licencia-de-conducir-eldorado").wait_for(timeout=15000)  # mock con latencia
    tabs = [t.replace("\n", " ").strip() for t in await page.get_by_role("tab").all_inner_texts()]
    await page.get_by_role("tab", name=re.compile("En revisión")).click()
    await settle(page, 500)
    await content(page).get_by_role("grid").get_by_role("link").first.wait_for(timeout=15000)
    rev_rows = await content(page).get_by_role("grid").get_by_role("row").count() - 1
    log(f"CP10 fichas: tabs={tabs}; tab 'En revisión' -> {rev_rows} filas")
    s_t = await shot(page, "cp10_fichas_tab_en_revision")
    await page.get_by_role("tab", name=re.compile("Todas")).click()
    await settle(page, 500)
    await page.get_by_role("link", name="obtener-licencia-de-conducir-eldorado").click()
    await settle(page)
    states = []

    async def estado():
        hdr = (await content(page).get_by_role("banner").nth(1).inner_text()).replace("\n", " | ")
        return hdr

    states.append(("inicial", await estado()))
    for act in ["Enviar a revisión", "Publicar", "Despublicar", "Republicar"]:
        await content(page).get_by_role("banner").first.get_by_role("button", name=act, exact=True).click()
        await page.locator("mat-dialog-container").wait_for()
        await confirm_dialog(page)
        await page.wait_for_timeout(1000)
        states.append((act, await estado()))
    log(f"CP10 workflow de la ficha fl-3 (mock): {states}")
    s_w = await shot(page, "cp10_ficha_workflow_republicada")
    seq = [s for _, s in states]
    ok = ("Borrador" in seq[0] and "En revisión" in seq[1] and "Publicado" in seq[2] and "Despublicado" in seq[3] and "Publicado" in seq[4]
          and rev_rows >= 1)
    return ok, f"{s_t}, {s_w}"


async def cp10_11_inyectado(browser):
    """Contexto SA con permisos inyectados en la respuesta de /api/auth/me (solo pantallas MOCK)."""
    SECTION[0] = "CP10/11:inyectado"
    ctx, page = await new_page(browser, inject=True, tag="SA+inj")
    await login(page, SA)
    log(f"CP10/11 contexto SA con permisos inyectados vía page.route('/api/auth/me'): {INJECTED} — staging no los otorga (R-3)")
    # Puntos de atención
    await go_nav(page, "Fichas por localidad")
    await page.get_by_role("link", name="obtener-licencia-de-conducir-eldorado").click()
    await settle(page)
    panel = await page.get_by_role("region", name="Puntos de atención").count()
    await page.get_by_role("button", name="Agregar punto").click()
    d = page.locator("mat-dialog-container")
    await d.wait_for()
    await d.get_by_role("textbox", name="Nombre").fill(f"{PFX} punto")
    await d.get_by_role("textbox", name="Dirección").fill("Calle de prueba 123")
    await d.get_by_role("textbox", name="Latitud").fill("95")
    await d.get_by_role("textbox", name="Longitud").fill("-55,1234567")
    await d.get_by_role("button", name="Agregar").click()
    await page.wait_for_timeout(700)
    errs = await d.locator("mat-error").all_inner_texts()
    still_open = await page.locator("mat-dialog-container").count()
    log(f"CP10 puntos de atención: panel visible={panel}; alta con lat=95 / long=-55,1234567 -> errores={errs}; diálogo abierto={still_open}")
    s_p = await shot(page, "cp10_punto_coordenadas_invalidas")
    await d.get_by_role("button", name="Cancelar").click()
    await page.wait_for_timeout(500)
    pts_ok = panel == 1 and still_open == 1 and any("-90 y 90" in e for e in errs) and any("6 decimales" in e for e in errs)

    # Etiquetas
    SECTION[0] = "CP11"
    await go_nav(page, "Etiquetas")
    await page.get_by_role("button", name="Nueva etiqueta").first.click()
    await settle(page, 1300)
    await page.get_by_role("textbox", name="Slug").fill("  Niños y Adolescentes E2E!")
    await page.wait_for_timeout(500)
    m = re.search(r"Se guardará como:\s*(\S+)", await page.locator("form").first.inner_text())
    preview = m.group(1) if m else ""
    log(f"CP11 etiqueta: slug '  Niños y Adolescentes E2E!' -> 'Se guardará como: {preview}'")
    s_e = await shot(page, "cp11_etiqueta_slug_preview")
    await page.get_by_role("button", name="Crear etiqueta").click()
    await settle(page)
    sb = await snackbar_text(page)
    # La lista pagina de a 10: se usa el buscador para encontrar la nueva.
    await page.get_by_role("textbox", name=re.compile("Buscar etiquetas")).fill("ninos-y-adolescentes-e2e")
    await page.wait_for_timeout(800)
    row = row_of(page, "ninos-y-adolescentes-e2e")
    rtxt = (await row.first.inner_text()).replace("\n", " ") if await row.count() else ""
    log(f"CP11 etiqueta creada (mock): snackbar='{sb}', fila='{rtxt}', URL={page.url}")
    s_e2 = await shot(page, "cp11_etiqueta_creada")
    if await row.count():
        await open_row_menu(page, "ninos-y-adolescentes-e2e")
        await page.get_by_role("menuitem", name=re.compile("Eliminar")).click()
        await page.locator("mat-dialog-container").wait_for()
        await confirm_dialog(page)
        await settle(page)
        log(f"CP11 etiqueta de prueba eliminada (mock): filas restantes={await row_of(page, 'ninos-y-adolescentes-e2e').count()}")
    tag_ok = preview == "ninos-y-adolescentes-e2e" and "Global" in rtxt
    errs_ctx = [c for c in CONSOLE if c.startswith("[SA+inj:CP11")]
    await ctx.close()
    return pts_ok, f"{s_p}", tag_ok and not errs_ctx, f"{s_e}, {s_e2}"


async def cp12_ruta_vieja(page):
    SECTION[0] = "CP12"
    await page.goto(BASE + "/dashboard/tramites/lista", wait_until="networkidle")
    await page.wait_for_timeout(800)
    log(f"CP12 URL vieja /dashboard/tramites/lista -> {page.url}")
    s = await shot(page, "cp12_ruta_vieja_redirige_plantillas")
    result("CP12", "OK" if page.url.endswith("/dashboard/tramites/plantillas") else "FALLA", f"{s}: -> {page.url}")


# ── CPs contra la API REAL (solo E2E_TARGET=local) ──────────────────────────────────────────────────────
LX: dict = {}  # estado compartido entre los CPs locales (ids, títulos, slugs)


async def pick_option(page, scope, combo, option, multi=False):
    await scope.get_by_role("combobox", name=combo).click()
    await page.get_by_role("option", name=option).first.click()
    if multi:
        await page.keyboard.press("Escape")
    await page.wait_for_timeout(300)


async def resp_json(resp):
    try:
        return await resp.json()
    except Exception:
        return {}


async def resp_text(resp):
    try:
        return (await resp.text())[:400]
    except Exception:
        return ""


def rpath(resp) -> str:
    return "/api/" + resp.url.split("/api/", 1)[1]


async def field_errors(page, label_re):
    ff = page.locator(".form-field").filter(has=page.get_by_role("textbox", name=label_re))
    return [t.strip() for t in await ff.locator("mat-error").all_inner_texts()]


def ensure_fixed_category() -> dict:
    """Categoría fija para las plantillas (se reutiliza: borrar una categoría referenciada da 500, ver hallazgos)."""
    token = sa_token()
    _, b = api("GET", "/api/category", token=token)
    for c in json.loads(b).get("data") or []:
        if c.get("name") == FIXED_CAT:
            return c
    s, b = api("POST", "/api/category", {"parentId": None, "slug": FIXED_CAT_SLUG, "name": FIXED_CAT}, token=token)
    check(s in (200, 201), f"no se pudo crear la categoría fija: {s} {b[:200]}")
    return json.loads(b)["data"]


async def cp13_etiquetas(page):
    """Etiquetas real (SA): global con slug canonicalizado, global duplicada (4072 en el campo), local con
    organismo, editar y borrar (DELETE real -> GET 404)."""
    SECTION[0] = "CP13"
    ev, ok = [], True
    # Global
    await go_nav(page, "Etiquetas")
    await page.get_by_role("button", name="Nueva etiqueta").first.click()
    await settle(page, 1200)
    raw = f"  {PFX} Global Ñandú Público!"
    exp_slug = canon_slug(raw)
    await page.get_by_role("textbox", name="Slug").fill(raw)
    await page.wait_for_timeout(400)
    m = re.search(r"Se guardará como:\s*(\S+)", await page.locator("form").first.inner_text())
    preview = m.group(1) if m else ""
    async with page.expect_response(lambda r: r.request.method == "POST" and re.search(r"/api/tag$", r.url)) as ri:
        await page.get_by_role("button", name="Crear etiqueta").click()
    r = await ri.value
    body = await resp_json(r)
    gid = (body.get("data") or {}).get("id")
    if gid:
        CREATED["tag"].append(gid)
    sent = r.request.post_data_json or {}
    await settle(page)
    await search_list(page, exp_slug)
    row = row_of(page, exp_slug)
    rtxt = (await row.first.inner_text()).replace("\n", " ") if await row.count() else ""
    log(f"CP13 etiqueta global: slug tipeado '{raw}' -> vista previa '{preview}'; POST /api/tag {r.status} "
        f"(enviado slug='{sent.get('slug')}', organismId={sent.get('organismId')}; guardado slug='{(body.get('data') or {}).get('slug')}', "
        f"local={(body.get('data') or {}).get('local')}); fila en la lista='{rtxt}'")
    s1 = await shot(page, "cp13_etiqueta_global_creada")
    g_ok = (r.status in (200, 201) and preview == exp_slug and (body.get("data") or {}).get("slug") == exp_slug
            and exp_slug in rtxt and "Global" in rtxt)
    if not check_response("crear etiqueta global", "POST", rpath(r), r.status, await resp_text(r)):
        g_ok = False
    ev.append(f"global {s1} ({'OK' if g_ok else 'FALLA'}: '{raw}' -> '{exp_slug}')")
    ok &= g_ok

    # Global duplicada -> 400 4072 en el campo slug, sin diálogo global
    await page.get_by_role("button", name="Nueva etiqueta").first.click()
    await settle(page, 1200)
    await page.get_by_role("textbox", name="Slug").fill(exp_slug)
    async with page.expect_response(lambda r: r.request.method == "POST" and re.search(r"/api/tag$", r.url)) as ri:
        await page.get_by_role("button", name="Crear etiqueta").click()
    r = await ri.value
    rbody = await resp_text(r)
    await page.wait_for_timeout(1200)
    errs = [t.strip() for t in await page.locator("mat-form-field").filter(
        has=page.get_by_role("textbox", name="Slug")).locator("mat-error").all_inner_texts()]
    dialogs = await page.locator("mat-dialog-container").count()
    banner = " ".join(t.strip() for t in await content(page).get_by_role("alert").all_inner_texts()).replace("\n", " ")
    log(f"CP13 etiqueta global duplicada '{exp_slug}': POST {r.status} code={body_code(rbody)}; error del campo Slug={errs}; "
        f"banner='{banner}'; diálogos={dialogs}; URL={page.url}")
    s2 = await shot(page, "cp13_etiqueta_global_duplicada")
    d_ok = (r.status in (400, 409) and body_code(rbody) == 4072 and any("Ya existe una etiqueta con ese slug" in e for e in errs)
            and dialogs == 0 and "/etiquetas/nuevo" in page.url)
    check_response("etiqueta duplicada (se espera 4072)", "POST", rpath(r), r.status, rbody, (400, 409))
    ev.append(f"duplicada {s2} ({'OK' if d_ok else 'FALLA'}: {r.status}/{body_code(rbody)})")
    ok &= d_ok
    await go_nav(page, "Etiquetas")  # el form quedó sucio: go_nav confirma "Salir sin guardar"

    # Local con organismo
    await page.get_by_role("button", name="Nueva etiqueta").first.click()
    await settle(page, 1200)
    local_slug = canon_slug(f"{PFX} local")
    await page.get_by_role("textbox", name="Slug").fill(local_slug)
    await page.locator("form mat-select").first.click()
    await page.get_by_role("option", name=LX["org_name"], exact=True).click()
    await page.wait_for_timeout(300)
    async with page.expect_response(lambda r: r.request.method == "POST" and re.search(r"/api/tag$", r.url)) as ri:
        await page.get_by_role("button", name="Crear etiqueta").click()
    r = await ri.value
    body = await resp_json(r)
    lid = (body.get("data") or {}).get("id")
    if lid:
        CREATED["tag"].append(lid)
    await settle(page)
    await search_list(page, local_slug)
    row = row_of(page, local_slug)
    rtxt = (await row.first.inner_text()).replace("\n", " ") if await row.count() else ""
    log(f"CP13 etiqueta local de '{LX['org_name']}': POST {r.status} data={body.get('data')}; fila='{rtxt}'")
    s3 = await shot(page, "cp13_etiqueta_local_creada")
    l_ok = (r.status in (200, 201) and (body.get("data") or {}).get("local") is True
            and (body.get("data") or {}).get("organismId") == LX["org_id"] and "Local" in rtxt and LX["org_name"] in rtxt)
    if not check_response("crear etiqueta local", "POST", rpath(r), r.status, await resp_text(r)):
        l_ok = False
    ev.append(f"local {s3} ({'OK' if l_ok else 'FALLA'})")
    ok &= l_ok

    # Editar la global
    ed_slug = canon_slug(f"{PFX} global editada")
    await search_list(page, exp_slug)
    await row_of(page, exp_slug).first.get_by_role("button", name=re.compile(r"^Editar")).click()
    await settle(page, 1200)
    await page.get_by_role("textbox", name="Slug").fill(ed_slug)
    async with page.expect_response(lambda r: r.request.method == "PUT" and "/api/tag/" in r.url) as ri:
        await page.get_by_role("button", name="Guardar cambios").click()
    r = await ri.value
    await settle(page)
    await search_list(page, ed_slug)
    e_rows = await row_of(page, ed_slug).count()
    log(f"CP13 editar etiqueta global -> '{ed_slug}': PUT {r.status}; vuelve a {page.url}; filas con el slug nuevo={e_rows}")
    s4 = await shot(page, "cp13_etiqueta_editada")
    e_ok = r.status == 200 and e_rows == 1 and "/etiquetas/lista" in page.url
    if not check_response("editar etiqueta", "PUT", rpath(r), r.status, await resp_text(r)):
        e_ok = False
    ev.append(f"editada {s4} ({'OK' if e_ok else 'FALLA'})")
    ok &= e_ok

    # Borrar las dos (DELETE real -> GET 404)
    del_ok = True
    for slug, tid in ((ed_slug, gid), (local_slug, lid)):
        if not tid:
            del_ok = False
            continue
        await search_list(page, slug)
        await open_row_menu(page, slug)
        await page.get_by_role("menuitem", name=re.compile("Eliminar")).click()
        await page.locator("mat-dialog-container").wait_for()
        async with page.expect_response(lambda r: r.request.method == "DELETE" and "/api/tag/" in r.url) as ri:
            await confirm_dialog(page)
        r = await ri.value
        await settle(page)
        g_status, _ = api("GET", f"/api/tag/{tid}", token=sa_token())
        left = await row_of(page, slug).count()
        log(f"CP13 borrar etiqueta '{slug}': DELETE {r.status}; filas restantes={left}; API GET /api/tag/{tid} -> {g_status}")
        if not check_response("borrar etiqueta", "DELETE", rpath(r), r.status, await resp_text(r), (200, 204)) or g_status != 404 or left:
            del_ok = False
    s5 = await shot(page, "cp13_etiquetas_borradas")
    ev.append(f"borradas {s5} ({'OK' if del_ok else 'FALLA'}: DELETE real, GET 404)")
    ok &= del_ok
    result("CP13", "OK" if ok else "FALLA", "; ".join(ev))


async def cp15_plantillas(page):
    """Plantillas real: crear (slug, categoría principal dentro de categorías, etiqueta) -> detalle; slug duplicado
    -> error en el campo (4072); editar. La desactivación va al final (cp15_desactivar), después de adoptarla."""
    SECTION[0] = "CP15"
    cat = ensure_fixed_category()
    LX["cat"] = cat
    ev, ok = [], True
    title = f"Obtener certificado {PFX} de prueba"
    exp_slug = canon_slug(title)
    await go_nav(page, "Plantillas provinciales")
    await page.get_by_role("button", name="Nueva plantilla").first.click()
    await settle(page, 1300)
    await page.get_by_role("textbox", name="Título").fill(title)
    await page.get_by_role("textbox", name=re.compile("^Resumen")).fill(f"Resumen {PFX}")
    await page.wait_for_timeout(300)
    auto_slug = await page.get_by_role("textbox", name="Slug").input_value()
    await pick_option(page, page, re.compile("Categorías"), FIXED_CAT, multi=True)
    await pick_option(page, page, re.compile("Categoría principal"), FIXED_CAT)
    await pick_option(page, page, re.compile("Etiquetas"), "salud", multi=True)
    s_f = await shot(page, "cp15_plantilla_form")
    async with page.expect_response(lambda r: r.request.method == "POST" and re.search(r"/api/procedure-template$", r.url)) as ri:
        await page.get_by_role("button", name="Crear plantilla").click()
    r = await ri.value
    body = await resp_json(r)
    data = body.get("data") or {}
    pid = data.get("id")
    if pid:
        CREATED["procedure-template"].append(pid)
    sent = r.request.post_data_json or {}
    await settle(page, 1200)
    heading = (await content(page).get_by_role("heading", level=2).first.inner_text()).strip() if "/detalle/" in page.url else ""
    code = (await content(page).locator("code").first.inner_text()).strip() if "/detalle/" in page.url else ""
    det_txt = (await content(page).inner_text()) if "/detalle/" in page.url else ""
    log(f"CP15 plantilla: título='{title}' -> slug autogenerado='{auto_slug}'; POST /api/procedure-template {r.status} "
        f"(enviado mainCategoryId={sent.get('mainCategoryId')} categoryIds={sent.get('categoryIds')} tagIds={sent.get('tagIds')}); "
        f"respuesta id={pid} mainCategoryId={data.get('mainCategoryId')} tagIds={data.get('tagIds')}; detalle {page.url} "
        f"heading='{heading}' slug='{code}'")
    s_d = await shot(page, "cp15_plantilla_detalle")
    c_ok = (r.status in (200, 201) and auto_slug == exp_slug and "/plantillas/detalle/" in page.url and heading == title
            and code == exp_slug and sent.get("mainCategoryId") == cat["id"] and cat["id"] in (sent.get("categoryIds") or [])
            and data.get("mainCategoryId") == cat["id"] and FIXED_CAT in det_txt and "salud" in det_txt)
    if not check_response("crear plantilla", "POST", rpath(r), r.status, await resp_text(r)):
        c_ok = False
    ev.append(f"alta {s_f} -> {s_d} ({'OK' if c_ok else 'FALLA'})")
    ok &= c_ok
    LX.update(pl_id=pid, pl_title=title, pl_slug=exp_slug)
    if not pid:
        result("CP15", "FALLA", "; ".join(ev))
        return

    # Slug duplicado -> 4072 en el campo
    await go_nav(page, "Plantillas provinciales")
    await page.get_by_role("button", name="Nueva plantilla").first.click()
    await settle(page, 1300)
    await page.get_by_role("textbox", name="Título").fill(f"Obtener otra cosa {PFX}")
    await page.get_by_role("textbox", name="Slug").fill(exp_slug)
    async with page.expect_response(lambda r: r.request.method == "POST" and re.search(r"/api/procedure-template$", r.url)) as ri:
        await page.get_by_role("button", name="Crear plantilla").click()
    r = await ri.value
    rbody = await resp_text(r)
    await page.wait_for_timeout(1200)
    errs = [t.strip() for t in await page.locator("mat-form-field").filter(
        has=page.get_by_role("textbox", name="Slug")).locator("mat-error").all_inner_texts()]
    dialogs = await page.locator("mat-dialog-container").count()
    log(f"CP15 plantilla con slug duplicado '{exp_slug}': POST {r.status} code={body_code(rbody)}; error del campo Slug={errs}; "
        f"diálogos={dialogs}; URL={page.url}")
    s_dup = await shot(page, "cp15_plantilla_slug_duplicado")
    d_ok = (r.status in (400, 409) and body_code(rbody) == 4072 and any("Ya existe una plantilla con ese slug" in e for e in errs)
            and dialogs == 0 and "/plantillas/nueva" in page.url)
    check_response("plantilla duplicada (se espera 4072)", "POST", rpath(r), r.status, rbody, (400, 409))
    ev.append(f"slug duplicado {s_dup} ({'OK' if d_ok else 'FALLA'}: {r.status}/{body_code(rbody)})")
    ok &= d_ok

    # Editar
    await page.goto(BASE + f"/dashboard/tramites/plantillas/detalle/{pid}", wait_until="networkidle")
    leave = page.locator("mat-dialog-container").get_by_role("button", name="Salir sin guardar")
    if await leave.count():
        await leave.click()
        await settle(page)
    await page.get_by_role("button", name="Editar").first.click()
    await settle(page, 1300)
    new_res = f"Resumen editado {PFX}"
    await page.get_by_role("textbox", name=re.compile("^Resumen")).fill(new_res)
    async with page.expect_response(lambda r: r.request.method == "PUT" and "/api/procedure-template/" in r.url) as ri:
        await page.get_by_role("button", name="Guardar cambios").click()
    r = await ri.value
    await settle(page, 1000)
    det_txt = await content(page).inner_text()
    log(f"CP15 editar plantilla (resumen) -> PUT {r.status}; vuelve a {page.url}; resumen nuevo visible={new_res in det_txt}")
    s_e = await shot(page, "cp15_plantilla_editada")
    e_ok = r.status == 200 and new_res in det_txt and "/plantillas/detalle/" in page.url
    if not check_response("editar plantilla", "PUT", rpath(r), r.status, await resp_text(r)):
        e_ok = False
    ev.append(f"edición {s_e} ({'OK' if e_ok else 'FALLA'})")
    ok &= e_ok
    LX["cp15_ev"], LX["cp15_ok"] = ev, ok


async def cp15_desactivar(page):
    """Desactivar la plantilla E2E (SA tiene DELETE_PROCEDURE): DELETE real = baja lógica."""
    SECTION[0] = "CP15:desactivar"
    ev, ok = LX.get("cp15_ev", []), LX.get("cp15_ok", False)
    pid = LX.get("pl_id")
    if not pid:
        return
    await page.goto(BASE + f"/dashboard/tramites/plantillas/detalle/{pid}", wait_until="networkidle")
    await page.wait_for_timeout(800)
    await page.get_by_role("button", name="Desactivar").click()
    d = page.locator("mat-dialog-container")
    await d.wait_for()
    dtxt = (await d.inner_text()).replace("\n", " ")
    async with page.expect_response(lambda r: r.request.method == "DELETE" and "/api/procedure-template/" in r.url) as ri:
        await d.get_by_role("button").last.click()
    r = await ri.value
    await settle(page)
    g_status, g = await api_get_item("procedure-template", pid)
    log(f"CP15 desactivar plantilla: diálogo='{dtxt[:120]}'; DELETE {r.status}; ahora en {page.url}; "
        f"API GET -> {g_status} active={g.get('active')}")
    s = await shot(page, "cp15_plantilla_desactivada")
    x_ok = r.status in (200, 204) and g.get("active") is False
    if not check_response("desactivar plantilla", "DELETE", rpath(r), r.status, await resp_text(r), (200, 204)):
        x_ok = False
    ev.append(f"desactivar {s} ({'OK' if x_ok else 'FALLA'}: DELETE {r.status}, active={g.get('active')})")
    result("CP15", "OK" if (ok and x_ok) else "FALLA", "; ".join(ev))


def seed_adopcion_sql(pl_id: str, org_id: str):
    """Fallback SOLO local: inserta una adopción en la base Postgres local descartable cuando el POST real falla."""
    check(UUID_RE.fullmatch(pl_id or "") and UUID_RE.fullmatch(org_id or ""), "ids inválidos para la siembra")
    sql = ("insert into organism_procedures(id,procedure_template_id,organism_id,enabled,effective_from,effective_to) "
           f"values (gen_random_uuid(),'{pl_id}','{org_id}',true,'2026-01-01 00:00:00+00','2027-12-31 23:59:59+00') returning id")
    out = subprocess.run(["docker", "exec", PG_CONTAINER, "psql", "-U", PG_USER, "-d", PG_DB, "-tA", "-c", sql],
                         capture_output=True, text=True, timeout=60)
    m = UUID_RE.search(out.stdout or "")
    return m.group(0) if m else None, (out.stderr or out.stdout or "")[:200]


async def adopt_dialog(page, desde, hasta):
    """Abre 'Adoptar trámite', completa y envía. Devuelve (response, alerta del diálogo, diálogo abierto)."""
    await go_nav(page, "Trámites del organismo")
    await page.get_by_role("button", name="Adoptar trámite").first.click()
    d = page.locator("mat-dialog-container")
    await d.wait_for()
    await d.get_by_role("combobox", name=re.compile("Plantilla provincial")).wait_for(timeout=15000)
    await page.wait_for_timeout(600)
    await pick_option(page, d, re.compile("Plantilla provincial"), LX["pl_title"])
    await pick_option(page, d, re.compile("Organismo"), LX["org_name"])
    await d.get_by_role("textbox", name="Vigente desde").fill(desde)
    if hasta:
        await d.get_by_role("textbox", name=re.compile("Vigente hasta")).fill(hasta)
    await d.get_by_role("textbox", name="Vigente desde").blur()
    await page.wait_for_timeout(300)
    async with page.expect_response(lambda r: r.request.method == "POST" and re.search(r"/api/organism-procedure$", r.url)) as ri:
        await d.get_by_role("button", name="Adoptar").click()
    r = await ri.value
    await page.wait_for_timeout(1500)
    still = await page.locator("mat-dialog-container").count()
    alert = (await d.get_by_role("alert").first.inner_text()).strip() if still and await d.get_by_role("alert").count() else ""
    return r, alert, still


async def cp16_adopciones(page):
    """Adopciones real: SA adopta la plantilla E2E con vigencia; solapamiento -> 4080 dentro del diálogo; detalle;
    'Organismos que la adoptaron' en la plantilla; edición de vigencia. Deshabilitar va al final (cp16_deshabilitar)."""
    SECTION[0] = "CP16"
    ev, ok = [], True
    if not LX.get("pl_id"):
        result("CP16", "no cubierto", "no hay plantilla E2E (CP15 falló)")
        return
    r, alert, still = await adopt_dialog(page, "01/01/2026", "31/12/2027")
    rbody = await resp_text(r)
    sent = r.request.post_data_json or {}
    body = await resp_json(r)
    aid = (body.get("data") or {}).get("id")
    log(f"CP16 adoptar '{LX['pl_title']}' para '{LX['org_name']}' 01/01/2026–31/12/2027: POST /api/organism-procedure {r.status} "
        f"(enviado effectiveFrom={sent.get('effectiveFrom')} effectiveTo={sent.get('effectiveTo')}); diálogo abierto={still}; "
        f"alerta='{alert}'; body={rbody[:160]}")
    s_a = await shot(page, "cp16_adoptar")
    create_ok = r.status in (200, 201) and bool(aid) and not still
    if not check_response("adoptar plantilla (crear adopción)", "POST", rpath(r), r.status, rbody):
        create_ok = False
    LX["adopt_create"] = (r.status, rbody)
    seeded = False
    if still:
        await page.locator("mat-dialog-container").get_by_role("button", name="Cancelar").click()
        await page.wait_for_timeout(500)
    if aid:
        CREATED["organism-procedure"].append(aid)
    elif SEED_SQL:
        aid, err = seed_adopcion_sql(LX["pl_id"], LX["org_id"])
        seeded = bool(aid)
        log(f"CP16 el alta real falló -> se siembra la adopción por SQL en la base local (E2E_SEED_SQL) para seguir con "
            f"fichas y puntos: id={aid} {'' if aid else err}")
        if aid:
            CREATED["organism-procedure"].append(aid)
    ev.append(f"alta {s_a} ({'OK' if create_ok else f'FALLA backend: POST {r.status}'})")
    LX["ad_id"], LX["ad_seeded"] = aid, seeded
    result("CP16-alta", "OK" if create_ok else "FALLA",
           f"{s_a}: POST /api/organism-procedure {r.status} body={rbody[:150]} (alerta en el diálogo: '{alert}')"
           + ("; para seguir se sembró la adopción por SQL" if seeded else ""))
    if not aid:
        for k in ("CP16-solapamiento", "CP16", "CP17", "CP18"):
            result(k, "no cubierto", "sin adopción: el alta real falló y no se pudo sembrar")
        return

    # Solapamiento -> 4080 dentro del diálogo (requiere la adopción anterior, real o sembrada)
    r, alert, still = await adopt_dialog(page, "01/06/2026", "")
    rbody = await resp_text(r)
    log(f"CP16 adopción solapada (01/06/2026 sin fin): POST {r.status} code={body_code(rbody)}; diálogo abierto={still}; alerta='{alert}'")
    s_o = await shot(page, "cp16_adopcion_solapada")
    ov_ok = (r.status == 409 and body_code(rbody) == 4080 and still == 1 and "Ya hay una adopción vigente" in alert)
    check_response("adopción solapada (se espera 409/4080)", "POST", rpath(r), r.status, rbody, (409,))
    if r.status in (200, 201):
        oid = ((await resp_json(r)).get("data") or {}).get("id")
        if oid:
            CREATED["organism-procedure"].append(oid)
        backend_finding("el backend aceptó una adopción solapada (se esperaba 409/4080)", "POST", rpath(r), r.status, rbody)
    if still:
        await page.locator("mat-dialog-container").get_by_role("button", name="Cancelar").click()
        await page.wait_for_timeout(500)
    result("CP16-solapamiento", "OK" if ov_ok else "FALLA",
           f"{s_o}: POST {r.status} code={body_code(rbody)}, diálogo abierto={still}, alerta='{alert}'"
           + (" — el error 500 es del backend (misma consulta de solapamiento que rompe el alta)" if r.status >= 500 else ""))

    # Detalle
    await page.goto(BASE + f"/dashboard/tramites/adopciones/detalle/{aid}", wait_until="networkidle")
    await page.wait_for_timeout(900)
    datos = (await page.get_by_role("region", name="Datos").inner_text()).replace("\n", " | ")
    head = (await content(page).get_by_role("heading", level=2).first.inner_text()).strip()
    log(f"CP16 detalle de la adopción {page.url}: heading='{head}'; Datos='{datos}'")
    s_det = await shot(page, "cp16_adopcion_detalle")
    det_ok = head == LX["pl_title"] and LX["org_name"] in datos and "01/01/2026" in datos and "31/12/2027" in datos
    if "01/01/2028" in datos:
        front_finding("Detalle de adopción: la vigencia 'hasta' se muestra corrida un día (01/01/2028 en vez de 31/12/2027)")
    ev.append(f"detalle {s_det} ({'OK' if det_ok else 'FALLA'})")
    ok &= det_ok

    # Edición de vigencia (PUT)
    region = page.get_by_role("region", name="Vigencia y estado")
    await region.get_by_role("textbox", name=re.compile("Vigente hasta")).fill("30/06/2027")
    await region.get_by_role("textbox", name="Vigente desde").click()
    await page.wait_for_timeout(300)
    async with page.expect_response(lambda r: r.request.method == "PUT" and "/api/organism-procedure/" in r.url) as ri:
        await region.get_by_role("button", name="Guardar cambios").click()
    r = await ri.value
    rbody = await resp_text(r)
    await page.wait_for_timeout(1500)
    alert = (await region.get_by_role("alert").first.inner_text()).strip() if await region.get_by_role("alert").count() else ""
    datos = (await page.get_by_role("region", name="Datos").inner_text()).replace("\n", " | ")
    log(f"CP16 editar vigencia (hasta 30/06/2027): PUT {r.status} req={(r.request.post_data or '')[:160]}; alerta='{alert}'; Datos='{datos}'")
    s_ed = await shot(page, "cp16_adopcion_vigencia_editada")
    ed_ok = r.status == 200 and "30/06/2027" in datos
    if not check_response("editar vigencia de la adopción", "PUT", rpath(r), r.status, rbody):
        ed_ok = False
    ev.append(f"editar vigencia {s_ed} ({'OK' if ed_ok else f'FALLA: PUT {r.status}'})")
    ok &= ed_ok
    if not ed_ok:  # descartar cambios para no dejar el form sucio
        if await region.get_by_role("button", name="Descartar").is_enabled():
            await region.get_by_role("button", name="Descartar").click()

    # "Organismos que la adoptaron" en el detalle de la plantilla
    await page.goto(BASE + f"/dashboard/tramites/plantillas/detalle/{LX['pl_id']}", wait_until="networkidle")
    leave = page.locator("mat-dialog-container").get_by_role("button", name="Salir sin guardar")
    if await leave.count():
        await leave.click()
        await settle(page)
    await page.wait_for_timeout(900)
    reg = page.get_by_role("region", name="Organismos que la adoptaron")
    rtxt = (await reg.inner_text()).replace("\n", " | ") if await reg.count() else ""
    log(f"CP16 plantilla -> 'Organismos que la adoptaron': '{rtxt}'")
    s_pl = await shot(page, "cp16_plantilla_organismos_que_la_adoptaron")
    pl_ok = LX["org_name"] in rtxt and "Vigente" in rtxt
    ev.append(f"en la plantilla {s_pl} ({'OK' if pl_ok else 'FALLA'})")
    ok &= pl_ok
    LX["cp16_ev"], LX["cp16_ok"] = ev, ok


async def cp16_deshabilitar(page):
    SECTION[0] = "CP16:deshabilitar"
    aid = LX.get("ad_id")
    if not aid:
        return
    ev, ok = LX.get("cp16_ev", []), LX.get("cp16_ok", False)
    await page.goto(BASE + f"/dashboard/tramites/adopciones/detalle/{aid}", wait_until="networkidle")
    await page.wait_for_timeout(800)
    await page.get_by_role("button", name="Deshabilitar").click()
    d = page.locator("mat-dialog-container")
    await d.wait_for()
    async with page.expect_response(lambda r: r.request.method == "DELETE" and "/api/organism-procedure/" in r.url) as ri:
        await confirm_dialog(page)
    r = await ri.value
    await settle(page)
    g_status, g = await api_get_item("organism-procedure", aid)
    await search_list(page, LX["pl_title"])
    rows = await row_of(page, LX["pl_title"]).count()
    log(f"CP16 deshabilitar adopción: DELETE {r.status}; ahora en {page.url}; filas con la plantilla en la lista={rows}; "
        f"API GET -> {g_status} enabled={g.get('enabled')}")
    s = await shot(page, "cp16_adopcion_deshabilitada")
    x_ok = r.status in (200, 204) and g.get("enabled") is False and rows == 0
    if not check_response("deshabilitar adopción", "DELETE", rpath(r), r.status, await resp_text(r), (200, 204)):
        x_ok = False
    ev.append(f"deshabilitar {s} ({'OK' if x_ok else 'FALLA'})")
    result("CP16", "OK" if (ok and x_ok) else "FALLA",
           "; ".join(ev) + (" [adopción sembrada por SQL: el alta real está en CP16-alta]" if LX.get("ad_seeded") else ""))


async def ficha_badge(page):
    hdr = content(page).locator("header.fichadet-membrete")
    return (await hdr.inner_text()).replace("\n", " | ") if await hdr.count() else ""


async def cp17_fichas(page):
    """Fichas real: desde la adopción, 'Agregar localidad' -> POST (BORRADOR); workflow real submit-review / publish /
    unpublish; edición bloqueada por G-1; 'Desactivar' al final (cp17_desactivar, después de los puntos)."""
    SECTION[0] = "CP17"
    aid = LX.get("ad_id")
    if not aid:
        return
    ev, ok = [], True
    await page.goto(BASE + f"/dashboard/tramites/adopciones/detalle/{aid}", wait_until="networkidle")
    await page.wait_for_timeout(800)
    await page.get_by_role("region", name="Fichas por localidad").get_by_role("link", name=re.compile("Agregar localidad")).click()
    await page.get_by_role("combobox", name=re.compile("Localidad")).wait_for(timeout=20000)
    await settle(page, 600)
    loc = LX["loc_name"]
    await page.get_by_role("combobox", name=re.compile("Localidad")).click()
    await page.get_by_role("option", name=re.compile(rf"^\s*{re.escape(loc)}\s*·")).first.click()
    await page.wait_for_timeout(500)
    slug = await page.get_by_role("textbox", name="Slug").input_value()
    ctx_txt = (await content(page).locator(".fichaform-contexto").inner_text()).replace("\n", " | ")
    s_f = await shot(page, "cp17_ficha_form_alta")
    async with page.expect_response(lambda r: r.request.method == "POST" and re.search(r"/api/organism-procedure-location$", r.url)) as ri:
        await page.get_by_role("button", name="Crear ficha").click()
    r = await ri.value
    body = await resp_json(r)
    data = body.get("data") or {}
    fid = data.get("id")
    if fid:
        CREATED["organism-procedure-location"].append(fid)
    sent = r.request.post_data_json or {}
    await settle(page, 1200)
    badge = await ficha_badge(page)
    log(f"CP17 alta de ficha ({ctx_txt}) localidad '{loc}' slug '{slug}': POST {r.status} (enviado organismProcedureId="
        f"{sent.get('organismProcedureId')} locationId={sent.get('locationId')} publicationStatus={sent.get('publicationStatus')}); "
        f"respuesta={data}; ahora en {page.url}; membrete='{badge}'")
    s_c = await shot(page, "cp17_ficha_creada_borrador")
    c_ok = (r.status in (200, 201) and data.get("publicationStatus") == "BORRADOR" and "Borrador" in badge
            and "/fichas/detalle/" in page.url and slug == f"{LX['pl_slug']}-{canon_slug(loc)}")
    if not check_response("crear ficha", "POST", rpath(r), r.status, await resp_text(r)):
        c_ok = False
    ev.append(f"alta {s_f} -> {s_c} ({'OK' if c_ok else 'FALLA'}: POST {r.status}, estado {data.get('publicationStatus')})")
    ok &= c_ok
    LX["fi_id"], LX["fi_slug"] = fid, slug
    if not fid:
        result("CP17", "FALLA", "; ".join(ev))
        return
    # Contrato G-1: GET de la ficha sin adopción/localidad/url/requisitos/costos
    g_status, g = await api_get_item("organism-procedure-location", fid)
    missing = [k for k in ("organismProcedureId", "locationId", "url", "requirements", "costs") if k not in g]
    if missing:
        backend_finding(f"G-1: GET de la ficha no devuelve {missing} (el front no puede mostrarlos ni editarla)",
                        "GET", "/api/organism-procedure-location/{id}", g_status, json.dumps(g)[:250])

    # ¿La adopción lista su ficha? (filtra por adopcionId, que con G-1 no llega)
    await page.goto(BASE + f"/dashboard/tramites/adopciones/detalle/{aid}", wait_until="networkidle")
    await page.wait_for_timeout(1000)
    reg_txt = (await page.get_by_role("region", name="Fichas por localidad").inner_text()).replace("\n", " | ")
    listed = slug in reg_txt or loc in reg_txt
    log(f"CP17 detalle de la adopción -> sección 'Fichas por localidad': '{reg_txt[:200]}' (lista la ficha nueva={listed})")
    s_l = await shot(page, "cp17_adopcion_seccion_fichas")
    if not listed:
        front_finding("Detalle de la adopción > 'Fichas por localidad' muestra 'Todavía no se ofrece en ninguna localidad' "
                      "aunque la adopción tiene una ficha: `FichasLocalesFacade.getDeAdopcion` filtra por `adopcionId`, que el "
                      "backend no devuelve (G-1); debería avisar que el dato no está disponible en vez de mostrar el vacío "
                      f"(core/features/fichas-locales/facades/fichas-locales.facade.ts:146; evidencia {s_l})")
    ev.append(f"sección de la adopción {s_l} (lista la ficha={listed}; G-1)")

    # Workflow real
    await page.goto(BASE + f"/dashboard/tramites/fichas/detalle/{fid}", wait_until="networkidle")
    await page.wait_for_timeout(900)
    wf, wf_ok, s_pub = [], True, ""
    for act, ep, st, label in (("Enviar a revisión", "submit-review", "EN_REVISION", "En revisión"),
                               ("Publicar", "publish", "PUBLICADO", "Publicado"),
                               ("Despublicar", "unpublish", "DESPUBLICADO", "Despublicado")):
        await content(page).get_by_role("banner").first.get_by_role("button", name=act, exact=True).click()
        await page.locator("mat-dialog-container").wait_for()
        async with page.expect_response(lambda r, ep=ep: r.request.method == "POST" and r.url.endswith(f"/{ep}")) as ri:
            await confirm_dialog(page)
        r = await ri.value
        data = (await resp_json(r)).get("data") or {}
        try:
            await content(page).locator("header.fichadet-membrete").get_by_text(label, exact=True).wait_for(timeout=8000)
        except Exception:
            pass
        await page.wait_for_timeout(500)
        badge = await ficha_badge(page)
        step_ok = r.status == 200 and data.get("publicationStatus") == st and label in badge
        if not check_response(f"workflow ficha: {ep}", "POST", UUID_RE.sub("{id}", rpath(r)), r.status, await resp_text(r)):
            step_ok = False
        wf.append(f"{act}: POST .../{ep} {r.status} -> {data.get('publicationStatus')} v{data.get('currentVersionNumber')} "
                  f"(membrete '{label}' {'sí' if label in badge else 'NO'})")
        wf_ok &= step_ok
        if st == "PUBLICADO":
            s_pub = await shot(page, "cp17_ficha_publicada")
            # Edición con la ficha publicada: con G-1 el form queda bloqueado por diseño
            await content(page).get_by_role("banner").first.get_by_role("link", name="Editar").click()
            await settle(page, 1200)
            alert_txt = (await content(page).get_by_role("alert").first.inner_text()).replace("\n", " | ") \
                if await content(page).get_by_role("alert").count() else ""
            has_form = await page.get_by_role("button", name="Guardar cambios").count()
            log(f"CP17 'Editar' con la ficha PUBLICADA -> {page.url}; alerta='{alert_txt}'; form con 'Guardar cambios'={has_form}")
            s_g1 = await shot(page, "cp17_ficha_edicion_bloqueada_g1")
            g1_ok = "todavía no se puede editar" in alert_txt and has_form == 0
            result("CP17-G1", "OK" if g1_ok else "FALLA",
                   f"{s_g1}: '{alert_txt[:160]}' (sin form; el toggle 'Activa' bloqueado de una ficha publicada no se puede "
                   f"ejercitar con G-1 abierto: queda no cubierto)")
            await page.goto(BASE + f"/dashboard/tramites/fichas/detalle/{fid}", wait_until="networkidle")
            await page.wait_for_timeout(900)
    log(f"CP17 workflow real: {wf}")
    s_w = await shot(page, "cp17_ficha_despublicada")
    ev.append(f"workflow {s_pub}, {s_w} ({'OK' if wf_ok else 'FALLA'}: {' / '.join(wf)})")
    ok &= wf_ok

    # Lista de fichas
    await go_nav(page, "Fichas por localidad")
    await search_list(page, slug)
    await page.wait_for_timeout(600)
    rtxt = (await row_of(page, slug).first.inner_text()).replace("\n", " ") if await row_of(page, slug).count() else ""
    log(f"CP17 lista 'Fichas por localidad' buscando '{slug}': fila='{rtxt}'")
    s_list = await shot(page, "cp17_fichas_lista")
    ev.append(f"lista {s_list} (fila {'visible' if rtxt else 'NO visible'})")
    ok &= bool(rtxt)
    LX["cp17_ev"], LX["cp17_ok"] = ev, ok


async def cp18_puntos(page):
    """Puntos de atención real, en la ficha: coordenadas inválidas rechazadas en cliente (sin POST), alta, edición
    y desactivación."""
    SECTION[0] = "CP18"
    fid = LX.get("fi_id")
    if not fid:
        result("CP18", "no cubierto", "sin ficha (CP17 falló)")
        return
    ev, ok = [], True
    await page.goto(BASE + f"/dashboard/tramites/fichas/detalle/{fid}", wait_until="networkidle")
    await page.wait_for_timeout(900)
    reg = page.get_by_role("region", name="Puntos de atención")
    name = f"{PFX} punto"
    await reg.get_by_role("button", name="Agregar punto").click()
    d = page.locator("mat-dialog-container")
    await d.wait_for()
    await d.get_by_role("textbox", name="Nombre").fill(name)
    await d.get_by_role("textbox", name="Dirección").fill("Av. Uruguay 3150, Posadas")
    await d.get_by_role("textbox", name="Latitud").fill("95")
    await d.get_by_role("textbox", name="Longitud").fill("-55,1234567")
    i0 = len(NET)
    await d.get_by_role("button", name="Agregar").click()
    await page.wait_for_timeout(900)
    errs = [t.strip() for t in await d.locator("mat-error").all_inner_texts()]
    posts = net_since(i0, "POST", "/api/attention-point")
    log(f"CP18 punto con lat=95 / long=-55,1234567 -> errores={errs}; diálogo abierto={await page.locator('mat-dialog-container').count()}; "
        f"POST enviados={len(posts)}")
    s_inv = await shot(page, "cp18_punto_coordenadas_invalidas")
    inv_ok = any("-90 y 90" in e for e in errs) and any("6 decimales" in e for e in errs) and not posts
    ev.append(f"inválidas {s_inv} ({'OK' if inv_ok else 'FALLA'})")
    ok &= inv_ok
    await d.get_by_role("textbox", name="Latitud").fill("-27,367104")
    await d.get_by_role("textbox", name="Longitud").fill("-55,896108")
    async with page.expect_response(lambda r: r.request.method == "POST" and re.search(r"/api/attention-point$", r.url)) as ri:
        await d.get_by_role("button", name="Agregar").click()
    r = await ri.value
    body = await resp_json(r)
    data = body.get("data") or {}
    pid = data.get("id")
    if pid:
        CREATED["attention-point"].append(pid)
    await page.wait_for_timeout(1500)
    card = (await reg.get_by_role("listitem").filter(has_text=name).first.inner_text()).replace("\n", " | ") \
        if await reg.get_by_role("listitem").filter(has_text=name).count() else ""
    log(f"CP18 alta de punto válido: POST {r.status} (enviado lat/long={(r.request.post_data_json or {}).get('latitude')}/"
        f"{(r.request.post_data_json or {}).get('longitude')}); respuesta={data}; tarjeta='{card}'")
    s_a = await shot(page, "cp18_punto_creado")
    a_ok = r.status in (200, 201) and data.get("latitude") == -27.367104 and data.get("longitude") == -55.896108 and name in card
    if not check_response("crear punto de atención", "POST", rpath(r), r.status, await resp_text(r)):
        a_ok = False
    ev.append(f"alta {s_a} ({'OK' if a_ok else 'FALLA'})")
    ok &= a_ok
    if not pid:
        result("CP18", "FALLA", "; ".join(ev))
        return
    # Editar
    ed = name + " ed"
    await reg.get_by_role("button", name=f"Editar {name}").click()
    d = page.locator("mat-dialog-container")
    await d.wait_for()
    await d.get_by_role("textbox", name="Nombre").fill(ed)
    async with page.expect_response(lambda r: r.request.method == "PUT" and "/api/attention-point/" in r.url) as ri:
        await d.get_by_role("button", name=re.compile("^(Guardar|Agregar)")).click()
    r = await ri.value
    await page.wait_for_timeout(1500)
    vis = await reg.get_by_role("heading", name=ed).count()
    log(f"CP18 editar punto -> '{ed}': PUT {r.status}; tarjeta con el nombre nuevo={vis}")
    s_e = await shot(page, "cp18_punto_editado")
    e_ok = r.status == 200 and vis == 1
    if not check_response("editar punto de atención", "PUT", rpath(r), r.status, await resp_text(r)):
        e_ok = False
    ev.append(f"edición {s_e} ({'OK' if e_ok else 'FALLA'})")
    ok &= e_ok
    # Desactivar
    await reg.get_by_role("button", name=f"Desactivar {ed}").click()
    await page.locator("mat-dialog-container").wait_for()
    async with page.expect_response(lambda r: r.request.method == "DELETE" and "/api/attention-point/" in r.url) as ri:
        await confirm_dialog(page)
    r = await ri.value
    await page.wait_for_timeout(1500)
    inact = await reg.get_by_role("switch", name=re.compile(r"Mostrar inactivos")).count()
    g_status, g = await api_get_item("attention-point", pid)
    log(f"CP18 desactivar punto: DELETE {r.status}; switch 'Mostrar inactivos'={inact}; API GET -> {g_status} active={g.get('active')}")
    s_x = await shot(page, "cp18_punto_desactivado")
    x_ok = r.status in (200, 204) and g.get("active") is False and inact == 1
    if not check_response("desactivar punto de atención", "DELETE", rpath(r), r.status, await resp_text(r), (200, 204)):
        x_ok = False
    ev.append(f"desactivar {s_x} ({'OK' if x_ok else 'FALLA'})")
    ok &= x_ok
    result("CP18", "OK" if ok else "FALLA", "; ".join(ev))


async def cp17_desactivar(page):
    SECTION[0] = "CP17:desactivar"
    fid = LX.get("fi_id")
    if not fid:
        return
    ev, ok = LX.get("cp17_ev", []), LX.get("cp17_ok", False)
    await page.goto(BASE + f"/dashboard/tramites/fichas/detalle/{fid}", wait_until="networkidle")
    await page.wait_for_timeout(900)
    await content(page).get_by_role("banner").first.get_by_role("button", name="Desactivar", exact=True).click()
    await page.locator("mat-dialog-container").wait_for()
    async with page.expect_response(lambda r: r.request.method == "DELETE" and "/api/organism-procedure-location/" in r.url) as ri:
        await confirm_dialog(page)
    r = await ri.value
    try:
        await content(page).locator("header.fichadet-membrete").get_by_text("Desactivada").wait_for(timeout=8000)
    except Exception:
        pass
    badge = await ficha_badge(page)
    g_status, g = await api_get_item("organism-procedure-location", fid)
    log(f"CP17 desactivar ficha: DELETE {r.status}; membrete='{badge}'; API GET -> {g_status} active={g.get('active')}")
    s = await shot(page, "cp17_ficha_desactivada")
    x_ok = r.status in (200, 204) and "Desactivada" in badge and g.get("active") is False
    if not check_response("desactivar ficha", "DELETE", rpath(r), r.status, await resp_text(r), (200, 204)):
        x_ok = False
    ev.append(f"desactivar {s} ({'OK' if x_ok else 'FALLA'})")
    result("CP17", "OK" if (ok and x_ok) else "FALLA",
           "; ".join(ev) + (" [sobre una adopción sembrada por SQL]" if LX.get("ad_seeded") else ""))


async def cp_estado_vacio(page):
    """Estado vacío con filtros activos: el CTA es siempre 'Limpiar filtros' (Etiquetas y Plantillas)."""
    SECTION[0] = "CP19"
    ev, ok = [], True
    for label in ("Etiquetas", "Plantillas provinciales"):
        await go_nav(page, label)
        await page.locator("app-list-search input").first.fill("zzz-no-existe-e2e")
        await page.wait_for_timeout(900)
        status = content(page).get_by_role("status")
        txt = (await status.first.inner_text()).replace("\n", " ") if await status.count() else ""
        btns = [t.strip() for t in await status.get_by_role("button").all_inner_texts()] if await status.count() else []
        s = await shot(page, "cp19_vacio_con_filtros_" + re.sub(r"\W+", "_", label.lower()))
        cleared = False
        if "Limpiar filtros" in " ".join(btns):
            await status.get_by_role("button", name=re.compile("Limpiar filtros")).first.click()
            await page.wait_for_timeout(700)
            cleared = (await page.locator("app-list-search input").first.input_value()) == ""
        log(f"CP19 {label} con búsqueda sin resultados: vacío='{txt[:120]}'; botones={btns}; 'Limpiar filtros' limpia={cleared}")
        this_ok = btns == ["Limpiar filtros"] or (len(btns) == 1 and "Limpiar filtros" in btns[0])
        ok &= this_ok and cleared
        ev.append(f"{label}: {s} botones={btns} limpia={cleared}")
    result("CP19", "OK" if ok else "FALLA", "; ".join(ev))


async def guarded(name, coro):
    try:
        return await coro
    except Exception as e:
        note(f"!! {name} abortado: {type(e).__name__}: {e}")
        note(traceback.format_exc())
        if name not in RESULTS:
            result(name, "FALLA", f"excepción: {type(e).__name__}: {str(e)[:200]}")
        return None


def local_setup() -> None:
    """Organismo y localidad (datos maestros del seed) para adopción/etiqueta local/ficha."""
    token = sa_token()
    _, b = api("GET", "/api/organism", token=token)
    orgs = [o for o in json.loads(b).get("data") or [] if o.get("active") and not (o.get("name") or "").upper().startswith("E2E")]
    org = next((o for o in orgs if o["name"] == "Silicon Misiones"), orgs[0] if orgs else None)
    check(org is not None, "no hay organismos activos en la base local")
    _, b = api("GET", "/api/location", token=token)
    locs = json.loads(b).get("data") or []
    loc = next((l for l in locs if l["name"] == "Posadas"), locs[0] if locs else None)
    check(loc is not None, "no hay localidades en la base local")
    LX.update(org_id=org["id"], org_name=org["name"], loc_id=loc["id"], loc_name=loc["name"])
    note(f"Setup local: organismo '{org['name']}' ({org['id']}), localidad '{loc['name']}' ({loc['id']})")


async def main():
    note(f"E2E backoffice vs {TARGET} ({BASE}) — corrida {RUN_DIR.name} — prefijo {PFX}; registros fijos '{FIXED_ORG}…' "
         f"(sigla {FIXED_ORG_ACR}) y '{FIXED_TIPO}…'" + (f"; categoría fija '{FIXED_CAT}'" if LOCAL else ""))
    try:
        s, _ = api("GET", "/")
        check(s == 200, f"dev server respondió {s}")
    except Exception as e:
        note(f"ABORT: el dev server {BASE} no responde ({e}). Levantalo con `npm run start:{TARGET}` en backoffice/.")
        return
    users = [("SA", SA), ("AB", AB), ("AO", AO)]
    agent = os.environ.get("E2E_AGENT_EMAIL", "").strip()
    if agent:
        users.append(("AGENT", agent))
    for who, email in users:
        load_me(who, email)
        note(f"/api/auth/me {who}: roles={sorted(ROLES[who])} permisos({len(PERMS[who])})={sorted(PERMS[who])}")
        note(f"  menú esperado {who}: {expected_menu(who)}")
    try:
        residues_before = residue_snapshot()
        note(f"Residuos E2E ANTES de la corrida (activos, inactivos) por recurso: {residues_before}")
    except Exception as e:
        residues_before = None
        note(f"!! no se pudo tomar el conteo de residuos inicial: {e}")
    async with async_playwright() as pw:
        browser = await pw.firefox.launch(headless=True)
        try:
            ctx, page = await cp1_login(browser)
            await guarded("CP2", cp2_smoke(page))

            ev = await cp4_abms(page)
            try:
                ev["Organismos"] = ("OK", await cp4_organismos(page))
            except Exception as e:
                note(traceback.format_exc())
                await shot(page, "org_error")
                ev["Organismos"] = ("FALLA", f"{type(e).__name__}: {e}")
                for k in ("CP3", "CP6", "CP4-dup", "CP4-origen"):
                    RESULTS.setdefault(k, ("FALLA", f"el flujo de Organismos se cortó: {e}"))
                await page.goto(BASE + "/dashboard/home", wait_until="networkidle")
            all_ok = all(v[0] == "OK" for v in ev.values())
            result("CP4", "OK" if all_ok else "FALLA", " | ".join(f"{k}: {v[0]} ({v[1]})" for k, v in ev.items()))

            await guarded("CP7", cp7_usuarios(page))
            await guarded("CP7b", cp7b_alta_usuario_real(page))
            sa_ok, sa_ev = await guarded("CP8", cp8_roles_sa(page)) or (False, "")

            detail_paths = []
            if LOCAL:
                SECTION[0] = "setup-local"
                local_setup()
                await guarded("CP13", cp13_etiquetas(page))
                await guarded("CP15", cp15_plantillas(page))
                await guarded("CP16", cp16_adopciones(page))
                await guarded("CP17", cp17_fichas(page))
                await guarded("CP18", cp18_puntos(page))
                await guarded("CP19", cp_estado_vacio(page))
                if LX.get("pl_id"):
                    detail_paths.append(f"/dashboard/tramites/plantillas/detalle/{LX['pl_id']}")
                if LX.get("ad_id"):
                    detail_paths.append(f"/dashboard/tramites/adopciones/detalle/{LX['ad_id']}")
                if LX.get("fi_id"):
                    detail_paths.append(f"/dashboard/tramites/fichas/detalle/{LX['fi_id']}")

            # Gating por rol contra /me (con los registros E2E todavía activos)
            role_res = {}
            for who, email in users[1:]:
                role_res[who] = await guarded("CP9", role_checks(browser, who, email, detail_paths))
            ab_r = role_res.get("AB")
            if "CP8" not in RESULTS:
                ab8 = ab_r and ab_r["cp8"]
                result("CP8", "OK" if (sa_ok and ab8 and ab8[0]) else "FALLA", f"SA: {sa_ev}; AB: {ab8[1] if ab8 else '(sin datos)'}")
            if "CP9" not in RESULTS:
                fails = {w: r["fails"] for w, r in role_res.items() if r}
                ok9 = all(r for r in role_res.values()) and not any(fails.values())
                result("CP9", "OK" if ok9 else "FALLA",
                       "; ".join(f"{w} menú={r['links']} capturas {', '.join(r['shots'])}" for w, r in role_res.items() if r)
                       + f" | inconsistencias con /me: {fails}")
            bc_bad = {w: r["bc_bad"] for w, r in role_res.items() if r and r["bc_bad"]}
            result("CP3-roles", "OK" if (role_res and all(role_res.values()) and not bc_bad) else "FALLA",
                   f"breadcrumb de cada ítem del menú y de los detalles {detail_paths} para {list(role_res)}: "
                   f"solo linkea secciones visibles ({'sin excepciones' if not bc_bad else bc_bad})")
            if "AGENT" not in role_res:
                result("CP20", "no cubierto", "no hay credenciales de un usuario AGENT (E2E_AGENT_EMAIL); no se inventan")
            else:
                r = role_res["AGENT"]
                result("CP20", "OK" if (r and not r["fails"]) else "FALLA", f"AGENT: {r and r['fails']}")

            if LOCAL:
                c14 = {w: r["cp14"] for w, r in role_res.items() if r and r["cp14"]}
                result("CP14", "OK" if (c14 and all(v[0] for v in c14.values())) else "FALLA",
                       " | ".join(f"{w}: {v[1]}" for w, v in c14.items()))
                await guarded("CP17", cp17_desactivar(page))
                await guarded("CP16", cp16_deshabilitar(page))
                await guarded("CP15", cp15_desactivar(page))
                for k in ("CP10", "CP11"):
                    result(k, "no cubierto", "target local: plantillas/fichas/puntos/etiquetas van en REAL (CP13–CP18); "
                                             "CP10/CP11 son los flujos mock de staging")
            else:
                SECTION[0] = "CP10"
                p_ok = await guarded("CP10", cp10_plantillas(page))
                f_ok = await guarded("CP10", cp10_fichas(page))
                inj = await guarded("CP11", cp10_11_inyectado(browser))
                if "CP10" not in RESULTS:
                    pts_ok, pts_ev = (inj[0], inj[1]) if inj else (False, "")
                    ok = bool(p_ok and p_ok[0] and f_ok and f_ok[0] and pts_ok)
                    result("CP10", "OK" if ok else "FALLA",
                           f"plantillas {p_ok}; fichas {f_ok}; puntos (permisos inyectados) ok={pts_ok} {pts_ev}")
                if inj and "CP11" not in RESULTS:
                    result("CP11", "OK" if inj[2] else "FALLA", f"{inj[3]} (permisos inyectados; sin errores de consola en la pantalla)")

            await guarded("CP12", cp12_ruta_vieja(page))
            await ctx.close()
        finally:
            await browser.close()
            SECTION[0] = "cleanup"
            try:
                api_cleanup_and_verify()
            except Exception as e:
                note(f"!! limpieza por API falló: {e}\n{traceback.format_exc()}")

    note("\n== Errores de consola / pageerror de la app ==")
    for c in CONSOLE:
        note("  CONSOLE " + c)
    note(f"  (total={len(CONSOLE)}; ruido de fuentes de Firefox ignorado={len(NOISE)})")

    note("\n== Requests clave (no-GET y respuestas >= 400) ==")
    for n in NET:
        if n["m"] != "GET" or n["status"] >= 400:
            note(f"  [{n['who']}:{n['sec']}] {n['m']} {n['path'].split('?')[0]} -> {n['status']}"
                 + (f" code={body_code(n['body'])}" if n["body"].startswith("{") else ""))
    note(f"  (requests a /api/ registradas en total: {len(NET)})")
    note("\n== HALLAZGOS DE BACKEND (no son fallas del front) ==")
    for h in BACKEND_FINDINGS:
        note("  - " + h)
    note(f"  (total={len(BACKEND_FINDINGS)})")
    note("\n== HALLAZGOS DE FRONT ==")
    for h in FRONT_FINDINGS:
        note("  - " + h)
    note(f"  (total={len(FRONT_FINDINGS)})")

    note("\n== Resumen ==")
    for k in sorted(RESULTS, key=lambda x: (int(re.sub(r"\D.*", "", x[2:]) or 0), x)):
        note(f"  {k}: {RESULTS[k][0]}")
    summary = ", ".join(f"{k}={v[0]}" for k, v in sorted(RESULTS.items()))

    # Resumen de residuos: lo que deja la corrida (debe no crecer).
    note(f"\n== Residuos E2E en {TARGET}: antes -> después de la corrida ==")
    residue_line = "RESIDUOS: sin datos"
    try:
        residues_after = residue_snapshot()
        if residues_before is not None:
            tb = ta = 0
            for res in RESIDUE_RESOURCES:
                (ab, ib), (aa, ia) = residues_before[res], residues_after[res]
                tb, ta = tb + ib, ta + ia
                flag = "" if (ia <= ib and aa == 0) else "   <-- CRECIÓ / quedó activo"
                note(f"  {res:<18} inactivos {ib} -> {ia} | activos {ab} -> {aa}{flag}")
            grew = ta > tb or any(residues_after[r][0] for r in RESIDUE_RESOURCES)
            residue_line = (f"RESIDUOS: inactivos E2E totales antes={tb} después={ta} (delta {ta - tb:+d}); "
                            f"activos E2E después={sum(residues_after[r][0] for r in RESIDUE_RESOURCES)} -> "
                            + ("CRECIÓ" if grew else "no creció"))
    except Exception as e:
        residue_line = f"RESIDUOS: no se pudo calcular ({e})"
    note(residue_line)
    note(f"\nFINAL_RESPONSE: target={TARGET} | {summary} | hallazgos backend={len(BACKEND_FINDINGS)} "
         f"front={len(FRONT_FINDINGS)} | {residue_line}")


if __name__ == "__main__":
    asyncio.run(main())
    sys.exit(0)
