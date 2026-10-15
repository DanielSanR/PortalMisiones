"""E2E del backoffice (Angular) contra el backend ONLINE de staging, vía el dev server en :4200.

Uso (desde la raíz del repo, con `npm run start:staging` corriendo en backoffice/):
    py -3.12 e2e/final_script.py

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
import sys
import time
import traceback
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


RESIDUE_RESOURCES = ["organism", "organism-type", "category", "modality", "life-event", "recipient", "role", "permission"]


def residue_snapshot() -> dict:
    """{recurso: (activos E2E, inactivos E2E)} sobre TODO staging (cualquier corrida)."""
    token = sa_token()
    out = {}
    for res in RESIDUE_RESOURCES:
        items = e2e_items(token, res, only_this_run=False)
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
        items = e2e_items(token, res, only_this_run=False)
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
    log(f"CP2 menú lateral SA: {links}")
    shots, bad = [], []
    for label in links:
        SECTION[0] = f"CP2:{label}"
        before = len(CONSOLE)
        await go_nav(page, label)
        await page.wait_for_timeout(600)
        text = (await content(page).inner_text()).strip()
        crumbs = (await page.get_by_role("navigation", name="Ruta de navegación").inner_text()).replace("\n", " > ")
        errs = CONSOLE[before:]
        ok = len(text) > 40 and not errs  # 40: un estado vacío legítimo ('Todavía no hay categorías') ronda 70
        log(f"CP2 abrir '{label}' -> {page.url} | breadcrumb='{crumbs}' | {len(text)} chars de contenido | errores consola={len(errs)}")
        shots.append(await shot(page, "smoke_" + re.sub(r"\W+", "_", label.lower()).strip("_")))
        if not ok:
            bad.append(f"{label}: len={len(text)} errs={errs}")
    SECTION[0] = "CP2:dashboard"
    await go_nav(page, "Inicio")
    dash_ok = await page.get_by_role("heading", name="Núcleo operativo").count() > 0
    log(f"CP2 Dashboard con contenido (heading 'Núcleo operativo'): {dash_ok}")
    trams = [l for l in links if l in ("Plantillas provinciales", "Trámites del organismo", "Fichas por localidad")]
    if bad or not dash_ok:
        result("CP2", "FALLA", f"pantallas con problema: {bad}")
    else:
        result("CP2", "OK", f"{len(links)} ítems sin pantalla en blanco ni errores de consola (grupo Trámites visible: {trams}; "
                            f"'Trámites del organismo' y 'Etiquetas' no están en el menú del SA por falta de READ_ADOPTION/READ_TAG en staging — R-3). "
                            f"Capturas {shots[0]} … {shots[-1]}")


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
    SECTION[0] = "CP7"
    await go_nav(page, "Usuarios")
    await open_row_menu(page, "María González")
    items = [t.strip() for t in await page.get_by_role("menuitem").all_inner_texts()]
    log(f"CP7 menú de fila de María González (ADMIN_ORGANIZATION): {items}")
    s_menu = await shot(page, "cp7_menu_fila_usuario")
    menu_ok = all(x in items for x in ["Cambiar email", "Cambiar contraseña", "Desactivar cuenta", "Eliminar definitivamente"])
    await page.keyboard.press("Escape")
    await open_row_menu(page, "Carlos Fernández")
    sa_items = [t.strip() for t in await page.get_by_role("menuitem").all_inner_texts()]
    log(f"CP7 menú de fila de Carlos Fernández (SUPERADMIN): {sa_items} (no debe ofrecer 'Cambiar contraseña')")
    await page.keyboard.press("Escape")

    # Cambiar contraseña
    await open_row_menu(page, "María González")
    await page.get_by_role("menuitem", name="Cambiar la contraseña de María González").click()
    d = page.locator("mat-dialog-container")
    await d.wait_for()
    pw, pw2 = d.get_by_role("textbox", name="Nueva contraseña"), d.get_by_role("textbox", name="Repetir contraseña")
    msgs = []
    for value in ["abc", "abcdefgh"]:
        await pw.fill(value)
        await pw.blur()
        await page.wait_for_timeout(300)
        msgs.append((value, " / ".join(await d.locator("mat-error").all_inner_texts())))
    await pw.fill("Prueba123")
    await pw2.fill("Prueba124")
    await pw2.blur()
    await page.wait_for_timeout(300)
    mism = "Las contraseñas no coinciden" if "Las contraseñas no coinciden" in await d.inner_text() else "(sin mensaje)"
    msgs.append(("Prueba123≠Prueba124", mism + f" | Guardar habilitado={await d.get_by_role('button', name='Guardar').is_enabled()}"))
    t_before = (await pw.get_attribute("type"), await pw2.get_attribute("type"))
    await d.get_by_role("button", name=re.compile("Mostrar contraseñas")).click()
    t_after = (await pw.get_attribute("type"), await pw2.get_attribute("type"))
    await d.get_by_role("button", name=re.compile("(Ocultar|Mostrar) contraseñas")).click()
    t_back = (await pw.get_attribute("type"), await pw2.get_attribute("type"))
    log(f"CP7 cambiar contraseña: validaciones={msgs}; ojo: {t_before} -> {t_after} -> {t_back}")
    await pw2.fill("Prueba123")
    await page.wait_for_timeout(200)
    s_pw = await shot(page, "cp7_cambiar_password_valida")
    await d.get_by_role("button", name="Guardar").click()
    sb_pw = await snackbar_text(page)
    log(f"CP7 cambiar contraseña 'Prueba123' -> snackbar='{sb_pw}'")
    s_pw2 = await shot(page, "cp7_password_actualizada")
    pw_ok = ("8" in msgs[0][1] and "mayúscula" in msgs[1][1] and "no coinciden" in msgs[2][1]
             and "Guardar habilitado=False" in msgs[2][1] and t_after == ("text", "text") and t_back == ("password", "password")
             and "Contraseña actualizada" in sb_pw)
    await page.wait_for_timeout(3500)

    # Cambiar email
    await open_row_menu(page, "Juan Pérez")
    await page.get_by_role("menuitem", name="Cambiar el email de Juan Pérez").click()
    d = page.locator("mat-dialog-container")
    await d.wait_for()
    em = d.get_by_role("textbox").first
    pre = await em.input_value()
    save_disabled_initially = not await d.get_by_role("button", name="Guardar").is_enabled()
    await em.fill("no-es-un-mail")
    await em.blur()
    await page.wait_for_timeout(300)
    inval = " / ".join(await d.locator("mat-error").all_inner_texts())
    await em.fill("Nuevo.Mail@Misiones.gob.ar")
    await d.get_by_role("button", name="Guardar").click()
    sb_em = await snackbar_text(page)
    await page.wait_for_timeout(500)
    row_txt = (await row_of(page, "Juan Pérez").first.inner_text()).replace("\n", " ")
    log(f"CP7 cambiar email: precargado='{pre}', Guardar deshabilitado al abrir={save_disabled_initially}, inválido='{inval}', "
        f"snackbar='{sb_em}', fila='{row_txt}'")
    s_em = await shot(page, "cp7_email_actualizado_minusculas")
    em_ok = "Email actualizado" in sb_em and "nuevo.mail@misiones.gob.ar" in row_txt and save_disabled_initially
    ok = menu_ok and "Cambiar contraseña" not in sa_items and pw_ok and em_ok
    result("CP7", "OK" if ok else "FALLA",
           f"{s_menu} (menú {items}), {s_pw}/{s_pw2} (validaciones + ojo + '{sb_pw}'), {s_em} ('{sb_em}', fila en minúsculas). "
           f"menu_ok={menu_ok} pw_ok={pw_ok} em_ok={em_ok}")


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


async def ab_checks(browser):
    SECTION[0] = "CP8/9:AB"
    ctx, page = await new_page(browser, tag="AB")
    await login(page, AB)
    links = await nav_links(page)
    log(f"CP9 AB menú: {links}")
    s_nav = await shot(page, "cp9_ab_menu")
    nav_ok = not any(x in links for x in ["Organismos", "Tipos de Organismo", "Fichas por localidad"]) and "Roles" in links
    await go_nav(page, "Roles")
    new_r = await page.get_by_role("button", name="Nuevo rol").count()
    btns = await content(page).get_by_role("grid").get_by_role("button", name=re.compile("^(Editar|Más acciones)")).count()
    log(f"CP8 AB Roles: 'Nuevo rol'={new_r}; botones Editar/Más acciones en filas={btns}")
    s_r = await shot(page, "cp8_ab_roles_sin_acciones")
    await go_nav(page, "Permisos")
    new_p = await page.get_by_role("button", name="Nuevo permiso").count()
    btns_p = await content(page).get_by_role("grid").get_by_role("button", name=re.compile("^(Editar|Más acciones)")).count()
    log(f"CP8 AB Permisos: 'Nuevo permiso'={new_p}; botones Editar/Más acciones en filas={btns_p}")
    redirects = {}
    for path in ["/dashboard/roles/nuevo", "/dashboard/permisos/nuevo", "/dashboard/organismos/lista",
                 "/dashboard/tipos-organismo/lista", "/dashboard/tramites/fichas"]:
        await page.goto(BASE + path, wait_until="networkidle")
        await page.wait_for_timeout(600)
        redirects[path] = page.url.replace(BASE, "")
    log(f"CP8/9 AB por URL directa: {redirects}")
    s_red = await shot(page, "cp8_ab_url_directa_redirige_home")
    red_ok = all(v.endswith("/dashboard/home") for v in redirects.values())
    await ctx.close()
    cp8_ab = new_r == 0 and btns == 0 and new_p == 0 and btns_p == 0 and redirects["/dashboard/roles/nuevo"].endswith("/home")
    return cp8_ab, nav_ok and red_ok, f"{s_nav}, {s_r}, {s_red}", links


async def ao_checks(browser):
    SECTION[0] = "CP9:AO"
    ctx, page = await new_page(browser, tag="AO")
    await login(page, AO)
    links = await nav_links(page)
    log(f"CP9 AO menú: {links}")
    await go_nav(page, "Usuarios")
    new_u = await page.get_by_role("button", name="Nuevo usuario").count()
    row_btns = await content(page).get_by_role("grid").get_by_role("button", name=re.compile("^(Editar|Más acciones)")).count()
    log(f"CP9 AO Usuarios: 'Nuevo usuario'={new_u}; botones Editar/Más acciones en filas={row_btns}")
    s_u = await shot(page, "cp9_ao_usuarios_lectura")
    redirects = {}
    for path in ["/dashboard/tramites/plantillas", "/dashboard/usuarios/nuevo", "/dashboard/organismos/lista",
                 "/dashboard/roles/lista", "/dashboard/categorias/lista"]:
        await page.goto(BASE + path, wait_until="networkidle")
        await page.wait_for_timeout(600)
        redirects[path] = page.url.replace(BASE, "")
    log(f"CP9 AO por URL directa: {redirects}")
    s_red = await shot(page, "cp9_ao_url_directa_redirige_home")
    await ctx.close()
    ok = (set(links) <= {"Inicio", "Fichas por localidad", "Usuarios", "Feedback Ciudadano"} and new_u == 0 and row_btns == 0
          and all(v.endswith("/dashboard/home") for v in redirects.values()))
    return ok, f"{s_u}, {s_red}", links


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


async def guarded(name, coro):
    try:
        return await coro
    except Exception as e:
        note(f"!! {name} abortado: {type(e).__name__}: {e}")
        note(traceback.format_exc())
        if name not in RESULTS:
            result(name, "FALLA", f"excepción: {type(e).__name__}: {str(e)[:200]}")
        return None


async def main():
    note(f"E2E backoffice vs staging — corrida {RUN_DIR.name} — prefijo {PFX}; registros fijos '{FIXED_ORG}…' "
         f"(sigla {FIXED_ORG_ACR}) y '{FIXED_TIPO}…'")
    try:
        s, _ = api("GET", "/")
        check(s == 200, f"dev server respondió {s}")
    except Exception as e:
        note(f"ABORT: el dev server {BASE} no responde ({e}). Levantalo con `npm run start:staging` en backoffice/.")
        return
    try:
        residues_before = residue_snapshot()
        note(f"Residuos E2E en staging ANTES de la corrida (activos, inactivos) por recurso: {residues_before}")
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
            r = await guarded("CP8", ab_checks(browser))
            if r:
                ab8_ok, ab9_ok, ab_ev, ab_links = r
                if "CP8" not in RESULTS:
                    result("CP8", "OK" if (sa_ok and ab8_ok) else "FALLA", f"SA: {sa_ev}; AB: {ab_ev}")
            r2 = await guarded("CP9", ao_checks(browser))
            if r and r2 and "CP9" not in RESULTS:
                ao_ok, ao_ev, ao_links = r2
                result("CP9", "OK" if (ab9_ok and ao_ok) else "FALLA",
                       f"AB menú={ab_links} (sin Organismos/Tipos/Fichas; ve Plantillas porque tiene READ_PROCEDURE) ; "
                       f"AO menú={ao_links}; capturas {ab_ev}, {ao_ev}")

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
    note("\n== Resumen ==")
    for k in sorted(RESULTS, key=lambda x: (int(re.sub(r"\D.*", "", x[2:]) or 0), x)):
        note(f"  {k}: {RESULTS[k][0]}")
    summary = ", ".join(f"{k}={v[0]}" for k, v in sorted(RESULTS.items()))

    # Resumen de residuos: lo que deja la corrida en staging (debe no crecer).
    note("\n== Residuos E2E en staging: antes -> después de la corrida ==")
    residue_line = "RESIDUOS: sin datos"
    try:
        residues_after = residue_snapshot()
        if residues_before is not None:
            tb = ta = 0
            for res in RESIDUE_RESOURCES:
                (ab, ib), (aa, ia) = residues_before[res], residues_after[res]
                tb, ta = tb + ib, ta + ia
                flag = "" if (ia <= ib and aa == 0) else "   <-- CRECIÓ / quedó activo"
                note(f"  {res:<14} inactivos {ib} -> {ia} | activos {ab} -> {aa}{flag}")
            grew = ta > tb or any(residues_after[r][0] for r in RESIDUE_RESOURCES)
            residue_line = (f"RESIDUOS: inactivos E2E totales antes={tb} después={ta} (delta {ta - tb:+d}); "
                            f"activos E2E después={sum(residues_after[r][0] for r in RESIDUE_RESOURCES)} -> "
                            + ("CRECIÓ" if grew else "no creció"))
    except Exception as e:
        residue_line = f"RESIDUOS: no se pudo calcular ({e})"
    note(residue_line)
    note(f"\nFINAL_RESPONSE: {summary} | {residue_line}")


if __name__ == "__main__":
    asyncio.run(main())
    sys.exit(0)
