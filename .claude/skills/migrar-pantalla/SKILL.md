---
name: migrar-pantalla
description: OBSOLETA (2026-11) - la migración del backoffice a la arquitectura de capas terminó y ya no quedan pantallas que consuman servicios o HTTP directo. No la uses para trabajo nuevo. Para crear usá nueva-feature, nueva-pantalla-lista o nuevo-formulario; para pasar un feature de mock a real, cablear-backend-real.
---

# Migrar una pantalla al facade — obsoleta

La migración terminó: ningún componente de `backoffice/src/app/pages/` inyecta `HttpClient` ni servicios de datos
(lo impide `npm run lint`: `no-restricted-imports` + `boundaries/element-types`). Se conserva esta nota como referencia.

## Si igual encontrás una pantalla fuera del patrón
1. Corré `cd backoffice && npm run check:fast` y `node scripts/check-structure.mjs --list`: la deuda conocida está en
   `scripts/check-structure.baseline.json` y en los topes `--max-warnings` de `package.json` (solo pueden bajar).
2. Lo que hoy suele quedar por alinear no es "migrar al facade" sino:
   - sesión leída en la pantalla (`AuthTokenService` en `pages/`) → exponerla desde el facade (`arquitectura-capas.md`);
   - formulario a mano → dynamic form (skill `nuevo-formulario`);
   - componente o helper suelto en la raíz de la sección → `list | form | detail | dialog | components/<pieza>` o al lado de su única pantalla (`pantallas-lista-dialogo.md`);
   - `*ngIf` / `*ngFor` → `@if` / `@for`; imports `../../` → alias; prefijo BEM de la pantalla (`scss-bem.md`).
3. Sin cambiar la UX, con spec del comportamiento, y `npm run check` en verde al terminar. Si resolviste un desvío del
   baseline: `node scripts/check-structure.mjs --prune` y bajá el tope de warnings que corresponda.
