# Mi perfil y Preferencias — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Sumar al backoffice las pantallas **Mi perfil** (solo lectura, con lo que trae la sesión) y **Preferencias** (todo
local al navegador), y conectar cada preferencia a la pieza que gobierna.

**Architecture:** Las preferencias no tienen backend: un `PreferenciasService` (root, `BehaviorSubject` + `localStorage`)
es la única fuente, con un lector puro (`leerPreferencias`) para el código que no tiene inyección (`avisos.ts`). Cada
consumidor lee de ahí: `ListaCliente` (filas por página), `AdminLayout` (menú contraído), `avisos.ts` (duración) y una clase
en `<html>` que cambia el token `--theme-table-row-height` (densidad). Mi perfil arma su vista con una función pura sobre
`AuthTokenService.getCurrentUser$()`: no pide nada al backend.

**Tech Stack:** Angular 17 standalone, RxJS (sin signals), Angular Material, Karma + Jasmine.

**Spec:** el mockup del canvas *Kitchen sink and backoffice screens*, página *Pantallas – Backoffice Misiones*, pestañas
"Mi perfil" y "Preferencias" (https://claude.ai/artifact/9RSKqfQ52NFPdphA2aQtGV), más las decisiones de abajo.

## Decisiones (lo que el mockup no dice)
- **Mi perfil no tiene estados "Cargando" / "Sin conexión".** El mockup los muestra, pero en la app los datos ya están en
  la sesión (`/api/auth/me` corre en el login y el refresh); la pantalla no hace pedidos. Si falta un dato, se muestra el
  texto de "no informado", no un error.
- **Nombre:** el backend no lo tiene. Se usa `nombre + apellido` si existe y, si no, se arma desde el correo
  (`juan.perez@…` → "Juan Perez"), como ya hace el `AdminLayout`. Esa lógica se extrae a `core/utils/session.utils.ts`.
- **Permisos del perfil:** se agrupan a partir de los **códigos** de la sesión (`user.permissions`), sin pedir
  `/api/permission` (el usuario puede no tener `READ_PERMISSION`).
- **Preferencias no usa el dynamic form:** no hay envío; cada control aplica al instante. Es la excepción a
  `formularios-dynamic-form.md` y se justifica en la cabecera del componente. Validarlo con el agente `arquitecto-capas`
  antes de cerrar la tarea 7.
- **Mi perfil no lleva preferencias**: viven solo en su pantalla (el mockup ya se corrigió).
- **Atajos** siguen en `AtajosService` con su clave propia (`atajos_teclado`); Preferencias los lee y escribe por ahí.
- Las preferencias son **por navegador**, no por cuenta. Pedir un endpoint al backend queda fuera de este plan.

## Global Constraints
- RxJS, nunca signals. Estado con Observables + `async`; comandos con `takeUntilDestroyed` o `unaVez`.
- Componentes standalone, OnPush, `templateUrl` + `styleUrl`, `inject()`, `@if` / `@for`, alias `@core` `@shared` `@pages`.
- SCSS: BEM con prefijo por pantalla (`mi-perfil__…`, `preferencias__…`), solo tokens `var(--theme-*)`.
- Funciones sin backend: visibles con `appUnavailable="<motivo>"`, nunca `disabled` + `title`.
- Textos en español con voseo, es-AR. Copiar los textos del mockup tal cual salvo que esta guía diga otra cosa.
- `localStorage` puede no existir o tirar (modo privado): siempre en `try/catch`, y la preferencia rige igual en memoria.
- Terminado = `npm run check` en verde (en `backoffice/`), sin `eslint-disable`, sin entradas nuevas en
  `scripts/*.baseline.json`. Ícono nuevo de Phosphor → `npm run icons`.
- Commits `tipo(scope): descripción en español`, en una rama nueva (no `main`). Commit solo si el usuario lo pidió.

## Review Focus
1. **`localStorage` bloqueado o con JSON roto** → valores de fábrica, sin excepción. (Test en la tarea 1.)
2. **Un valor guardado fuera de rango** (`filasPorPagina: 37`, `densidad: 'xx'`) → se descarta ese campo y los demás se
   conservan. (Test en la tarea 1.)
3. **Aviso "Hasta que lo cierre" cuando quien llama pasa `duracion` explícita** (p. ej. `avisarExito(…, { duracion: 5000 })`)
   → también queda fijo; "Más tiempo" también duplica esa duración. (Test en la tarea 2.)
4. **Menú contraído recordado en mobile** → no se aplica: en mobile el menú es un sidenav superpuesto. (Test en la tarea 4.)
5. **Sesión sin `scope` ni organismo (backend viejo) o sin permisos** → el perfil muestra "Global" y el vacío de permisos
   ("Tu rol no tiene permisos asignados"), sin romper. (Test en la tarea 6.)

---

### Task 1: `PreferenciasService` y modelo

**Files:**
- Create: `backoffice/src/app/core/models/preferencias.model.ts`
- Create: `backoffice/src/app/core/services/preferencias.service.ts`
- Test: `backoffice/src/app/core/services/preferencias.service.spec.ts`

**Interfaces:**
- Produces:
  - `type FilasPorPagina = 10 | 20 | 50`, `type Densidad = 'comoda' | 'compacta'`, `type DuracionDeAvisos = 'normal' | 'largo' | 'fijo'`
  - `interface Preferencias { filasPorPagina: FilasPorPagina; densidad: Densidad; avisos: DuracionDeAvisos; recordarMenuContraido: boolean; menuContraido: boolean }`
  - `const PREFERENCIAS_DE_FABRICA: Preferencias = { filasPorPagina: 10, densidad: 'comoda', avisos: 'normal', recordarMenuContraido: false, menuContraido: false }`
  - `const PREFERENCIAS_STORAGE_KEY = 'preferencias_backoffice'`
  - `const CLAVE_EMAIL_RECORDADO = 'backoffice.login.email'` (se mueve desde `login.component.ts`)
  - `function leerPreferencias(storage: Storage | null | undefined): Preferencias` (puro)
  - `class PreferenciasService` (root): `preferencias$: Observable<Preferencias>`, `get actual(): Preferencias`,
    `actualizar(cambios: Partial<Preferencias>): void`, `restablecer(): void`, `esDeFabrica$: Observable<boolean>`
    (incluye atajos encendidos), `correoRecordado$: Observable<string>`, `olvidarCorreo(): void`

- [ ] **Step 1: Escribir los specs que fallan**

```ts
describe('leerPreferencias', () => {
  it('sin storage devuelve los valores de fábrica', () => expect(leerPreferencias(null)).toEqual(PREFERENCIAS_DE_FABRICA));
  it('con JSON roto devuelve los valores de fábrica', () => { /* storage fake con '{no json' */ });
  it('descarta solo el campo inválido', () => {
    // guardado: { filasPorPagina: 37, densidad: 'compacta', avisos: 'xx' }
    expect(leerPreferencias(storage)).toEqual({ ...PREFERENCIAS_DE_FABRICA, densidad: 'compacta' });
  });
});
describe('PreferenciasService', () => {
  // beforeEach/afterEach: localStorage.removeItem de PREFERENCIAS_STORAGE_KEY, ATAJOS_STORAGE_KEY y CLAVE_EMAIL_RECORDADO
  it('actualizar emite, guarda en localStorage y conserva lo demás');
  it('restablecer vuelve a fábrica y enciende los atajos (AtajosService.habilitados === true)');
  it('esDeFabrica$ es false con los atajos apagados aunque lo demás sea de fábrica');
  it('densidad compacta agrega la clase densidad-compacta a <html> y comoda la quita');
  it('olvidarCorreo borra CLAVE_EMAIL_RECORDADO y correoRecordado$ emite ""');
  it('si setItem tira, la preferencia rige igual en memoria'); // spyOn(Storage.prototype, 'setItem').and.throwError('lleno')
});
```

- [ ] **Step 2: Correr y ver que fallan** — `cd backoffice && npx ng test --watch=false --browsers=ChromeHeadless --include=src/app/core/services/preferencias.service.spec.ts` → FAIL (no existe el módulo).

- [ ] **Step 3: Implementar** el modelo y el servicio. `BehaviorSubject` inicializado con `leerPreferencias(window.localStorage)`
  (vía `DOCUMENT.defaultView`, como `AtajosService`); validación campo a campo contra los valores permitidos. La clase
  `densidad-compacta` se aplica en el constructor con `preferencias$.pipe(map(p => p.densidad), distinctUntilChanged())`
  sobre `document.documentElement.classList` (solo en browser). `correoRecordado$` es un `BehaviorSubject<string>` leído al
  crear el servicio. En `login.component.ts`, reemplazar la constante local por la importada.

- [ ] **Step 4: Correr y ver que pasan** — mismo comando → PASS. `npm run check:fast` → OK.

- [ ] **Step 5: Commit** — `feat(backoffice): servicio de preferencias locales`

---

### Task 2: Duración de los avisos

**Files:**
- Modify: `backoffice/src/app/shared/utils/avisos.ts` (función `abrir`)
- Test: `backoffice/src/app/shared/utils/avisos.spec.ts` (crear si no existe)

**Interfaces:**
- Consumes: `leerPreferencias`, `PREFERENCIAS_STORAGE_KEY`, `DuracionDeAvisos` (tarea 1)
- Produces: `function duracionSegunPreferencia(ms: number, modo: DuracionDeAvisos): number | undefined` exportada desde `avisos.ts`

- [ ] **Step 1: Specs que fallan**

```ts
it('normal deja la duración', () => expect(duracionSegunPreferencia(3000, 'normal')).toBe(3000));
it('largo la duplica', () => expect(duracionSegunPreferencia(5000, 'largo')).toBe(10000));
it('fijo no pone duración', () => expect(duracionSegunPreferencia(8000, 'fijo')).toBeUndefined());
it('avisarExito con duracion explícita y preferencia fijo abre sin duration', () => {
  localStorage.setItem(PREFERENCIAS_STORAGE_KEY, JSON.stringify({ avisos: 'fijo' }));
  avisarExito(snackBar, 'Etiqueta creada', { duracion: 5000 });
  expect(snackBar.open).toHaveBeenCalledWith('Etiqueta creada', 'OK', jasmine.objectContaining({ duration: undefined }));
});
```

- [ ] **Step 2: Correr y ver que fallan** (`--include=src/app/shared/utils/avisos.spec.ts`).
- [ ] **Step 3: Implementar.** En `abrir`, `duration: duracionSegunPreferencia(opciones.duracion ?? duracionPorDefecto, leerPreferencias(globalThis.localStorage).avisos)`. Lectura síncrona a propósito: `avisos.ts` son funciones sin inyección. Actualizar el JSDoc de cabecera.
- [ ] **Step 4: Correr y ver que pasan.**
- [ ] **Step 5: Commit** — `feat(backoffice): duración de avisos según la preferencia`

---

### Task 3: Filas por página y densidad de tablas

**Files:**
- Modify: `backoffice/src/app/shared/utils/lista-cliente.ts:140-157`
- Modify: `backoffice/src/shared-styles/_themes.scss` (junto a `--theme-table-row-height`, línea ~355)
- Test: `backoffice/src/app/shared/utils/lista-cliente.spec.ts`

**Interfaces:**
- Consumes: `PreferenciasService.actual.filasPorPagina` (tarea 1)

- [ ] **Step 1: Specs que fallan**

```ts
it('sin tamanoDePagina usa las filas por página de la preferencia', async () => {
  // PreferenciasService fake con actual.filasPorPagina = 20; fuente con 25 ítems
  expect((await firstValueFrom(lista.vista$)).pageSize).toBe(20);
  expect(vista.rows.length).toBe(20);
});
it('tamanoDePagina: null sigue sin paginar aunque haya preferencia');
```

- [ ] **Step 2: Correr y ver que fallan.**
- [ ] **Step 3: Implementar.** `ListaCliente` inyecta `PreferenciasService` (ya está en contexto de inyección, como `DestroyRef`) y usa `actual.filasPorPagina` como tamaño inicial en lugar de `10`; `config.tamanoDePagina` sigue mandando. Se lee una vez al crear la lista: un cambio de preferencia aplica a la próxima lista que se abra (decirlo en el JSDoc). En `_themes.scss`: `:root.densidad-compacta { --theme-table-row-height: 44px; }` (revisar que `_responsive.scss` no pise el valor en desktop). Los botones de fila (30 px) no cambian.
- [ ] **Step 4: Correr y ver que pasan.** `npm run check:fast` (stylelint incluido) → OK.
- [ ] **Step 5: Commit** — `feat(backoffice): filas por página y densidad de tablas desde preferencias`

---

### Task 4: Recordar el menú contraído

**Files:**
- Modify: `backoffice/src/app/shared/layouts/admin-layout/admin-layout.component.ts` (`isCollapsed`, `toggleCollapse()` l.233)
- Test: `backoffice/src/app/shared/layouts/admin-layout/admin-layout.component.spec.ts`

**Interfaces:**
- Consumes: `PreferenciasService.actual`, `actualizar({ menuContraido })` (tarea 1)

- [ ] **Step 1: Specs que fallan**

```ts
it('con recordarMenuContraido y menuContraido arranca contraído en desktop');
it('en mobile no aplica el menú contraído recordado');
it('toggleCollapse guarda menuContraido solo si recordarMenuContraido está encendido');
```

- [ ] **Step 2: Correr y ver que fallan.**
- [ ] **Step 3: Implementar.** Al iniciar (donde hoy se resuelve `isMobile`): `isCollapsed = !isMobile && p.recordarMenuContraido && p.menuContraido`. `toggleCollapse()` llama a `actualizar({ menuContraido: this.isCollapsed })` si `recordarMenuContraido`. Extraer `nombreDesdeEmail` (l.140) a `core/utils/session.utils.ts` como `nombreVisible(user: AuthUser): string` e `inicialesDe(user: AuthUser): string`, y usarlos acá (la tarea 6 los reutiliza; mover sus specs a `session.utils.spec.ts`).
- [ ] **Step 4: Correr y ver que pasan.**
- [ ] **Step 5: Commit** — `feat(backoffice): recordar el menú lateral contraído`

---

### Task 5: Grupos de permisos desde los códigos de la sesión

**Files:**
- Modify: `backoffice/src/app/shared/utils/permiso-groups.util.ts`
- Test: `backoffice/src/app/shared/utils/permiso-groups.util.spec.ts`

**Interfaces:**
- Produces: `function gruposDeCodigos(codigos: readonly string[]): PermisoGroupVM[]` — mismos grupos y etiquetas que `buildPermisoGroups` (`PERMISO_RESOURCE_LABELS` / `PERMISO_ACTION_LABELS`), todos `granted: true`, sin catálogo.

- [ ] **Step 1: Specs que fallan**

```ts
it('agrupa READ_USER y CREATE_USER en un solo grupo con dos chips', () => {
  const [g] = gruposDeCodigos(['READ_USER', 'CREATE_USER']);
  expect(g.total).toBe(2); expect(g.items.every((i) => i.granted)).toBeTrue();
});
it('un código desconocido cae en un grupo "Otros" con el código como etiqueta');
it('sin códigos devuelve []');
```

- [ ] **Step 2: Correr y ver que fallan.**
- [ ] **Step 3: Implementar** reusando el parseo `ACCION_RECURSO` que ya usa `buildPermisoGroups` (extraerlo a una función privada común si hoy está inline; no duplicarlo).
- [ ] **Step 4: Correr y ver que pasan.**
- [ ] **Step 5: Commit** — `feat(backoffice): agrupar permisos a partir de los códigos de la sesión`

---

### Task 6: Pantalla Mi perfil

**Files:**
- Create: `backoffice/src/app/pages/perfil/detail/mi-perfil-detail.component.{ts,html,scss,spec.ts}`
- Create: `backoffice/src/app/pages/perfil/detail/mi-perfil.vista.ts` (+ `mi-perfil.vista.spec.ts`)
- Create: `backoffice/src/app/pages/perfil/perfil.rutas.ts` — `export const RUTA_MI_PERFIL = '/perfil'`
- Modify: `backoffice/src/app/pages/pages.module.ts` (ruta `perfil`, `loadComponent`, `breadcrumb: ['Mi perfil']`, sin `access`: la ve cualquier sesión)
- Modify: `backoffice/src/app/shared/layouts/user-menu/user-menu.component.html:42` (quitar `appUnavailable`, `routerLink`)

**Interfaces:**
- Consumes: `AuthTokenService.getCurrentUser$()`, `nombreVisible`, `inicialesDe`, `etiquetaDeOrganismo`, `organismoDeSesion` (`core/utils/session.utils.ts`), `getUserRoleLabel()`, `gruposDeCodigos` (tarea 5)
- Produces: `function vistaDePerfil(user: AuthUser, rol: string): VistaDePerfil` con
  `{ nombre; iniciales; email; rol; alcance: 'Global' | 'Por organismo'; alcanceAyuda; organismo: string | null; grupos: PermisoGroupVM[]; totalPermisos: string }`

- [ ] **Step 1: Specs que fallan**

```ts
// mi-perfil.vista.spec.ts
it('sesión de organismo: alcance "Por organismo", ayuda "Ves y editás solo lo de tu organismo." y organismo "Nombre (SIGLA)"');
it('sin scope ni organismo (backend viejo): alcance "Global" y organismo null');
it('sin nombre en la sesión arma el nombre desde el correo');
it('sin permisos: grupos [] y totalPermisos "0 permisos"');
// mi-perfil-detail.component.spec.ts (AuthTokenService fake con BehaviorSubject)
it('muestra correo, rol y alcance; el organismo solo con sesión de organismo');
it('"Cambiar contraseña" está visible con appUnavailable, no disabled');
it('sin permisos muestra "Tu rol no tiene permisos asignados"');
```

- [ ] **Step 2: Correr y ver que fallan.**
- [ ] **Step 3: Implementar** según el mockup: `<app-membrete>` (avatar con iniciales, nombre, chip "Cuenta activa", línea con correo · rol · alcance; acción "Cambiar contraseña" con `appUnavailable="Cambiar contraseña: todavía no está disponible"`) y `.ficha-paneles` con "Datos de la cuenta" (`<dl>`, nota "¿Algún dato está mal o necesitás otro rol? Pedíselo a un administrador del backoffice: desde acá no se puede cambiar.") y "Qué podés hacer" (chips de solo lectura en `<ul>`, nota "Si te cambian el rol, lo nuevo se ve al volver a iniciar sesión."). `vista$ = getCurrentUser$().pipe(filter(Boolean), map(u => vistaDePerfil(u, rol)))`.
- [ ] **Step 4: Correr y ver que pasan.** `npm run check:fast` (incluye `check:structure`) → OK.
- [ ] **Step 5: Commit** — `feat(backoffice): pantalla Mi perfil`

---

### Task 7: Pantalla Preferencias

**Files:**
- Create: `backoffice/src/app/pages/preferencias/form/preferencias-form.component.{ts,html,scss,spec.ts}`
- Create: `backoffice/src/app/pages/preferencias/preferencias.rutas.ts` — `export const RUTA_PREFERENCIAS = '/preferencias'`
- Modify: `backoffice/src/app/pages/pages.module.ts` (ruta `preferencias`, `breadcrumb: ['Preferencias']`, sin `access`)
- Modify: `backoffice/src/app/shared/layouts/admin-layout/admin-layout.component.html:42` (botón Preferencias: quitar `appUnavailable`, `routerLink` + `routerLinkActive`)

**Interfaces:**
- Consumes: `PreferenciasService` (tarea 1), `AtajosService.habilitados$` / `setHabilitados`, `AtajosService.listar()` no (la tabla de atajos es fija: `/`, `?`, `N`, `F`)

- [ ] **Step 1: Specs que fallan** (`PreferenciasService` y `AtajosService` fakes con `BehaviorSubject`)

```ts
it('elegir 20 filas llama actualizar({ filasPorPagina: 20 })');
it('elegir Compacta llama actualizar({ densidad: "compacta" }) y la vista previa usa filas de 44 px');
it('elegir "Hasta que lo cierre" llama actualizar({ avisos: "fijo" })');
it('el interruptor de atajos llama setHabilitados(false) y atenúa la tabla de atajos');
it('con valores de fábrica "Restablecer preferencias" tiene aria-disabled="true" y no llama restablecer');
it('"Olvidar" llama olvidarCorreo y el texto pasa a "No hay ningún correo guardado"');
it('sin correo recordado no se muestra "Olvidar"');
```

- [ ] **Step 2: Correr y ver que fallan.**
- [ ] **Step 3: Implementar** según el mockup: dos columnas (Teclado + Listas y tablas | Avisos + Navegación + Este navegador + Idioma y formato). Controles de Material: `mat-slide-toggle` (interruptores), `mat-button-toggle-group` (filas por página, con `aria-label`), `mat-radio-group` (densidad y avisos, dentro de `fieldset` + `legend`). Cada cambio llama a `actualizar(...)` al momento: no hay botón Guardar. Cabecera del componente: por qué no usa `app-dynamic-form` (aplica al instante, no hay envío). Pedir validación al agente `arquitecto-capas` antes del commit. Ícono nuevo (`arrow-counter-clockwise`, `envelope-simple`, `keyboard` si faltan) → `npm run icons`.
- [ ] **Step 4: Correr y ver que pasan.** `npm run check:fast` → OK.
- [ ] **Step 5: Commit** — `feat(backoffice): pantalla Preferencias`

---

### Task 8: Cierre

- [ ] **Step 1:** `cd backoffice && npm run check` → todo en verde (typecheck, lint, estilos, estructura, madge, íconos, tests, build).
- [ ] **Step 2:** Revisión con el agente `angular-ssr-reviewer` sobre la rama; aplicar lo que encuentre.
- [ ] **Step 3:** Probar a mano en `npx ng serve` (mock): Mi perfil con un usuario global y uno de organismo; en Preferencias,
  cambiar filas (abrir Etiquetas: 20 filas), densidad (filas de 44 px), avisos "Hasta que lo cierre" (crear una etiqueta: el
  aviso queda), menú contraído (recargar), Olvidar correo (cerrar sesión: el login aparece vacío), Restablecer.
- [ ] **Step 4:** Actualizar el mapa de `CLAUDE.md` si corresponde (secciones nuevas `perfil` y `preferencias`).
