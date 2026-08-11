---
slug: map-view
category: mobile
source: https://www.checklist.design/mobile/map-view
synced: 2026-08-11
---

# Map View

> The native map screen showing location-based content, user position, and contextual overlays

## Checklist

- [ ] **Pin and marker designs** — Custom markers clearly distinguishable from each other and from the base map, sized for reliable tap accuracy on mobile
      💡 Ensure the marker design for current location is the most prominent, as all map view interactions are centred around it
- [ ] **Marker clustering (if applicable)** — How markers are shown when a group of them are so close together they cannot be shown individually, and must be grouped
- [ ] **Native map components** — Leverage either MapKit for iOS or Google Maps for Android to utilise existing foundations and layout that is time consuming to create from scratch
- [ ] **Location permission** — The point in the flow at which location permission is requested, with context explaining the level of access needed and why
      💡 Consider the UI if permissions are denied, where you can provide instructions on how to change the permission in settings
- [ ] **Current location re-centre** — A clearly visible button to re-centre the map to the user's current position without zooming or scrolling to it
- [ ] **Selected item bottom sheet** — Tapping a marker expanding a bottom sheet with details about that location — not a full-screen navigation away from the map.
- [ ] **Search or filter actions** — Search or filter controls accessible as a persistent overlay on the map or as a separate screen
      💡 Selecting filters can be on a separate screen, but when on map the applied filters should be visible for context
- [ ] **Offline handling** — When offline, cached map tiles displayed where available, with a clear indicator that the map may not be current

## Relacionados

`design-system/icon` · `design-system/button` · `mobile/search` · `flows/filtering-items`
