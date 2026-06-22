#!/usr/bin/env bash
# ---------------------------------------------------------------------------
# Sincroniza las subcarpetas del monorepo (GitHub) a repos SEPARADOS de GitLab.
# Mirror one-way:  GitHub (monorepo)  ──►  GitLab (repos por proyecto)
#
#   backoffice/   (Angular)        ──►  remote 'gitlab-backoffice'  (repo: frontend)
#   public/       (portal Next.js) ──►  remote 'gitlab-portal'      (repo: frontend-next)
#
# Empuja a la rama 'dev' (NO 'staging'). El merge dev → staging se hace manual en GitLab,
# así no se pisan los Dockerfile/.gitlab-ci.yml que viven solo en GitLab.
#
# Requisitos (una sola vez):
#   git remote add gitlab-backoffice <url-frontend.git>
#   git remote add gitlab-portal     <url-frontend-next.git>
#
# Uso:
#   bash scripts/sync-to-gitlab.sh                  # destino dev, origen rama local actual
#   bash scripts/sync-to-gitlab.sh dev main         # destino dev, origen rama 'main' local
# ---------------------------------------------------------------------------
set -euo pipefail

TARGET="${1:-dev}"            # rama DESTINO en GitLab
SOURCE="${2:-HEAD}"          # ref LOCAL del monorepo a partir (rama actual por defecto)

sync() {
  local prefix="$1" remote="$2"
  if ! git remote get-url "$remote" >/dev/null 2>&1; then
    echo "✗ Falta el remote '$remote'. Agregalo con: git remote add $remote <url>"
    return 1
  fi
  echo "→ Sincronizando '$prefix/' ($SOURCE)  →  $remote ($TARGET)"
  # subtree split es determinista: mismas commits → mismo SHA (idempotente).
  local sha
  sha="$(git subtree split --prefix="$prefix" "$SOURCE")"
  # --force: 'dev' es rama-espejo del folder (su historia no se relaciona con la de GitLab).
  git push --force "$remote" "$sha:refs/heads/$TARGET"
  echo "  ✓ $prefix listo (${sha:0:10})"
}

echo "== Sync monorepo → GitLab (origen: $SOURCE → destino: $TARGET) =="
sync "backoffice" "gitlab-backoffice"
sync "public"     "gitlab-portal"
echo "✓ Todo sincronizado."
