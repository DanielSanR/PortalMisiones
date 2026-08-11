---
slug: api-keys
category: web-app
source: https://www.checklist.design/web-app/api-keys
synced: 2026-08-11
---

# API Keys

> A screen where users generate and manage API keys and other developer-facing credentials needed to integrate the product programmatically.

## Checklist

- [ ] **Key list** — A table of all existing API keys showing name, creation date, last used date, and permissions
      💡 Only show the last few characters after creation for identification without risk of revealing entire key
- [ ] **Generate key** — A clear way to create a new API key, with the option to give it a name and set its scope or permissions
      💡 Unnamed keys become impossible to manage as the list grows, so requiring a name before generation is useful
- [ ] **Copy key on creation** — The full key revealed exactly once immediately after creation, with a prominent copy button
      💡 Users need to be explicitly told this is the only time the key will be shown in full, following this it will be impossible to copy again
- [ ] **Key permissions or scopes** — The ability to limit what each key can access (read-only, specific resources, or full access)
      💡 Least-privilege access is a security best practice, and when fine-grained scopes are easier to set than full-access, more users choose them
- [ ] **Revoke key** — A clear way to immediately invalidate a key, with a confirmation step before proceeding.
      💡 Revocation is instant and irreversible, so the confirmation message needs to communicate this clearly, since there is no undo
- [ ] **Documentation link** — A direct link to API documentation so developers can get started without having to search for it

## Relacionados

`mobile/account` · `web-app/settings` · `web-app/integrations`
