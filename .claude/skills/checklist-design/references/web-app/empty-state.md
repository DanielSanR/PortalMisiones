---
slug: empty-state
category: web-app
source: https://www.checklist.design/web-app/empty-state
synced: 2026-08-11
---

# Empty State

> The state of a screen or component when there is no data to display, whether it's because a user is new, has cleared their content, or a search returned no results.

## Checklist

- [ ] **Illustration or icon** — A visual that signals the empty state and gives the screen some personality, rather than feeling broken
      💡 Visual should be contextual e.g. empty inbox and a deleted account shouldn't be the same
- [ ] **Clear heading** — A short, plain-language title naming what's missing
      💡 'It's empty' isn't helpful while 'No projects yet' is clear
- [ ] **Supporting description** — A brief explanation of what belongs in this space, most useful for first-time users
- [ ] **Primary action** — A CTA pointing toward the next step: creating, importing, connecting etc
      💡 It should create the first item, not just link somewhere generic
- [ ] **Zero state vs. no-results state** — A distinction between a screen that is empty because nothing has been created versus one that returned no search or filter results
      💡 A no-results state without a way to reset or broaden the search is a dead end — always provide an escape route
- [ ] **Error state variant** — A separate variant for when content failed to load, as opposed to genuinely being empty
      💡 Showing an empty state when the real issue is a loading error causes users to assume they have lost their data

## Relacionados

`web-app/onboarding`
