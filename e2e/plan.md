# Task
E2E automatizado (Playwright Python, Firefox headless, viewport 1280x1800) del backoffice Angular contra el backend
ONLINE de staging (dev server :4200 `--configuration staging`, proxy a `tramitesmisiones.api.dev.stagemnes.net.ar`).
Staging es compartido: datos propios con prefijo `E2E-<timestamp>`, borrados al final y verificados por API. En
Organismos y Tipos de organismo (solo baja lógica) **no se crean registros**: se reutiliza un registro fijo
`E2E-fijo …`. Ver "Política de datos" en `README.md`.

Corrida de referencia: `final_runs/run_5/` (prefijo `E2E-1792077906`). Las capturas están en
`final_runs/run_5/screenshots/` y el log en `final_runs/run_5/final_script_log.txt`. Las otras corridas:
- `run_1` y `run_2`: corridas de ajuste. `run_2` es la evidencia del bug del borrado de usuarios (B-1).
- `run_3`: la referencia anterior, cuando todavía se creaba 1 organismo y 1 tipo por corrida.
- `run_4`: la primera corrida con registros fijos. Adoptó los residuos `E2E-1792075342 …` como fijos y no dejó
  residuos nuevos (8 -> 8). Su CP4-dup quedó en FALLA solo porque la app cambió el texto del error de "ese acrónimo" a
  "esa sigla". El comportamiento era el correcto: 409, error en el campo y ningún diálogo.

Permisos reales de staging (`GET /api/auth/me`, no los del brief): AB tiene `READ/CREATE/UPDATE_PROCEDURE`, así que **ve**
Plantillas. AO tiene `READ/CREATE/UPDATE_VARIANT` y `PUBLISH_VARIANT`, así que **ve** Fichas. Nadie tiene `*_TAG`,
`*_ADOPTION` ni `*_ATTENTION_POINT` (R-3). Las expectativas de CP9 siguen esos permisos reales.

# Critical Points
- [x] CP1: Login SA OK + `GET /api/auth/me` con `Authorization: Bearer`; password inválida → error inline.
  Evidencia: `final_execution_1_login_password_invalida.png` (alerta "La contraseña ingresada es incorrecta."),
  `final_execution_2_login_sa_home.png`; log step 2: `requests a /api/auth/me: [('GET', 'Bearer eyJhbGci…')]`.
- [x] CP2: Humo SA. Cada ítem del menú (14, incluido el grupo Trámites: Plantillas provinciales y Fichas por localidad)
  abre sin pantalla en blanco y con 0 errores de consola o `pageerror`. El Dashboard muestra "Núcleo operativo".
  Evidencia: steps 3–18, `final_execution_4_smoke_inicio.png` … `final_execution_17_smoke_feedback_ciudadano.png`, y en el log
  `(total=0; ruido de fuentes de Firefox ignorado=0)`. "Trámites del organismo" y "Etiquetas" no aparecen para el SA
  porque le faltan `READ_ADOPTION` y `READ_TAG` en staging (R-3), así que no forman parte del humo.
- [x] CP3: Breadcrumb. En el detalle del organismo fijo (`E2E-fijo Organismo r1792077906`, Activo), el clic en
  "Organismos" vuelve a `/organismos/lista`. Evidencia: steps 44–45, `final_execution_44_cp3_detalle_organismo.png`,
  `final_execution_45_cp3_breadcrumb_vuelve_a_lista.png`.
