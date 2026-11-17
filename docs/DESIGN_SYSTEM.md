# LifeOS design system

## Direction
Use a clean, light interface with off-white backgrounds, white surfaces, and muted sage accents. Keep layouts calm, readable, responsive, and accessible.

## Tokens
Global design tokens live in frontend/src/design-system/tokens.css. Use color, typography, spacing, radius, and shadow variables instead of hardcoded repeated values. Light is the default theme; dark token values are prepared under the data-theme="dark" selector. No theme toggle is part of this ticket.

## Components
Reusable UI primitives live in frontend/src/components/ui:
- Button: primary, secondary, ghost, and icon variants
- Card: comfortable or compact padding

Component styles are in frontend/src/design-system/components.css. Layout-specific styles belong in frontend/src/styles.css. Add a shared component only when it has a clear reusable contract.

## Accessibility
Use semantic elements, visible keyboard focus, accessible labels for icon-only controls, and respect reduced-motion preferences. Maintain usable contrast and touch target sizes.

