# LifeOS project map

- frontend/ — React + TypeScript + Vite browser app.
- frontend/src/App.tsx — app shell, responsive navigation, route map, and temporary section pages.
- frontend/src/design-system/tokens.css — shared color, typography, spacing, radius, and shadow tokens.
- frontend/src/design-system/components.css — shared Button and Card styles.
- frontend/src/components/ui/ — reusable React UI primitives.
- frontend/src/styles.css — app shell and responsive layout styles.
- backend/firestore.rules — owner-scoped Firestore rules; review before deployment.
- backend/firestore.indexes.json — composite indexes, currently empty.
- firebase.json — Hosting and Firestore CLI configuration; no project selected.
- docs/PRODUCT_BRIEF.md — product scope and constraints.
- docs/ARCHITECTURE.md — technical direction and setup.
- docs/DECISIONS.md — provisional choices and open questions.
- docs/DESIGN_SYSTEM.md — UI conventions and component usage.
- docs/NAVIGATION.md — routes and responsive navigation behavior.
- AGENTS.md — repository-wide guidance.
- .codex/agents/ — LifeOS-specific role instructions.

Authentication and data access code do not exist yet. The routes other than Home are placeholders, not implemented features.

