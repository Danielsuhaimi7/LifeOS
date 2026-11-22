# LifeOS project map

- frontend/ — React + TypeScript + Vite browser app.
- frontend/src/App.tsx — Firebase auth gate, app shell, responsive navigation, route map, and feature routes.
- frontend/src/auth/FirebaseAuthProvider.tsx — Firebase client config, Google sign-in, redirect return handling, auth state, and sign-out.
- frontend/src/auth/AuthPages.tsx — sign-in, auth loading, and Firebase setup screens.
- frontend/src/design-system/tokens.css — shared color, typography, spacing, radius, and shadow tokens.
- frontend/src/design-system/components.css — shared Button and Card styles.
- frontend/src/components/ui/ — reusable React UI primitives.
- frontend/src/styles.css — app shell, responsive layout, and task feature styles.
- backend/firestore.rules — owner-scoped rules with field validation for tasks and other model collections; review and validate before deployment.
- backend/firestore.indexes.json — composite indexes, currently empty.
- firebase.json — Hosting and Firestore CLI configuration; no project selected.
- docs/PRODUCT_BRIEF.md — product scope and constraints.
- docs/ARCHITECTURE.md — technical direction and setup.
- docs/FIREBASE_SETUP.md — local Firebase and Google sign-in setup.
- docs/FIRESTORE_DATA_MODEL.md — owner-scoped collections, field schemas, and Firestore write conventions.
- frontend/src/tasks/ — Firestore task and recurring-series repositories plus the responsive task management page.
- docs/NAVIGATION.md — desktop/mobile navigation and feature route status.
- docs/DECISIONS.md — provisional choices and open questions.
- docs/DESIGN_SYSTEM.md — UI conventions and component usage.
- docs/NAVIGATION.md — routes and responsive navigation behavior.
- AGENTS.md — repository-wide guidance.
- .codex/agents/ — LifeOS-specific role instructions.

Google Authentication and task Firestore data access exist. The task and recurring-series rules must be deployed before cloud task operations work. Calendar, Notes, Finance, and Settings remain placeholders.

