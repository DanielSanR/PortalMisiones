#!/usr/bin/env bash
# PostToolUse hook: validación rápida del backoffice al editar un archivo fuente Angular.
#  - tsc --noEmit para .ts/.html/.scss bajo backoffice/src (typecheck)
#  - eslint (incluye boundaries) para archivos .ts bajo core/features
# Recibe el JSON del evento por stdin. Corre async; reporta errores de tipos/capas.
set -uo pipefail

raw=$(cat)
f=$(printf '%s' "$raw" | jq -r '.tool_input.file_path // .tool_response.filePath // empty' 2>/dev/null | tr '\134' '/')

case "$f" in
  */backoffice/src/*.ts|*/backoffice/src/*.html|*/backoffice/src/*.scss) ;;
  *) exit 0 ;;
esac

cd "$(dirname "$0")/../../backoffice" || exit 0

# Ruta relativa al backoffice (para eslint sobre el archivo puntual).
rel="${f#*/backoffice/}"

status=0
npx tsc --noEmit -p tsconfig.json || status=$?

case "$rel" in
  src/app/core/features/*.ts)
    npx eslint "$rel" || status=$?
    ;;
esac

exit $status
