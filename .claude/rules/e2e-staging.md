---
paths:
  - "e2e/**"
---

# E2E contra staging (`e2e/`)

Playwright para Python (Firefox headless) contra `ng serve --configuration staging` en `:4200` (el `/api` va por proxy a
**staging**). Un script por rol en `e2e/roles/` sobre `comun.py`. Detalle: `e2e/roles/README.md` y `QA e2e en vivo — staging.md`.

## Hacé
- Levantar antes el dev server (`cd backoffice && npm run start:staging`): el script no lo levanta.
- Correr desde la raíz: `py -3.12 e2e/roles/01_superadmin.py`. Para iterar, corrida parcial con `E2E_SOLO=<secciones>`
  (no pisa los resultados de la corrida completa).
- **Staging es compartido.** Todo lo que crea el e2e lleva la marca de muestra: nombre natural + ` · muestra <corrida>`
  (slugs `…-muestra-<corrida>`) y queda registrado en `e2e/roles/datos_muestra.json` (sin contraseñas).
- Lo creado **no se borra**: queda como dato de muestra. Por recurso se elimina o desactiva **un solo** registro, creado para
  eso (`… para baja · muestra <corrida>`).
- Credenciales **solo** en `e2e/.env` (ignorado por git; plantilla en `e2e/.env.example`). Leelas con `env(...)` de `comun.py`.
- **Máximo 2 intentos fallidos de login por cuenta** en toda la corrida: el backend bloquea la cuenta al 5.º. Si una cuenta
  no loguea, sus casos quedan `BLOQUEADO` / `NO_CUBIERTO`; no se reintenta en loop.
- Negativos por API: sobre ids inexistentes o con rechazo esperado, para no modificar nada.
- Rotular en el log cada bloque que no es "real de staging": `[permisos inyectados en /me (solo navegador), datos mock]`,
  `[token SA, solo lectura]`, `[permisos reales de /me, datos mock]`.
- Cada caso con id estable (`AB-GAT-03`), resultado (`OK` / `FALLA` / `BLOQUEADO` / `NO_CUBIERTO`) y captura del formulario.
- Un hallazgo de backend va a `hallazgos_backend[]` del resultado (método, ruta, status, body); no se "arregla" maquillando el front.

## No hagas
- Imprimir, loguear, capturar o commitear contraseñas o tokens (los requests a `auth/login`, `auth/refresh` y
  `change-password` se registran sin cuerpo). Tampoco pegarlos en un informe, un commit o el chat.
- Modificar **cuentas reales** preexistentes: ni contraseña, ni email, ni estado, ni rol, ni organismo. Solo se activan o
  desactivan los usuarios de muestra, con el token del SUPERADMIN.
- Borrar o editar datos que no tengan la marca de muestra de una corrida propia. Limpieza masiva al final.
- Usar el token del SUPERADMIN para ejecutar un caso de otro rol (solo lecturas rotuladas y activar usuarios de muestra).
- Probar contraseñas incorrectas más de una vez (un solo caso, y después verificar por API que la cuenta sigue logueando).
- Correr contra producción, o apuntar `E2E_BASE_URL` a otra cosa que el dev server local con proxy a staging.
- Dar por "probado en real" algo que corrió con datos mock: en staging siguen en mock `dashboard`, `auditoria` y `feedback`.

Ejemplo canónico: `e2e/roles/04_agent.py` (rol sin escritura: gating + negativos por API) sobre `e2e/roles/comun.py`.
Lo verifica: revisión manual de `log.txt` y `resultados.json` de la corrida; `git status` sin `e2e/.env` ni capturas con datos sensibles.
