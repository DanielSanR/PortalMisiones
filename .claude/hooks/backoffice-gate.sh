#!/usr/bin/env bash
# Stop hook: gate autoritativo al finalizar un bloque de trabajo.
# Verifica 0 dependencias circulares (madge) y build de producción del backoffice.
# Exit 2 → re-despierta al modelo con el error para que lo corrija.
set -uo pipefail

cd "$(dirname "$0")/../../backoffice" || exit 0

# Solo correr si el backoffice tiene cambios sin commitear (evita gate en turnos no-backoffice).
if git -C . diff --quiet -- . 2>/dev/null && git -C . diff --cached --quiet -- . 2>/dev/null; then
  exit 0
fi

if ! npm run check:circular; then
  echo "Hook gate: madge detectó dependencias circulares." >&2
  exit 2
fi

if ! npx ng build; then
  echo "Hook gate: 'ng build' falló." >&2
  exit 2
fi

exit 0
