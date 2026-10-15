# E2E del backoffice contra staging

Prueba de punta a punta automatizada con Playwright para Python (Firefox headless). Recorre el backoffice Angular contra el
backend online de staging, pasando por el proxy del dev server.

## Cómo correrlo
```bash
cd backoffice && npm run start:staging     # dev server en :4200 con proxy a staging (dejalo corriendo)
py -3.12 e2e/final_script.py               # desde la raíz del repo (requiere Playwright + Firefox instalados)
```
Cada corrida crea `e2e/final_runs/run_<n>/` con una copia del script, `screenshots/` y `final_script_log.txt`. Cada CP
deja en el log una línea `RESULT CPx: OK|FALLA|no cubierto`, y al final se escribe `FINAL_RESPONSE`. Si el dev server
no responde, el script corta sin hacer nada.

### Variables de entorno
| Variable | Default | Efecto |
|---|---|---|
| `E2E_ALTA_USUARIO=1` | apagada | Activa CP7b, el alta real de usuario. Está apagada porque en staging `DELETE /api/user/{id}/admin` responde 500 y no se puede limpiar (B-1). |

No hay variable para el ABM de Organismos y Tipos de organismo: por defecto **no crea registros** (ver "Política de
datos en staging").

## Qué cubre (detalle y evidencia en `plan.md`)
- Login: contraseña inválida con error inline, y `GET /api/auth/me` con `Bearer`.
- Humo de los 14 ítems del menú del SA, sin errores de consola.
- Breadcrumb.
- ABM real con SA:
  - Categorías, Modalidades, Destinatarios y Eventos de vida: crear, editar y eliminar, y después se verifica por API
    que el registro ya no existe (`GET /api/<recurso>/{id}` → 404, borrado físico).
  - Tipos de organismo y Organismos: sobre un registro fijo reutilizable. Se reactiva y edita desde la lista, y se
    vuelve a eliminar. Incluye volver a la lista después de editar y el acrónimo duplicado (error en el campo, sin
    diálogo global). Ver la política de datos más abajo.
- Error de borrado inline (DELETE bloqueado con `page.route`).
- Aviso de cambios sin guardar.
- Acciones de usuario (mock): cambiar contraseña con su política y el ojo, y cambiar email (queda en minúsculas).
- Roles y Permisos: SA contra AB, y el toggle "Asignable por Administrador de Backoffice".
- Gating de menú y de URL para AB y AO.
- Trámites (mock): plantillas, fichas (tabs y workflow), validación de coordenadas de puntos de atención.
- Etiquetas (mock): vista previa del slug.
- Redirección de la ruta vieja `/dashboard/tramites/lista`.

## Qué no cubre
- El alta real de usuarios (ver arriba).
- El alta exitosa de Organismos y Tipos de organismo, salvo la primera vez que no haya registro fijo ni residuo para
  adoptar. El formulario de alta de organismo se sigue ejercitando, con el POST que termina en 409 (CP4-dup). El alta
  exitosa se cubre en los cuatro recursos con borrado físico.
- Adopciones ("Trámites del organismo"): nadie tiene `READ_ADOPTION` en staging.
- Guardar roles o permisos existentes.
- Etiquetas y puntos de atención con el RBAC real: se prueban inyectando permisos en la respuesta de `/api/auth/me`,
  porque staging no los otorga (R-3).

## Política de datos en staging (entorno compartido)
- Solo se tocan datos propios con prefijo `E2E-`. Nunca se editan ni borran datos ajenos.
- **Recursos con borrado físico** (Categorías, Modalidades, Destinatarios, Eventos de vida): cada corrida crea
  registros `E2E-<timestamp> …` y los borra por la UI. Después se confirma con `GET /api/<recurso>/{id}` → 404 que
  desaparecieron, no que quedaron desactivados. Si algo falla a mitad, el bloque final de limpieza los borra por API.
- **Recursos con baja lógica** (Organismos y Tipos de organismo: `DELETE` solo pone `active:false` y no existe borrado
  físico): el script **no crea registros nuevos**. Reutiliza dos registros fijos:
  - `E2E-fijo Organismo r<ts>` (sigla `E2EFIJO`) y `E2E-fijo Tipo r<ts>`. El sufijo `r<ts>` indica la última corrida
    que los editó, y se buscan por el prefijo `E2E-fijo Organismo` / `E2E-fijo Tipo`.
  - En cada corrida se editan desde la lista: se renombran y se prende el switch "Organismo activo" / "Tipo activo",
    lo que los reactiva. Después se eliminan por la UI y vuelven a quedar inactivos.
  - Si el registro fijo todavía no existe, se **adopta** el residuo `E2E-*` inactivo más reciente de corridas viejas: se
    lo renombra al nombre fijo. Solo si no hay ninguno se crea, una única vez en la vida de staging.
  - El acrónimo duplicado (CP4-dup) se prueba intentando crear `E2E-<ts> dup` con la sigla del fijo. El backend responde
    409 y no se crea nada.
  - Si la corrida se corta con el fijo activo, la limpieza final lo da de baja por API.
- **Resumen de residuos**: al principio y al final se cuentan los registros `E2E` activos e inactivos de cada recurso
  (organismos, tipos, categorías, modalidades, eventos, destinatarios, roles y permisos). Al final del log aparece la
  tabla "antes -> después" y la línea `RESIDUOS: … -> no creció | CRECIÓ`, que también se repite en `FINAL_RESPONSE`.
- Residuos históricos que no se pueden purgar desde la API (de las corridas `run_1`–`run_3`, antes de esta política):
  3 organismos y 3 tipos `E2E-<ts>` inactivos. Además, el registro fijo de cada recurso quedó inactivo: es un residuo
  viejo adoptado, no uno nuevo. También queda 1 usuario de `run_2` con borrado lógico. Para purgarlos hay que pedírselo
  al equipo de backend o a un DBA (los ids aparecen en las líneas `CLEANUP` del log).
