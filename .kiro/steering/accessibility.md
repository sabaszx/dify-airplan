---
inclusion: auto
name: accessibility
description: Apply when creating or modifying UI, dialogs, menus, or interactive controls.
---

# Accessibility (target WCAG 2.2 AA where practical)

- Keyboard: all controls reachable and operable; visible focus; dialogs trap
  focus; context menu navigates with arrows/Enter/Escape and returns focus.
- Provide accessible names/roles; use `aria-live` for save status and toasts.
- Do not rely on color alone; pair status with text/symbol (see warning levels).
- Respect reduced-motion; maintain adequate contrast and touch-target sizes.
- The canvas is not directly screen-reader navigable; provide an equivalent
  object list + inspector for keyboard/AT users (planned; document the gap).
- Note: full WCAG conformance requires manual AT testing and expert review; the
  automated checks are a floor, not proof of conformance.