- [x] CP4: ABM real con SA. Evidencia: steps 19–46.
  - Categorías, Modalidades, Destinatarios y Eventos de vida: crear → editar → eliminar, con POST 201, PUT 200,
    DELETE 200 y snackbar. Después de cada borrado, `GET /api/<recurso>/{id}` → **404**, o sea que el borrado es
    físico y no deja residuo (steps 22, 27, 31 y 35). Capturas `final_execution_19…34_abm_*.png`. En el step 32 se ve
    la vista previa "Identificador (slug)" del evento de vida.
  - Tipos de organismo, **sin alta**: se reutiliza el registro fijo id `79e4065b…` (step 36, "fijo"). Se edita desde la
    lista: se renombra a `E2E-fijo Tipo r1792077906` y el switch "Tipo activo" pasa de false a prendido. El PUT 200
    manda `active=true` y la fila queda "Activo" con el snackbar "Tipo de organismo actualizado" (step 37,
    `final_execution_37_abm_tipos_reactivado_editado.png`). Después se elimina: DELETE 200, snackbar "Tipo de organismo
    eliminado", y la API devuelve `active=False` (step 38, `final_execution_38_abm_tipos_eliminado.png`).
  - Organismos, **sin alta**: se reutiliza el fijo id `59eb5d61…` (step 39). Se reactiva y edita (CP4-origen), y
    después se elimina: DELETE 200, snackbar "Organismo eliminado", y la API devuelve `active=False` (step 46,
    `final_execution_46_abm_organismos_eliminado.png`).
  - Nota de UI: después de la baja lógica, la lista saca la fila de la vista aunque el registro siga existiendo
    inactivo (si se recarga, aparece en "Inactivos"). No afecta los CPs.
  - [x] CP4-origen: se edita el fijo desde la lista (`/organismos/editar/59eb5d61…?origen=lista`): se renombra, sigla
    `E2EFIJO` y se prende "Organismo activo". Guardar hace PUT 200 con `active=true` y vuelve a `/organismos/lista`, con
    la fila "E2E-fijo Organismo r1792077906 (E2EFIJO) · Ministerio · Activo" y el snackbar "Organismo actualizado".
    Evidencia: step 40, `final_execution_40_abm_organismos_reactivado_editado.png`.
  - [x] CP4-dup: crear `E2E-1792077906 dup` con la sigla del fijo (`E2EFIJO`) devuelve POST **409** y no crea nada. El
    campo Sigla muestra en rojo "Ya existe un organismo con esa sigla (también cuentan los dados de baja)", el banner
    dice "No se pudo guardar · Revisá el campo marcado." y no se abre ningún diálogo modal. Evidencia: step 41,
    `final_execution_41_org_dup_acronimo_del_fijo.png`. El script acepta las dos redacciones del mensaje: "ese
    acrónimo" (run_3) y "esa sigla" (desde run_4).
- [x] CP5: con el DELETE de una modalidad E2E abortado por `page.route`, el modal de confirmación queda abierto, muestra
  "No se pudo completar la acción. Intentá de nuevo." y el botón sigue habilitado. Sin el bloqueo, el reintento hace
  DELETE 200, cierra el modal y muestra el snackbar. Evidencia: steps 25–26,
  `final_execution_25_cp5_delete_bloqueado_modalidades.png`, `final_execution_26_abm_modalidades_eliminado.png`.
- [x] CP6: con el formulario de alta de organismo modificado (el del 409), el clic en el menú abre el diálogo "Salir sin
  guardar". La URL no cambia hasta confirmar y después pasa a la lista. Evidencia: steps 42–43,
  `final_execution_42_cp6_salir_sin_guardar.png`. Desde run_4 la captura espera a que termine la animación y el
  diálogo se ve completo.
- [x] CP7: Usuarios (mock). Evidencia: steps 47–51.
  - Menú de la fila: Cambiar email, Cambiar contraseña, Desactivar cuenta y Eliminar definitivamente.
  - La fila del SUPERADMIN no ofrece "Cambiar contraseña".
  - Cambiar contraseña: "abc" da el error de 8 caracteres, "abcdefgh" pide mayúscula, minúscula y número, y dos
    contraseñas distintas dan "Las contraseñas no coinciden" con Guardar deshabilitado. El ojo cambia
    `password ↔ text`. "Prueba123" muestra el snackbar "Contraseña actualizada".
  - Cambiar email: llega precargado, Guardar arranca deshabilitado y un email inválido da "El email ingresado no es
    válido". "Nuevo.Mail@Misiones.gob.ar" muestra el snackbar "Email actualizado" y la fila queda en
    `nuevo.mail@misiones.gob.ar`.
  - Capturas: `final_execution_47_cp7_menu_fila_usuario.png`, `final_execution_50_cp7_password_actualizada.png`,
    `final_execution_51_cp7_email_actualizado_minusculas.png`.
- [ ] CP7b (extra, **no cubierto**): alta real de usuario. En `run_2` el alta funcionó (POST /api/user 201), pero
  `DELETE /api/user/{id}/admin` respondió **500**, así que no se puede garantizar la limpieza. Desde `run_3` el paso
  queda salteado por defecto y se habilita con `E2E_ALTA_USUARIO=1`. Ver el bug B-1.
- [x] CP8: Roles y Permisos (no se guarda nada). Evidencia: steps 53–59, `final_execution_54_cp8_sa_form_rol_toggle_backoffice.png`,
  `final_execution_57_cp8_ab_roles_sin_acciones.png`, `final_execution_59_cp8_ab_url_directa_redirige_home.png`.
  - SA: ve "Nuevo rol", "Nuevo permiso" y las acciones Editar y ⋮ en las filas. El formulario de rol tiene el toggle
    "Asignable por Administrador de Backoffice".
  - AB: ve las listas pero no "Nuevo rol" ni "Nuevo permiso", y las filas no tienen botones. Por URL,
    `/dashboard/roles/nuevo` y `/dashboard/permisos/nuevo` lo mandan a `/dashboard/home`.
