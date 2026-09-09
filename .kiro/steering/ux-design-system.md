---
inclusion: auto
name: ux-design-system
description: Apply when creating or modifying UI components, layout, design tokens, or theming.
---

# UX design system

- Canvas-first, full-screen editor: compact header, narrow left nav rail, large
  central canvas, floating bottom tool dock, floating/dockable right inspector.
  The canvas is the dominant element.
- Use original design tokens (`src/lib/tokens.ts`): 8px spacing base, radius,
  elevation, warning levels (color + symbol), colorblind-safe heatmap palette,
  material colors (represent material type, not RF strength).
- Avoid large dashboard cards, permanent panels that shrink the canvas, and
  modals for common editing. Use dialogs only for complex/destructive workflows.
- Common actions ≤ 1–2 interactions after selecting an object.
- Support light/dark and a high-contrast heatmap option; EN/TH localization.
- Do not copy any vendor's proprietary code, assets, logos, or pixel styling.
