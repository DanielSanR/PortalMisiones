---
slug: action-sheet
category: mobile
source: https://www.checklist.design/mobile/action-sheet
synced: 2026-08-11
---

# Action Sheet

> The sheet that slides up from the bottom of the screen to present options or confirmations — the mobile equivalent of a dropdown menu or modal dialog.

## Checklist

- [ ] **Heading and actions** — Similar to modals, there must be a clear heading outline the purpose of the action sheet, along with relevant actions the user can select to continue
- [ ] **Swipe or backdrop dismiss** — The sheet is dismissible by dragging it down or tapping the dimmed area behind it, along with the expected close button
- [ ] **Destructive action styling** — Any destructive option — delete, remove, block — styled in red and positioned last, separated from safe actions.
      💡 Users scan top-to-bottom and tap quickly — a destructive action buried at the bottom prevents accidental taps.
- [ ] **Cancel action** — A clearly labelled cancel/close option that dismisses the sheet without taking any action
      💡 Typically the secondary action, similar to a desktop modal
- [ ] **Snap points (if expandable)** — Defining where the action sheet expands or compresses to on resize, instead of it being free-form
      💡 A drag handle at the top of the sheet indicates the action sheet can be expanded (or dismissed)
- [ ] **Content scrollability** — Consider what stickies as you scroll so the sheet remains contextual, and that the sheet stays fixed in position on scroll
      💡 Similar to modals, it's best to avoid scrollability here unless you cannot avoid it
- [ ] **Keyboard relation** — Consider the action sheet size and responsiveness if keyboard needs to be triggered while it is active
- [ ] **Backdrop dimming** — The screen behind darkened to draw focus to the action sheet

## Relacionados

`web-app/settings` · `web-app/empty-state` · `design-system/modal`
