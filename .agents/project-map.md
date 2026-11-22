# LifeOS project map

- frontend/ — React + TypeScript + Vite browser app.
- frontend/src/App.tsx — Firebase auth gate, app shell, responsive navigation, route map, and temporary section pages.
- frontend/src/auth/FirebaseAuthProvider.tsx — Firebase client config, Google sign-in, redirect return handling, auth state, and sign-out.
- frontend/src/auth/AuthPages.tsx — sign-in, auth loading, and Firebase setup screens.
- frontend/src/design-system/tokens.css — shared color, typography, spacing, radius, and shadow tokens.
- frontend/src/design-system/components.css — shared Button and Card styles.
- frontend/src/components/ui/ — reusable React UI primitives.
- frontend/src/styles.css — app shell and responsive layout styles.
- backend/firestore.rules — prototype owner-scoped rules with field validation; review and validate before deployment.
- backend/firestore.indexes.json — composite indexes, currently empty.
- firebase.json — Hosting and Firestore CLI configuration; no project selected.
- docs/PRODUCT_BRIEF.md — product scope and constraints.
- docs/ARCHITECTURE.md — technical direction and setup.
- docs/FIREBASE_SETUP.md — local Firebase and Google sign-in setup.
- docs/FIRESTORE_DATA_MODEL.md — owner-scoped collections, field schemas, and Firestore write conventions.
- docs/DECISIONS.md — provisional choices and open questions.
- docs/DESIGN_SYSTEM.md — UI conventions and component usage.
- docs/NAVIGATION.md — routes and responsive navigation behavior.
- AGENTS.md — repository-wide guidance.
- .codex/agents/ — LifeOS-specific role instructions.

Google Authentication exists. The initial Firestore model and prototype rules exist, but frontend data access has not been implemented. Routes other than Home remain placeholders.