- [x] CP9: gating por rol, según los permisos reales. Evidencia: steps 56–62, `final_execution_56_cp9_ab_menu.png`,
  `final_execution_61_cp9_ao_usuarios_lectura.png`, `final_execution_62_cp9_ao_url_directa_redirige_home.png`.
  - AB: no ve Organismos, Tipos de Organismo ni Fichas. Por URL, organismos, tipos y fichas lo mandan a Home.
  - AO: ve solo Inicio, Fichas por localidad, Usuarios y Feedback. Usuarios está en lectura: sin "Nuevo usuario" y
    sin botones en las filas. Por URL, plantillas, `usuarios/nuevo`, organismos, roles y categorías lo mandan a Home.
- [x] CP10: Trámites (mock). Evidencia: steps 63–69.
  - Plantilla E2E: el slug se autogenera como `obtener-certificado-e2e-…-de-prueba`. Al editarlo, la vista previa
    muestra "Se guardará como: obtener-cert-e2e-…". El detalle muestra ese mismo slug. Después se desactivó la
    plantilla para no dejar estado colgado.
  - Fichas: tabs "Todas" y "En revisión 2" (la segunda muestra 2 filas). El workflow de fl-3 recorre Borrador →
    En revisión → Publicado → Despublicado → Publicado, con el badge y la versión actualizados en cada paso.
  - Puntos de atención (con permisos inyectados, ver nota): el panel es visible. Latitud 95 da "Tiene que estar entre
    -90 y 90" y una longitud con 7 decimales da "Hasta 6 decimales".
  - Capturas: `final_execution_63_cp10_plantilla_form_slug.png`, `final_execution_64_cp10_plantilla_detalle.png`,
    `final_execution_66_cp10_fichas_tab_en_revision.png`, `final_execution_67_cp10_ficha_workflow_republicada.png`,
    `final_execution_69_cp10_punto_coordenadas_invalidas.png`.
- [x] CP11: Etiquetas (mock, con permisos inyectados). El slug "  Niños y Adolescentes E2E!" muestra "Se guardará como:
  ninos-y-adolescentes-e2e". Al crearla aparece con el badge Global, después se borra, y no hay errores de consola ni
  crash. Evidencia: steps 70–72, `final_execution_70_cp11_etiqueta_slug_preview.png`, `final_execution_71_cp11_etiqueta_creada.png`.
- [x] CP12: `/dashboard/tramites/lista` redirige a `/dashboard/tramites/plantillas`. Evidencia: step 73,
  `final_execution_73_cp12_ruta_vieja_redirige_plantillas.png`.
- [x] CLEANUP: `CLEANUP_SUMMARY: datos E2E activos remanentes = 0` (organismos, tipos, categorías, modalidades,
  eventos, destinatarios, roles y permisos).
- [x] RESIDUOS (no crecen): al final del log está la tabla antes -> después de los registros `E2E` por recurso.
  - run_5: organism inactivos 4 -> 4, organism-type 4 -> 4 y el resto 0 -> 0. Activos 0 -> 0 en todos.
    `RESIDUOS: inactivos E2E totales antes=8 después=8 (delta +0); activos E2E después=0 -> no creció`. run_4 dio lo
    mismo.
  - Los 4+4 inactivos son los históricos de run_1–run_3 y la exploración. Uno de cada recurso ahora es el registro
    fijo, adoptado del residuo de run_3.
  - También queda 1 usuario de `run_2` (`e2e.1792075066@example.com`, id `1fcb47e4-7231-4989-9d7c-82a72e715513`),
    inactivo y con borrado lógico (`PUT /api/user/{id}` 200), porque el borrado físico da 500. No se cuenta en la
    tabla porque `GET /api/user` responde 500 en staging.

**Nota sobre la inyección de permisos (CP10 puntos y CP11):** staging no otorga `*_TAG` ni `*_ATTENTION_POINT` a ningún
rol (R-3). Por eso, en un contexto de navegador aparte, el script intercepta `GET /api/auth/me` con `page.route` y
agrega esos 8 permisos a la respuesta. Las dos pantallas son mock en staging, así que no se toca el backend. Con esto se
prueba la UI, no el RBAC real de esas pantallas.

# No cubierto
- CP7b, el alta real de usuario: ver arriba (B-1). Se habilita con `E2E_ALTA_USUARIO=1`.
- El alta exitosa de Organismos y Tipos de organismo, salvo la primera vez, cuando no hay registro fijo ni residuo para
  adoptar. Es a propósito, para no acumular registros con baja lógica. El formulario de alta de organismo se sigue
  ejercitando con el POST 409 de CP4-dup.
- "Trámites del organismo" (adopciones): ningún usuario de staging tiene `READ_ADOPTION` (R-3). No se inyectó porque el
  brief no lo pedía.
- Error de borrado (BO-11) en los otros recursos, además de Modalidades: el componente de confirmación es compartido y
  se probó en uno.
- Guardar en el formulario de rol: está prohibido por el brief (no se tocan roles existentes).
