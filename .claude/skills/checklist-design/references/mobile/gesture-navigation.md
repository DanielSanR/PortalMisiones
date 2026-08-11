---
slug: gesture-navigation
category: mobile
source: https://www.checklist.design/mobile/gesture-navigation
synced: 2026-08-11
---

# Gesture navigation

> The touch-based interaction patterns that let users navigate and act without tapping buttons.

## Checklist

- [ ] **Swipe to go back** — The standard action to allow a user to go back without tapping a button
      💡 This can be disabled on screens where a horizontal swipe exists to not be a conflict
- [ ] **List item swipe actions** — Revealing quick actions such as delete, archive, mark as read on an item without opening it
      💡 Suitable only if there are 2-3 actions available on the item, any more may be too significant space was
- [ ] **Pull to refresh** — For scrollable content lists with a visible indicator and haptic confirmation when triggered
- [ ] **Long press menus** — Triggered by long pressing, an item reveals actions relevant to that specific element
      💡 These are utilised for quick actions, and the action should exist elsewhere in a more accessible way in the app
- [ ] **Pinch to zoom** — Image and map content supporting standard pinch-to-zoom, with zoom level reset logically on navigation away
- [ ] **Drag to reorder** — Lists or cards that can be reordered supporting long-press-to-lift and drag, with clear visual feedback during the drag state
- [ ] **Gesture hints** — A subtle animation or tooltip on first encounter with a key gesture, hinting at its existence
      💡 If it's a significant value to learn the gesture, the hint could persist until the user tries the action, so they understand it better
- [ ] **Haptic feedback** — Beneficial for key gesture moments where your finger may cover the screen and therefore it's not clear whether you have engaged with the gesture e.g. the pull-to-refresh, long press or drag actions

## Relacionados

`mobile/tab-bar-navigation` · `mobile/action-sheet`
