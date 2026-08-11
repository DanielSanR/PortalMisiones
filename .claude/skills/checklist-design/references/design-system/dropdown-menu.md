---
slug: dropdown-menu
category: design-system
source: https://www.checklist.design/design-system/dropdown-menu
synced: 2026-08-11
---

# Dropdown Menu

> A dropdown triggered from a button or right-click target to reveal a menu of actions the user can proceed with

## Checklist

- [ ] **Trigger affordance** — The element that opens the menu: an overflow icon, chevron button, or right-click target
- [ ] **Menu item anatomy** — The structure of each action: label, optional leading icon, optional trailing shortcut, optional destructive styling
      💡 Mixing icon and non-icon items in the same list throws off the scan
- [ ] **Section dividers and groups** — Dividers and/or labels that break related actions into sections once the menu gets large
- [ ] **Destructive item styling** — Visual differentiation — typically the danger colour — for actions that cannot be undone
      💡 Always place destructive actions at the end of the menu, after a divider to reduce misclicks
- [ ] **Nested submenu** — A secondary menu triggered by a parent item, used for grouping related but distinct actions
      💡 Limit nesting to one level to be too layered and confusing
- [ ] **Disabled items** — Menu items that are visible but cannot be triggered, indicating an unavailable action
      💡 A tooltip on that item that reveals the reason it is disabled is handy
- [ ] **Positioning and overflow** — The menu's placement relative to its trigger, repositioning automatically to stay within the viewport
- [ ] **Keyboard shortcut display** — Shortcut hints aligned to the trailing edge of the item label
