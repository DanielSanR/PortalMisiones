---
paths:
  - "backoffice/src/app/**/*.ts"
  - "backoffice/src/app/**/*.html"
---

# Textos de interfaz y errores (backoffice)

## Textos — hacé
- Español rioplatense con **voseo**: "Revisá tu conexión e intentá de nuevo", "Creá la primera", "No pudimos cargar…".
- Títulos de trámite con verbo en infinitivo ("Obtener", "Inscribirse"). Fechas DD/MM/YYYY, locale es-AR.
- Cada error dice **qué pasó y qué puede hacer la persona**. Carga fallida: "No pudimos cargar <las etiquetas>" + "Revisá tu
  conexión e intentá de nuevo."
- Confirmación destructiva: título en pregunta ("¿Eliminar la etiqueta?"), consecuencia explícita, botones "Cancelar" / "Sí, eliminar".
- Acción en curso en gerundio con `…`: "Guardando…", "Eliminando…". Éxito breve: "Etiqueta creada", "Etiqueta eliminada".
- Vacío: "Todavía no hay <etiquetas>" (invita a crear) distinto de "Sin resultados" (invita a limpiar filtros).
- Textos que se repiten en una sección: `pages/<sección>/<x>-textos.ts`.

## Errores — hacé
- **Nunca mostrar el `message` del backend.** A veces habla de otra cosa, viene en otro tono o expone detalles internos.
- Decidí por **código de negocio** (`API_CODES`, `@core/constants/api-codes.constants`), no por HTTP status ni por el texto.
- Guardado de formulario: declarar `CONFLICTOS_X: ConflictoDeCampo[]` (`code` → `control` + `mensaje`) y `FALLBACK_X` en
  `pages/<x>/<x>-save-error.ts`; aplicarlos con `aplicarErrorDeGuardado(err, form, CONFLICTOS_X, FALLBACK_X)`
  (`@core/utils/save-error.utils`): marca el campo y devuelve el texto del banner. El banner ya se titula "No se pudo guardar":
  el texto no lo repite.
- Acción sin formulario (eliminar, activar, publicar): `errorDeAccion` de la confirmación, armado con
  `errorDeAccionPorCodigo({ [API_CODES.X]: 'texto propio' })` (`@core/utils/http-error-text.utils`).
- Error no previsto: `textoDeErrorHttp(err, fallback, { contexto })` (sin conexión, 401, 403, 404, 409, 400/422, 5xx).
- Si el formulario o la confirmación muestran el error, la escritura lleva `sinDialogoGlobal()`
  (`@core/interceptors/http-error.interceptor`) en el `.http.datasource.ts`: sin eso se abre además el diálogo global.
- El **MockDataSource** falla igual que el backend: `errorDeNegocio(API_CODES.X, …)` (`@core/mocks/mock-errors`), mismo código y status.

## No hagas
- `err.error.message`, `err.message` o `err.statusText` en un template, snackbar, banner o diálogo.
- `if (err.status === 409)` para elegir un texto de negocio; números de código sueltos (`4072`) en vez de `API_CODES.X`.
- Tuteo ("revisa", "puedes"), "usted", mayúsculas sostenidas, jerga técnica ("Error 500", "request", "payload").
- Un `catchError` que traga el error y deja la pantalla en el estado vacío (indistinguible de "no hay datos").
- Dos avisos para el mismo error (banner + diálogo global).

Ejemplo canónico: `pages/etiquetas/etiqueta-save-error.ts` + `pages/etiquetas/etiqueta-dialogo.ts` (guardado),
`pages/categorias/categoria-save-error.ts` (`errorDeEliminarCategoria`, acción).
Lo verifica: specs `core/utils/save-error.utils.spec.ts`, `core/utils/http-error-text.utils.spec.ts` y
`describeDuplicadoSinDialogoGlobal` en el spec del `.http.datasource.ts`; el voseo y el texto crudo los revisa `angular-ssr-reviewer`.
